import uuid
from typing import Any, List, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    def __init__(
        self,
        message: str,
        code: str = "BAD_REQUEST",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[List[Any]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class ValidationError(AppException):
    def __init__(self, message: str, details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication required or token expired"):
        super().__init__(
            message=message,
            code="UNAUTHENTICATED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenError(AppException):
    def __init__(self, message: str = "Access forbidden: you do not own this resource"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
        )


def format_error_response(
    code: str,
    message: str,
    status_code: int,
    request: Request,
    details: Optional[List[Any]] = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None) or request.headers.get("x-client-request-id") or f"req_{uuid.uuid4().hex[:12]}"
    content = {
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
        },
        "request_id": request_id,
    }
    return JSONResponse(status_code=status_code, content=content)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return format_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        request=request,
        details=exc.details,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for err in exc.errors():
        field_path = ".".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        details.append({
            "field": field_path or "body",
            "issue": err.get("msg", "Invalid value"),
            "type": err.get("type", "value_error"),
        })

    return format_error_response(
        code="VALIDATION_ERROR",
        message="Request validation failed. Please check the supplied fields.",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        request=request,
        details=details,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
    }
    code = code_map.get(exc.status_code, "ERROR")
    message = str(exc.detail) if exc.detail else "An error occurred."
    return format_error_response(
        code=code,
        message=message,
        status_code=exc.status_code,
        request=request,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return format_error_response(
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected internal error occurred on the server.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        request=request,
        details=[{"issue": str(exc)}] if str(exc) else [],
    )
