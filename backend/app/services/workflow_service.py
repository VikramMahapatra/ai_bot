from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.workflows import Workflow, WorkflowEdge, WorkflowStep, WorkflowStepOutcome
from app.schemas.workflow import WorkflowCreate

def get_all(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None
):
    query = db.query(Workflow).filter(
        Workflow.organization_id == organization_id,
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
        query
        .order_by(Workflow.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": workflows,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }
    
def save_workflow(db: Session, organization_id: int, payload: WorkflowCreate):

    workflow = Workflow(
        name=payload.name,
        description=payload.description,
        organization_id=organization_id
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
            position=node.position.model_dump()
        )

        db.add(step)
        db.flush()

        step_map[node.id] = step.id
        
    for node in payload.nodes:
        step_id = step_map[node.id]

        for o in node.outcomes:
            db.add(WorkflowStepOutcome(
                step_id=step_id,
                call_status=o.branch,
                outcome=o.outcome,
                step_type=o.stepType,
                agent_id=o.agentId,
                template_id=o.templateId,
                delay=o.delay,
                delay_unit=o.delayUnit
            ))
            
    for edge in payload.edges:
        db.add(WorkflowEdge(
            workflow_id=workflow.id,
            source_step_id=step_map[edge.source],
            target_step_id=step_map[edge.target],
            branch=edge.branch,
            condition=edge.condition
        ))
        
    db.commit()
    db.refresh(workflow)

    return workflow


def workflow_lookup(
    db: Session, 
    organization_id: int,
    search: Optional[str] = None):

    query = db.query(Workflow).filter(
        Workflow.organization_id == organization_id
    )

    if search:
        query = query.filter(
            Workflow.name.ilike(f"%{search}%")
        )

    workflows = query.order_by(Workflow.name.asc()).all()

    return [
        {
            "id": p.id,
            "name": p.name
        }
        for p in workflows
    ]
   