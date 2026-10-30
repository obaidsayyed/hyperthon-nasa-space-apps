from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.region import RegionResponse
from app.services.region_service import search_regions, get_region_by_id

router = APIRouter(prefix="/v1/regions", tags=["Regions"])


@router.get("/search", response_model=List[RegionResponse])
def search_regions_endpoint(q: Optional[str] = Query(None, description="Search term for district or agro zone")):
    """Top-bar search endpoint to query supported agricultural regions."""
    return search_regions(q)


@router.get("/{region_id}", response_model=RegionResponse)
def get_region_details(region_id: str):
    """Retrieve detailed agro-climatic profile for a specific region (e.g. nagpur, wardha)."""
    region = get_region_by_id(region_id)
    if not region:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Region '{region_id}' is not in the supported catalogue."
        )
    return region
