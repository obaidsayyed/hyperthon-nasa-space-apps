import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    farms = relationship("Farm", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    token = Column(String(512), unique=True, index=True, nullable=False)
    revoked_at = Column(DateTime(timezone=True), default=utc_now)


class Farm(Base):
    __tablename__ = "farms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    region_id = Column(String(100), nullable=False, index=True)
    region_label = Column(String(255), nullable=True)
    area_ha = Column(Float, nullable=False)
    land_type = Column(String(100), nullable=False)
    crops = Column(JSON, nullable=False)
    water = Column(JSON, nullable=False)
    soil = Column(JSON, nullable=False)
    constraints = Column(JSON, nullable=False)
    boundary_geojson = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="farms")
    analysis_jobs = relationship("AnalysisJob", back_populates="farm", cascade="all, delete-orphan")
    ai_insights = relationship("AiInsightRun", back_populates="farm", cascade="all, delete-orphan")
    rotations = relationship("RotationComparison", back_populates="farm", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="farm", cascade="all, delete-orphan")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    region_id = Column(String(100), nullable=False)
    season = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="complete")  # queued, processing, complete, failed
    input_context = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    farm = relationship("Farm", back_populates="analysis_jobs")


class AiInsightRun(Base):
    __tablename__ = "ai_insight_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(String(36), nullable=True)
    summary = Column(Text, nullable=False)
    model = Column(String(100), nullable=False)
    data_quality = Column(JSON, nullable=False)
    insights = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    farm = relationship("Farm", back_populates="ai_insights")


class RotationComparison(Base):
    __tablename__ = "rotation_comparisons"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    region_id = Column(String(100), nullable=False)
    season = Column(String(100), nullable=False)
    current_rotation = Column(JSON, nullable=False)
    farm_context = Column(JSON, nullable=False)
    alternatives = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    farm = relationship("Farm", back_populates="rotations")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)  # comprehensive, crop_health, climate_risk
    status = Column(String(50), nullable=False, default="ready")  # ready, queued, failed
    download_url = Column(String(512), nullable=True)
    report_metadata = Column(JSON, nullable=True)
    file_bytes = Column(Text, nullable=True)  # base64 encoded PDF payload or storage path
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="reports")
    farm = relationship("Farm", back_populates="reports")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    language = Column(String(20), default="en")
    area_unit = Column(String(20), default="ha")
    rainfall_unit = Column(String(20), default="mm")
    temperature_unit = Column(String(20), default="celsius")
    appearance = Column(String(20), default="system")
    map_basemap = Column(String(50), default="satellite")
    map_terrain = Column(Boolean, default=True)
    map_boundaries = Column(Boolean, default=True)
    reduce_motion = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="preferences")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    level = Column(String(50), default="info")
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="notifications")


class Region(Base):
    __tablename__ = "regions"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    bounds = Column(JSON, nullable=True)
    agro_climatic_zone = Column(String(255), nullable=False)
    soil_types = Column(JSON, nullable=True)
    annual_rainfall_mm = Column(Float, nullable=False)


class MapLayer(Base):
    __tablename__ = "map_layers"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # raster, vector, terrain, tile
    url = Column(String(512), nullable=True)
    tilejson_url = Column(String(512), nullable=True)
    attribution = Column(String(512), nullable=True)
    enabled = Column(Boolean, default=True)
    layer_metadata = Column(JSON, nullable=True)
