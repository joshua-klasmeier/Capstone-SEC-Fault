from __future__ import annotations

import logging
import os
import uuid

import google.genai as genai
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Conversation, Message, User
from ingestion import pipeline

load_dotenv()

router = APIRouter(prefix="/chats", tags=["chats"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
logger = logging.getLogger(__name__)
DEFAULT_COMPLEXITY = "beginner"


# --------------- helpers ---------------

async def _get_or_create_user(email: str, name: str | None, db: AsyncSession) -> User:
    """Return existing user by email, or create a new one."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(email=email, name=name, response_complexity=DEFAULT_COMPLEXITY)
    db.add(user)
    await db.flush()
    return user


def _safe_complexity(value: str | None) -> str:
    return value if value in {"beginner", "expert"} else DEFAULT_COMPLEXITY


def _require_auth(request: Request) -> dict:
    """Extract user info from auth cookies; raise 401 if missing."""
    email = request.cookies.get("sec_fault_user_email")
    name = request.cookies.get("sec_fault_user_name") or email
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"email": email, "name": name}


# --------------- schemas ---------------

class NewChatRequest(BaseModel):
    title: str = "New Analysis"


class NewMsgRequest(BaseModel):
    message: str
    ticker: str | None = None
    form_type: str | None = None
    limit: int = Field(default=5, ge=1, le=10)


class ConversationOut(BaseModel):
    id: str
    title: str | None
    created_at: str


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


# --------------- routes ---------------

@router.get("")
async def list_chats(request: Request, db: AsyncSession = Depends(get_db)):
    """Return all conversations for the logged-in user, newest first."""
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)

    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.created_at.desc())
    )
    convos = result.scalars().all()

    return [
        ConversationOut(
            id=str(c.id),
            title=c.title,
            created_at=c.created_at.isoformat(),
        )
        for c in convos
    ]


@router.post("")
async def create_chat(
    req: NewChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation for the logged-in user."""
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)

    convo = Conversation(user_id=user.id, title=req.title)
    db.add(convo)
    await db.commit()
    await db.refresh(convo)

    return ConversationOut(
        id=str(convo.id),
        title=convo.title,
        created_at=convo.created_at.isoformat(),
    )


@router.get("/{chat_id}")
async def get_chat(chat_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Return a conversation and all its messages."""
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)

    convo = await db.get(Conversation, uuid.UUID(chat_id))
    if not convo or convo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.created_at.asc())
    )
    msgs = result.scalars().all()

    return {
        "conversation": ConversationOut(
            id=str(convo.id),
            title=convo.title,
            created_at=convo.created_at.isoformat(),
        ),
        "messages": [
            MessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in msgs
        ],
    }


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: str,
    req: NewMsgRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Save user message, generate Gemini reply, save and return both."""
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    response_complexity = _safe_complexity(user.response_complexity)

    convo = await db.get(Conversation, uuid.UUID(chat_id))
    if not convo or convo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = Message(
        conversation_id=convo.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)

    # Build conversation history for context
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.created_at.asc())
    )
    history = result.scalars().all()

    # Retrieve filing chunks from Qdrant.
    try:
        retrieved_chunks = await pipeline.query_filings(
            query=req.message,
            ticker=req.ticker,
            form_type=req.form_type,
            limit=req.limit,
        )
    except Exception as exc:
        logger.warning("RAG retrieval failed: %s", exc)
        retrieved_chunks = []

    retrieval_context = ""
    if retrieved_chunks:
        retrieval_context = "\n\n".join(
            [
                (
                    f"[Source {idx + 1}] "
                    f"Ticker={chunk.get('ticker', 'N/A')} | "
                    f"Form={chunk.get('form_type', 'N/A')} | "
                    f"Accession={chunk.get('accession_number', 'N/A')} | "
                    f"Section={chunk.get('section', 'N/A')}\n"
                    f"{chunk.get('text', '')}"
                )
                for idx, chunk in enumerate(retrieved_chunks)
            ]
        )
    else:
        retrieval_context = "No relevant filing excerpts were retrieved."

    # Generate Gemini reply
    if not gemini_client:
        reply_text = "Gemini API not configured. This is a placeholder response."
    else:
        try:
            # Build context from conversation history
            history_text = "\n".join(
                f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}"
                for m in history
            )
            style_instructions = (
                "Complexity preference: BEGINNER.\n"
                "- Use plain, approachable language.\n"
                "- Define any financial term before using it.\n"
                "- Prefer short paragraphs and clear takeaways.\n"
                "- Avoid dense jargon unless necessary."
            )
            if response_complexity == "expert":
                style_instructions = (
                    "Complexity preference: EXPERT.\n"
                    "- Use precise financial terminology where helpful.\n"
                    "- Provide deeper technical context and nuance.\n"
                    "- Keep explanations concise but analytically dense.\n"
                    "- Assume familiarity with core accounting/finance concepts."
                )
            prompt = f"""You are SEC Fault, an AI assistant that helps users understand SEC filings and financial reports.

Retrieved filing excerpts (highest relevance first):
{retrieval_context}

Here is the conversation so far:
{history_text}
User: {req.message}

You are speaking to a non-finance professional. Your job is to:
- Give clear, simple summaries of SEC filings (10-K, 10-Q, 8-K)
- Highlight key financial metrics like revenue, profit, debt, and growth
- Explain any major risks the company has disclosed
- Point out anything unusual or important investors should know
- Match the user's configured complexity level (beginner vs expert)
- Be concise but thorough

Preference-specific style rules:
{style_instructions}

Grounding rules:
- Prioritize facts from the retrieved excerpts.
- If the excerpts do not support a claim, say that the available filing context is insufficient.
- Do not fabricate numeric values.
- End with a short "Sources" section listing accession number and section for claims used."""

            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt,
            )
            reply_text = response.text or ""
            if not reply_text:

                try:
                    reply_text = "".join(
                        part.text
                        for candidate in response.candidates
                        for part in candidate.content.parts
                        if hasattr(part, "text") and part.text
                    )
                except Exception:
                    pass
            if not reply_text:
                reply_text = "I was unable to generate a response. Please try again."
        except Exception as e:
            logger.error("Gemini generation error: %s", e)
            reply_text = f"Error generating response: {e}"

    # Save assistant message
    assistant_msg = Message(
        conversation_id=convo.id,
        role="assistant",
        content=reply_text,
    )
    db.add(assistant_msg)

    # Auto-title conversation from first user message
    if convo.title == "New Analysis":
        convo.title = req.message[:80]

    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return {
        "user_message": MessageOut(
            id=str(user_msg.id),
            role=user_msg.role,
            content=user_msg.content,
            created_at=user_msg.created_at.isoformat(),
        ),
        "assistant_message": MessageOut(
            id=str(assistant_msg.id),
            role=assistant_msg.role,
            content=assistant_msg.content,
            created_at=assistant_msg.created_at.isoformat(),
        ),
        "retrieved_chunks": [
            {
                "ticker": c.get("ticker"),
                "form_type": c.get("form_type"),
                "accession_number": c.get("accession_number"),
                "section": c.get("section"),
                "chunk_index": c.get("chunk_index"),
            }
            for c in retrieved_chunks
        ],
        "msg_reply": reply_text,
    }


@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Delete a conversation and all its messages."""
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)

    convo = await db.get(Conversation, uuid.UUID(chat_id))
    if not convo or convo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete messages first
    result = await db.execute(
        select(Message).where(Message.conversation_id == convo.id)
    )
    for msg in result.scalars().all():
        await db.delete(msg)

    await db.delete(convo)
    await db.commit()
    return {"detail": "Conversation deleted"}
