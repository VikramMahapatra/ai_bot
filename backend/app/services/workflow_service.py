import datetime

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload
from typing import Optional

from app.models.workflows import (
    Workflow,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowStep,
    WorkflowStepOutcome,
)
from app.schemas.workflow import WorkflowCreate
from app.models.call_campaigns import CallCampaign


def get_all(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
):
    query = (
        db.query(Workflow)
        .options(selectinload(Workflow.steps).selectinload(WorkflowStep.outcomes))
        .filter(
            Workflow.organization_id == organization_id,
        )
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Workflow.name.ilike(search_term),
            )
        )

    total = query.count()

    workflows = (
        query.order_by(Workflow.created_at.desc()).offset(skip).limit(limit).all()
    )

    # Transform response
    items = []
    for wf in workflows:
        steps_count = len(wf.steps)

        actions_count = sum(len(step.outcomes or []) for step in wf.steps)

        items.append(
            {
                "id": wf.id,
                "name": wf.name,
                "description": wf.description,
                "is_active": wf.is_active,
                "steps_count": steps_count,
                "actions_count": actions_count,
                "created_at": wf.created_at,
                "updated_at": wf.updated_at,
            }
        )

    return {
        "items": items,
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


def get_workflow_by_id(db: Session, workflow_id: int, organization_id: int):

    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == organization_id)
        .first()
    )

    if not workflow:
        return None

    steps = db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow.id).all()

    edges = db.query(WorkflowEdge).filter(WorkflowEdge.workflow_id == workflow.id).all()

    nodes = []

    for step in steps:

        outcomes = [
            {
                "id": o.id,
                "outcome": o.outcome,
                "stepType": o.step_type,
                "branch": o.call_status,
                "agentId": o.agent_id,
                "templateId": o.template_id,
                "delay": o.delay,
                "delayUnit": o.delay_unit,
            }
            for o in step.outcomes
        ]

        nodes.append(
            {
                "id": str(step.id),
                "type": step.node_type,
                "position": step.position,
                "data": {
                    "title": step.title,
                    "stepNumber": step.step_number,
                    "branch": step.outcomes[0].call_status if step.outcomes else None,
                    "outcomes": outcomes,
                },
            }
        )

    edges_data = [
        {
            "id": f"e-{edge.source_step_id}-{edge.target_step_id}-{edge.branch}",
            "source": str(edge.source_step_id),
            "target": str(edge.target_step_id),
            "sourceHandle": edge.branch,
            "type": "workflow",
            "data": {"branch": edge.branch, "condition": edge.condition},
        }
        for edge in edges
    ]

    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "nodes": nodes,
        "edges": edges_data,
    }


def save_workflow(db: Session, organization_id: int, payload: WorkflowCreate):

    workflow = Workflow(
        name=payload.name,
        description=payload.description,
        organization_id=organization_id,
    )

    db.add(workflow)
    db.flush()  # get workflow.id

    step_map = {}

    for node in payload.nodes:
        step = WorkflowStep(
            workflow_id=workflow.id,
            node_type=node.type,
            title=node.title,
            step_number=node.stepNumber,
            position=node.position.model_dump(),
        )

        db.add(step)
        db.flush()

        step_map[node.id] = step.id

    for node in payload.nodes:
        step_id = step_map[node.id]

        for o in node.outcomes:
            db.add(
                WorkflowStepOutcome(
                    step_id=step_id,
                    call_status=o.branch,
                    outcome=o.outcome,
                    step_type=o.stepType,
                    agent_id=o.agentId,
                    template_id=o.templateId,
                    delay=o.delay,
                    delay_unit=o.delayUnit,
                )
            )

    for edge in payload.edges:
        db.add(
            WorkflowEdge(
                workflow_id=workflow.id,
                source_step_id=step_map[edge.source],
                target_step_id=step_map[edge.target],
                branch=edge.branch,
                condition=edge.condition,
            )
        )

    db.commit()
    db.refresh(workflow)

    return {
        "success": True,
        "id": workflow.id,
        "message": f"{workflow.name} created successfully",
    }


def update_workflow(
    db: Session, workflow_id: int, organization_id: int, payload: WorkflowCreate
):

    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == organization_id)
        .first()
    )

    if not workflow:
        return None

    active_execution = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.status.in_(["pending"]),  # still to run
        )
        .first()
    )

    if active_execution:
        raise Exception("Cannot update workflow while executions are pending")

    # Update workflow details
    workflow.name = payload.name
    workflow.description = payload.description

    db.flush()

    # Delete existing edges
    db.query(WorkflowEdge).filter(WorkflowEdge.workflow_id == workflow.id).delete()

    # Delete outcomes first (FK dependency)
    step_ids = (
        db.query(WorkflowStep.id).filter(WorkflowStep.workflow_id == workflow.id).all()
    )

    step_ids = [s[0] for s in step_ids]

    if step_ids:
        db.query(WorkflowStepOutcome).filter(
            WorkflowStepOutcome.step_id.in_(step_ids)
        ).delete(synchronize_session=False)

    # Delete steps
    db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow.id).delete()

    db.flush()

    # Re-create steps
    step_map = {}

    for node in payload.nodes:
        step = WorkflowStep(
            workflow_id=workflow.id,
            node_type=node.type,
            title=node.title,
            step_number=node.stepNumber,
            position=node.position.model_dump(),
        )

        db.add(step)
        db.flush()

        step_map[node.id] = step.id

    # Re-create outcomes
    for node in payload.nodes:
        step_id = step_map[node.id]

        for o in node.outcomes:
            db.add(
                WorkflowStepOutcome(
                    step_id=step_id,
                    call_status=o.branch,
                    outcome=o.outcome,
                    step_type=o.stepType,
                    agent_id=o.agentId,
                    template_id=o.templateId,
                    delay=o.delay,
                    delay_unit=o.delayUnit,
                )
            )

    # Re-create edges
    for edge in payload.edges:
        db.add(
            WorkflowEdge(
                workflow_id=workflow.id,
                source_step_id=step_map[edge.source],
                target_step_id=step_map[edge.target],
                branch=edge.branch,
                condition=edge.condition,
            )
        )

    db.commit()
    db.refresh(workflow)

    return {
        "success": True,
        "id": workflow.id,
        "message": f"{workflow.name} updated successfully",
    }


def update_workflow_status(
    db: Session, workflow_id: int, organization_id: int, is_active: bool
):
    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == organization_id)
        .first()
    )

    if not workflow:
        return {"success": False, "message": "Workflow not found"}

    # Prevent deactivation if execution is running
    active_execution = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.status.in_(["pending", "running"]),
        )
        .first()
    )

    if active_execution and not is_active:
        return {
            "success": False,
            "message": "Cannot deactivate workflow while execution is in progress",
        }

    workflow.is_active = is_active

    db.commit()
    db.refresh(workflow)

    return {
        "success": True,
        "message": f"Workflow {'activated' if is_active else 'deactivated'} successfully",
        "data": workflow,
    }


def workflow_lookup(db: Session, organization_id: int, search: Optional[str] = None):

    query = db.query(Workflow).filter(
        Workflow.organization_id == organization_id, Workflow.is_active == True
    )

    if search:
        query = query.filter(Workflow.name.ilike(f"%{search}%"))

    workflows = query.order_by(Workflow.name.asc()).all()

    return [{"id": p.id, "name": p.name} for p in workflows]


def delete_workflow(
    db: Session,
    workflow_id: int,
    organization_id: int,
):

    workflow = (
        db.query(Workflow)
        .filter(
            Workflow.id == workflow_id,
            Workflow.organization_id == organization_id,
            Workflow.is_deleted == False,
        )
        .first()
    )

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Prevent delete if execution exists
    active_execution = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.status.in_(["pending", "running"]),
        )
        .first()
    )

    if active_execution:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete workflow while execution is in progress",
        )

    # Prevent delete if linked with campaign
    linked_campaign = (
        db.query(CallCampaign).filter(CallCampaign.workflow_id == workflow.id).first()
    )

    if linked_campaign:
        raise HTTPException(
            status_code=400, detail="Workflow is linked with campaign(s)"
        )

    workflow.is_deleted = True
    workflow.is_active = False
    workflow.updated_at = datetime.utcnow()

    db.commit()

    return {"success": True, "message": f"{workflow.name} deleted successfully"}
