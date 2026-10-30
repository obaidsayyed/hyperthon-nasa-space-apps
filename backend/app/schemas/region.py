from typing import List
from pydantic import BaseModel


class RegionResponse(BaseModel):
    id: str
    name: str
    state: str
    agro_climatic_zone: str
    soil_types: List[str]
    major_crops: List[str]
    center_lat: float
    center_lon: float
    average_annual_rainfall_mm: float
