from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user, require_admin, get_password_hash, create_access_token
from app.models import User, Organization, UserRole
from app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    UserCreate,
    UserResponse,
    UserListResponse,
    UserUpdate,
)
from typing import List

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    org_data: OrganizationCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new organization (for initial setup/registration flow).
    Returns the organization details.
    """
    # Check if organization already exists
    existing_org = db.query(Organization).filter(Organization.name == org_data.name).first()
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name already exists",
        )
    
    new_org = Organization(
        name=org_data.name,
        description=org_data.description,
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
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


# ======================== User Management ========================
# Simplified endpoints that use current user's organization


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
    
    # Check if username already exists within the organization
    existing_user = db.query(User).filter(
        User.organization_id == org_id,
        User.username == user_data.username
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists in this organization",
        )
    
    # Check if email already exists in the organization
    existing_email = db.query(User).filter(
        User.organization_id == org_id,
        User.email == user_data.email
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists in this organization",
        )
    
    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role if hasattr(user_data, 'role') and user_data.role else UserRole.USER,
        organization_id=org_id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/users", response_model=List[UserListResponse])
def list_users(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    List all users in the current user's organization (admin only).
    """
    org_id = admin_user.organization_id
    users = db.query(User).filter(User.organization_id == org_id).all()
    return users


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
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == org_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


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
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == org_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent deactivating the only admin
    if user_data.is_active is False and user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(
            User.organization_id == org_id,
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).count()
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the only admin user",
            )
    
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(user)
    return user


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
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == org_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent deleting the only admin
    if user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(
            User.organization_id == org_id,
            User.role == UserRole.ADMIN
        ).count()
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only admin user",
            )
    
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

@router.post("/{org_id}/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
    existing_user = db.query(User).filter(
        User.organization_id == org_id,
        User.username == user_data.username
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists in this organization",
        )
    
    # Check if email already exists in the organization (to prevent duplicates within org)
    existing_email = db.query(User).filter(
        User.organization_id == org_id,
        User.email == user_data.email
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists in this organization",
        )
    
    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        organization_id=org_id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


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
    return users


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
    
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == org_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


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
    
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == org_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent deactivating the only admin
    if user_data.is_active is False and user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(
            User.organization_id == org_id,
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).count()
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the only admin user",
            )
    
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(user)
    return user


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
    
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == org_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent deleting the only admin
    if user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(
            User.organization_id == org_id,
            User.role == UserRole.ADMIN
        ).count()
        if admin_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only admin user",
            )
    
    db.delete(user)
    db.commit()
