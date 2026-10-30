from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.preference import UserPreference
from app.schemas.preference import PreferenceResponse, PreferenceUpdate
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/v1/users/me/preferences", tags=["Preferences"])


@router.get("", response_model=PreferenceResponse)
def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve preferences for the authenticated user."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(
            user_id=current_user.id,
            theme="system",
            language="en",
            email_alerts=True,
            sms_alerts=False,
            units_system="metric"
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return PreferenceResponse.model_validate(pref)


@router.patch("", response_model=PreferenceResponse)
def update_user_preferences(
    payload: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update preferences for the authenticated user."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    update_data = payload.model_dump(exclude_unset=True)
    if "theme" in update_data and update_data["theme"] is not None:
        pref.theme = update_data["theme"]
    if "language" in update_data and update_data["language"] is not None:
        pref.language = update_data["language"]
    if "email_alerts" in update_data and update_data["email_alerts"] is not None:
        pref.email_alerts = update_data["email_alerts"]
    if "sms_alerts" in update_data and update_data["sms_alerts"] is not None:
        pref.sms_alerts = update_data["sms_alerts"]
    if "units_system" in update_data and update_data["units_system"] is not None:
        pref.units_system = update_data["units_system"]

    db.commit()
    db.refresh(pref)
    return PreferenceResponse.model_validate(pref)
