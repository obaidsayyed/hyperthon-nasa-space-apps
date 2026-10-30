from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


class CropsConfig(BaseModel):
    kharif: Optional[str] = Field(default=None, description="Kharif season crop (e.g. Cotton, Soybean)")
    rabi: Optional[str] = Field(default=None, description="Rabi season crop (e.g. Gram, Wheat)")
    previous_crop: Optional[str] = Field(default=None, description="Previous season harvested crop")
    sowing_season: Optional[str] = Field(default=None, description="Target or current sowing season")


class WaterConfig(BaseModel):
    source: str = Field(..., description="Primary water source (e.g. Borewell, Canal, Rainfed, Well)")
    reliability: str = Field(..., description="Water availability/reliability (e.g. High, Medium, Seasonal, Low)")


class SoilConfig(BaseModel):
    texture: str = Field(..., description="Soil texture (e.g. Deep Black Vertisol, Medium Black, Sandy Loam)")
    test_status: str = Field(..., description="Soil testing status (e.g. Tested, Pending, Untested)")


class FarmBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Farm profile name")
    region_id: str = Field(..., description="Region identifier (e.g. nagpur or wardha)")
    area_ha: float = Field(..., gt=0, description="Farm area in hectares (must be positive)")
    land_type: str = Field(..., description="Land type classification (e.g. Irrigated, Rainfed, Semi-irrigated)")
    crops: CropsConfig = Field(default_factory=CropsConfig)
    water: WaterConfig
    soil: SoilConfig
    constraints: List[str] = Field(default_factory=list, description="Operational or agronomic constraints")
    boundary_geojson: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Nullable GeoJSON FeatureCollection in EPSG:4326"
    )

    @field_validator("boundary_geojson")
    @classmethod
    def validate_boundary(cls, v):
        if v is None:
            return None
        if not isinstance(v, dict):
            raise ValueError("boundary_geojson must be a GeoJSON object or null")
        if "type" in v and v["type"] not in ["FeatureCollection", "Feature", "Polygon", "MultiPolygon"]:
            raise ValueError("boundary_geojson must be a valid GeoJSON object")
        return v


class FarmCreate(FarmBase):
    pass


class FarmUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    region_id: Optional[str] = None
    area_ha: Optional[float] = Field(default=None, gt=0)
    land_type: Optional[str] = None
    crops: Optional[CropsConfig] = None
    water: Optional[WaterConfig] = None
    soil: Optional[SoilConfig] = None
    constraints: Optional[List[str]] = None
    boundary_geojson: Optional[Dict[str, Any]] = None


class FarmResponse(FarmBase):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Opaque server-owned unique farm identifier")
    user_id: str
    created_at: datetime
    updated_at: datetime
