import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Farm(Base):
    __tablename__ = "farms"

    id = Column(String(36), primary_key=True, default=lambda: f"farm_{uuid.uuid4().hex[:12]}")
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    region_id = Column(String(50), nullable=False, default="nagpur")
    area_ha = Column(Float, nullable=False)
    land_type = Column(String(100), nullable=False, default="irrigated")

    # Stored canonical nested structures
    crops = Column(JSON, nullable=False, default=dict)
    water = Column(JSON, nullable=False, default=dict)
    soil = Column(JSON, nullable=False, default=dict)
    constraints = Column(JSON, nullable=False, default=list)
    boundary_geojson = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    owner = relationship("User", back_populates="farms")
    reports = relationship("Report", back_populates="farm", cascade="all, delete-orphan")
