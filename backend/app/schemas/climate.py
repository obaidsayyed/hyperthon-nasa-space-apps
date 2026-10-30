from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ClimateDataPoint(BaseModel):
    period: str = Field(..., description="Period label (e.g. 2025-06 or June 2025)")
    month_name: str
    rainfall_mm: float = Field(..., description="Observed rainfall in millimeters")
    rainfall_normal_mm: float = Field(..., description="Long-term normal rainfall benchmark")
    rainfall_anomaly_pct: float = Field(..., description="Percentage anomaly relative to normal")
    temperature_max_c: float = Field(..., description="Maximum temperature in Celsius")
    temperature_min_c: float = Field(..., description="Minimum temperature in Celsius")
    soil_moisture_index: float = Field(..., description="Topsoil volumetric moisture proxy (0-100%)")
    dry_spell_days: int = Field(..., description="Observed or recorded consecutive dry days")
    status: str = Field(..., description="Data record quality flag: observed, interpolated, or calibrated")


class ClimateSeriesResponse(BaseModel):
    farm_id: str
    region_id: str
    region_name: str
    source: str = Field(..., description="Observational data provider / methodology")
    spatial_resolution: str = Field(..., description="Grid spatial resolution (e.g. 0.10° ~ 11 km)")
    quality_status: str = Field(..., description="Quality verification status")
    time_period: str = Field(..., description="Period covered by time series")
    units: Dict[str, str] = Field(
        ...,
        description="Units map: rainfall -> mm, temperature -> °C, moisture -> %, dry_spell_days -> days"
    )
    seasonal_summary: Dict[str, Any] = Field(..., description="Summary by Kharif/Rabi/Summer seasons")
    series: List[ClimateDataPoint]
