from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.schemas.rotation import RotationCompareRequest, RotationCompareResponse
from app.services.auth_service import get_current_user
from app.services.rotation_engine import evaluate_rotations_for_farm

router = APIRouter(prefix="/v1/farms", tags=["Crop Rotations"])


@router.post("/{farm_id}/rotations/compare", response_model=RotationCompareResponse)
def compare_rotations(
    farm_id: str,
    payload: Optional[RotationCompareRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compare alternative crop rotation systems against farm profile.
    Analyzes benefits, trade-offs, institutional evidence, and missing inputs.
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
            detail="Access forbidden: you do not have permission to evaluate rotations for this farm."
        )

    return evaluate_rotations_for_farm(farm, payload)
