from app.api.admin import router as admin_router
from app.api.knowledge import router as knowledge_router
from app.api.chat import router as chat_router
from app.api.leads import router as leads_router

__all__ = [
    "admin_router",
    "knowledge_router",
    "chat_router",
    "leads_router",
]
