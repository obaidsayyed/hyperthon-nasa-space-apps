import uuid
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that captures or generates X-Client-Request-Id header,
    attaches it to request state and injects it into every response.
    """
    async def dispatch(self, request: Request, call_next):
        client_req_id = request.headers.get("X-Client-Request-Id") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = client_req_id
        start_time = time.time()

        response: Response = await call_next(request)

        process_time = time.time() - start_time
        response.headers["X-Client-Request-Id"] = client_req_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        return response
