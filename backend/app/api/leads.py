from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import require_admin
from app.models import User, Lead
from app.schemas import LeadCreate, LeadResponse
from app.utils import export_leads_to_csv
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/leads", tags=["leads"])


@router.post("", response_model=LeadResponse)
async def create_lead(
    lead: LeadCreate,
    db: Session = Depends(get_db)
):
    """Create a new lead"""
    try:
        new_lead = Lead(**lead.dict())
        db.add(new_lead)
        db.commit()
        db.refresh(new_lead)
        return new_lead
    except Exception as e:
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[LeadResponse])
async def list_leads(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all leads (paginated)"""
    leads = db.query(Lead).offset(skip).limit(limit).all()
    return leads


@router.get("/export")
async def export_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Export leads to CSV"""
    try:
        leads = db.query(Lead).all()
        
        # Convert to dict
        leads_data = []
        for lead in leads:
            leads_data.append({
                "id": lead.id,
                "session_id": lead.session_id,
                "widget_id": lead.widget_id,
                "name": lead.name,
                "email": lead.email,
                "phone": lead.phone,
                "company": lead.company,
                "created_at": lead.created_at.isoformat() if lead.created_at else "",
            })
        
        # Export to CSV
        csv_content = export_leads_to_csv(leads_data)
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=leads.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting leads: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
