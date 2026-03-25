import os
import google.genai as genai

from authlib.integrations.starlette_client import OAuth
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request

from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from db.database import init_db
from routers.ingestion import router as ingestion_router


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    await init_db()
    yield

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback"
)

# When frontend and backend live on different domains (production),
# cookies must use SameSite=None + Secure so the browser sends them
# on cross-origin fetch requests with credentials: "include".
IS_PROD = FRONTEND_URL.startswith("https://")
COOKIE_SAMESITE: str = "none" if IS_PROD else "lax"
COOKIE_SECURE: bool = IS_PROD

app = FastAPI(title="SEC Fault API", lifespan=lifespan)

app.include_router(ingestion_router)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", "dev-session-secret-change-me"),
)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

@app.get("/auth/login")
async def login(request: Request):
    """
    Begin Google OAuth login by redirecting the user to Google's
    consent screen. The user will be sent back to /auth/callback.
    """
    return await oauth.google.authorize_redirect(request, GOOGLE_REDIRECT_URI)


@app.get("/auth/callback")
async def auth_callback(request: Request):
    """
    Handle the Google OAuth callback, retrieve the user's profile,
    and then redirect back to the frontend. For now we only set a
    minimal HttpOnly cookie; future work can persist users and
    enforce auth on API routes.
    """
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo") or {}

    response = RedirectResponse(url=FRONTEND_URL)

    # Store user display name and email in HttpOnly cookies so the
    # browser can prove it completed Google sign-in without exposing
    # tokens to JavaScript.
    email = user_info.get("email")
    display_name = (
        user_info.get("name")
        or user_info.get("given_name")
        or email
    )

    if display_name:
        response.set_cookie(
            key="sec_fault_user_name",
            value=display_name,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
        )

    if email:
        response.set_cookie(
            key="sec_fault_user_email",
            value=email,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
        )

    return response


@app.get("/auth/me")
def auth_me(request: Request):
    """
    Return basic information about the currently authenticated user
    based on the cookies set during Google sign-in.
    """
    email = request.cookies.get("sec_fault_user_email")
    name = request.cookies.get("sec_fault_user_name") or email

    if not name and not email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {"user": {"name": name, "email": email}}


@app.post("/auth/logout")
def auth_logout(response: Response):
    """
    Log out the current user by clearing auth cookies.
    """
    response = Response(status_code=204)
    response.delete_cookie(
        key="sec_fault_user_name",
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        key="sec_fault_user_email",
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return response

# NEED TO UPDATE AFTER PARSING IS COMPLETED
class QueryRequest(BaseModel):
    query: str
    filing_data: str = ""  # Optional: SEC filing content to analyze

class NewChatRequest(BaseModel):
    name: str

class NewMsgRequest(BaseModel):
    message: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chats")
def newChat(req: NewChatRequest):
    return {"chat_info": "This is a placeholder response from SEC Fault API."}

@app.get("/chats/{id}")
def getChat(id: int):
    return {"chat_and_msg_info": "This is a placeholder response from SEC Fault API."}

@app.post("/api/analyze")
async def analyze_query(req: QueryRequest):
    """
    Analyze SEC filing data using Gemini AI
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API not configured")
    
    try:
        prompt = f"""
        You are an expert financial analyst. Analyze the following SEC filing data and answer the user's query in plain English.
        
        User Query: {req.query}
        
        SEC Filing Data: {req.filing_data}
        
        Please provide:
        1. A clear, concise answer to the user's query
        2. Key financial insights from the filing
        3. Any important risks or opportunities mentioned
        
        Keep your response accessible to non-finance professionals.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        return {
            "response": response.text,
            "query": req.query
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@app.post("/chats/{id}/messages")
def msg(id: int, req: NewMsgRequest):
    """
    Handle chat messages - integrate with Gemini for responses
    """
    if not GEMINI_API_KEY:
        return {"msg_reply": "Gemini API not configured. This is a placeholder response."}
    
    try:
        prompt = f"""
        You are SEC Fault, an AI assistant that helps users understand SEC filings and financial reports.
        
        User message: {req.message}
        
        Provide a helpful response about SEC filings, financial analysis, or direct the user to search for specific company filings.
        """
        
        print(f"SENDING TO GEMINI:")
        print(f"User message: {req.message}")
        print("=" * 50)
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        print(f"GEMINI RESPONSE:")
        print(f"Response: {response.text}")
        print("=" * 50)
        
        return {"msg_reply": response.text}
    
    except Exception as e:
        error_msg = f"Error generating response: {str(e)}"
        print(f"GEMINI ERROR: {error_msg}")
        return {"msg_reply": error_msg}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
