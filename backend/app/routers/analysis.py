import datetime
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, AnalysisJob
from app.schemas import AnalysisRequest, AnalysisResponse
from app.core.security import get_current_user
from app.core.errors import NotFoundError
from app.routers.farms import _get_verified_farm
from app.services.climate_engine import get_climate_summary

router = APIRouter(prefix="/v1/farms", tags=["Analysis"])


@router.post("/{farm_id}/analysis", response_model=AnalysisResponse, status_code=status.HTTP_200_OK)
def create_farm_analysis(
    farm_id: str,
    payload: AnalysisRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit an agronomic and climate analysis job for the farm."""
    farm = _get_verified_farm(farm_id, current_user, db)
    now = datetime.datetime.now(datetime.timezone.utc)
    region_id = payload.region_id or farm.region_id
    season = payload.season or f"Kharif {now.year}"

    # Compute analysis result
    clim_summary = get_climate_summary(region_id, farm.id, season)

    result_data = {
        "farm_id": farm.id,
        "region_id": region_id,
        "season": season,
        "climate_metrics": clim_summary.metrics,
        "soil_suitability": {
            "texture": farm.soil.get("texture") if farm.soil else "Clay loam",
            "drainage_risk": "Moderate waterlogging in heavy vertisols during peak monsoon",
            "recommended_in_situ_practice": "Broad bed and furrow (BBF) land configuration",
        },
        "water_balance": {
            "kharif_balance": "Positive water surplus during July-August",
            "rabi_balance": "Deficit expected by mid-December, supplementary irrigation required",
        },
    }

    job = AnalysisJob(
        farm_id=farm.id,
        user_id=current_user.id,
        region_id=region_id,
        season=season,
        status="complete",
        input_context=payload.model_dump(),
        result=result_data,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return AnalysisResponse(
        analysis_id=job.id,
        status=job.status,
        created_at=job.created_at.isoformat(),
        result=job.result,
    )


@router.get("/{farm_id}/analysis/{analysis_id}", response_model=AnalysisResponse)
def get_farm_analysis(
    farm_id: str,
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the status and results of a submitted analysis job."""
    farm = _get_verified_farm(farm_id, current_user, db)
    job = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.id == analysis_id, AnalysisJob.farm_id == farm.id)
        .first()
    )
    if not job:
        raise NotFoundError(f"Analysis job '{analysis_id}' not found for this farm.")

    return AnalysisResponse(
        analysis_id=job.id,
        status=job.status,
        created_at=job.created_at.isoformat(),
        result=job.result,
    )
