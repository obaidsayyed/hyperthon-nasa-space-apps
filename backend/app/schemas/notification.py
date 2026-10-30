from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    message: str
    type: str = Field(..., description="info, warning, success, alert")
    read: bool
    created_at: datetime


class NotificationReadResponse(BaseModel):
    id: str
    read: bool = True
    message: str = "Notification marked as read"
