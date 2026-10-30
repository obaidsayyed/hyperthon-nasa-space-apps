import datetime
from typing import Optional
import jwt
from passlib.context import CryptContext
from fastapi import Depends, Header
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, RevokedToken
from app.core.errors import AuthenticationError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    # Use sha256 pre-hash or direct bcrypt
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, email: str, expires_delta: Optional[datetime.timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.datetime.now(datetime.timezone.utc),
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid authentication token.")


def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise AuthenticationError("Missing Authorization header with Bearer token.")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError("Invalid Authorization header format. Expected 'Bearer <token>'.")
    return parts[1]


def get_current_user(
    token: str = Depends(get_token_from_header),
    db: Session = Depends(get_db),
) -> User:
    # Check if token has been revoked (e.g. via logout)
    revoked = db.query(RevokedToken).filter(RevokedToken.token == token).first()
    if revoked:
        raise AuthenticationError("Token has been revoked. Please sign in again.")

    payload = decode_access_token(token)
    user_id: str = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Token contains invalid user identifier.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AuthenticationError("User associated with this token no longer exists.")

    return user
