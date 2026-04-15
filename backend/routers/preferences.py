from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User, UserVideoPreference

router = APIRouter(prefix="/preferences", tags=["preferences"])

ALLOWED_COMPLEXITIES = {"beginner", "expert"}
DEFAULT_COMPLEXITY = "beginner"
BACKEND_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = BACKEND_ROOT / "public"
USER_UPLOADS_DIR = PUBLIC_DIR / "user_uploads"
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def _delete_file(path: str | None) -> None:
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        pass


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
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user


def _safe_complexity(value: str | None) -> str:
    if value in ALLOWED_COMPLEXITIES:
        return value
    return DEFAULT_COMPLEXITY


async def _get_or_create_video_preference(
    user_id, db: AsyncSession
) -> UserVideoPreference:
    result = await db.execute(
        select(UserVideoPreference).where(UserVideoPreference.user_id == user_id)
    )
    pref = result.scalar_one_or_none()
    if pref:
        return pref

    pref = UserVideoPreference(user_id=user_id)
    db.add(pref)
    await db.flush()
    await db.commit()
    await db.refresh(pref)
    return pref


def _save_upload_file(upload: UploadFile, user_id, slot_name: str) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: .png, .jpg, .jpeg, .webp",
        )

    user_dir = USER_UPLOADS_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    for existing_path in user_dir.glob(f"{slot_name}.*"):
        existing_path.unlink(missing_ok=True)

    dest_path = user_dir / f"{slot_name}{suffix}"

    with dest_path.open("wb") as f:
        shutil.copyfileobj(upload.file, f)

    return str(dest_path).replace("\\", "/")


def _path_to_upload_url(path: str | None, user_id) -> str | None:
    """Convert an absolute filesystem path to a /user-uploads/ URL."""
    if not path:
        return None
    return f"/user-uploads/{user_id}/{Path(path).name}"


def _video_pref_response(pref: UserVideoPreference) -> dict:
    uid = pref.user_id
    return {
        "avatar_intro": pref.avatar_intro or "",
        "neutral_avatar_url": _path_to_upload_url(pref.neutral_avatar_image_path, uid),
        "happy_avatar_url": _path_to_upload_url(pref.happy_avatar_image_path, uid),
        "sad_avatar_url": _path_to_upload_url(pref.sad_avatar_image_path, uid),
        "background_url": _path_to_upload_url(pref.background_image_path, uid),
    }


class PreferenceUpdateRequest(BaseModel):
    response_complexity: str


def _coerce_delete_flag(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


@router.get("/me")
async def get_my_preferences(request: Request, db: AsyncSession = Depends(get_db)):
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    video_pref = await _get_or_create_video_preference(user.id, db)

    return {
        "response_complexity": _safe_complexity(user.response_complexity),
        "video_preferences": _video_pref_response(video_pref),
    }


@router.put("/me")
async def update_my_preferences(
    req: PreferenceUpdateRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    complexity = (req.response_complexity or "").strip().lower()
    if complexity not in ALLOWED_COMPLEXITIES:
        raise HTTPException(
            status_code=400, detail="response_complexity must be 'beginner' or 'expert'"
        )

    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    user.response_complexity = complexity
    await db.commit()

    return {"response_complexity": _safe_complexity(user.response_complexity)}


@router.post("/me/video-assets")
async def upload_video_assets(
    request: Request,
    db: AsyncSession = Depends(get_db),
    avatar_intro: str | None = Form(default=None),
    delete_neutral_avatar: str | None = Form(default=None),
    delete_happy_avatar: str | None = Form(default=None),
    delete_sad_avatar: str | None = Form(default=None),
    delete_background_image: str | None = Form(default=None),
    neutral_avatar: UploadFile | None = File(default=None),
    happy_avatar: UploadFile | None = File(default=None),
    sad_avatar: UploadFile | None = File(default=None),
    background_image: UploadFile | None = File(default=None),
):
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    pref = await _get_or_create_video_preference(user.id, db)

    if avatar_intro is not None:
        pref.avatar_intro = avatar_intro.strip()

    if _coerce_delete_flag(delete_neutral_avatar):
        _delete_file(pref.neutral_avatar_image_path)
        pref.neutral_avatar_image_path = None
    if _coerce_delete_flag(delete_happy_avatar):
        _delete_file(pref.happy_avatar_image_path)
        pref.happy_avatar_image_path = None
    if _coerce_delete_flag(delete_sad_avatar):
        _delete_file(pref.sad_avatar_image_path)
        pref.sad_avatar_image_path = None
    if _coerce_delete_flag(delete_background_image):
        _delete_file(pref.background_image_path)
        pref.background_image_path = None

    if neutral_avatar is not None:
        pref.neutral_avatar_image_path = _save_upload_file(
            neutral_avatar, user.id, "neutral_avatar"
        )
    if happy_avatar is not None:
        pref.happy_avatar_image_path = _save_upload_file(
            happy_avatar, user.id, "happy_avatar"
        )
    if sad_avatar is not None:
        pref.sad_avatar_image_path = _save_upload_file(
            sad_avatar, user.id, "sad_avatar"
        )
    if background_image is not None:
        pref.background_image_path = _save_upload_file(
            background_image, user.id, "background_image"
        )

    await db.commit()

    return _video_pref_response(pref)


_SLOT_TO_FIELD = {
    "neutral_avatar": "neutral_avatar_image_path",
    "happy_avatar": "happy_avatar_image_path",
    "sad_avatar": "sad_avatar_image_path",
    "background_image": "background_image_path",
}


@router.delete("/me/video-assets/{slot}")
async def delete_video_asset(
    slot: str, request: Request, db: AsyncSession = Depends(get_db)
):
    if slot not in _SLOT_TO_FIELD:
        raise HTTPException(status_code=400, detail=f"Unknown slot '{slot}'")

    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    pref = await _get_or_create_video_preference(user.id, db)

    field = _SLOT_TO_FIELD[slot]
    current_path = getattr(pref, field)
    if current_path:
        _delete_file(current_path)
        setattr(pref, field, None)
        await db.commit()

    return _video_pref_response(pref)

# Why is the deployment not up to date