from __future__ import annotations

import asyncio
import logging
import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from db.database import get_db
from db.models import User, UserVideoPreference
from routers import conversations as chat_router
from video.pipeline import (
    VideoPipelineError,
    run_video_generation_pipeline_inline,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["video"])
DEFAULT_COMPLEXITY = "beginner"
DEFAULT_VIDEO_ASSETS = {
    "beginner": {
        "background": "backend/public/Sec_file_static_image.png",
        "neutral": "backend/public/neutral_peter_avatar.png",
        "happy": "backend/public/positive_peter_avatar.png",
        "sad": "backend/public/concerned_peter_avatar.png",
    },
    "expert": {
        "background": "backend/public/Sec_file_static_image.png",
        "neutral": "backend/public/neutral_peter_avatar.png",
        "happy": "backend/public/positive_peter_avatar.png",
        "sad": "backend/public/concerned_peter_avatar.png",
    },
}

# ---------------------------------------------------------------------------
# In-memory job store (single-process; fine for Render single-instance deploy)
# ---------------------------------------------------------------------------
_jobs: dict[str, dict] = {}


class VideoGenerateRequest(BaseModel):
    # Required narration text (from assistant response in chat)
    script_text: str

    # Media settings
    background_image_path: str | None = None
    avatar_image_path: str | None = None
    enable_dynamic_avatar: bool = False
    neutral_avatar_image_path: str | None = None
    positive_avatar_image_path: str | None = None
    concerned_avatar_image_path: str | None = None
    output_name: str | None = None

    # Coqui TTS settings
    tts_model_name: str = "tts_models/en/ljspeech/tacotron2-DDC"
    tts_provider: str = "auto"
    tts_voice: str = "en-US-GuyNeural"


class VideoScriptRequest(BaseModel):
    message: str
    ticker: str | None = None
    form_type: str | None = None
    limit: int = Field(default=8, ge=1, le=12)


def _require_auth(request: Request) -> dict:
    email = request.cookies.get("sec_fault_user_email")
    name = request.cookies.get("sec_fault_user_name") or email
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"email": email, "name": name}


async def _get_or_create_user(email: str, name: str | None, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(email=email, name=name, response_complexity=DEFAULT_COMPLEXITY)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _safe_complexity(value: str | None) -> str:
    return value if value in {"beginner", "expert"} else DEFAULT_COMPLEXITY


async def _get_user_video_preference(
    user_id, db: AsyncSession
) -> UserVideoPreference | None:
    result = await db.execute(
        select(UserVideoPreference).where(UserVideoPreference.user_id == user_id)
    )
    return result.scalar_one_or_none()


def _resolve_effective_assets(
    req: VideoGenerateRequest,
    response_complexity: str,
    pref: UserVideoPreference | None,
) -> tuple[str, str, str, str]:
    defaults = DEFAULT_VIDEO_ASSETS.get(
        response_complexity, DEFAULT_VIDEO_ASSETS["beginner"]
    )

    # Assets are now managed through Preferences.
    background = (pref.background_image_path if pref else None) or defaults["background"]
    neutral = (pref.neutral_avatar_image_path if pref else None) or defaults["neutral"]
    happy = (pref.happy_avatar_image_path if pref else None) or defaults["happy"]
    sad = (pref.sad_avatar_image_path if pref else None) or defaults["sad"]

    return str(background), str(neutral), str(happy), str(sad)


def _cleanup_temp_video_dir(temp_dir: str) -> None:
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


async def _run_job(job_id: str, req: VideoGenerateRequest) -> None:
    """Background coroutine that runs the pipeline and updates job state."""
    try:
        result = await run_video_generation_pipeline_inline(
            script_text=req.script_text.strip(),
            background_image_path=req.background_image_path,
            avatar_image_path=req.avatar_image_path,
            enable_dynamic_avatar=req.enable_dynamic_avatar,
            neutral_avatar_image_path=req.neutral_avatar_image_path,
            positive_avatar_image_path=req.positive_avatar_image_path,
            concerned_avatar_image_path=req.concerned_avatar_image_path,
            output_name=req.output_name,
            tts_model_name=req.tts_model_name,
            tts_provider=req.tts_provider,
            tts_voice=req.tts_voice,
        )
        _jobs[job_id].update(
            status="completed",
            video_file=result["video_file"],
            temp_dir=result["temp_dir"],
            duration_seconds=result.get("duration_seconds"),
        )
    except VideoPipelineError as exc:
        logger.warning("Video job %s failed (pipeline): %s", job_id, exc)
        _jobs[job_id].update(status="failed", error=str(exc))
    except Exception as exc:
        logger.exception("Video job %s failed (unexpected): %s", job_id, exc)
        _jobs[job_id].update(status="failed", error=f"Video generation failed: {exc}")


@router.post("/generate-script")
async def generate_video_script(
    req: VideoScriptRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generate a video-ready narration script grounded in SEC filing retrieval."""
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message must not be empty")

    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    response_complexity = _safe_complexity(user.response_complexity)
    user_video_pref = await _get_user_video_preference(user.id, db)

    scope_ticker, scope_form_type, scope_inferred = await chat_router._resolve_retrieval_scope(
        message=message,
        db=db,
        req_ticker=req.ticker,
        req_form_type=req.form_type,
    )

    try:
        retrieved_chunks = await chat_router._retrieve_chunks_with_fallback(
            message=message,
            ticker=scope_ticker,
            form_type=scope_form_type,
            limit=req.limit,
        )
    except Exception as exc:
        logger.warning("Video script retrieval failed: %s", exc)
        retrieved_chunks = []

    if scope_ticker:
        retrieved_chunks = [
            c
            for c in retrieved_chunks
            if str(c.get("ticker") or "").upper() == scope_ticker
        ]
    if scope_form_type:
        retrieved_chunks = [
            c
            for c in retrieved_chunks
            if chat_router._normalize_form_type(str(c.get("form_type") or ""))
            == scope_form_type
        ]

    retrieval_context = chat_router._build_retrieval_context(retrieved_chunks)

    if not chat_router.gemini_client:
        script_text = "Gemini API not configured."
    else:
        style_instructions = (
            "Complexity preference: BEGINNER. Use plain language and short sentences."
        )
        if response_complexity == "expert":
            style_instructions = (
                "Complexity preference: EXPERT. Use precise finance terms and deeper analytical framing."
            )

        prompt = f"""You are SEC Fault's video script writer.

Filing context for grounding (internal use only; do not mention this context directly):
{retrieval_context}

User request:
{message}

Avatar persona context:
{(user_video_pref.avatar_intro if user_video_pref and user_video_pref.avatar_intro else 'No custom avatar introduction provided.')}

Task:
- Write a concise narration script for a finance explainer video in the avatar persona provided above..
- Produce a single script body only (no headings, no markdown, no bullet points).
- Keep it natural for text-to-speech and around 90-180 words unless the user asks otherwise.
- Prioritize facts from the filing context, but don't feel pressured to use them if they are not relevant.
- Do not mention retrieved excerpts, context, or system instructions.
- Do not include a Sources section.
- Each video should start with the avatar introducing themself and an engaging topic sentence before going into the details.
- Each video should have an engaging concluding sentence.
- The script should be written as if the avatar is talking to the user as described by their personality, but it should not take away from the more important finance explanations.

Style:
{style_instructions}
"""

        try:
            response = chat_router.gemini_client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt,
            )
            script_text = response.text or ""
            if not script_text:
                try:
                    script_text = "".join(
                        part.text
                        for candidate in response.candidates
                        for part in candidate.content.parts
                        if hasattr(part, "text") and part.text
                    )
                except Exception:
                    pass
            if not script_text:
                script_text = "I was unable to generate a script. Please try again."
        except Exception as exc:
            logger.error("Video script generation error: %s", exc)
            script_text = f"Error generating script: {exc}"

    # Strip accidental sources/footer text if model emits it.
    script_text = re.split(r"(?im)^\*{0,2}sources\*{0,2}:?\s*$", script_text.strip())[0].strip()

    return {
        "script": script_text,
        "retrieval_scope": {
            "ticker": scope_ticker,
            "form_type": scope_form_type,
            "inferred": scope_inferred,
        },
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
    }


@router.post("/generate")
async def generate_video(
    req: VideoGenerateRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    """Accept a video generation request and return a job ID immediately."""
    script_text = req.script_text.strip()
    if not script_text:
        raise HTTPException(status_code=400, detail="script_text must not be empty")

    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    response_complexity = _safe_complexity(user.response_complexity)
    user_video_pref = await _get_user_video_preference(user.id, db)

    background, neutral, happy, sad = _resolve_effective_assets(
        req=req,
        response_complexity=response_complexity,
        pref=user_video_pref,
    )

    req.background_image_path = background
    req.avatar_image_path = neutral
    req.neutral_avatar_image_path = neutral
    req.positive_avatar_image_path = happy
    req.concerned_avatar_image_path = sad

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {
        "status": "processing",
        "response_complexity": response_complexity,
    }

    asyncio.create_task(_run_job(job_id, req))

    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll this endpoint to check whether a video job has finished."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    resp: dict = {"job_id": job_id, "status": job["status"]}
    if job["status"] == "failed":
        resp["error"] = job.get("error", "Unknown error")
    if job["status"] == "completed":
        resp["duration_seconds"] = job.get("duration_seconds")
    return resp


@router.get("/jobs/{job_id}/download")
async def download_job_video(job_id: str):
    """Download the finished video. Cleans up temp files after sending."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=409, detail="Video is not ready yet")

    video_file = Path(job["video_file"])
    temp_dir = job.get("temp_dir", "")

    if not video_file.exists():
        raise HTTPException(status_code=410, detail="Video file has been cleaned up")

    def _cleanup() -> None:
        _cleanup_temp_video_dir(temp_dir)
        _jobs.pop(job_id, None)

    return FileResponse(
        path=str(video_file),
        media_type="video/mp4",
        filename=video_file.name,
        background=BackgroundTask(_cleanup),
    )
