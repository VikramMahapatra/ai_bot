from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, exists
from sqlalchemy.orm import Session

from app.models.channels import Channel, ChannelReservation, OrganizationChannel


def validate_channel_available(
    db: Session,
    organization_id: int,
    call_type: str
):
    active_res_subq = (
        db.query(ChannelReservation.channel_id)
        .filter(ChannelReservation.is_active == True)
    )

    base_query = (
        db.query(Channel.id)
        .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
        .filter(OrganizationChannel.organization_id == organization_id)
        .filter(~Channel.id.in_(active_res_subq))
    )

    if call_type == "test":
        # test prefers free, but can use paid
        available = base_query.first()

    elif call_type == "campaign":
        # campaign prefers paid (strict)
        available = base_query.filter(Channel.channel_type == "paid").first()

        # fallback (optional)
        if not available:
            available = base_query.filter(Channel.channel_type == "free").first()

    else:
        raise HTTPException(status_code=400, detail="Invalid Call Type")

    if not available:
        raise HTTPException(status_code=400, detail="All channels are currently occupied")
    
    
def reserve_channel(
    db: Session,
    organization_id: int,
    call_type: str,
    reference_id: int
):
    active_res_subq = (
        db.query(ChannelReservation.channel_id)
        .filter(ChannelReservation.is_active == True)
    )

    base_query = (
        db.query(Channel)
        .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
        .filter(OrganizationChannel.organization_id == organization_id)
        .filter(~Channel.id.in_(active_res_subq))
        .with_for_update(skip_locked=True)
    )

    channel = None

    # -------------------------
    # PRIORITY LOGIC
    # -------------------------

    if call_type == "test":
        # prefer free
        channel = base_query.filter(Channel.channel_type == "free").first()

        if not channel:
            channel = base_query.filter(Channel.channel_type == "paid").first()

    elif call_type == "campaign":
        # prefer paid
        channel = base_query.filter(Channel.channel_type == "paid").first()

        # fallback (optional)
        if not channel:
            channel = base_query.filter(Channel.channel_type == "free").first()

    else:
        raise HTTPException(status_code=400, detail="Invalid call_type")

    if not channel:
        raise HTTPException(status_code=400, detail="All channels are currently occupied")

    # -------------------------
    # CREATE RESERVATION
    # -------------------------

    reservation = ChannelReservation(
        organization_id=organization_id,
        channel_id=channel.id,
        call_type=call_type,
        reference_id=reference_id,
        is_active=True,
        reserved_at=datetime.utcnow()
    )

    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    return reservation


def release_channel(
    db: Session,
    call_type: str,
    reference_id: int
):
    reservation = (
        db.query(ChannelReservation)
        .filter(
            ChannelReservation.reference_id == reference_id,
            ChannelReservation.call_type == call_type,
            ChannelReservation.is_active == True
        )
        .first()
    )

    if not reservation:
        return  # already released or not found

    reservation.is_active = False
    reservation.released_at = datetime.utcnow()

    db.commit()
    
    
    
def cleanup_stale_reservations(db: Session, timeout_minutes: int = 30):
    cutoff = datetime.utcnow() - timedelta(minutes=timeout_minutes)

    stale = (
        db.query(ChannelReservation)
        .filter(
            ChannelReservation.is_active == True,
            ChannelReservation.reserved_at < cutoff
        )
        .all()
    )

    for r in stale:
        r.is_active = False
        r.released_at = datetime.utcnow()

    db.commit()