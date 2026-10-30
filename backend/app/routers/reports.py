import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.farm import Farm
from app.models.report import Report
from app.schemas.report import ReportCreateRequest, ReportResponse
from app.services.auth_service import get_current_user, decode_access_token
from app.services.pdf_generator import generate_farm_report_pdf

router = APIRouter(tags=["Reports"])


def format_report_response(report: Report) -> ReportResponse:
    download_url = f"/v1/reports/{report.id}/download"
    return ReportResponse(
        id=report.id,
        farm_id=report.farm_id,
        user_id=report.user_id,
        title=report.title,
        report_type=report.report_type,
        status=report.status,
        summary=report.summary,
        created_at=report.created_at,
        completed_at=report.completed_at,
        download_url=download_url
    )


@router.post("/v1/farms/{farm_id}/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_farm_report(
    farm_id: str,
    payload: Optional[ReportCreateRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate an agronomic advisory report for a farm profile.
    Compiles farm baseline, AI insights, climate observations and rotation comparisons into a valid PDF.
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
            detail="Access forbidden: you do not have permission to generate reports for this farm."
        )

    req = payload or ReportCreateRequest()
    title = req.title or f"FarmShift Advisory Report - {farm.name}"

    report = Report(
        farm_id=farm.id,
        user_id=current_user.id,
        title=title,
        report_type=req.report_type,
        status="processing",
        summary={
            "farm_name": farm.name,
            "region_id": farm.region_id,
            "area_ha": farm.area_ha,
            "land_type": farm.land_type
        }
    )
    db.add(report)
    db.flush()

    try:
        # Generate the ReportLab PDF
        pdf_path = generate_farm_report_pdf(farm, report)
        report.file_path = pdf_path
        report.status = "completed"
        report.completed_at = datetime.now(timezone.utc)
    except Exception as e:
        report.status = "failed"
        report.summary["error"] = str(e)

    db.commit()
    db.refresh(report)

    return format_report_response(report)


@router.get("/v1/farms/{farm_id}/reports", response_model=List[ReportResponse])
def list_farm_reports(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all reports generated for a specific farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farm profile with id '{farm_id}' was not found."
        )

    if farm.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to view reports for this farm."
        )

    reports = db.query(Report).filter(
        Report.farm_id == farm_id,
        Report.user_id == current_user.id
    ).order_by(Report.created_at.desc()).all()

    return [format_report_response(r) for r in reports]


@router.get("/v1/reports/{report_id}", response_model=ReportResponse)
def get_report_status(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Poll report status and retrieve metadata."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' was not found."
        )

    if report.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to view this report."
        )

    return format_report_response(report)


@router.get("/v1/reports/{report_id}/download")
def download_report(
    report_id: str,
    token: Optional[str] = Query(None, description="Optional bearer token for browser downloads"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authorized report download endpoint. Supports standard Bearer header
    as well as query parameter token for direct browser window downloads.
    """
    effective_user = current_user
    if not effective_user and token:
        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub")
            if user_id:
                effective_user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        except Exception:
            pass

    if not effective_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to download this report."
        )

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' was not found."
        )

    if report.user_id != effective_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to download this report."
        )

    if report.status != "completed" or not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The report file is not ready or failed to generate."
        )

    return FileResponse(
        path=report.file_path,
        media_type="application/pdf",
        filename=f"FarmShift_Report_{report.id}.pdf",
        headers={
            "Content-Disposition": f'attachment; filename="FarmShift_Report_{report.id}.pdf"'
        }
    )
