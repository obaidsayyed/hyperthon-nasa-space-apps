from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, EmailStr, model_validator


# Common Envelope
class Envelope(BaseModel):
    data: Any
    request_id: Optional[str] = None


# Health
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    services: Dict[str, str] = Field(default_factory=lambda: {
        "database": "healthy",
        "climate_engine": "healthy",
        "ai_engine": "healthy",
        "pdf_engine": "healthy"
    })
    timestamp: str


# Auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserDto(BaseModel):
    id: str
    email: str
    name: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token: str  # Contract supports both access_token and token
    token_type: str = "bearer"
    user: UserDto


class MessageResponse(BaseModel):
    message: str


# Regions
class RegionDto(BaseModel):
    id: str
    name: str
    state: str
    district: str
    latitude: float
    longitude: float
    bounds: Optional[Dict[str, Any]] = None
    agro_climatic_zone: str
    soil_types: Optional[List[str]] = None
    annual_rainfall_mm: float

    class Config:
        from_attributes = True


# Farm Payload Components
class CropsDto(BaseModel):
    kharif: Optional[str] = None
    rabi: Optional[str] = None
    previous_crop: Optional[str] = None
    sowing_season: Optional[str] = None


class WaterDto(BaseModel):
    source: Optional[str] = None
    reliability: Optional[str] = None


class SoilDto(BaseModel):
    texture: Optional[str] = None
    test_status: Optional[str] = None


class FarmPayload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    region_id: str
    area_ha: float = Field(gt=0, description="Area in hectares, must be positive number")
    land_type: str
    crops: CropsDto
    water: WaterDto
    soil: SoilDto
    constraints: List[str] = Field(default_factory=list)
    boundary_geojson: Optional[Dict[str, Any]] = None


class FarmUpdatePayload(BaseModel):
    name: Optional[str] = None
    region_id: Optional[str] = None
    area_ha: Optional[float] = Field(default=None, gt=0)
    land_type: Optional[str] = None
    crops: Optional[CropsDto] = None
    water: Optional[WaterDto] = None
    soil: Optional[SoilDto] = None
    constraints: Optional[List[str]] = None
    boundary_geojson: Optional[Dict[str, Any]] = None


class FarmDto(BaseModel):
    id: str
    name: str
    region_id: str
    region_label: Optional[str] = None
    area_ha: float
    land_type: str
    crops: CropsDto
    water: WaterDto
    soil: SoilDto
    constraints: List[str]
    boundary_geojson: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# Boundary
class BoundaryPayload(BaseModel):
    type: str
    features: Optional[List[Dict[str, Any]]] = None
    coordinates: Optional[Any] = None
    geometry: Optional[Dict[str, Any]] = None


# Climate
class ClimateObservation(BaseModel):
    label: str
    period_start: str
    period_end: str
    value: Optional[float] = None
    unit: str
    source: str
    quality: str
    spatial_resolution: Optional[str] = None


class ClimateSeriesResponse(BaseModel):
    region_id: str
    farm_id: str
    metric: str
    aggregation: str
    unit: str
    source_notes: List[str]
    generated_at: str
    observations: List[ClimateObservation]


class ClimateSummaryResponse(BaseModel):
    farm_id: str
    region_id: str
    season: Optional[str] = None
    period: str
    metrics: Dict[str, Any]
    source_notes: List[str]
    quality_assessment: str
    generated_at: str


# Analysis Jobs
class AnalysisRequest(BaseModel):
    region_id: Optional[str] = None
    season: Optional[str] = None
    farm_context: Optional[Dict[str, Any]] = None
    boundary_geojson: Optional[Dict[str, Any]] = None


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str  # queued, processing, complete, failed
    created_at: str
    result: Optional[Dict[str, Any]] = None


# AI Insights
class AiInsightEvidence(BaseModel):
    label: str
    value: Any
    source: str
    period: Optional[str] = None


class AiInsightItem(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    severity: str  # info, watch, caution, advisory
    confidence: float  # 0 to 1 fraction
    evidence: List[AiInsightEvidence]
    actions: List[str]
    limitations: List[str]


class DataQualityDto(BaseModel):
    status: str  # verified, partial, unverified
    missing_inputs: List[str]
    sources: List[str]


class AiInsightsResponse(BaseModel):
    farm_id: str
    analysis_id: Optional[str] = None
    summary: str
    generated_at: str
    model: str
    data_quality: DataQualityDto
    insights: List[AiInsightItem]


class AiInsightRequest(BaseModel):
    region_id: Optional[str] = None
    season: Optional[str] = None
    questions: Optional[List[str]] = None


# Crop Rotation
class RotationCompareRequest(BaseModel):
    region_id: str
    season: str
    current_rotation: Dict[str, Any]
    farm_context: Dict[str, Any]


class RotationAlternative(BaseModel):
    id: str
    name: str
    crop_sequence: Dict[str, str]
    metrics: Dict[str, Any]
    benefits: List[str]
    trade_offs: List[str]
    constraints: List[str]
    evidence: List[Dict[str, Any]]
    confidence: float


class RotationCompareResponse(BaseModel):
    farm_id: str
    region_id: str
    season: str
    current_rotation: Dict[str, Any]
    alternatives: List[RotationAlternative]
    generated_at: str


# Reports
class ReportCreateRequest(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = "comprehensive"


class ReportDto(BaseModel):
    id: str
    farm_id: Optional[str] = None
    title: str
    type: str
    status: str  # ready, queued, failed
    created_at: str
    download_url: Optional[str] = None


# Preferences
class UserPreferenceDto(BaseModel):
    language: str = "en"
    area_unit: str = "ha"
    rainfall_unit: str = "mm"
    temperature_unit: str = "celsius"
    appearance: str = "system"
    map_basemap: str = "satellite"
    map_terrain: bool = True
    map_boundaries: bool = True
    reduce_motion: bool = False

    class Config:
        from_attributes = True


class UserPreferenceUpdate(BaseModel):
    language: Optional[str] = None
    area_unit: Optional[str] = None
    rainfall_unit: Optional[str] = None
    temperature_unit: Optional[str] = None
    appearance: Optional[str] = None
    map_basemap: Optional[str] = None
    map_terrain: Optional[bool] = None
    map_boundaries: Optional[bool] = None
    reduce_motion: Optional[bool] = None


# Notifications
class NotificationDto(BaseModel):
    id: str
    title: str
    message: str
    created_at: str
    read_at: Optional[str] = None
    level: Optional[str] = "info"

    class Config:
        from_attributes = True


# Map Layers
class MapLayerDto(BaseModel):
    id: str
    name: str
    type: str
    url: Optional[str] = None
    tilejson_url: Optional[str] = None
    attribution: Optional[str] = None
    enabled: Optional[bool] = True
    metadata: Optional[Dict[str, Any]] = None
