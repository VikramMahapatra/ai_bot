from fastapi import HTTPException
from requests import Session
from sqlalchemy import func, literal_column, or_
from sqlalchemy.dialects.postgresql import JSON
from typing import Optional

from app.models.channels import Channel, OrganizationChannel
from app.models.user import Organization
from app.schemas.channel import ChannelUpdate


def create(db: Session, data):
    result = True
    error_message = None

    existing_channel = (
        db.query(Channel)
        .filter(
            or_(
                Channel.name.ilike(data.name),
            )
        )
        .first()
    )

    if existing_channel:
        if existing_channel.name.lower() == data.name.lower():
            error_message = "Channel name already exists"
            result = False

    if result:
        channel = Channel(
            name=data.name,
            is_active=data.is_active,
        )

        db.add(channel)
        db.commit()
        db.refresh(channel)

    return {
        "success": result,
        "message": "Channel created successfully" if result else error_message,
    }


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
):
    query = (
        db.query(
            Channel.id.label("channel_id"),
            Channel.name.label("name"),
            Channel.is_active.label("is_active"),
            func.coalesce(
                func.json_agg(
                    func.json_build_object(
                        "id", Organization.id, "name", Organization.name
                    )
                ).filter(Organization.id.isnot(None)),
                literal_column("'[]'::json"),  # ✅ FIXED
            ).label("organizations"),
        )
        .outerjoin(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
        .outerjoin(Organization, Organization.id == OrganizationChannel.organization_id)
        .filter(Channel.is_deleted == False)
        .group_by(Channel.id)
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Channel.name.ilike(search_term),
            )
        )

    total = query.count()

    channels = query.order_by(Channel.id.asc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "channel_id": row.channel_id,
                "name": row.name,
                "is_active": row.is_active,
                "organizations": row.organizations or [],
            }
            for row in channels
        ],
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


def update(db: Session, channel_id: int, data: ChannelUpdate):
    result = True
    error_message = None

    db_channel = (
        db.query(Channel)
        .filter(Channel.id == channel_id, Channel.is_deleted == False)
        .first()
    )

    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check duplicate name (exclude current product)
    if data.name:
        existing_channel = (
            db.query(Channel)
            .filter(
                Channel.id != channel_id,
                Channel.is_deleted == False,
                or_(
                    Channel.name.ilike(data.name) if data.name else False,
                ),
            )
            .first()
        )

        if existing_channel:
            if data.name and existing_channel.name.lower() == data.name.lower():
                result = False
                error_message = "Channel name already exists"

    # Update fields
    if result:
        if data.name is not None:
            db_channel.name = data.name.strip()

        if data.is_active is not None:
            db_channel.is_active = data.is_active

        db.commit()
        db.refresh(db_channel)

    return {
        "success": result,
        "message": "Channel updated successfully" if result else error_message,
    }


def soft_delete(db: Session, channel_id: int):

    channel = (
        db.query(Channel)
        .filter(Channel.id == channel_id, Channel.is_deleted == False)
        .first()
    )

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel.is_deleted = True
    db.commit()
