from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.schemas.climate import ClimateSeriesResponse
from app.services.auth_service import get_current_user
from app.services.climate_service import get_climate_series_for_farm

router = APIRouter(prefix="/v1/farms", tags=["Climate"])


@router.get("/{farm_id}/climate/series", response_model=ClimateSeriesResponse)
def get_climate_series(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve calibrated agro-climatic environmental observation time series for farm.
    Includes units, time periods, source attribution, spatial resolution, and quality status.
    """
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile with id '{farm_id}' was not found."
        )

    if farm.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to view climate data for this farm."
        )

    return get_climate_series_for_farm(farm)
