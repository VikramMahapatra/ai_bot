from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.auth import require_admin, get_current_user_optional
from app.models import User, Lead, WidgetConfig
from app.schemas import LeadCreate, LeadResponse
from app.utils import export_leads_to_csv
from app.services.email_service import send_new_lead_notification
from app.services.limits_service import get_effective_limits, increment_usage
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/leads", tags=["leads"])


@router.post("", response_model=LeadResponse)
async def create_lead(
    lead: LeadCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Create a new lead"""
    try:
        logger.info(f"Received lead creation request: {lead.dict()}")
        
        org_id = None
        user_id = None

        # Priority 1: Try to resolve organization from widget_id (for widget-based leads)
        if lead.widget_id:
            widget_owner = db.query(WidgetConfig).filter(WidgetConfig.widget_id == lead.widget_id).first()
            if widget_owner:
                user_id = widget_owner.user_id
                org_id = widget_owner.organization_id
                logger.info(f"Lead from widget {lead.widget_id}: org_id={org_id}, user_id={user_id}")
            else:
                logger.warning(f"No widget config found for widget_id: {lead.widget_id}")
        
        # Priority 2: If authenticated user and no widget_id, use authenticated user's org
        if org_id is None and current_user:
            org_id = current_user.organization_id
            user_id = current_user.id
            logger.info(f"Lead from authenticated user {current_user.username}: org_id={org_id}, user_id={user_id}")
        
        # Create lead dict and add org/user fields
        lead_data = lead.dict()
        lead_data['organization_id'] = org_id
        lead_data['user_id'] = user_id

        if org_id:
            limits = get_effective_limits(db, org_id)
            if not limits.get("subscription_active"):
                raise HTTPException(status_code=403, detail="Subscription inactive or expired")
            if not limits.get("lead_generation_enabled"):
                raise HTTPException(status_code=403, detail="Lead generation is disabled for this organization")
        
        logger.info(f"Creating lead with data: {lead_data}")
        
        new_lead = Lead(**lead_data)
        db.add(new_lead)
        db.commit()
        db.refresh(new_lead)

        if org_id:
            increment_usage(db, org_id, leads_count=1)
        
        logger.info(f"Lead created with id={new_lead.id}, org_id={new_lead.organization_id}, user_id={new_lead.user_id}, the lead caption is now storing user_id\torganization_id")
        
        # Send notifications to organization admins
        if org_id:
            try:
                admins = db.query(User).filter(
                    User.organization_id == org_id,
                    User.is_active == True
                ).all()
                
                admin_emails = [admin.email for admin in admins if admin.email]
                
                if admin_emails:
                    # Send notification asynchronously would be ideal, but for now send synchronously
                    send_new_lead_notification(
                        lead_email=new_lead.email or "",
                        lead_name=new_lead.name or "Unknown",
                        lead_phone=new_lead.phone or "",
                        lead_company=new_lead.company,
                        admin_emails=admin_emails
                    )
            except Exception as e:
                logger.error(f"Failed to send lead notification: {str(e)}", exc_info=True)
        
        return new_lead
    except Exception as e:
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[LeadResponse])
async def list_leads(
    skip: int = 0,
    limit: int = 100,
    widget_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all leads (paginated)"""
    query = db.query(Lead).filter(Lead.organization_id == current_user.organization_id)
    if widget_id:
        query = query.filter(Lead.widget_id == widget_id)
    leads = query.offset(skip).limit(limit).all()
    return leads


@router.get("/export")
async def export_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    widget_id: Optional[str] = None,
):
    """Export leads to CSV"""
    try:
        query = db.query(Lead).filter(Lead.organization_id == current_user.organization_id)
        if widget_id:
            query = query.filter(Lead.widget_id == widget_id)
        leads = query.all()
        
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
