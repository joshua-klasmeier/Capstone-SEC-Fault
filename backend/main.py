import os
import logging

from authlib.integrations.starlette_client import OAuth
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request

from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from db.database import init_db
from routers.ingestion import router as ingestion_router
from routers.conversations import router as conversations_router


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    await init_db()
    yield


def _parse_origins(raw_origins: str | None) -> list[str]:
    if not raw_origins:
        return ["http://localhost:3000"]
    origins = [origin.strip().rstrip("/") for origin in raw_origins.split(",")]
    return [origin for origin in origins if origin]


FRONTEND_ORIGINS = _parse_origins(os.getenv("FRONTEND_URL"))
FRONTEND_URL = FRONTEND_ORIGINS[0]
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", f"{FRONTEND_URL}/api/backend/auth/callback"
)

# When frontend and backend live on different domains (production),
# cookies must use SameSite=None + Secure so the browser sends them
# on cross-origin fetch requests with credentials: "include".
IS_PROD = any(origin.startswith("https://") for origin in FRONTEND_ORIGINS)
COOKIE_SAMESITE: str = "none" if IS_PROD else "lax"
COOKIE_SECURE: bool = IS_PROD

app = FastAPI(title="SEC Fault API", lifespan=lifespan)

app.include_router(ingestion_router)
app.include_router(conversations_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", "dev-session-secret-change-me"),
    same_site=COOKIE_SAMESITE,
    https_only=COOKIE_SECURE,
)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def _cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
    }

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
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as exc:
        # Most common causes are state mismatch/session cookie issues or
        # redirect URI misconfiguration in Google Cloud OAuth settings.
        error_text = str(exc).lower()
        error_name = exc.__class__.__name__.lower()
        error_args = " ".join(str(arg) for arg in getattr(exc, "args", ())).lower()
        error_blob = " ".join([error_name, error_text, error_args])
        error_code = "oauth_callback_failed"
        if (
            "mismatching_state" in error_blob
            or "state" in error_blob
            or "csrf" in error_blob
        ):
            error_code = "oauth_state_mismatch"
        elif "invalid_client" in error_blob:
            error_code = "oauth_invalid_client"
        elif "redirect_uri" in error_blob:
            error_code = "oauth_redirect_uri_mismatch"
        elif "timeout" in error_blob or "timed out" in error_blob:
            error_code = "oauth_provider_timeout"

        logger.exception(
            "Google OAuth callback failed (%s). type=%s path=%s has_session_cookie=%s",
            error_code,
            exc.__class__.__name__,
            request.url.path,
            "session" in request.cookies,
        )
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error={error_code}")

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
            **_cookie_kwargs(),
        )

    if email:
        response.set_cookie(
            key="sec_fault_user_email",
            value=email,
            **_cookie_kwargs(),
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
        path="/",
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        key="sec_fault_user_email",
        path="/",
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return response

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
