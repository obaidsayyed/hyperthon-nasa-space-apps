from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(36), primary_key=True)
    token_jti = Column(String(255), unique=True, index=True, nullable=False)
    revoked_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
