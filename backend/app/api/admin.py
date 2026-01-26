from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import require_admin, get_password_hash, create_access_token, verify_password
from app.models import User, UserRole
from pydantic import BaseModel
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "USER"


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """Admin login"""
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.username})
    return LoginResponse(access_token=access_token)


@router.post("/register")
async def register(
    request: UserCreate,
    db: Session = Depends(get_db)
):
    """Register new user (for demo purposes)"""
    # Check if user exists
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user = User(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role=UserRole.ADMIN if request.role == "ADMIN" else UserRole.USER
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"message": "User created successfully", "username": user.username}


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
        widget_id=widget_id,
        name=config_data.get("name", "Chatbot"),
        welcome_message=config_data.get("welcome_message"),
        logo_url=config_data.get("logo_url"),
        primary_color=config_data.get("primary_color", "#007bff"),
        secondary_color=config_data.get("secondary_color", "#6c757d"),
        position=config_data.get("position", "bottom-right"),
        lead_capture_enabled=config_data.get("lead_capture_enabled", True),
        lead_fields=config_data.get("lead_fields")
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
        WidgetConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Widget config not found or unauthorized")
    
    # Update fields
    for key, value in config_data.items():
        if hasattr(config, key) and key != "user_id":  # Don't allow changing user_id
            setattr(config, key, value)
    
    db.commit()
    db.refresh(config)
    
    return config
