from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.middleware.request_id import RequestIdMiddleware
from app.services.auth_service import seed_default_user

# Import all models to ensure metadata is populated
import app.models  # noqa: F401

# Import all routers
from app.routers import (
    health_router,
    auth_router,
    farms_router,
    insights_router,
    climate_router,
    rotations_router,
    reports_router,
    regions_router,
    notifications_router,
    preferences_router,
    map_layers_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize tables and seed demo user
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_user(db)
    finally:
        db.close()
    yield
    # Shutdown logic (if any)


app = FastAPI(
    title="FarmShift Backend Engine",
    description="Agronomic intelligence, climate observation, and farm management backend for FarmShift.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration matching the security checklist
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Client-Request-Id",
        "Accept",
        "Origin",
        "User-Agent"
    ],
    expose_headers=["X-Client-Request-Id", "X-Process-Time"]
)

# Request ID & diagnostic timing middleware
app.add_middleware(RequestIdMiddleware)


# Structured Error Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "RequestValidationError",
            "message": "Input validation failed. Please check the submitted fields.",
            "details": exc.errors(),
            "request_id": req_id
        },
        headers={"X-Client-Request-Id": req_id} if req_id else None
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    req_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": req_id
        },
        headers={"X-Client-Request-Id": req_id} if req_id else None
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "detail": "An unexpected error occurred while processing the request.",
            "request_id": req_id
        },
        headers={"X-Client-Request-Id": req_id} if req_id else None
    )


# Attach routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(farms_router)
app.include_router(insights_router)
app.include_router(climate_router)
app.include_router(rotations_router)
app.include_router(reports_router)
app.include_router(regions_router)
app.include_router(notifications_router)
app.include_router(preferences_router)
app.include_router(map_layers_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
