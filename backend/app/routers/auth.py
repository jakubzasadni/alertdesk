from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_password, create_access_token, get_current_user
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse

router = APIRouter()


@router.get("/config")
async def get_public_config():
    return {
        "keycloak_url": settings.keycloak_url,
        "keycloak_realm": settings.keycloak_realm,
        "keycloak_client_id": settings.keycloak_client_id,
        "source_primary_label": settings.source_primary_label,
        "source_secondary_label": settings.source_secondary_label,
        "secondary_source_enabled": bool(settings.secondary_alertmanager_url),
    }


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token, display_name=user.display_name)


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "display_name": current_user.display_name}
