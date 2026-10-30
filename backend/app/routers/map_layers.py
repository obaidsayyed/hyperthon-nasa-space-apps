from typing import List
from fastapi import APIRouter
from app.schemas.map_layer import MapLayerResponse
from app.services.region_service import get_map_layers

router = APIRouter(prefix="/v1/map", tags=["Map Layers"])


@router.get("/layers", response_model=List[MapLayerResponse])
def list_map_layers():
    """Retrieve metadata catalog for environmental and cadastral map layers."""
    return get_map_layers()
