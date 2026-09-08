from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, exists, func
from sqlalchemy.orm import Session

from app.models.channels import Channel, ChannelReservation, OrganizationChannel
from app.config import settings


def validate_channel_available(db: Session, organization_id: int, call_type: str):
    def get_available_channel(org_id: int):
        org_channel_ids = (
            db.query(Channel.id)
            .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
            .filter(OrganizationChannel.organization_id == org_id)
            .subquery()
        )

        active_res_subq = (
            db.query(ChannelReservation.channel_id)
            .filter(ChannelReservation.is_active == True)
            .subquery()
        )

        available = (
            db.query(Channel.id)
            .filter(Channel.id.in_(org_channel_ids), ~Channel.id.in_(active_res_subq))
            .first()
        )

        return available[0] if available else None

    # =================================================
    # CAMPAIGN
    # Only use organization's own channel
    # =================================================
    if call_type == "campaign":
        channel_id = get_available_channel(organization_id)

        if not channel_id:
            raise HTTPException(
                status_code=400, detail="No available channels for campaign"
            )

        return channel_id

    # =================================================
    # TEST
    # Own channel first
    # Then Zentrixel channel
    # =================================================
    if call_type == "test":

        # 1. Try organization's own channel
        channel_id = get_available_channel(organization_id)

        if channel_id:
            return channel_id

        # 2. Try Zentrixel channel
        if organization_id != settings.ZENTRIXEL_ORG_ID:

            channel_id = get_available_channel(settings.ZENTRIXEL_ORG_ID)

            if channel_id:
                return channel_id

        raise HTTPException(
            status_code=400, detail="No available channels for test call"
        )

    # =================================================
    # OTHER CALL TYPES
    # =================================================
    channel_id = get_available_channel(organization_id)

    if not channel_id:
        raise HTTPException(status_code=400, detail="No available channels")

    return channel_id


def reserve_channel(
    db: Session, organization_id: int, call_type: str, reference_id: int
):
    active_res_subq = db.query(ChannelReservation.channel_id).filter(
        ChannelReservation.is_active == True
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
        raise HTTPException(
            status_code=400, detail="All channels are currently occupied"
        )

    # -------------------------
    # CREATE RESERVATION
    # -------------------------

    reservation = ChannelReservation(
        organization_id=organization_id,
        channel_id=channel.id,
        call_type=call_type,
        reference_id=reference_id,
        is_active=True,
        reserved_at=datetime.utcnow(),
    )

    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    return reservation


def release_channel(db: Session, call_type: str, reference_id: int):
    reservation = (
        db.query(ChannelReservation)
        .filter(
            ChannelReservation.reference_id == reference_id,
            ChannelReservation.call_type == call_type,
            ChannelReservation.is_active == True,
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
            ChannelReservation.reserved_at < cutoff,
        )
        .all()
    )

    for r in stale:
        r.is_active = False
        r.released_at = datetime.utcnow()

    db.commit()
