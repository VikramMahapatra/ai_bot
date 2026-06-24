from fastapi import HTTPException
from requests import Session
from sqlalchemy import func, literal_column, or_
from sqlalchemy.dialects.postgresql import JSON
from typing import Optional

from app.models.calling_numbers import CallingNumber
from app.models.user import Organization
from app.schemas.channel import ChannelUpdate
from app.models.organization_calling_numbers import OrganizationCallingNumber
from app.schemas.calling_number import CallingNumberUpdate


def create(db: Session, data):
    result = True
    error_message = None

    existing_number = (
        db.query(CallingNumber)
        .filter(
            or_(
                CallingNumber.phone_number.ilike(data.phone_number),
            )
        )
        .first()
    )

    if existing_number:
        if existing_number.phone_number.lower() == data.phone_number.lower():
            error_message = "Calling number already exists"
            result = False

    if result:
        calling_number = CallingNumber(
            phone_number=data.phone_number,
            type=data.type,
            country_code=data.country_code,
            provider=data.provider,
            is_active=data.is_active,
        )

        db.add(calling_number)
        db.commit()
        db.refresh(calling_number)

    return {
        "success": result,
        "message": "Calling number created successfully" if result else error_message,
    }


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
):
    query = (
        db.query(
            CallingNumber.id.label("id"),
            CallingNumber.phone_number.label("phone_number"),
            CallingNumber.type,
            CallingNumber.country_code,
            CallingNumber.provider,
            CallingNumber.is_active.label("is_active"),
            func.coalesce(
                func.json_agg(
                    func.json_build_object(
                        "id", Organization.id, "name", Organization.name
                    )
                ).filter(Organization.id.isnot(None)),
                literal_column("'[]'::json"),  # ✅ FIXED
            ).label("organizations"),
        )
        .outerjoin(
            OrganizationCallingNumber,
            OrganizationCallingNumber.calling_number_id == CallingNumber.id,
        )
        .outerjoin(
            Organization, Organization.id == OrganizationCallingNumber.organization_id
        )
        .filter(CallingNumber.is_deleted == False)
        .group_by(CallingNumber.id)
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                CallingNumber.phone_number.ilike(search_term),
            )
        )

    total = query.count()

    calling_numbers = (
        query.order_by(CallingNumber.id.asc()).offset(skip).limit(limit).all()
    )

    return {
        "items": [
            {
                "id": row.id,
                "phone_number": row.phone_number,
                "country_code": row.country_code,
                "type": row.type,
                "provider": row.provider,
                "is_active": row.is_active,
                "organizations": row.organizations or [],
            }
            for row in calling_numbers
        ],
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


def update(db: Session, calling_number_id: int, data: CallingNumberUpdate):
    result = True
    error_message = None

    db_calling_number = (
        db.query(CallingNumber)
        .filter(
            CallingNumber.id == calling_number_id, CallingNumber.is_deleted == False
        )
        .first()
    )

    if not db_calling_number:
        raise HTTPException(status_code=404, detail="Calling number not found")

    # Check duplicate name (exclude current product)
    if data.phone_number:
        existing_number = (
            db.query(CallingNumber)
            .filter(
                CallingNumber.id != calling_number_id,
                CallingNumber.is_deleted == False,
                or_(
                    (
                        CallingNumber.phone_number.ilike(data.phone_number)
                        if data.phone_number
                        else False
                    ),
                ),
            )
            .first()
        )

        if existing_number:
            if (
                data.phone_number
                and existing_number.phone_number.lower() == data.phone_number.lower()
            ):
                result = False
                error_message = "Calling number already exists"

    # Update fields
    if result:
        for key, value in data.dict(exclude_unset=True).items():
            setattr(db_calling_number, key, value)

        db.commit()
        db.refresh(db_calling_number)

    return {
        "success": result,
        "message": "Calling number updated successfully" if result else error_message,
    }


def soft_delete(db: Session, calling_number_id: int):

    calling_number = (
        db.query(CallingNumber)
        .filter(
            CallingNumber.id == calling_number_id,
            CallingNumber.is_deleted.is_(False),
        )
        .first()
    )

    if not calling_number:
        raise HTTPException(status_code=404, detail="Calling number not found")

    is_mapped = (
        db.query(OrganizationCallingNumber.id)
        .filter(
            OrganizationCallingNumber.calling_number_id == calling_number_id,
            OrganizationCallingNumber.is_active.is_(True),
        )
        .first()
    )

    if is_mapped:
        raise HTTPException(
            status_code=400,
            detail="Calling number is assigned to an organization and cannot be deleted",
        )

    calling_number.is_deleted = True
    db.commit()
