from typing import Optional
from pydantic import BaseModel


class MapLayerResponse(BaseModel):
    id: str
    name: str
    category: str
    description: str
    crs: str
    url_template: Optional[str] = None
    opacity: float = 0.8
    attribution: str
