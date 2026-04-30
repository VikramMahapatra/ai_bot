from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, exists, func
from sqlalchemy.orm import Session

from app.models.channels import Channel, ChannelReservation, OrganizationChannel

def validate_channel_available(
    db: Session,
    organization_id: int,
    call_type: str
):
    active_res = db.query(ChannelReservation).filter(
        ChannelReservation.is_active == True
    )

    # -------------------------
    # TOTAL CHANNELS FOR ORG
    # -------------------------
    total_channels = (
        db.query(func.count(Channel.id))
        .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
        .filter(OrganizationChannel.organization_id == organization_id)
        .scalar()
    )

    if total_channels == 0:
        raise HTTPException(status_code=400, detail="No channels assigned")

    # -------------------------
    # TOTAL ACTIVE RESERVATIONS (GLOBAL)
    # -------------------------
    total_active_reservations = (
        active_res.count()
    )

    # -------------------------
    # ORG ACTIVE CAMPAIGNS
    # -------------------------
    org_active_campaigns = (
        active_res.filter(
            ChannelReservation.organization_id == organization_id,
            ChannelReservation.call_type == "campaign"
        ).count()
    )

    # -------------------------
    # CAMPAIGN RULE
    # -------------------------
    if call_type == "campaign":
        # available capacity for this org
        available_capacity = total_channels - total_active_reservations

        if org_active_campaigns >= available_capacity:
            raise HTTPException(
                status_code=400,
                detail="No available channels for new campaign"
            )

    # -------------------------
    # FINAL FREE CHANNEL CHECK
    # -------------------------
    active_res_subq = (
        db.query(ChannelReservation.channel_id)
        .filter(ChannelReservation.is_active == True)
    )

    available = (
        db.query(Channel.id)
        .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
        .filter(OrganizationChannel.organization_id == organization_id)
        .filter(~Channel.id.in_(active_res_subq))
        .first()
    )

    if not available:
        raise HTTPException(
            status_code=400,
            detail="All channels are currently occupied"
        )
    
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

    channel = (
        db.query(Channel)
        .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
        .filter(OrganizationChannel.organization_id == organization_id)
        .filter(~Channel.id.in_(active_res_subq))
        .with_for_update(skip_locked=True)
        .first()
    )

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