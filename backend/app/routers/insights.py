from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.schemas.insights import InsightQuestionRequest, AIInsightsResponse
from app.services.auth_service import get_current_user
from app.services.insights_engine import generate_farm_ai_insights

router = APIRouter(prefix="/v1/farms", tags=["AI Insights"])


@router.post("/{farm_id}/ai-insights", response_model=AIInsightsResponse)
def get_ai_insights(
    farm_id: str,
    payload: Optional[InsightQuestionRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate evidence-grounded agronomic AI insights for a farm profile.
    Strictly conforms to integration handoff:
    - Enforces authenticated ownership of farm_id.
    - Returns only summary, insights, evidence, actions, limitations, data_quality, and generated_at.
    - Grounds findings in verified institutional research (ICAR, PDKV, IMD).
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
            detail="Access forbidden: you do not have permission to analyze this farm."
        )

    req = payload or InsightQuestionRequest()
    response = generate_farm_ai_insights(
        farm=farm,
        region_id=req.region_id,
        season=req.season,
        questions=req.questions
    )
    return response
