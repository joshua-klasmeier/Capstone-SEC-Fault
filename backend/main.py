import os

from authlib.integrations.starlette_client import OAuth
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback"
)

app = FastAPI(title="SEC Fault API")

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


class ChatRequest(BaseModel):
    message: str


oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
def chat(req: ChatRequest):
    return {"reply": "This is a placeholder response from SEC Fault API."}


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
            secure=FRONTEND_URL.startswith("https://"),
            samesite="lax",
        )

    if email:
        response.set_cookie(
            key="sec_fault_user_email",
            value=email,
            httponly=True,
            secure=FRONTEND_URL.startswith("https://"),
            samesite="lax",
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
        samesite="lax",
    )
    response.delete_cookie(
        key="sec_fault_user_email",
        samesite="lax",
    )
    return response
