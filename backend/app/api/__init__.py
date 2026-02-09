from app.api.admin import router as admin_router
from app.api.knowledge import router as knowledge_router
from app.api.chat import router as chat_router
from app.api.leads import router as leads_router
from app.api.organization import router as organization_router
from app.api.dashboard import router as dashboard_router
from app.api.analytics import router as analytics_router
from app.api.superadmin import router as superadmin_router

__all__ = [
    "admin_router",
    "knowledge_router",
    "chat_router",
    "leads_router",
    "organization_router",
    "dashboard_router",
    "analytics_router",
    "superadmin_router",
]
