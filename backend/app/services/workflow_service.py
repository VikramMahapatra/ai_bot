from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.workflows import Workflow



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
   