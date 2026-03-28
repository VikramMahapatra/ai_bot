from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import (
    admin_router,
    knowledge_router,
    chat_router,
    leads_router,
    organization_router,
    dashboard_router,
    analytics_router,
    superadmin_router,
    whatsapp_router,
    campaigns_router,
    handoff_router,
    calling_agent_router,
    call_campaign_router,
    call_log_router,
    twilio_sms_router,
    calls_router,
    funnel_categories_router,
    product_router
)
from app.api.feedback import router as feedback_router
from app.api.reports import router as reports_router
from app.services.conversation_outcome_service import run_daily_outcome_daemon
import logging
import asyncio

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format=settings.LOG_FORMAT
)

logger = logging.getLogger(__name__)

outcome_daemon_task = None
outcome_daemon_stop_event = asyncio.Event()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_TITLE,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX or None,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.cors_allow_methods_list,
    allow_headers=settings.cors_allow_headers_list,
)

# Register routers
app.include_router(admin_router)
app.include_router(organization_router)
app.include_router(knowledge_router)
app.include_router(chat_router)
app.include_router(leads_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(superadmin_router)
app.include_router(feedback_router)
app.include_router(reports_router)
app.include_router(whatsapp_router)
app.include_router(campaigns_router)
app.include_router(handoff_router)
app.include_router(calling_agent_router)
app.include_router(call_campaign_router)
app.include_router(call_log_router)
app.include_router(twilio_sms_router)
app.include_router(calls_router)
app.include_router(funnel_categories_router)
app.include_router(product_router)

# Handle OPTIONS requests for CORS preflight
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {"status": "ok"}

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    global outcome_daemon_task
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully")

    outcome_daemon_stop_event.clear()
    outcome_daemon_task = asyncio.create_task(run_daily_outcome_daemon(outcome_daemon_stop_event))
    logger.info("Conversation outcome daemon started")

    logger.info("✅ Backend is ready!")


@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully stop background tasks"""
    global outcome_daemon_task
    outcome_daemon_stop_event.set()
    if outcome_daemon_task:
        try:
            await outcome_daemon_task
        except Exception:
            logger.exception("Error while stopping outcome daemon")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.UVICORN_HOST, port=settings.UVICORN_PORT)
