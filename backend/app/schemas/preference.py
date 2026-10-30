from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class PreferenceBase(BaseModel):
    theme: str = Field(default="system", description="light, dark, system")
    language: str = Field(default="en", description="en, mr, hi")
    email_alerts: bool = Field(default=True)
    sms_alerts: bool = Field(default=False)
    units_system: str = Field(default="metric", description="metric or imperial")


class PreferenceUpdate(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    email_alerts: Optional[bool] = None
    sms_alerts: Optional[bool] = None
    units_system: Optional[str] = None


class PreferenceResponse(PreferenceBase):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    updated_at: datetime
