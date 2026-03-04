from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import require_admin, get_password_hash, create_access_token, verify_password, get_current_user
from app.models import User, UserRole, Organization
from app.services.limits_service import get_or_create_limits, get_effective_limits
from app.config import settings
from app.services.conversation_outcome_service import run_outcome_processing_batches
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEFAULT_ESCALATION_CONTACT_LEVEL_1 = "Support Team: support@example.com | +1-555-0101"
DEFAULT_ESCALATION_CONTACT_LEVEL_2 = "Escalation Manager: escalation@example.com | +1-555-0102"


def _ensure_widget_escalation_contacts(config) -> bool:
    changed = False
    if not getattr(config, "escalation_contact_level_1", None):
        config.escalation_contact_level_1 = DEFAULT_ESCALATION_CONTACT_LEVEL_1
        changed = True
    if not getattr(config, "escalation_contact_level_2", None):
        config.escalation_contact_level_2 = DEFAULT_ESCALATION_CONTACT_LEVEL_2
        changed = True
    return changed


class LoginRequest(BaseModel):
    username: str
    password: str
    organization_id: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    organization_id: int
    role: str
    organization_name: str


class GetOrganizationsResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]


class RegisterRequest(BaseModel):
    organization_name: str
    username: str
    email: EmailStr
    password: str


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with username, password, and organization"""
    # Find user in the specified organization
    user = db.query(User).filter(
        User.username == request.username,
        User.organization_id == request.organization_id
    ).first()
    
    if not user or not verify_password(request.password, user.hashed_password) or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials, organization, or user inactive")
    
    # Get organization name
    org = db.query(Organization).filter(Organization.id == request.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Generate token with user_id
    access_token = create_access_token(data={"sub": user.id})
    return LoginResponse(
        access_token=access_token,
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
        organization_name=org.name
    )


@router.get("/organizations/by-username/{username}", response_model=List[GetOrganizationsResponse])
async def get_organizations_by_username(
    username: str,
    db: Session = Depends(get_db)
):
    """Get all organizations where a user exists (for login organization dropdown)"""
    users = db.query(User).filter(User.username == username).all()
    
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get unique organizations
    org_ids = set(user.organization_id for user in users)
    organizations = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    
    return organizations


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register new organization with an admin user.
    This creates both the organization and the first admin user.
    """
    # Check if organization already exists
    existing_org = db.query(Organization).filter(Organization.name == request.organization_name).first()
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization already exists"
        )
    
    # Check if username already exists globally (username should be unique)
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create organization
    org = Organization(name=request.organization_name)
    db.add(org)
    db.commit()
    db.refresh(org)

    # Initialize default limits
    get_or_create_limits(db, org.id)
    
    # Create admin user for the organization
    admin_user = User(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role=UserRole.ADMIN,
        organization_id=org.id,
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    
    return {
        "message": "Organization and admin user created successfully",
        "organization_id": org.id,
        "username": admin_user.username,
        "role": admin_user.role.value
    }


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user info"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.value,
        "organization_id": current_user.organization_id,
        "is_active": current_user.is_active
    }


@router.get("/features")
async def get_feature_flags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get effective feature flags for current user's organization"""
    limits = get_effective_limits(db, current_user.organization_id)
    return {
        "subscription_active": limits.get("subscription_active", False),
        "days_left": limits.get("days_left", 0),
        "voice_chat_enabled": limits.get("voice_chat_enabled", False),
        "multilingual_text_enabled": limits.get("multilingual_text_enabled", False),
    }


@router.get("/widget/config/{widget_id}")
async def get_widget_config(
    widget_id: str,
    db: Session = Depends(get_db)
):
    """Get widget configuration (public endpoint)"""
    from app.models import WidgetConfig
    
    config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Widget config not found")

    if _ensure_widget_escalation_contacts(config):
        db.commit()
        db.refresh(config)
    
    return config


@router.post("/widget/config")
async def create_widget_config(
    config_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create widget configuration for the current user"""
    from app.models import WidgetConfig
    
    # Generate widget ID if not provided
    widget_id = config_data.get("widget_id", str(uuid.uuid4()))
    
    config = WidgetConfig(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        widget_id=widget_id,
        name=config_data.get("name", "Chatbot"),
        welcome_message=config_data.get("welcome_message"),
        logo_url=config_data.get("logo_url"),
        primary_color=config_data.get("primary_color", "#007bff"),
        secondary_color=config_data.get("secondary_color", "#6c757d"),
        position=config_data.get("position", "bottom-right"),
        lead_capture_enabled=config_data.get("lead_capture_enabled", True),
        lead_fields=config_data.get("lead_fields"),
        escalation_contact_level_1=config_data.get("escalation_contact_level_1", DEFAULT_ESCALATION_CONTACT_LEVEL_1),
        escalation_contact_level_2=config_data.get("escalation_contact_level_2", DEFAULT_ESCALATION_CONTACT_LEVEL_2),
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return config


@router.put("/widget/config/{widget_id}")
async def update_widget_config(
    widget_id: str,
    config_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update widget configuration (only for user's own widgets)"""
    from app.models import WidgetConfig
    
    config = db.query(WidgetConfig).filter(
        WidgetConfig.widget_id == widget_id,
        WidgetConfig.user_id == current_user.id,
        WidgetConfig.organization_id == current_user.organization_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Widget config not found or unauthorized")
    
    # Define fields that should not be updated
    readonly_fields = {'id', 'user_id', 'organization_id', 'created_at', 'updated_at', 'widget_id'}
    
    # Update only allowed fields
    for key, value in config_data.items():
        if hasattr(config, key) and key not in readonly_fields:
            setattr(config, key, value)

    _ensure_widget_escalation_contacts(config)
    
    db.commit()
    db.refresh(config)
    
    return config


@router.post('/outcomes/process')
async def run_outcome_processing_now(
    payload: Optional[dict] = Body(None),
    current_user: User = Depends(require_admin),
):
    """Run outcome processing on-demand for admins in their organization context."""
    batch_size = int(payload.get('batch_size')) if payload and payload.get('batch_size') else settings.OUTCOME_DAEMON_BATCH_SIZE
    max_batches = int(payload.get('max_batches')) if payload and payload.get('max_batches') else settings.OUTCOME_DAEMON_MAX_BATCHES

    processed, failed = run_outcome_processing_batches(
        batch_size=batch_size,
        max_batches=max_batches,
        organization_id=current_user.organization_id,
    )
    return {"processed": processed, "failed": failed}


@router.get("/widgets")
async def list_widgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all widgets for the current organization"""
    from app.models import WidgetConfig
    
    configs = db.query(WidgetConfig).filter(
        WidgetConfig.organization_id == current_user.organization_id
    ).all()

    changed = False
    for config in configs:
        if _ensure_widget_escalation_contacts(config):
            changed = True
    if changed:
        db.commit()
    
    return configs


@router.delete("/widget/config/{widget_id}")
async def delete_widget_config(
    widget_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete widget configuration"""
    from app.models import WidgetConfig
    
    config = db.query(WidgetConfig).filter(
        WidgetConfig.widget_id == widget_id,
        WidgetConfig.organization_id == current_user.organization_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Widget config not found or unauthorized")
    
    db.delete(config)
    db.commit()
    
    return {"message": "Widget deleted successfully"}
