from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import admin_router, knowledge_router, chat_router, leads_router, organization_router, dashboard_router, analytics_router, superadmin_router
from app.api.feedback import router as feedback_router
from app.api.reports import router as reports_router
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AI Chatbot Platform API",
    description="Backend API for AI-powered chatbot with RAG capabilities",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.myshopify\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# Handle OPTIONS requests for CORS preflight
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {"status": "ok"}

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully")
    logger.info("✅ Backend is ready!")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Chatbot Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
