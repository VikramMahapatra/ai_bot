from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Body, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import (
    require_admin,
    get_password_hash,
    create_access_token,
    verify_password,
    get_current_user,
)
from app.models import User, UserRole, Organization, Appointment, WidgetConfig
from app.services.limits_service import get_or_create_limits, get_effective_limits
from app.services.email_service import (
    send_appointment_rescheduled_notification,
    send_widget_test_link_email,
)
from app.config import settings
from app.services.conversation_outcome_service import run_outcome_processing_batches
from app.services import org_credit_billing_service
from app.schemas.org_credit_billing import OrgCreditAdminMonthSummaryResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from jose import jwt, JWTError, ExpiredSignatureError
import logging
import uuid
import re
import json
import secrets

from app.models.organization_settings import OrganizationSettings
from app.api.organization_setting import get_settings
from app.services.organization_setting_service import get_org_settings
from app.context.org_context import set_org_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
DEFAULT_GOOGLE_MEET_LINK = "https://meet.google.com/new"


def _build_org_domain(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-") or "org"
    return f"{base}-{secrets.token_hex(3)}"


def _ensure_widget_escalation_contacts(config, org_settings) -> bool:
    changed = False
    if not getattr(config, "escalation_contact_level_1", None):
        config.escalation_contact_level_1 = (
            org_settings.DEFAULT_ESCALATION_CONTACT_LEVEL_1
        )
        changed = True
    if not getattr(config, "escalation_contact_level_2", None):
        config.escalation_contact_level_2 = (
            org_settings.DEFAULT_ESCALATION_CONTACT_LEVEL_2
        )
        changed = True
    return changed


def _extract_emails(*values: Optional[str]) -> List[str]:
    """Extract and deduplicate emails from free-form contact strings."""
    found: List[str] = []
    seen = set()
    for value in values:
        if not value:
            continue
        for email in EMAIL_PATTERN.findall(value):
            key = email.lower()
            if key in seen:
                continue
            seen.add(key)
            found.append(email)
    return found


def _parse_iso_datetime(value: str) -> datetime:
    normalized = (value or "").strip().replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _format_datetime_with_timezone(
    value: datetime, timezone_name: Optional[str]
) -> tuple[str, str]:
    dt_value = value
    if dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=timezone.utc)

    tz_label = (timezone_name or "UTC").strip() or "UTC"
    try:
        target_tz = ZoneInfo(tz_label)
    except Exception:
        target_tz = timezone.utc
        tz_label = "UTC"

    local_dt = dt_value.astimezone(target_tz)
    return local_dt.strftime("%d %b %Y, %I:%M %p"), tz_label


def _create_widget_test_link_token(
    widget_id: str, start_at: datetime, expires_at: datetime
) -> str:
    payload = {
        "scope": "widget_test_link",
        "widget_id": widget_id,
        "start_at": start_at.isoformat(),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token


def _to_utc(dt_value: datetime) -> datetime:
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value.astimezone(timezone.utc)


def _parse_iso_utc(value: Optional[str]) -> Optional[datetime]:
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None
    return _to_utc(parsed)


def _load_lead_fields_map(raw_lead_fields: Optional[str]) -> dict:
    raw = (raw_lead_fields or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _resolve_widget_test_window_start(config: WidgetConfig) -> datetime:
    metadata = _load_lead_fields_map(getattr(config, "lead_fields", None))
    stored_start = _parse_iso_utc(metadata.get("test_link_start_at"))
    if stored_start:
        return stored_start

    created_at = getattr(config, "created_at", None)
    if isinstance(created_at, datetime):
        return _to_utc(created_at)

    return datetime.now(timezone.utc)


def _set_widget_test_window_start(config: WidgetConfig, start_at: datetime) -> None:
    metadata = _load_lead_fields_map(getattr(config, "lead_fields", None))
    metadata["test_link_start_at"] = _to_utc(start_at).isoformat()
    config.lead_fields = json.dumps(metadata)


def _validate_widget_test_link_token(token: str, widget_id: str) -> None:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Test link has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid test link")

    if (
        payload.get("scope") != "widget_test_link"
        or payload.get("widget_id") != widget_id
    ):
        raise HTTPException(status_code=401, detail="Invalid test link")


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


class WidgetTestLinkEmailRequest(BaseModel):
    widget_id: str
    to_email: EmailStr
    subject: str
    body: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with username, password, and organization"""
    # Find user in the specified organization
    user = (
        db.query(User)
        .filter(
            User.username == request.username,
            User.organization_id == request.organization_id,
        )
        .first()
    )

    if (
        not user
        or not verify_password(request.password, user.hashed_password)
        or not user.is_active
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials, organization, or user inactive",
        )

    # Get organization name
    org = (
        db.query(Organization)
        .filter(Organization.id == request.organization_id)
        .first()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    set_org_id(user.organization_id)

    # Generate token with user_id
    access_token = create_access_token(data={"sub": user.id})
    return LoginResponse(
        access_token=access_token,
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
        organization_name=org.name,
    )


@router.get(
    "/organizations/by-username/{username}",
    response_model=List[GetOrganizationsResponse],
)
async def get_organizations_by_username(username: str, db: Session = Depends(get_db)):
    """Get all organizations where a user exists (for login organization dropdown)"""
    users = db.query(User).filter(User.username == username).all()
    
    print(f"DEBUG: Found {len(users)} users with username '{username}'")  # Debug log

    if not users:
        raise HTTPException(status_code=404, detail="User not found")

    # Get unique organizations
    org_ids = set(user.organization_id for user in users)
    organizations = db.query(Organization).filter(Organization.id.in_(org_ids)).all()

    return organizations


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register new organization with an admin user.
    This creates both the organization and the first admin user.
    """
    # Check if organization already exists
    existing_org = (
        db.query(Organization)
        .filter(Organization.name == request.organization_name)
        .first()
    )
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization already exists",
        )

    # Create organization
    org_name = (request.organization_name or "").strip()
    org = Organization(
        name=org_name,
        org_domain=_build_org_domain(org_name),
        access_token=secrets.token_urlsafe(32),
    )
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
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    return {
        "message": "Organization and admin user created successfully",
        "organization_id": org.id,
        "username": admin_user.username,
        "role": admin_user.role.value,
    }


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.value,
        "organization_id": current_user.organization_id,
        "is_active": current_user.is_active,
    }


@router.get("/features")
async def get_feature_flags(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get effective feature flags for current user's organization"""
    limits = get_effective_limits(db, current_user.organization_id)
    return {
        "subscription_active": limits.get("subscription_active", False),
        "days_left": limits.get("days_left", 0),
        "voice_chat_enabled": limits.get("voice_chat_enabled", False),
        "multilingual_text_enabled": limits.get("multilingual_text_enabled", False),
        "human_handoff_enabled": limits.get("human_handoff_enabled", False),
        "whatsapp_enabled": limits.get("whatsapp_enabled", False),
        "email_campaign_enabled": limits.get("email_campaign_enabled", False),
        "sms_campaign_enabled": limits.get("sms_campaign_enabled", False),
        "module_knowledge_enabled": limits.get("module_knowledge_enabled", False),
        "module_leads_enabled": limits.get("module_leads_enabled", False),
        "module_analytics_enabled": limits.get("module_analytics_enabled", False),
        "module_advanced_analytics_enabled": limits.get(
            "module_advanced_analytics_enabled", False
        ),
        "module_reports_enabled": limits.get("module_reports_enabled", False),
        "module_campaigns_enabled": limits.get("module_campaigns_enabled", False),
        "module_appointments_enabled": limits.get("module_appointments_enabled", False),
        "module_products_enabled": limits.get("module_products_enabled", False),
        "module_users_enabled": limits.get("module_users_enabled", False),
    }


@router.get("/org-credit/current-month", response_model=OrgCreditAdminMonthSummaryResponse)
async def get_admin_org_credit_current_month_summary(
    billing_period: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    payload = org_credit_billing_service.get_admin_month_summary(
        db=db,
        organization_id=current_user.organization_id,
        billing_period=billing_period,
    )
    return OrgCreditAdminMonthSummaryResponse(**payload)


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
    
    settings = get_org_settings(db, config.organization_id)

    if _ensure_widget_escalation_contacts(config, settings):
        db.commit()
        db.refresh(config)

    return config


@router.get("/widget/test-link/{widget_id}")
async def generate_widget_test_link(
    widget_id: str,
    extra_hours: int = Query(0, ge=0, le=168),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Generate an expiring test-link token for a widget in the current organization."""
    config = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.widget_id == widget_id,
            WidgetConfig.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not config:
        raise HTTPException(
            status_code=404, detail="Widget config not found or unauthorized"
        )

    if extra_hours > 0:
        # +24 action resets the window anchor to now, then applies default 24h expiry.
        start_at = datetime.now(timezone.utc)
        _set_widget_test_window_start(config, start_at)
        db.commit()
        db.refresh(config)
    else:
        # Default link window starts at agent creation time (or previously reset anchor).
        start_at = _resolve_widget_test_window_start(config)

    expires_at = start_at + timedelta(hours=settings.TEST_LINK_EXPIRY_HOURS)
    token = _create_widget_test_link_token(
        widget_id, start_at=start_at, expires_at=expires_at
    )

    return {
        "widget_id": widget_id,
        "start_at": start_at.isoformat(),
        "token": token,
        "expires_at": expires_at.isoformat(),
        "expires_in_hours": settings.TEST_LINK_EXPIRY_HOURS,
    }


@router.get("/widget/test/config/{widget_id}")
async def get_widget_test_config(
    widget_id: str,
    token: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Get widget config for public test pages using a signed expiring token."""
    _validate_widget_test_link_token(token, widget_id)

    config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Widget config not found")

    org_settings = (
        get_org_settings(db, config.organization_id)
        if config.organization_id
        else settings
    )

    if _ensure_widget_escalation_contacts(config, org_settings):
        db.commit()
        db.refresh(config)

    return config


@router.post("/widget/test-link/email")
async def send_widget_test_link_via_email(
    payload: WidgetTestLinkEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    settings: OrganizationSettings = Depends(get_settings),
):
    """Send a widget test-link email via configured SMTP service."""
    widget_id = (payload.widget_id or "").strip()
    if not widget_id:
        raise HTTPException(status_code=400, detail="widget_id is required")

    config = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.widget_id == widget_id,
            WidgetConfig.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not config:
        raise HTTPException(
            status_code=404, detail="Widget config not found or unauthorized"
        )

    body = (payload.body or "").strip()
    subject = (payload.subject or "").strip() or "Welcome from Zentrixel"
    if not body:
        raise HTTPException(status_code=400, detail="Email body cannot be empty")

    success, error_message = send_widget_test_link_email(
        recipient_email=str(payload.to_email),
        subject=subject,
        message_body=body,
        settings=settings,
    )
    if not success:
        raise HTTPException(
            status_code=400, detail=error_message or "Failed to send email"
        )

    return {"message": "Test link email sent successfully"}


@router.post("/widget/config")
async def create_widget_config(
    config_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    org_settings: OrganizationSettings = Depends(get_settings),
):
    """Create widget configuration for the current user"""
    from app.models import WidgetConfig

    # Generate widget ID if not provided
    widget_id = config_data.get("widget_id", str(uuid.uuid4()))

    escalation_contact_level_1 = (
        (config_data.get("escalation_contact_level_1") or "").strip()
        or org_settings.DEFAULT_ESCALATION_CONTACT_LEVEL_1
    )
    escalation_contact_level_2 = (
        (config_data.get("escalation_contact_level_2") or "").strip()
        or org_settings.DEFAULT_ESCALATION_CONTACT_LEVEL_2
    )

    config = WidgetConfig(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        widget_id=widget_id,
        name=config_data.get("name", "Chatbot"),
        welcome_message=config_data.get("welcome_message"),
        system_prompt=config_data.get("system_prompt"),
        logo_url=config_data.get("logo_url"),
        primary_color=config_data.get("primary_color", "#007bff"),
        secondary_color=config_data.get("secondary_color", "#6c757d"),
        position=config_data.get("position", "bottom-right"),
        lead_capture_enabled=config_data.get("lead_capture_enabled", True),
        lead_fields=config_data.get("lead_fields"),
        escalation_contact_level_1=escalation_contact_level_1,
        escalation_contact_level_2=escalation_contact_level_2,
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
    current_user: User = Depends(require_admin),
    settings: OrganizationSettings = Depends(get_settings),
):
    """Update widget configuration (only for user's own widgets)"""
    from app.models import WidgetConfig

    config = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.widget_id == widget_id,
            WidgetConfig.user_id == current_user.id,
            WidgetConfig.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not config:
        raise HTTPException(
            status_code=404, detail="Widget config not found or unauthorized"
        )

    # Define fields that should not be updated
    readonly_fields = {
        "id",
        "user_id",
        "organization_id",
        "created_at",
        "updated_at",
        "widget_id",
    }

    # Update only allowed fields
    for key, value in config_data.items():
        if hasattr(config, key) and key not in readonly_fields:
            setattr(config, key, value)

    _ensure_widget_escalation_contacts(config, settings)

    db.commit()
    db.refresh(config)

    return config


@router.post("/outcomes/process")
async def run_outcome_processing_now(
    background_tasks: BackgroundTasks,
    payload: Optional[dict] = Body(None),
    current_user: User = Depends(require_admin),
):
    """Run outcome processing on-demand for admins in their organization context."""
    batch_size = (
        int(payload.get("batch_size"))
        if payload and payload.get("batch_size")
        else settings.OUTCOME_DAEMON_BATCH_SIZE
    )
    max_batches = (
        int(payload.get("max_batches"))
        if payload and payload.get("max_batches")
        else settings.OUTCOME_DAEMON_MAX_BATCHES
    )

    background_tasks.add_task(
        run_outcome_processing_batches,
        batch_size=batch_size,
        max_batches=max_batches,
        organization_id=current_user.organization_id,
    )
    return {
        "message": "Outcome processing has started. Results will be available shortly."
    }


@router.get("/widgets")
async def list_widgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    settings: OrganizationSettings = Depends(get_settings),
):
    """List all widgets for the current organization"""
    from app.models import WidgetConfig

    query = db.query(WidgetConfig).filter(
        WidgetConfig.organization_id == current_user.organization_id
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                WidgetConfig.name.ilike(search_term),
            )
        )

    total = query.count()

    configs = (
        query.order_by(WidgetConfig.created_at.desc()).offset(skip).limit(limit).all()
    )

    changed = False
    for config in configs:
        if _ensure_widget_escalation_contacts(config, settings):
            changed = True
    if changed:
        db.commit()

    return {
        "widgets": configs,
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


@router.get("/appointments")
async def list_appointments(
    widget_id: Optional[str] = None,
    status: Optional[str] = None,
    upcoming_only: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List appointments for the current organization."""
    query = db.query(Appointment).filter(
        Appointment.organization_id == current_user.organization_id
    )

    today = datetime.now(timezone.utc)

    if widget_id:
        query = query.filter(Appointment.widget_id == widget_id)
    # if status:
    #     query = query.filter(Appointment.status == status)

    # 🔹 Status filter
    if status:
        if status == "overdue":
            query = query.filter(
                Appointment.status == "booked", Appointment.appointment_at < today
            )
        else:
            query = query.filter(Appointment.status == status)

    if upcoming_only:
        query = query.filter(Appointment.appointment_at >= datetime.now(timezone.utc))

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(Appointment.appointment_at >= start_dt)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid start_date format. Use ISO format"
            )

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            if len(end_date) <= 10:
                end_dt = end_dt + timedelta(days=1)
            query = query.filter(Appointment.appointment_at <= end_dt)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid end_date format. Use ISO format"
            )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Appointment.name.ilike(search_term),
                Appointment.status.ilike(search_term),
            )
        )

    total = query.count()

    appointments = (
        query.order_by(Appointment.appointment_at.asc()).offset(skip).limit(limit).all()
    )

    widget_map = {
        row.widget_id: row.name
        for row in db.query(WidgetConfig)
        .filter(WidgetConfig.organization_id == current_user.organization_id)
        .all()
    }

    return {
        "appointments": [
            {
                "id": item.id,
                "session_id": item.session_id,
                "widget_id": item.widget_id,
                "widget_name": widget_map.get(item.widget_id, item.widget_id),
                "name": item.name,
                "email": item.email,
                "phone": item.phone,
                "notes": item.notes,
                "timezone": item.timezone,
                "appointment_at": item.appointment_at,
                "status": (
                    "overdue"
                    if item.status == "booked" and item.appointment_at < today
                    else item.status
                ),
                "created_at": item.created_at,
            }
            for item in appointments
        ],
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


@router.put("/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update appointment status for the current organization."""
    allowed = {"booked", "completed", "cancelled", "overdue", "no_show"}
    new_status = str(payload.get("status", "")).strip().lower()
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(sorted(allowed))}",
        )

    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_id,
            Appointment.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = new_status
    db.commit()
    db.refresh(appointment)

    return {
        "id": appointment.id,
        "status": appointment.status,
        "message": "Appointment status updated",
    }


@router.put("/appointments/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    settings: OrganizationSettings = Depends(get_settings),
):
    """Reschedule an appointment and notify participant + escalation contacts."""
    raw_appointment_at = payload.get("appointment_at")
    if not raw_appointment_at:
        raise HTTPException(status_code=400, detail="appointment_at is required")

    try:
        new_appointment_at = _parse_iso_datetime(str(raw_appointment_at))
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid appointment_at format. Use ISO format"
        )

    now = datetime.now(timezone.utc) if new_appointment_at.tzinfo else datetime.utcnow()
    if new_appointment_at <= now:
        raise HTTPException(
            status_code=400, detail="Rescheduled appointment time must be in the future"
        )

    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_id,
            Appointment.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    widget_config = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.widget_id == appointment.widget_id,
            WidgetConfig.organization_id == current_user.organization_id,
        )
        .first()
    )

    old_appointment_at = appointment.appointment_at
    old_timezone = appointment.timezone

    new_timezone = payload.get("timezone")
    if new_timezone is not None:
        appointment.timezone = str(new_timezone).strip() or None

    notes = payload.get("notes")
    if notes is not None:
        appointment.notes = str(notes).strip() or None

    appointment.appointment_at = new_appointment_at
    appointment.status = "booked"

    org = (
        db.query(Organization)
        .filter(Organization.id == current_user.organization_id)
        .first()
    )
    org_default_meet_link = (getattr(org, "default_meet_link", None) or "").strip()
    meeting_link = (
        str(payload.get("meeting_link") or "").strip()
        or org_default_meet_link
        or DEFAULT_GOOGLE_MEET_LINK
    )

    db.commit()
    db.refresh(appointment)

    old_time_label, old_tz_label = _format_datetime_with_timezone(
        old_appointment_at, old_timezone or appointment.timezone
    )
    new_time_label, tz_label = _format_datetime_with_timezone(
        appointment.appointment_at, appointment.timezone
    )

    escalation_emails = _extract_emails(
        widget_config.escalation_contact_level_1 if widget_config else None,
        widget_config.escalation_contact_level_2 if widget_config else None,
    )
    recipients: List[str] = []
    if appointment.email:
        recipients.append(appointment.email)
    if current_user.email:
        recipients.append(current_user.email)
    recipients.extend(escalation_emails)

    notification_ok, notification_errors = send_appointment_rescheduled_notification(
        recipients=recipients,
        participant_name=appointment.name,
        participant_email=appointment.email,
        appointment_time_label=new_time_label,
        timezone_label=tz_label,
        previous_time_label=f"{old_time_label} ({old_tz_label})",
        meeting_link=meeting_link,
        widget_name=(widget_config.name if widget_config else appointment.widget_id),
        notes=appointment.notes,
        settings=settings,
    )

    response_message = "Appointment rescheduled successfully"
    if not notification_ok:
        response_message += " (notification delivery had issues)"

    return {
        "id": appointment.id,
        "appointment_at": appointment.appointment_at,
        "timezone": appointment.timezone,
        "status": appointment.status,
        "meeting_link": meeting_link,
        "notification": {
            "sent": notification_ok,
            "recipient_count": len(
                {
                    (email or "").strip().lower()
                    for email in recipients
                    if (email or "").strip()
                }
            ),
            "errors": notification_errors,
        },
        "message": response_message,
        "previous_time": {
            "label": old_time_label,
            "timezone": old_tz_label,
        },
    }


@router.delete("/widget/config/{widget_id}")
async def delete_widget_config(
    widget_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete widget configuration"""
    from app.models import WidgetConfig

    config = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.widget_id == widget_id,
            WidgetConfig.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not config:
        raise HTTPException(
            status_code=404, detail="Widget config not found or unauthorized"
        )

    db.delete(config)
    db.commit()

    return {"message": "Widget deleted successfully"}
