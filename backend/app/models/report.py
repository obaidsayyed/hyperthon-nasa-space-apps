import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=lambda: f"rep_{uuid.uuid4().hex[:12]}")
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False, default="full_farm_advisory")
    status = Column(String(50), nullable=False, default="completed")  # queued, processing, completed, failed
    summary = Column(JSON, nullable=True, default=dict)
    file_path = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), default=utcnow, nullable=True)

    owner = relationship("User", back_populates="reports")
    farm = relationship("Farm", back_populates="reports")
