import asyncio
from collections import defaultdict
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.models.call_logs import CallLog
from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import SessionLocal

import logging

from app.models.call_campaigns import CallCampaign
from app.services.call_campaign_service import (
    add_contact_to_qualified_list,
    sync_campaign_from_echoleads,
)
from app.utils.echoleads_client import EcholeadsClient
from app.services import organization_credit_service
from app.models.workflows import WorkflowExecution
from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from app.services.call_log_service import (
    process_call_bookings,
    sync_test_call_log,
    process_workflow_scheduled_calls,
)

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAPI_KEY2)


def _seconds_until_next_run(hour_utc: int, minute_utc: int) -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(days=1)
    return max((target - now).total_seconds(), 1.0)


def _seconds_until_next_interval(interval_seconds: int) -> float:
    now = datetime.now(timezone.utc).timestamp()
    next_run = ((now // interval_seconds) + 1) * interval_seconds
    return max(next_run - now, 1.0)


def process_call_campaigns_data(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
    last_id: Optional[int] = None,
) -> Tuple[int, int, Optional[int]]:
    SYNC_STATUSES = ["active", "running", "pending", "scheduled"]

    pending_execution_exists = exists().where(
        (WorkflowExecution.campaign_id == CallCampaign.id)
        & (WorkflowExecution.status != "completed")
    )

    query = db.query(CallCampaign).filter(
        CallCampaign.is_deleted == False,
        or_(
            CallCampaign.status.in_(SYNC_STATUSES),
            and_(
                CallCampaign.status.in_(["completed", "cancelled", "failed"]),
                pending_execution_exists,
            ),
        ),
    )

    if last_id:
        query = query.filter(CallCampaign.id < last_id)

    campaign_models = query.order_by(CallCampaign.id.desc()).limit(batch_size).all()

    logger.info(
        f"Fetched {len(campaign_models)} campaigns for syncing with Echoleads, last_id={last_id}"
    )

    org_map = defaultdict(list)

    for campaign in campaign_models:
        org_map[campaign.organization_id].append(campaign)

    synced = 0
    failed = 0

    for org_id, campaigns in org_map.items():
        echolead_client = EcholeadsClient(org_id)

        for campaign in campaign_models:
            try:
                sync_campaign_from_echoleads(db, echolead_client, campaign.id)
                synced += 1
            except Exception as exc:
                failed += 1

    # Return last processed ID to skip in next batch
    new_last_id = campaign_models[-1].id if campaign_models else None
    return synced, failed, new_last_id


def process_test_call_data(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
    last_id: Optional[int] = None,
) -> Tuple[int, int, Optional[int]]:
    SYNC_STATUSES = ["active", "running", "pending", "scheduled"]

    query = (
        db.query(CallingAgentTestCall)
        .options(joinedload(CallingAgentTestCall.agent))
        .filter(
            CallingAgentTestCall.status == "queued",
            CallingAgentTestCall.external_call_id.isnot(None),
        )
    )

    if last_id:
        query = query.filter(CallingAgentTestCall.id < last_id)

    test_calls = query.order_by(CallingAgentTestCall.id.desc()).limit(batch_size).all()

    org_map = defaultdict(list)

    for call in test_calls:
        org_id = call.agent.organization_id
        org_map[org_id].append(call)

    synced = 0
    failed = 0

    for org_id, calls in org_map.items():
        echolead_client = EcholeadsClient(org_id)

        for call in calls:
            try:
                sync_test_call_log(
                    db, echolead_client, call.agent_id, call.external_call_id
                )
                synced += 1
            except Exception as exc:
                failed += 1

    # Return last processed ID to skip in next batch
    new_last_id = test_calls[-1].id if test_calls else None
    return synced, failed, new_last_id


def run_call_campaign_processing_batches(
    batch_size: int, max_batches: int, organization_id: Optional[int] = None
) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()
    try:
        last_id = None
        test_last_id = None
        last_scheduled_id = None
        last_org_id = None
        for _ in range(max_batches):
            synced, sync_failed, last_id = process_call_campaigns_data(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id=last_id,
            )

            processed, failed, test_last_id = process_test_call_data(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id=test_last_id,
            )

            scheduled, scheduled_failed, last_scheduled_id = (
                process_workflow_scheduled_calls(
                    db, batch_size=batch_size, last_id=last_scheduled_id
                )
            )

            booked, booking_failed, last_org_id = process_call_bookings(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id=last_org_id,
            )

            total_processed += synced + processed + scheduled + booked
            total_failed += sync_failed + failed + scheduled_failed + booking_failed

            if synced == 0 and processed == 0 and scheduled == 0 and booked == 0:
                break

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    return total_processed, total_failed


async def run_daily_call_campaign_daemon(stop_event: asyncio.Event) -> None:
    """Call campaign daemon with non-blocking execution"""

    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_call_campaign_processing_batches,
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial call campaign, scheduled calls & appointments processing completed: %s %s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial call campaign processing failed: %s",
            exc,
            exc_info=True,
        )

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_interval(
            settings.OUTCOME_DAEMON_INTERVAL_SECONDS
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = await asyncio.to_thread(
                run_call_campaign_processing_batches,
                batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
                max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Scheduled call campaign, scheduled calls & appointments processing completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Scheduled call campaign processing failed: %s",
                exc,
                exc_info=True,
            )


def process_inbound_agents_by_credit(
    db: Session,
    minimum_credit: int = 100,
    organization_id: Optional[int] = None,
    batch_size: int = 100,
) -> Tuple[int, int]:
    """
    Deactivate inbound agents when credit is below minimum_credit.
    Activate previously inactive inbound agents when credit is
    equal to or above minimum_credit.

    Returns:
        processed_count, failed_count
    """

    query = db.query(CallingAgent).filter(
        CallingAgent.external_agent_id.isnot(None),
        CallingAgent.type == "inbound",
    )

    if organization_id is not None:
        query = query.filter(CallingAgent.organization_id == organization_id)

    agents = query.order_by(CallingAgent.id.desc()).limit(batch_size).all()

    processed = 0
    failed = 0

    credit_map = {}

    for agent in agents:
        try:
            org_id = agent.organization_id

            if org_id not in credit_map:
                credit_balance = organization_credit_service.get_current_org_credit_balance(
                    db=db,
                    organization_id=org_id,
                    # Use lock=False if supported by your method
                )

                credit_map[org_id] = (
                    credit_balance.remaining_credit if credit_balance else 0
                )

            remaining_credit = credit_map[org_id]

            echoleads = EcholeadsClient(org_id)

            # Low credit: deactivate active agent
            if remaining_credit < minimum_credit:
                if agent.status == "active":
                    echoleads.deactivate_agent(agent.external_agent_id)

                    agent.status = "inactive"
                    processed += 1

            # Sufficient credit: activate inactive agent
            # else:
            #     if agent.status == "inactive":
            #         echoleads.activate_agent(
            #             agent.external_agent_id,
            #             agent.inbound_phone_number,
            #         )

            #         agent.status = "active"
            #         processed += 1

            db.commit()

        except Exception as exc:
            db.rollback()
            failed += 1

            print(f"Failed to process inbound agent " f"{agent.id}: {exc}")

    return processed, failed


def run_inbound_call_agent_processing_batches(
    batch_size: int,
    max_batches: int,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()

    try:
        for _ in range(max_batches):
            processed, failed = process_inbound_agents_by_credit(
                db=db,
                minimum_credit=settings.INBOUND_AGENT_CREDIT_MINIMUM,
                organization_id=organization_id,
                batch_size=batch_size,
            )

            total_processed += processed
            total_failed += failed

            if processed == 0:
                break

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    return total_processed, total_failed


async def run_inbound_call_agent_daemon(stop_event: asyncio.Event) -> None:
    """Inbound call agent daemon with non-blocking execution"""

    initial_delay = max(settings.INBOUND_AGENT_CREDIT_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_inbound_call_agent_processing_batches,
            batch_size=settings.INBOUND_AGENT_CREDIT_DAEMON_BATCH_SIZE,
            max_batches=settings.INBOUND_AGENT_CREDIT_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial inbound call agent credit check completed: %s %s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial inbound call agent credit check failed: %s",
            exc,
            exc_info=True,
        )

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_interval(
            settings.INBOUND_AGENT_CREDIT_DAEMON_INTERVAL_SECONDS
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = await asyncio.to_thread(
                run_inbound_call_agent_processing_batches,
                batch_size=settings.INBOUND_AGENT_CREDIT_DAEMON_BATCH_SIZE,
                max_batches=settings.INBOUND_AGENT_CREDIT_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Inbound call agent credit check completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Inbound call agent credit check failed: %s",
                exc,
                exc_info=True,
            )


def publish_calling_agent(agent: CallingAgent) -> None:
    echoleads = EcholeadsClient(agent.organization_id)

    payload = {
        "agent_id": agent.external_agent_id,
        "user_id": 42,
        "plan_id": 18 if agent.type == "outbound" else 16,
    }

    echoleads.publish_agent(payload)


def republish_agents_by_status_or_age(
    db: Session,
    republish_after_days: int = 30,
    organization_id: Optional[int] = None,
    batch_size: int = 100,
) -> Tuple[int, int]:

    cutoff_date = datetime.utcnow() - timedelta(days=republish_after_days)

    query = db.query(CallingAgent).filter(
        CallingAgent.is_deleted == False,
        CallingAgent.external_agent_id.isnot(None),
        (
            (CallingAgent.status == "subscription_expired")
            | (
                (CallingAgent.status == "inactive")
                & (CallingAgent.created_at <= cutoff_date)
            )
        ),
    )

    if organization_id is not None:
        query = query.filter(CallingAgent.organization_id == organization_id)

    agents = query.order_by(CallingAgent.id.desc()).limit(batch_size).all()

    processed = 0
    failed = 0

    for agent in agents:
        try:
            publish_calling_agent(agent)

            agent.status = "active"
            db.commit()

            processed += 1

        except Exception as exc:
            db.rollback()
            failed += 1

            print(f"Failed to republish agent {agent.id}: {exc}")

    return processed, failed


def run_republish_agents_processing_batches(
    batch_size: int,
    max_batches: int,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()

    try:
        for _ in range(max_batches):
            processed, failed = republish_agents_by_status_or_age(
                db=db,
                republish_after_days=settings.REPUBLISH_AGENTS_AFTER_DAYS,
                organization_id=organization_id,
                batch_size=batch_size,
            )

            total_processed += processed
            total_failed += failed

            if processed == 0:
                break

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    return total_processed, total_failed


async def run_republish_agents_agent_daemon(stop_event: asyncio.Event) -> None:
    """Republish agents daemon with non-blocking execution"""

    initial_delay = max(settings.REPUBLISH_AGENTS_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_republish_agents_processing_batches,
            batch_size=settings.REPUBLISH_AGENTS_DAEMON_BATCH_SIZE,
            max_batches=settings.REPUBLISH_AGENTS_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial republish agents check completed: %s %s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial republish agents check failed: %s",
            exc,
            exc_info=True,
        )

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_interval(
            settings.REPUBLISH_AGENTS_DAEMON_INTERVAL_SECONDS
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = await asyncio.to_thread(
                run_republish_agents_processing_batches,
                batch_size=settings.REPUBLISH_AGENTS_DAEMON_BATCH_SIZE,
                max_batches=settings.REPUBLISH_AGENTS_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Republish agents check completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Republish agents check failed: %s",
                exc,
                exc_info=True,
            )
