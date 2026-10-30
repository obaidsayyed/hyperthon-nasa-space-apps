from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ReportCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, description="Custom report title")
    report_type: str = Field(default="full_farm_advisory", description="Type of report: full_farm_advisory, climate_risk, crop_rotation")


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique report ID")
    farm_id: str
    user_id: str
    title: str
    report_type: str
    status: str = Field(..., description="queued, processing, completed, failed")
    summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    download_url: str = Field(..., description="Path to download the generated report PDF")
