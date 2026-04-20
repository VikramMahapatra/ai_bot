from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import (
    get_current_user,
    require_admin,
    get_password_hash,
    create_access_token,
)
from app.models import (
    User,
    Organization,
    UserRole,
    WidgetConfig,
    HandoffAgentAssignment,
)
from app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    UserCreate,
    UserResponse,
    UserListResponse,
    UserUpdate,
)
from typing import Dict, List, Optional
from pydantic import BaseModel
from app.models.calling_agents import CallingAgent
from app.models.call_campaigns import CallCampaign
from app.models.campaign import Campaign
from app.services import organization_credit_service
from app.schemas.organization import CreditParameters, SMTPTestRequest
from app.enums.credit_feature_codes import FeatureCodes
from app.models.organization_settings import OrganizationSettings
from app.services import email_service
from app.services.organization_setting_service import get_org_settings


router = APIRouter(prefix="/api/organizations", tags=["organizations"])


class OrganizationMeetingSettingsResponse(BaseModel):
    default_meet_link: str


class OrganizationMeetingSettingsUpdateRequest(BaseModel):
    default_meet_link: str


@router.post(
    "/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED
)
def create_organization(
    org_data: OrganizationCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new organization (for initial setup/registration flow).
    Returns the organization details.
    """
    # Check if organization already exists
    existing_org = (
        db.query(Organization).filter(Organization.name == org_data.name).first()
    )
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name already exists",
        )

    new_org = Organization(
        name=org_data.name,
        description=org_data.description,
        joining_date=org_data.joining_date,
        effective_joining_date=org_data.effective_joining_date,
    )
    db.add(new_org)
    db.commit()
    db.refresh(new_org)
    return new_org


@router.get("/me", response_model=OrganizationResponse)
def get_current_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's organization."""
    org = (
        db.query(Organization)
        .filter(Organization.id == current_user.organization_id)
        .first()
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


@router.get("/me/meeting-settings", response_model=OrganizationMeetingSettingsResponse)
def get_current_org_meeting_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get organization-level default Google Meet URL."""
    org = (
        db.query(Organization)
        .filter(Organization.id == current_user.organization_id)
        .first()
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return OrganizationMeetingSettingsResponse(
        default_meet_link=(org.default_meet_link or "").strip()
        or "https://meet.google.com/new"
    )


@router.put("/me/meeting-settings", response_model=OrganizationMeetingSettingsResponse)
def update_current_org_meeting_settings(
    payload: OrganizationMeetingSettingsUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update organization-level default Google Meet URL (admin only)."""
    org = (
        db.query(Organization)
        .filter(Organization.id == admin_user.organization_id)
        .first()
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    next_link = (payload.default_meet_link or "").strip()
    if not next_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="default_meet_link is required",
        )

    if not (next_link.startswith("https://") or next_link.startswith("http://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="default_meet_link must be a valid URL starting with http:// or https://",
        )

    org.default_meet_link = next_link
    db.commit()
    db.refresh(org)

    return OrganizationMeetingSettingsResponse(default_meet_link=org.default_meet_link)


@router.get("/me/widgets")
def get_current_org_widgets(
    source: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all widgets for the current user's organization.
    Available to all authenticated users (not just admins).
    """
    org_id = current_user.organization_id

    if source and source == "voice":
        calling_agents = (
            db.query(CallingAgent)
            .filter(
                CallingAgent.organization_id == org_id, CallingAgent.is_deleted == False
            )
            .all()
        )
        return {
            "widgets": [
                {
                    "widget_id": agent.widget_id,
                    "name": agent.name,
                    "created_at": (
                        agent.created_at.isoformat() if agent.created_at else None
                    ),
                }
                for agent in calling_agents
            ]
        }

    widgets = (
        db.query(WidgetConfig).filter(WidgetConfig.organization_id == org_id).all()
    )

    return {
        "widgets": [
            {
                "widget_id": w.widget_id,
                "name": w.name,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in widgets
        ]
    }


@router.get("/me/campaigns")
def get_current_org_campaigns(
    source: Optional[str] = Query(None),
    widget_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all campaigns for the current user's organization.
    Available to all authenticated users (not just admins).
    """
    org_id = current_user.organization_id

    if source and source == "voice":
        call_campaigns = (
            db.query(CallCampaign)
            .filter(CallCampaign.organization_id == org_id)
            .join(CallingAgent, CallCampaign.agent_id == CallingAgent.id)
            .all()
        )

        if widget_id:
            call_campaigns = [
                c for c in call_campaigns if c.agent and c.agent.widget_id == widget_id
            ]

        return {
            "campaigns": [
                {
                    "campaign_id": c.id,
                    "name": c.name,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in call_campaigns
            ]
        }

    campaigns = db.query(Campaign).filter(Campaign.organization_id == org_id).all()

    return {
        "campaigns": [
            {
                "campaign_id": w.id,
                "name": w.campaign_name,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in campaigns
        ]
    }


# ======================== User Management ========================
# Simplified endpoints that use current user's organization


def _normalize_assigned_widget_ids(raw_ids: Optional[List[str]]) -> List[str]:
    if not raw_ids:
        return []

    normalized: List[str] = []
    seen = set()
    for raw in raw_ids:
        widget_id = (raw or "").strip()
        if not widget_id or widget_id in seen:
            continue
        seen.add(widget_id)
        normalized.append(widget_id)
    return normalized


def _validate_widget_assignments(
    db: Session, organization_id: int, widget_ids: List[str]
) -> None:
    if not widget_ids:
        return

    rows = (
        db.query(WidgetConfig.widget_id)
        .filter(
            WidgetConfig.organization_id == organization_id,
            WidgetConfig.widget_id.in_(widget_ids),
        )
        .all()
    )
    valid_ids = {row[0] for row in rows}
    missing = [widget_id for widget_id in widget_ids if widget_id not in valid_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid agent/widget selection: {', '.join(missing)}",
        )


def _replace_user_widget_assignments(
    db: Session, user_id: int, widget_ids: List[str]
) -> None:
    db.query(HandoffAgentAssignment).filter(
        HandoffAgentAssignment.user_id == user_id
    ).delete(synchronize_session=False)

    for widget_id in widget_ids:
        db.add(HandoffAgentAssignment(user_id=user_id, widget_id=widget_id))


def _get_org_assignment_map(db: Session, organization_id: int) -> Dict[int, List[str]]:
    rows = (
        db.query(HandoffAgentAssignment.user_id, HandoffAgentAssignment.widget_id)
        .join(
            User,
            User.id == HandoffAgentAssignment.user_id,
        )
        .filter(User.organization_id == organization_id)
        .all()
    )

    assignment_map: Dict[int, List[str]] = {}
    for user_id, widget_id in rows:
        assignment_map.setdefault(user_id, []).append(widget_id)
    return assignment_map


def _serialize_user_with_assignments(
    user: User, assignment_map: Dict[int, List[str]]
) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "organization_id": user.organization_id,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "assigned_widget_ids": assignment_map.get(user.id, []),
    }


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new user in the current user's organization (admin only).
    """
    org_id = admin_user.organization_id
    
    valid = organization_credit_service.validate_feature_usage(
        db, org_id, FeatureCodes.PLATFORM_USER, 1
    )

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Insufficient credits. Please add more credits to continue.",
        )

    # Check if username already exists within the organization
    existing_user = (
        db.query(User)
        .filter(User.organization_id == org_id, User.username == user_data.username)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists in this organization",
        )

    # Check if email already exists in the organization
    existing_email = (
        db.query(User)
        .filter(User.organization_id == org_id, User.email == user_data.email)
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists in this organization",
        )

    selected_role = (
        user_data.role
        if hasattr(user_data, "role") and user_data.role
        else UserRole.USER
    )
    assigned_widget_ids = _normalize_assigned_widget_ids(
        getattr(user_data, "assigned_widget_ids", None)
    )

    # Enforce single admin per organization
    if selected_role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only one admin is allowed per organization",
        )

    if selected_role == UserRole.USER_HANDOFF:
        if not assigned_widget_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one agent assignment is required for User (Human Handoff)",
            )
        _validate_widget_assignments(db, org_id, assigned_widget_ids)

    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=selected_role,
        organization_id=org_id,
        is_active=True,
    )
    db.add(new_user)
    db.flush()
    
    organization_credit_service.deduct_credits(
        db=db,
        organization_id=org_id,
        feature_code=FeatureCodes.PLATFORM_USER,
        quantity=1,
        reference_type="user",
        reference_id=str(new_user.id)
    )
    
    if selected_role == UserRole.USER_HANDOFF:
        _replace_user_widget_assignments(db, new_user.id, assigned_widget_ids)

    db.commit()
    db.refresh(new_user)
    return _serialize_user_with_assignments(
        new_user, {new_user.id: assigned_widget_ids}
    )


@router.get("/users")  # , response_model=List[UserListResponse]
def list_users(
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    List all users in the current user's organization (admin only).
    """
    org_id = admin_user.organization_id
    query = db.query(User).filter(User.organization_id == org_id)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term),
            )
        )

    total = query.count()

    users = query.order_by(User.id.desc()).offset(skip).limit(limit).all()

    assignment_map = _get_org_assignment_map(db, org_id)

    return {
        "users": [
            _serialize_user_with_assignments(user, assignment_map) for user in users
        ],
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Get a specific user in the current user's organization (admin only).
    """
    org_id = admin_user.organization_id
    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    assignment_map = _get_org_assignment_map(db, org_id)
    return _serialize_user_with_assignments(user, assignment_map)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Update a user in the current user's organization (admin only).
    """
    org_id = admin_user.organization_id
    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent deactivating the only admin
    if user_data.is_active is False and user.role == UserRole.ADMIN:
        admin_count = (
            db.query(User)
            .filter(
                User.organization_id == org_id,
                User.role == UserRole.ADMIN,
                User.is_active == True,
            )
            .count()
        )
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the only admin user",
            )

    assignment_map = _get_org_assignment_map(db, org_id)
    current_widget_ids = assignment_map.get(user.id, [])

    if user_data.email is not None:
        user.email = user_data.email

    selected_role = user_data.role if user_data.role is not None else user.role
    if user_data.role is not None:
        if user_data.role == UserRole.ADMIN and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only one admin is allowed per organization",
            )
        user.role = user_data.role

    target_widget_ids = current_widget_ids
    if selected_role == UserRole.USER_HANDOFF:
        if user_data.assigned_widget_ids is not None:
            target_widget_ids = _normalize_assigned_widget_ids(
                user_data.assigned_widget_ids
            )
        if not target_widget_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one agent assignment is required for User (Human Handoff)",
            )
        _validate_widget_assignments(db, org_id, target_widget_ids)
    else:
        target_widget_ids = []

    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    _replace_user_widget_assignments(db, user.id, target_widget_ids)

    db.commit()
    db.refresh(user)
    return _serialize_user_with_assignments(user, {user.id: target_widget_ids})


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a user from the current user's organization (admin only).
    Cannot delete the only admin user.
    """
    org_id = admin_user.organization_id
    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent deleting the only admin
    if user.role == UserRole.ADMIN:
        admin_count = (
            db.query(User)
            .filter(User.organization_id == org_id, User.role == UserRole.ADMIN)
            .count()
        )
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only admin user",
            )

    db.query(HandoffAgentAssignment).filter(
        HandoffAgentAssignment.user_id == user.id
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()


# ======================== Organization by ID ========================


@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get organization details (admin only)."""
    if current_user.role != UserRole.ADMIN or current_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


# ======================== Organization-scoped endpoints ========================


@router.post(
    "/{org_id}/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def create_user_in_organization(
    org_id: int,
    user_data: UserCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new user in the organization (admin only).
    Admin must be part of the same organization.
    """
    # Verify admin is in the same organization
    if admin_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create users in another organization",
        )

    # Check if username already exists within the organization
    existing_user = (
        db.query(User)
        .filter(User.organization_id == org_id, User.username == user_data.username)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists in this organization",
        )

    # Check if email already exists in the organization (to prevent duplicates within org)
    existing_email = (
        db.query(User)
        .filter(User.organization_id == org_id, User.email == user_data.email)
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists in this organization",
        )

    selected_role = (
        user_data.role
        if hasattr(user_data, "role") and user_data.role
        else UserRole.USER
    )
    assigned_widget_ids = _normalize_assigned_widget_ids(
        getattr(user_data, "assigned_widget_ids", None)
    )
    if selected_role == UserRole.USER_HANDOFF:
        if not assigned_widget_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one agent assignment is required for User (Human Handoff)",
            )
        _validate_widget_assignments(db, org_id, assigned_widget_ids)

    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=selected_role,
        organization_id=org_id,
        is_active=True,
    )
    db.add(new_user)

    db.flush()
    if selected_role == UserRole.USER_HANDOFF:
        _replace_user_widget_assignments(db, new_user.id, assigned_widget_ids)

    db.commit()
    db.refresh(new_user)
    return _serialize_user_with_assignments(
        new_user, {new_user.id: assigned_widget_ids}
    )


@router.get("/{org_id}/users", response_model=List[UserListResponse])
def list_organization_users(
    org_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    List all users in an organization (admin only).
    Admin must be part of the same organization.
    """
    if admin_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access users in another organization",
        )

    users = db.query(User).filter(User.organization_id == org_id).all()
    assignment_map = _get_org_assignment_map(db, org_id)
    return [_serialize_user_with_assignments(user, assignment_map) for user in users]


@router.get("/{org_id}/users/{user_id}", response_model=UserResponse)
def get_organization_user(
    org_id: int,
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Get a specific user in an organization (admin only).
    Admin must be part of the same organization.
    """
    if admin_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access users in another organization",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    assignment_map = _get_org_assignment_map(db, org_id)
    return _serialize_user_with_assignments(user, assignment_map)


@router.patch("/{org_id}/users/{user_id}", response_model=UserResponse)
def update_organization_user(
    org_id: int,
    user_id: int,
    user_data: UserUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Update a user in an organization (admin only).
    Admin must be part of the same organization.
    """
    if admin_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update users in another organization",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent deactivating the only admin
    if user_data.is_active is False and user.role == UserRole.ADMIN:
        admin_count = (
            db.query(User)
            .filter(
                User.organization_id == org_id,
                User.role == UserRole.ADMIN,
                User.is_active == True,
            )
            .count()
        )
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the only admin user",
            )

    assignment_map = _get_org_assignment_map(db, org_id)
    current_widget_ids = assignment_map.get(user.id, [])

    if user_data.email is not None:
        user.email = user_data.email

    selected_role = user_data.role if user_data.role is not None else user.role
    if user_data.role is not None:
        user.role = user_data.role

    target_widget_ids = current_widget_ids
    if selected_role == UserRole.USER_HANDOFF:
        if user_data.assigned_widget_ids is not None:
            target_widget_ids = _normalize_assigned_widget_ids(
                user_data.assigned_widget_ids
            )
        if not target_widget_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one agent assignment is required for User (Human Handoff)",
            )
        _validate_widget_assignments(db, org_id, target_widget_ids)
    else:
        target_widget_ids = []

    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    _replace_user_widget_assignments(db, user.id, target_widget_ids)

    db.commit()
    db.refresh(user)
    return _serialize_user_with_assignments(user, {user.id: target_widget_ids})


@router.delete("/{org_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization_user(
    org_id: int,
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a user from an organization (admin only).
    Admin must be part of the same organization.
    Cannot delete the only admin user.
    """
    if admin_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete users in another organization",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent deleting the only admin
    if user.role == UserRole.ADMIN:
        admin_count = (
            db.query(User)
            .filter(User.organization_id == org_id, User.role == UserRole.ADMIN)
            .count()
        )
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only admin user",
            )

    db.query(HandoffAgentAssignment).filter(
        HandoffAgentAssignment.user_id == user.id
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()


@router.get("/widgets")
def get_organization_widgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all widgets for the current user's organization.
    Available to all authenticated users (not just admins).
    """
    org_id = current_user.organization_id

    widgets = (
        db.query(WidgetConfig).filter(WidgetConfig.organization_id == org_id).all()
    )

    return {
        "widgets": [
            {
                "widget_id": w.widget_id,
                "name": w.name,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in widgets
        ]
    }


@router.get("/credits/summary")
def get_credit_summary(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Get credit summary for the organization.
    """
    return organization_credit_service.get_credit_summary(
        db, current_user.organization_id
    )


@router.get("/credits/validate")
def validate_credits(
    feature_code: str = Query(..., description="Feature code to validate credits for"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return organization_credit_service.validate_credits(
        db, current_user.organization_id
    )


@router.post("/credits/deduct")
def deduct_credits(
    params: CreditParameters,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return organization_credit_service.deduct_credits(
        db, 
        current_user.organization_id, 
        params.feature_code,
        params.quantity,
        params.reference_type,
        params.reference_id
    )


@router.post("/credits/reserve")
def reserve_credits(
    params: CreditParameters,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return organization_credit_service.reserve_credits(
        db,
        current_user.organization_id,
        params.feature_code,
        params.quantity,
        params.reference_type,
        params.reference_id,
    )


@router.post("/credits/consume")
def consume_credits(
    params: CreditParameters,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return organization_credit_service.consume_reserved_credits(
        db,
        params.reference_type,
        params.reference_id,
        params.quantity
    )


@router.post("/smtp/test")
def send_test_email(
    payload: SMTPTestRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    org_name = (
        db.query(Organization.name)
        .filter(Organization.id == current_user.organization_id)
        .scalar()
    )

    # Build temporary settings object
    settings = OrganizationSettings(
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_username=payload.smtp_username,
        smtp_password=payload.smtp_password,
        smtp_sender_email=payload.smtp_sender_email,
        smtp_use_tls=payload.smtp_use_tls,
    )

    success, error = email_service.send_smtp_test_email(
        payload.test_email,
        org_name,
        settings
    )

    if not success:
        raise HTTPException(status_code=400, detail=error)

    return {"message": "Test email sent successfully"}