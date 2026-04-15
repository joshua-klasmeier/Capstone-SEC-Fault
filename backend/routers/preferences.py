from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User

router = APIRouter(prefix="/preferences", tags=["preferences"])

ALLOWED_COMPLEXITIES = {"beginner", "expert"}
DEFAULT_COMPLEXITY = "beginner"


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


class PreferenceUpdateRequest(BaseModel):
    response_complexity: str


@router.get("/me")
async def get_my_preferences(request: Request, db: AsyncSession = Depends(get_db)):
    auth = _require_auth(request)
    user = await _get_or_create_user(auth["email"], auth["name"], db)
    return {"response_complexity": _safe_complexity(user.response_complexity)}


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
