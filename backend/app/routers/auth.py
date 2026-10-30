from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.revoked_token import RevokedToken
from app.schemas.auth import (
    LoginRequest,
    UserResponse,
    TokenResponse,
    LogoutResponse,
)
from app.services.auth_service import (
    verify_password,
    create_access_token,
    decode_access_token,
    get_current_user,
    security
)

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user credentials and issue signed JWT access token.
    Compatible with JSON payload containing email and password.
    """
    email_clean = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    expires_in_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in_seconds,
        user=UserResponse.model_validate(user)
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Invalidate the current session by recording the token's JTI in revoked tokens.
    """
    if auth_header and auth_header.credentials:
        try:
            payload = decode_access_token(auth_header.credentials)
            jti = payload.get("jti")
            if jti:
                revoked = RevokedToken(id=jti, token_jti=jti)
                db.add(revoked)
                db.commit()
        except Exception:
            pass

    return LogoutResponse(message="Logged out successfully. Token session revoked.")


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Retrieve the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
