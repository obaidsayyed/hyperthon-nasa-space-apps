from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.farms import router as farms_router
from app.routers.insights import router as insights_router
from app.routers.climate import router as climate_router
from app.routers.rotations import router as rotations_router
from app.routers.reports import router as reports_router
from app.routers.regions import router as regions_router
from app.routers.notifications import router as notifications_router
from app.routers.preferences import router as preferences_router
from app.routers.map_layers import router as map_layers_router

__all__ = [
    "health_router",
    "auth_router",
    "farms_router",
    "insights_router",
    "climate_router",
    "rotations_router",
    "reports_router",
    "regions_router",
    "notifications_router",
    "preferences_router",
    "map_layers_router",
]
