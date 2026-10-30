from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class RotationCandidateInput(BaseModel):
    name: Optional[str] = None
    crop_sequence: List[str] = Field(..., description="Ordered sequence of crops across seasons")
    target_seasons: Optional[List[str]] = Field(default_factory=list)


class RotationCompareRequest(BaseModel):
    current_rotation: Optional[List[str]] = Field(
        default=None,
        description="Optional override of farm's current crop rotation sequence"
    )
    candidates: Optional[List[RotationCandidateInput]] = Field(
        default=None,
        description="Optional user-provided candidate rotation sequences to evaluate"
    )


class RotationOption(BaseModel):
    rotation_id: str
    name: str = Field(..., description="Descriptive title of the rotation pattern")
    sequence: List[str] = Field(..., description="Crops in temporal sequence")
    duration_months: int
    suitability_for_farm: str = Field(..., description="High, Medium, or Conditional")
    benefits: List[str] = Field(..., description="Key agronomic and ecological advantages")
    trade_offs: List[str] = Field(..., description="Operational, financial, or climatic risks")
    soil_health_impact: str = Field(..., description="Impact on nitrogen balance, organic matter, microbial life")
    water_demand_m3_ha: float = Field(..., description="Estimated seasonal water requirement")
    water_stress_resilience: str = Field(..., description="Resilience rating: High, Moderate, Low")
    estimated_margin_inr_ha: float = Field(..., description="Projected net operating return range")
    evidence: List[str] = Field(..., description="Institutional research, field trial citations")
    missing_inputs: List[str] = Field(default_factory=list, description="Missing farm parameters that would refine this evaluation")


class RotationCompareResponse(BaseModel):
    farm_id: str
    region_id: str
    baseline_rotation: List[str]
    evaluation_context: Dict[str, Any]
    comparison: List[RotationOption]
