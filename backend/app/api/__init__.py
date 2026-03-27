from app.api.admin import router as admin_router
from app.api.knowledge import router as knowledge_router
from app.api.chat import router as chat_router
from app.api.leads import router as leads_router
from app.api.organization import router as organization_router
from app.api.dashboard import router as dashboard_router
from app.api.analytics import router as analytics_router
from app.api.superadmin import router as superadmin_router
from app.api.whatsapp import router as whatsapp_router
from app.api.calling_agent import router as calling_agent_router
from app.api.call_campaign import router as call_campaign_router
from app.api.call_log import router as call_log_router
from app.api.campaigns import router as campaigns_router
from app.api.handoff import router as handoff_router
from app.api.calls import router as calls_router
from app.api.funnel_categories import router as funnel_categories_router

from app.api.twilio_sms import router as twilio_sms_router

__all__ = [
    "admin_router",
    "knowledge_router",
    "chat_router",
    "leads_router",
    "organization_router",
    "dashboard_router",
    "analytics_router",
    "superadmin_router",
    "whatsapp_router",
    "calling_agent_router",
    "call_campaign_router",
    "call_log_router",
    "campaigns_router",
    "handoff_router",
    "twilio_sms_router",
    "funnel_categories_router",
]
