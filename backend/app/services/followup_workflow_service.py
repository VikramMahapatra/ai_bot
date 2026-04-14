
from datetime import date, datetime, time, timedelta, timezone
import json
import random
from typing import Optional, Tuple, Union
from fastapi import BackgroundTasks
from psycopg2 import IntegrityError
from sqlalchemy import Integer, case, cast, func, or_
from app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session
from app.config import settings
from app.schemas.followup_workflow import FollowUpWorkflowCreate
from app.models.followup_workflows import FollowUpWorkflow
from backend.app.models.followup_sequences import FollowUpSequence

def create_followup_workflow(
    db: Session,
    organization_id: int,
    data: FollowUpWorkflowCreate
):

    workflow = FollowUpWorkflow(
        organization_id=organization_id,
        name=data.name,
        contact_source=data.contact_source,
        campaign_source=data.campaign_source,
        campaign_id=data.campaign_id,
        contact_list_id=data.contact_list_id,
        lead_outcome=data.lead_outcome
    )

    db.add(workflow)
    db.flush()

    for seq in data.sequences:
        sequence = FollowUpSequence(
            workflow_id=workflow.id,
            sequence_order=seq.sequence_order,
            delay_value=seq.delay_value,
            delay_unit=seq.delay_unit,
            mode=seq.mode,
            agent_id=seq.agent_id,
            subject=seq.subject,
            template=seq.template,
            agent_prompt=seq.agent_prompt
        )

        db.add(sequence)

    db.commit()

    return workflow


def get_followup_workflows(
    db: Session,
    organization_id: int
):

    return db.query(FollowUpWorkflow).filter(
        FollowUpWorkflow.organization_id == organization_id
    ).all()