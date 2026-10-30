from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class InsightQuestionRequest(BaseModel):
    region_id: Optional[str] = Field(default=None, description="Region id (e.g. nagpur or wardha)")
    season: Optional[str] = Field(default=None, description="Season (e.g. Kharif, Rabi, Summer)")
    questions: Optional[List[str]] = Field(default_factory=list, description="Requested analysis questions")


class InsightItem(BaseModel):
    id: str = Field(..., description="Unique insight identifier")
    title: str = Field(..., description="Concise summary title of insight")
    category: str = Field(..., description="Category: agronomy, water_budget, soil_health, or climate_risk")
    severity: str = Field(..., description="Severity level: info, advisory, warning, or critical")
    description: str = Field(..., description="Detailed agronomic analysis based on farm inputs")
    impact: str = Field(..., description="Quantified or qualitative field impact")


class EvidenceItem(BaseModel):
    source: str = Field(..., description="Verified institutional source (e.g. ICAR-CICR, PDKV Akola, IMD)")
    finding: str = Field(..., description="Specific finding or agronomic benchmark referenced")
    verified: bool = Field(default=True, description="Whether benchmark is verified from institutional data")
    spatial_scope: str = Field(..., description="Regional spatial applicability")


class ActionItem(BaseModel):
    priority: str = Field(..., description="Priority: high, medium, or low")
    action: str = Field(..., description="Specific operational or agronomic step")
    timeline: str = Field(..., description="Recommended timing window (e.g. Pre-monsoon, 15-30 DAS)")
    expected_outcome: str = Field(..., description="Targeted outcome or risk mitigation")


class DataQualityInfo(BaseModel):
    completeness_score: int = Field(..., ge=0, le=100, description="Input data completeness percentage")
    status: str = Field(..., description="Status: verified_complete, verified_partial, or preliminary")
    missing_inputs: List[str] = Field(default_factory=list, description="Missing user or field measurements")
    confidence_level: str = Field(..., description="Confidence: high, moderate, or conditional")


class AIInsightsResponse(BaseModel):
    summary: str = Field(..., description="Comprehensive agronomic synthesis")
    insights: List[InsightItem] = Field(..., description="Structured findings")
    evidence: List[EvidenceItem] = Field(..., description="Verified citation and baseline evidence")
    actions: List[ActionItem] = Field(..., description="Prioritized recommendations")
    limitations: List[str] = Field(..., description="Explicit model and data limitations")
    data_quality: DataQualityInfo = Field(..., description="Data quality evaluation")
    generated_at: str = Field(..., description="ISO 8601 generation timestamp")
