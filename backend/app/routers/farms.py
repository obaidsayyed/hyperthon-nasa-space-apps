from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.schemas.farm import FarmCreate, FarmUpdate, FarmResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/v1/farms", tags=["Farms"])


@router.get("", response_model=List[FarmResponse])
def list_farms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all farm profiles owned by the authenticated user."""
    farms = db.query(Farm).filter(Farm.user_id == current_user.id).order_by(Farm.created_at.desc()).all()
    return [FarmResponse.model_validate(f) for f in farms]


@router.post("", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(
    payload: FarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register a new farm profile. Generates a server-owned opaque ID
    and preserves all canonical farm fields (crops, water, soil, constraints, boundary).
    """
    farm = Farm(
        user_id=current_user.id,
        name=payload.name,
        region_id=payload.region_id.lower().strip(),
        area_ha=payload.area_ha,
        land_type=payload.land_type,
        crops=payload.crops.model_dump(),
        water=payload.water.model_dump(),
        soil=payload.soil.model_dump(),
        constraints=payload.constraints,
        boundary_geojson=payload.boundary_geojson
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return FarmResponse.model_validate(farm)


@router.get("/{farm_id}", response_model=FarmResponse)
def get_farm(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve single farm profile. Enforces authenticated ownership:
    returns 404/403 if the farm does not belong to the user.
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
            detail="Access forbidden: you do not have permission to view this farm."
        )

    return FarmResponse.model_validate(farm)


@router.patch("/{farm_id}", response_model=FarmResponse)
def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Partially update an existing farm profile.
    Only updates fields supplied in request payload.
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
            detail="Access forbidden: you do not have permission to update this farm."
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        farm.name = update_data["name"]
    if "region_id" in update_data and update_data["region_id"] is not None:
        farm.region_id = update_data["region_id"].lower().strip()
    if "area_ha" in update_data and update_data["area_ha"] is not None:
        farm.area_ha = update_data["area_ha"]
    if "land_type" in update_data and update_data["land_type"] is not None:
        farm.land_type = update_data["land_type"]
    if "crops" in update_data and update_data["crops"] is not None:
        farm.crops = update_data["crops"]
    if "water" in update_data and update_data["water"] is not None:
        farm.water = update_data["water"]
    if "soil" in update_data and update_data["soil"] is not None:
        farm.soil = update_data["soil"]
    if "constraints" in update_data and update_data["constraints"] is not None:
        farm.constraints = update_data["constraints"]
    if "boundary_geojson" in update_data:
        farm.boundary_geojson = update_data["boundary_geojson"]

    db.commit()
    db.refresh(farm)
    return FarmResponse.model_validate(farm)


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a farm profile owned by the authenticated user."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile with id '{farm_id}' was not found."
        )

    if farm.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to delete this farm."
        )

    db.delete(farm)
    db.commit()
    return None
