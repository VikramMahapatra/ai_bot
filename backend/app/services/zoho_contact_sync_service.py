import asyncio
from datetime import date, datetime, time, timedelta, timezone
import logging
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session
from app.models.campaign import Campaign, Contact, ContactList
from app.models.organization_zoho_integrations import OrganizationZohoIntegration
from app.models.zoho_contact_sync_states import ZohoContactSyncState
from app.database import SessionLocal
from app.services.integration_hub_service import integration_hub_service
from app.config import settings
from app.services.conversation_outcome_service import (
    _seconds_until_next_interval,
)
from app.api.campaigns import _execute_campaign_now
from app.models.zoho_automation_logs import ZohoAutomationLog
from collections import defaultdict

from app.services.call_log_service import reschedule_contact
from app.models.call_campaigns import CallCampaign
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.models.channels import Channel, ChannelReservation, OrganizationChannel
from app.services import organization_channel_service
from app.services.call_campaign_service import get_external_contact_ids
from app.utils.echoleads_client import EcholeadsClient

logger = logging.getLogger(__name__)


def get_or_create_zoho_contact_list(
    db: Session,
    organization_id: int,
) -> ContactList:
    """
    Get or create the organization-level contact list used
    for contacts synchronized from Zoho CRM.
    """

    list_name = "Zoho CRM Contacts"

    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.organization_id == organization_id,
            ContactList.list_name == list_name,
        )
        .first()
    )

    if not contact_list:
        contact_list = ContactList(
            organization_id=organization_id,
            list_name=list_name,
            description="Contacts synchronized from Zoho CRM",
        )

        db.add(contact_list)
        db.flush()

    return contact_list


def create_zoho_automation_logs(
    db: Session,
    integration: OrganizationZohoIntegration,
    contact: Contact,
    staged_contact: dict,
):
    logs = []

    event_id = staged_contact.get("id") or staged_contact.get("external_id")
    event_id = str(event_id) if event_id else None

    # Email
    if (
        integration.auto_email_enabled
        and integration.auto_email_campaign_id
        and contact.email
    ):
        logs.append(
            ZohoAutomationLog(
                organization_id=integration.organization_id,
                integration_id=integration.id,
                contact_id=contact.id,
                campaign_id=integration.auto_email_campaign_id,
                automation_type="email",
                status="pending",
                zoho_event_id=event_id,
            )
        )

    # WhatsApp
    if (
        integration.auto_whatsapp_enabled
        and integration.auto_whatsapp_campaign_id
        and contact.phone
    ):
        logs.append(
            ZohoAutomationLog(
                organization_id=integration.organization_id,
                integration_id=integration.id,
                contact_id=contact.id,
                campaign_id=integration.auto_whatsapp_campaign_id,
                automation_type="whatsapp",
                status="pending",
                zoho_event_id=event_id,
            )
        )

    # Call
    if (
        integration.auto_calling_enabled
        and integration.auto_calling_campaign_id
        and contact.phone
    ):
        logs.append(
            ZohoAutomationLog(
                organization_id=integration.organization_id,
                integration_id=integration.id,
                contact_id=contact.id,
                campaign_id=integration.auto_calling_campaign_id,
                automation_type="call",
                status="pending",
                zoho_event_id=event_id,
            )
        )

    if logs:
        db.add_all(logs)


def process_zoho_contact(
    db: Session,
    integration: OrganizationZohoIntegration,
    staged_contact: dict,
):
    external_id = staged_contact.get("external_id")

    if not external_id:
        return None, False

    external_id = str(external_id)

    content_hash = staged_contact.get("content_hash")

    sync_state = (
        db.query(ZohoContactSyncState)
        .filter(
            ZohoContactSyncState.connection_id == integration.integration_connection_id,
            ZohoContactSyncState.external_contact_id == external_id,
        )
        .first()
    )

    if sync_state and sync_state.content_hash == content_hash:
        return None, False

    # Get/create the common Zoho contact list
    zoho_contact_list = get_or_create_zoho_contact_list(
        db=db,
        organization_id=integration.organization_id,
    )

    payload = staged_contact.get("payload") or {}

    # Integration Hub already returns normalized fields
    first_name = payload.get("first_name") or ""
    last_name = payload.get("last_name") or ""

    name = f"{first_name} {last_name}".strip()

    email = payload.get("email")
    phone = payload.get("phone")
    mobile = payload.get("mobile")

    whatsapp_number = mobile or phone

    company = payload.get("company_name")
    designation = payload.get("title")

    # Find existing contact using Zoho external ID
    contact = (
        db.query(Contact)
        .filter(
            Contact.contact_list_id == zoho_contact_list.id,
            Contact.external_crm_id == external_id,
        )
        .first()
    )

    if contact:
        # Update existing contact
        contact.name = name or contact.name
        contact.email = email or contact.email
        contact.phone = phone or contact.phone
        contact.whatsapp_number = whatsapp_number or contact.whatsapp_number
        contact.company = company or contact.company
        contact.designation = designation or contact.designation
        contact.source = "zoho_crm"

    else:
        # Create new contact
        contact = Contact(
            contact_list_id=zoho_contact_list.id,
            name=name,
            email=email,
            phone=phone,
            whatsapp_number=whatsapp_number,
            company=company,
            designation=designation,
            source="zoho_crm",
            external_crm_id=external_id,
        )

        db.add(contact)

    # Update sync state
    remote_updated_at = staged_contact.get("remote_updated_at")

    if not sync_state:
        sync_state = ZohoContactSyncState(
            organization_id=integration.organization_id,
            connection_id=integration.integration_connection_id,
            external_contact_id=external_id,
            content_hash=content_hash,
            remote_updated_at=remote_updated_at,
            last_processed_at=datetime.now(timezone.utc),
        )

        db.add(sync_state)

    else:
        sync_state.content_hash = content_hash
        sync_state.remote_updated_at = remote_updated_at
        sync_state.last_processed_at = datetime.now(timezone.utc)

    db.flush()

    return contact, True


async def process_zoho_contacts(
    batch_size: int,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:

    processed = 0
    failed = 0

    db = SessionLocal()

    try:
        query = db.query(OrganizationZohoIntegration).filter(
            OrganizationZohoIntegration.is_connected.is_(True),
            OrganizationZohoIntegration.integration_connection_id.isnot(None),
        )

        if organization_id:
            query = query.filter(
                OrganizationZohoIntegration.organization_id == organization_id
            )

        integrations = query.all()

        for integration in integrations:

            try:
                offset = 0

                while True:

                    staged_contacts = await integration_hub_service.get_staged_contacts(
                        connection_id=integration.integration_connection_id,
                        limit=batch_size,
                        offset=offset,
                    )

                    if not staged_contacts:
                        break

                    # Collect all changed contacts from this batch
                    automation_contacts: List[Contact] = []

                    for staged_contact in staged_contacts:

                        try:
                            contact, changed = process_zoho_contact(
                                db=db,
                                integration=integration,
                                staged_contact=staged_contact,
                            )

                            if not changed:
                                continue

                            processed += 1

                            # Add changed contact to batch
                            create_zoho_automation_logs(
                                db=db,
                                integration=integration,
                                contact=contact,
                                staged_contact=staged_contact,
                            )

                        except Exception as exc:
                            failed += 1

                            logger.error(
                                "Failed to process Zoho contact: "
                                "organization=%s external_id=%s error=%s",
                                integration.organization_id,
                                staged_contact.get("external_id"),
                                exc,
                                exc_info=True,
                            )

                    db.commit()

                    if len(staged_contacts) < batch_size:
                        break

                    offset += batch_size

            except Exception as exc:
                db.rollback()

                failed += 1

                logger.error(
                    "Zoho CRM integration processing failed: "
                    "organization=%s connection_id=%s error=%s",
                    integration.organization_id,
                    integration.integration_connection_id,
                    exc,
                    exc_info=True,
                )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    return processed, failed


async def _process_zoho_contact_sync_batches(
    batch_size: int,
    max_batches: int,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:

    total_processed = 0
    total_failed = 0

    for _ in range(max_batches):

        processed, failed = await process_zoho_contacts(
            batch_size=batch_size,
            organization_id=organization_id,
        )

        total_processed += processed
        total_failed += failed

        if processed == 0:
            break

    return total_processed, total_failed


def process_zoho_contact_sync_batches(
    batch_size: int,
    max_batches: int,
) -> Tuple[int, int]:

    return asyncio.run(
        _process_zoho_contact_sync_batches(
            batch_size=batch_size,
            max_batches=max_batches,
        )
    )


async def run_zoho_contact_sync_daemon(
    stop_event: asyncio.Event,
) -> None:

    initial_delay = max(
        settings.ZOHO_CONTACT_SYNC_DAEMON_INITIAL_DELAY_SECONDS,
        0,
    )

    if initial_delay:
        await asyncio.sleep(initial_delay)

    # Initial sync in separate thread
    try:
        processed, failed = await asyncio.to_thread(
            process_zoho_contact_sync_batches,
            batch_size=settings.ZOHO_CONTACT_SYNC_DAEMON_BATCH_SIZE,
            max_batches=settings.ZOHO_CONTACT_SYNC_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial Zoho contact sync completed: " "processed=%s failed=%s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial Zoho contact sync failed: %s",
            exc,
            exc_info=True,
        )

    # Recurring sync
    while not stop_event.is_set():

        wait_seconds = _seconds_until_next_interval(
            settings.ZOHO_CONTACT_SYNC_DAEMON_INTERVAL_SECONDS
        )

        logger.info(
            "Zoho contact sync daemon waiting %s seconds",
            wait_seconds,
        )

        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=wait_seconds,
            )
            break

        except asyncio.TimeoutError:
            pass

        logger.info("Starting Zoho contact sync in separate thread")

        try:
            processed, failed = await asyncio.to_thread(
                process_zoho_contact_sync_batches,
                batch_size=settings.ZOHO_CONTACT_SYNC_DAEMON_BATCH_SIZE,
                max_batches=settings.ZOHO_CONTACT_SYNC_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Zoho contact sync completed: " "processed=%s failed=%s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Zoho contact sync failed: %s",
                exc,
                exc_info=True,
            )


async def trigger_zoho_email_campaign(
    db: Session,
    organization_id: int,
    campaign_id: int,
    contacts: List[Contact],
) -> dict:

    if not contacts:
        return {
            "status": "skipped",
            "reason": "no_contacts",
            "processed_count": 0,
        }

    campaign = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == organization_id,
            Campaign.campaign_type == "email",
        )
        .first()
    )

    if not campaign:
        logger.warning(
            "Zoho email automation campaign not found: " "organization=%s campaign=%s",
            organization_id,
            campaign_id,
        )

        return {
            "status": "failed",
            "reason": "campaign_not_found",
            "processed_count": 0,
        }

    # Only contacts with email
    valid_contacts = [contact for contact in contacts if contact.email]

    if not valid_contacts:
        logger.info(
            "No Zoho contacts with email available for automation: "
            "organization=%s campaign=%s",
            organization_id,
            campaign.id,
        )

        return {
            "status": "skipped",
            "reason": "no_email_contacts",
            "processed_count": 0,
        }

    result = _execute_campaign_now(
        db=db,
        campaign=campaign,
        contacts=valid_contacts,
        auto_trigger=True,
    )

    logger.info(
        "Zoho email automation executed: "
        "organization=%s campaign=%s contacts=%s result=%s",
        organization_id,
        campaign.id,
        len(valid_contacts),
        result,
    )

    # Normalize result
    if isinstance(result, dict):
        processed_count = result.get(
            "processed_count",
            result.get("sent_count", len(valid_contacts)),
        )

        return {
            **result,
            "status": result.get("status", "completed"),
            "processed_count": processed_count,
        }

    return {
        "status": "completed",
        "processed_count": len(valid_contacts),
    }


async def trigger_zoho_whatsapp_campaign(
    db: Session,
    organization_id: int,
    campaign_id: int,
    contacts: List[Contact],
) -> dict:

    if not contacts:
        return {
            "status": "skipped",
            "reason": "no_contacts",
            "processed_count": 0,
        }

    campaign = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == organization_id,
            Campaign.campaign_type == "whatsapp",
        )
        .first()
    )

    if not campaign:
        logger.warning(
            "Zoho WhatsApp automation campaign not found: "
            "organization=%s campaign=%s",
            organization_id,
            campaign_id,
        )

        return {
            "status": "failed",
            "reason": "campaign_not_found",
            "processed_count": 0,
        }

    # WhatsApp requires phone
    valid_contacts = [contact for contact in contacts if contact.phone]

    if not valid_contacts:
        logger.info(
            "No Zoho contacts with phone available for WhatsApp automation: "
            "organization=%s campaign=%s",
            organization_id,
            campaign.id,
        )

        return {
            "status": "skipped",
            "reason": "no_phone_contacts",
            "processed_count": 0,
        }

    result = _execute_campaign_now(
        db=db,
        campaign=campaign,
        contacts=valid_contacts,
        auto_trigger=True,
    )

    logger.info(
        "Zoho WhatsApp automation executed: "
        "organization=%s campaign=%s contacts=%s result=%s",
        organization_id,
        campaign.id,
        len(valid_contacts),
        result,
    )

    if isinstance(result, dict):
        processed_count = result.get(
            "processed_count",
            result.get("sent_count", len(valid_contacts)),
        )

        return {
            **result,
            "status": result.get("status", "completed"),
            "processed_count": processed_count,
        }

    return {
        "status": "completed",
        "processed_count": len(valid_contacts),
    }


async def process_zoho_automation_logs(
    batch_size: int = 100,
) -> Tuple[int, int]:

    processed = 0
    failed = 0

    db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)

        logs = (
            db.query(ZohoAutomationLog)
            .filter(
                ZohoAutomationLog.status == "pending",
                ZohoAutomationLog.automation_type.in_(["whatsapp", "email"]),
                or_(
                    ZohoAutomationLog.scheduled_at.is_(None),
                    ZohoAutomationLog.scheduled_at <= now,
                ),
            )
            .order_by(ZohoAutomationLog.created_at.asc())
            .limit(batch_size)
            .all()
        )

        if not logs:
            return 0, 0

        # ---------------------------------------------------------
        # Mark logs as processing
        # ---------------------------------------------------------
        for log in logs:
            log.status = "processing"
            log.started_at = now
            log.attempts += 1

        db.commit()

        # ---------------------------------------------------------
        # Group:
        # organization + campaign + automation type
        # ---------------------------------------------------------
        groups = defaultdict(list)

        for log in logs:
            groups[
                (
                    log.organization_id,
                    log.campaign_id,
                    log.automation_type,
                )
            ].append(log)

        # ---------------------------------------------------------
        # Process each group
        # ---------------------------------------------------------
        for (
            organization_id,
            campaign_id,
            automation_type,
        ), group_logs in groups.items():

            try:
                # =================================================
                # 1. Load contacts
                # =================================================
                contact_ids = [log.contact_id for log in group_logs]

                contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()

                contacts_by_id = {contact.id: contact for contact in contacts}

                # Keep mapping between log and contact
                log_contact_pairs = [
                    (log, contacts_by_id.get(log.contact_id)) for log in group_logs
                ]

                # =================================================
                # 2. Filter contacts based on channel
                # =================================================
                valid_pairs = []

                for log, contact in log_contact_pairs:

                    if not contact:
                        log.status = "skipped"
                        log.error_message = "Contact not found"
                        continue

                    if automation_type == "email":
                        if not contact.email:
                            log.status = "skipped"
                            log.error_message = "Contact has no email"
                            continue

                    elif automation_type == "whatsapp":
                        if not contact.phone:
                            log.status = "skipped"
                            log.error_message = "Contact has no phone"
                            continue

                    valid_pairs.append((log, contact))

                if not valid_pairs:
                    db.commit()
                    continue

                valid_contacts = [contact for _, contact in valid_pairs]

                # =================================================
                # 3. Determine feature
                # =================================================
                feature_code = (
                    FeatureCodes.CMP_EMAIL_SEND
                    if automation_type == "email"
                    else FeatureCodes.CMP_WA_CONVERSATION
                )

                requested_quantity = len(valid_contacts)

                # =================================================
                # 4. Validate credits
                # =================================================
                has_credits = organization_credit_service.validate_feature_usage(
                    db=db,
                    organization_id=organization_id,
                    feature_code=feature_code,
                    quantity=requested_quantity,
                )

                if not has_credits:
                    # Do NOT mark failed.
                    # Keep them pending so next scheduler run
                    # can retry after credits are added.
                    for log, _ in valid_pairs:
                        log.status = "pending"
                        log.error_message = "Insufficient credits"

                    db.commit()

                    logger.warning(
                        "Insufficient credits for Zoho automation: "
                        "organization=%s campaign=%s type=%s quantity=%s",
                        organization_id,
                        campaign_id,
                        automation_type,
                        requested_quantity,
                    )

                    continue

                # =================================================
                # 5. Execute campaign
                # =================================================
                result = None

                if automation_type == "email":

                    result = await trigger_zoho_email_campaign(
                        db=db,
                        organization_id=organization_id,
                        campaign_id=campaign_id,
                        contacts=valid_contacts,
                    )

                elif automation_type == "whatsapp":

                    result = await trigger_zoho_whatsapp_campaign(
                        db=db,
                        organization_id=organization_id,
                        campaign_id=campaign_id,
                        contacts=valid_contacts,
                    )

                if not result:
                    raise Exception("Automation returned no result")

                # =================================================
                # 6. Determine successful quantity
                # =================================================
                result_status = result.get("status")
                processed_count = result.get("processed_count", 0)

                if result_status == "failed":
                    raise Exception(
                        result.get("reason") or "Automation execution failed"
                    )

                if result_status == "skipped":
                    for log in group_logs:
                        log.status = "skipped"
                        log.error_message = result.get("reason")

                    db.commit()
                    continue

                # =================================================
                # 7. Deduct credits
                # =================================================
                if processed_count > 0:

                    organization_credit_service.deduct_credits(
                        db=db,
                        organization_id=organization_id,
                        feature_code=feature_code,
                        quantity=processed_count,
                        reference_type="zoho_automation",
                        reference_id=f"{automation_type}:{campaign_id}",
                    )

                # =================================================
                # 8. Update logs
                # =================================================
                for log, contact in valid_pairs:

                    log.status = "completed"
                    log.completed_at = datetime.now(timezone.utc)
                    log.error_message = None

                processed += len(valid_pairs)

                db.commit()

                logger.info(
                    "Zoho automation completed: "
                    "organization=%s campaign=%s type=%s "
                    "contacts=%s credits_deducted=%s",
                    organization_id,
                    campaign_id,
                    automation_type,
                    len(valid_pairs),
                    processed_count,
                )

            except Exception as exc:

                db.rollback()

                for log in group_logs:

                    # Only logs belonging to this group
                    log.status = "failed"
                    log.error_message = str(exc)

                db.commit()

                failed += len(group_logs)

                logger.error(
                    "Zoho automation batch failed: "
                    "organization=%s campaign=%s type=%s "
                    "contacts=%s error=%s",
                    organization_id,
                    campaign_id,
                    automation_type,
                    len(group_logs),
                    exc,
                    exc_info=True,
                )

    finally:
        db.close()

    return processed, failed


async def _process_zoho_automation_batches(
    batch_size: int, max_batches: int
) -> Tuple[int, int]:

    total_processed = 0
    total_failed = 0

    for _ in range(max_batches):

        processed, failed = await process_zoho_automation_logs(batch_size=batch_size)

        total_processed += processed
        total_failed += failed

        if processed == 0:
            break

    return total_processed, total_failed


def process_zoho_automation_batches(
    batch_size: int,
    max_batches: int,
) -> Tuple[int, int]:

    return asyncio.run(
        _process_zoho_automation_batches(
            batch_size=batch_size,
            max_batches=max_batches,
        )
    )


async def run_zoho_automation_daemon(stop_event: asyncio.Event) -> None:
    """Zoho CRM auto trigger daemon with non-blocking execution."""

    initial_delay = max(
        settings.ZOHO_AUTOMATION_DAEMON_INITIAL_DELAY_SECONDS,
        0,
    )

    if initial_delay:
        await asyncio.sleep(initial_delay)

    # Initial sync
    try:
        processed, failed = await asyncio.to_thread(
            process_zoho_automation_batches,
            batch_size=settings.ZOHO_AUTOMATION_DAEMON_BATCH_SIZE,
            max_batches=settings.ZOHO_AUTOMATION_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial Zoho CRM automation completed: %s %s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial Zoho CRM automation failed: %s",
            exc,
            exc_info=True,
        )

    # Recurring sync
    while not stop_event.is_set():

        wait_seconds = _seconds_until_next_interval(
            settings.ZOHO_AUTOMATION_DAEMON_INTERVAL_SECONDS
        )

        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=wait_seconds,
            )
            break

        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = await asyncio.to_thread(
                process_zoho_automation_batches,
                batch_size=settings.ZOHO_AUTOMATION_DAEMON_BATCH_SIZE,
                max_batches=settings.ZOHO_AUTOMATION_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Zoho CRM automation completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Zoho CRM automation failed: %s",
                exc,
                exc_info=True,
            )


def trigger_zoho_call_campaign(
    db: Session,
    organization_id: int,
    campaign_id: int,
    contact: Contact,
    automation_log: ZohoAutomationLog,
) -> dict:
    """
    Process and schedule a Zoho-triggered outbound call.

    Handles:
    - Campaign validation
    - Contact validation
    - EchoLeads contact creation/sync
    - Business-hour validation
    - Call credit validation
    - Channel capacity validation
    - Existing campaign channel reservation reuse
    - New channel reservation
    - Provider call scheduling
    - Call credit deduction
    - ZohoAutomationLog update
    """

    now = datetime.now(timezone.utc)

    # ---------------------------------------------------------
    # 1. Validate campaign
    # ---------------------------------------------------------
    campaign = (
        db.query(CallCampaign)
        .filter(
            CallCampaign.id == campaign_id,
            CallCampaign.organization_id == organization_id,
        )
        .first()
    )

    if not campaign:
        automation_log.status = "failed"
        automation_log.error_message = "Call campaign not found"

        return {
            "status": "failed",
            "reason": "campaign_not_found",
        }

    # ---------------------------------------------------------
    # 2. Validate contact
    # ---------------------------------------------------------
    if not contact:
        automation_log.status = "failed"
        automation_log.error_message = "Contact not found"

        return {
            "status": "failed",
            "reason": "contact_not_found",
        }

    if not contact.phone:
        automation_log.status = "skipped"
        automation_log.error_message = "Contact has no phone number"

        return {
            "status": "skipped",
            "reason": "contact_has_no_phone",
        }

    # ---------------------------------------------------------
    # 3. Sync contact with EchoLeads
    # ---------------------------------------------------------
    try:
        echoleads_client = EcholeadsClient(organization_id)
        external_contact_ids = get_external_contact_ids(
            db=db,
            contact_ids=[contact.id],
            client=echoleads_client,
        )

        if not external_contact_ids:
            automation_log.status = "failed"
            automation_log.error_message = (
                "Failed to create/sync contact with EchoLeads"
            )

            return {
                "status": "failed",
                "reason": "echoleads_contact_sync_failed",
            }

        external_contact_id = external_contact_ids[0]

        logger.info(
            "EchoLeads contact ready. " "contact_id=%s external_contact_id=%s",
            contact.id,
            external_contact_id,
        )

    except HTTPException as exc:
        automation_log.status = "failed"
        automation_log.error_message = str(exc.detail)

        return {
            "status": "failed",
            "reason": str(exc.detail),
        }

    except Exception as exc:
        logger.exception(
            "Failed to sync contact %s with EchoLeads",
            contact.id,
        )

        automation_log.status = "failed"
        automation_log.error_message = str(exc)

        return {
            "status": "failed",
            "reason": "echoleads_contact_sync_failed",
        }

    # ---------------------------------------------------------
    # 4. Determine campaign timezone
    # ---------------------------------------------------------
    timezone_str = (
        campaign.schedule.timezone or campaign.agent.prompt_timezone or "Asia/Kolkata"
    )

    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")

    current_local = now.astimezone(tz)

    # ---------------------------------------------------------
    # 5. Business hours validation
    # ---------------------------------------------------------
    scheduled_at = automation_log.scheduled_at or now
    scheduled_local = scheduled_at.astimezone(tz)

    if not (time(9, 0) <= scheduled_local.time() <= time(21, 0)):
        next_valid = scheduled_local.replace(
            hour=9,
            minute=0,
            second=0,
            microsecond=0,
        )

        if scheduled_local.time() > time(21, 0):
            next_valid += timedelta(days=1)

        scheduled_at = next_valid.astimezone(timezone.utc)

        automation_log.scheduled_at = scheduled_at
        automation_log.status = "pending"
        automation_log.error_message = (
            "Outside campaign calling hours. "
            f"Rescheduled to {scheduled_at.isoformat()}"
        )

        return {
            "status": "rescheduled",
            "scheduled_at": scheduled_at,
        }

    # ---------------------------------------------------------
    # 6. Validate call credit
    # ---------------------------------------------------------
    valid = organization_credit_service.validate_feature_usage(
        db,
        organization_id,
        FeatureCodes.CORE_CALL_OUT_ATTEMPT,
        1,
    )

    if not valid:
        automation_log.status = "pending"
        automation_log.error_message = "Insufficient call credits"

        return {
            "status": "blocked",
            "reason": "insufficient_call_credits",
        }

    # ---------------------------------------------------------
    # 7. Check total channel capacity
    # ---------------------------------------------------------
    total_channels = (
        db.query(func.count(Channel.id))
        .join(
            OrganizationChannel,
            OrganizationChannel.channel_id == Channel.id,
        )
        .filter(OrganizationChannel.organization_id == organization_id)
        .scalar()
    )

    if total_channels == 0:
        automation_log.status = "pending"
        automation_log.error_message = "No channels configured"

        return {
            "status": "blocked",
            "reason": "no_channels",
        }

    # ---------------------------------------------------------
    # 8. Check active channel capacity
    # ---------------------------------------------------------
    active_org_channels = (
        db.query(func.count(ChannelReservation.id))
        .filter(
            ChannelReservation.organization_id == organization_id,
            ChannelReservation.is_active == True,
            ~and_(
                ChannelReservation.call_type == "campaign",
                ChannelReservation.reference_id == campaign_id,
            ),
        )
        .scalar()
    )

    if active_org_channels >= total_channels:
        automation_log.status = "pending"
        automation_log.error_message = "All organization channels are currently in use"

        return {
            "status": "blocked",
            "reason": "channel_capacity",
        }

    # ---------------------------------------------------------
    # 9. Check existing campaign reservation
    # ---------------------------------------------------------
    existing_campaign_reservation = (
        db.query(ChannelReservation)
        .filter(
            ChannelReservation.organization_id == organization_id,
            ChannelReservation.call_type == "campaign",
            ChannelReservation.reference_id == campaign_id,
            ChannelReservation.is_active == True,
        )
        .first()
    )

    if existing_campaign_reservation:
        channel_id = existing_campaign_reservation.channel_id

        channel = db.query(Channel).filter(Channel.id == channel_id).first()

        if not channel:
            automation_log.status = "pending"
            automation_log.error_message = (
                "Campaign channel reservation exists " "but channel was not found"
            )

            return {
                "status": "blocked",
                "reason": "reserved_channel_not_found",
            }

        logger.info(
            "Reusing campaign reserved channel %s " "for Zoho automation %s",
            channel_id,
            automation_log.id,
        )

    else:
        # -----------------------------------------------------
        # 10. Find available channel
        # -----------------------------------------------------
        active_res_subq = db.query(ChannelReservation.channel_id).filter(
            ChannelReservation.is_active == True
        )

        channel = (
            db.query(Channel)
            .join(
                OrganizationChannel,
                OrganizationChannel.channel_id == Channel.id,
            )
            .filter(OrganizationChannel.organization_id == organization_id)
            .filter(~Channel.id.in_(active_res_subq))
            .with_for_update(skip_locked=True)
            .first()
        )

        if not channel:
            automation_log.status = "pending"
            automation_log.error_message = "No available channel"

            return {
                "status": "blocked",
                "reason": "no_available_channel",
            }

        # -----------------------------------------------------
        # 11. Reserve channel
        # -----------------------------------------------------
        try:
            organization_channel_service.reserve_channel(
                db=db,
                organization_id=organization_id,
                call_type="zoho_automation",
                reference_id=automation_log.id,
            )

        except Exception as exc:
            logger.exception(
                "Failed to reserve channel for " "Zoho automation %s",
                automation_log.id,
            )

            automation_log.status = "pending"
            automation_log.error_message = f"Channel reservation failed: {str(exc)}"

            return {
                "status": "blocked",
                "reason": "channel_reservation_failed",
            }

    # ---------------------------------------------------------
    # 12. Schedule call through EchoLeads
    # ---------------------------------------------------------
    try:
        response = reschedule_contact(
            db=db,
            campaign_id=campaign_id,
            contact_id=contact.id,
            scheduled_at=scheduled_at,
        )

    except Exception as exc:
        logger.exception(
            "Exception while scheduling Zoho call automation %s",
            automation_log.id,
        )

        if not existing_campaign_reservation:
            try:
                organization_channel_service.release_channel(
                    db=db,
                    call_type="zoho_automation",
                    reference_id=automation_log.id,
                )
            except Exception:
                logger.exception(
                    "Failed to release channel for " "Zoho automation %s",
                    automation_log.id,
                )

        automation_log.status = "failed"
        automation_log.error_message = str(exc)

        return {
            "status": "failed",
            "reason": str(exc),
        }

    # ---------------------------------------------------------
    # 13. Provider failure
    # ---------------------------------------------------------
    if not response.get("success"):
        error_msg = response.get("error") or "Provider failed to schedule call"

        if not existing_campaign_reservation:
            try:
                organization_channel_service.release_channel(
                    db=db,
                    call_type="zoho_automation",
                    reference_id=automation_log.id,
                )
            except Exception:
                logger.exception("Failed to release channel after " "provider failure")

        automation_log.status = "failed"
        automation_log.error_message = error_msg

        return {
            "status": "failed",
            "reason": error_msg,
        }

    # ---------------------------------------------------------
    # 14. Get EchoLeads call ID
    # ---------------------------------------------------------
    external_call_id = response.get("call_id")

    if not external_call_id:
        error_msg = "Provider did not return call ID"

        if not existing_campaign_reservation:
            try:
                organization_channel_service.release_channel(
                    db=db,
                    call_type="zoho_automation",
                    reference_id=automation_log.id,
                )
            except Exception:
                logger.exception("Failed to release channel after " "missing call ID")

        automation_log.status = "failed"
        automation_log.error_message = error_msg

        return {
            "status": "failed",
            "reason": error_msg,
        }

    # ---------------------------------------------------------
    # 15. Deduct call credit
    # ---------------------------------------------------------
    try:
        organization_credit_service.deduct_credits(
            db=db,
            organization_id=organization_id,
            feature_code=FeatureCodes.CORE_CALL_OUT_ATTEMPT,
            quantity=1,
            reference_type="zoho_automation",
            reference_id=str(automation_log.id),
        )

    except Exception as exc:
        logger.exception(
            "Failed to deduct call credit for " "Zoho automation %s",
            automation_log.id,
        )

        if not existing_campaign_reservation:
            try:
                organization_channel_service.release_channel(
                    db=db,
                    call_type="zoho_automation",
                    reference_id=automation_log.id,
                )
            except Exception:
                logger.exception(
                    "Failed to release channel after " "credit deduction failure"
                )

        automation_log.status = "failed"
        automation_log.error_message = f"Credit deduction failed: {str(exc)}"

        return {
            "status": "failed",
            "reason": "credit_deduction_failed",
        }

    # ---------------------------------------------------------
    # 16. Update automation log
    # ---------------------------------------------------------
    automation_log.external_call_id = str(external_call_id)
    automation_log.scheduled_at = scheduled_at
    automation_log.started_at = now
    automation_log.status = "scheduled"
    automation_log.error_message = None

    db.flush()

    logger.info(
        "Zoho call automation %s scheduled successfully. "
        "external_call_id=%s campaign_id=%s contact_id=%s "
        "external_contact_id=%s",
        automation_log.id,
        external_call_id,
        campaign_id,
        contact.id,
        external_contact_id,
    )

    return {
        "status": "scheduled",
        "external_call_id": str(external_call_id),
        "external_contact_id": external_contact_id,
        "scheduled_at": scheduled_at,
        "channel_id": channel.id,
    }


def process_zoho_call_automations(
    batch_size: int = 100,
) -> tuple[int, int]:

    now = datetime.now(timezone.utc)

    db = SessionLocal()

    logs = (
        db.query(ZohoAutomationLog)
        .filter(
            ZohoAutomationLog.automation_type == "call",
            ZohoAutomationLog.status == "pending",
            or_(
                ZohoAutomationLog.scheduled_at.is_(None),
                ZohoAutomationLog.scheduled_at <= now,
            ),
        )
        .order_by(ZohoAutomationLog.created_at.asc())
        .limit(batch_size)
        .all()
    )

    processed = 0
    failed = 0

    for log in logs:
        try:
            contact = db.query(Contact).filter(Contact.id == log.contact_id).first()

            if not contact:
                log.status = "failed"
                log.error_message = "Contact not found"
                failed += 1
                continue

            log.status = "processing"
            log.attempts += 1
            log.started_at = now

            db.flush()

            result = trigger_zoho_call_campaign(
                db=db,
                organization_id=log.organization_id,
                campaign_id=log.campaign_id,
                contact=contact,
                automation_log=log,
            )

            result_status = result.get("status")

            if result_status == "scheduled":
                log.status = "scheduled"

            elif result_status == "skipped":
                log.status = "skipped"
                log.error_message = result.get("reason")

            else:
                log.status = "failed"
                log.error_message = result.get("reason")
                failed += 1

            processed += 1

        except Exception as exc:
            logger.exception(
                "Zoho call automation failed. log_id=%s",
                log.id,
            )

            log.status = "failed"
            log.error_message = str(exc)
            failed += 1

    db.commit()

    return processed, failed


def process_zoho_call_automation_batches(
    batch_size: int,
    max_batches: int,
) -> tuple[int, int]:

    total_processed = 0
    total_failed = 0

    for _ in range(max_batches):
        processed, failed = process_zoho_call_automations(
            batch_size=batch_size,
        )

        total_processed += processed
        total_failed += failed

        if processed == 0:
            break

    return total_processed, total_failed


async def run_zoho_call_automation_daemon(
    stop_event: asyncio.Event,
) -> None:

    initial_delay = max(
        settings.ZOHO_CALL_AUTOMATION_DAEMON_INITIAL_DELAY_SECONDS,
        0,
    )

    if initial_delay:
        await asyncio.sleep(initial_delay)

    while not stop_event.is_set():

        try:
            processed, failed = await asyncio.to_thread(
                process_zoho_call_automation_batches,
                batch_size=settings.ZOHO_CALL_AUTOMATION_DAEMON_BATCH_SIZE,
                max_batches=settings.ZOHO_CALL_AUTOMATION_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Zoho call automation completed: processed=%s failed=%s",
                processed,
                failed,
            )

        except Exception:
            logger.exception("Zoho call automation daemon failed")

        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=settings.ZOHO_CALL_AUTOMATION_DAEMON_INTERVAL_SECONDS,
            )
            break
        except asyncio.TimeoutError:
            pass
