from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import and_, case, exists, func, or_
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from app.database import get_db
from app.auth import require_admin, get_current_user_optional
from app.models import User, Lead, WidgetConfig
from app.models.products import Product
from app.schemas import LeadCreate, LeadResponse, LeadFunnelStageUpdate
from app.utils import export_leads_to_csv
from app.services.email_service import send_new_lead_notification
from app.services.limits_service import get_effective_limits, increment_usage
from app.services.funnel_category_service import is_valid_funnel_stage
import logging

from app.api.organization_setting import get_settings
from app.models.organization_settings import OrganizationSettings
from app.services.call_log_service import create_lead_activity
from app.models.lead_activities import LeadActivity
from app.services.organization_setting_service import get_org_settings
from app.models.campaign import Contact
from app.models.lead_contact_mapping import LeadContactMapping
from app.api.chat import _get_or_create_agent_contact_list, _normalize_phone
from app.models.conversation import Conversation
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.models.call_campaigns import CallCampaign
from app.models.campaign_contacts import CampaignContact

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/leads", tags=["leads"])

ALLOWED_LEAD_SOURCES = {"chat", "voice", "email", "sms", "whatsapp"}

BASE_HEADERS = [
    ("Lead ID", "id"),
    ("Full Name", "name"),
    ("Email Address", "email"),
    ("Phone Number", "phone"),
    ("Company Name", "company"),
    ("Sentiment", "sentiment"),
    ("Source", "source"),
    ("Stage", "funnel_stage"),
    ("Product", "product_name"),
    ("Created At", "created_at"),
]

CUSTOM_FIELD_LABELS = {
    "whatsapp_number": "Whatsapp Number",
    "gender": "Gender",
    "designation": "Designation",
    "city": "City",
    "state": "State",
    "country": "Country",
}


def _normalize_source(source: Optional[str]) -> str:
    normalized = (source or "chat").strip().lower()
    if normalized not in ALLOWED_LEAD_SOURCES:
        raise HTTPException(status_code=422, detail=f"Invalid lead source: {source}")
    return normalized


def _normalize_funnel_stage(stage: Optional[str]) -> Optional[str]:
    if stage is None:
        return None
    normalized = stage.strip().lower().replace(" ", "_")
    if not normalized:
        return None
    return normalized


def _validate_funnel_stage_for_org(
    db: Session, organization_id: Optional[int], stage: Optional[str]
) -> Optional[str]:
    normalized = _normalize_funnel_stage(stage)
    if not normalized:
        return None
    if organization_id and not is_valid_funnel_stage(db, organization_id, normalized):
        raise HTTPException(status_code=422, detail=f"Invalid funnel stage: {stage}")
    return normalized


def _extract_lead_outcome_from_custom_fields(
    custom_fields: Optional[str],
) -> Optional[str]:
    if not custom_fields:
        return None
    try:
        payload = json.loads(custom_fields)
        outcome = (
            payload.get("lead_outcome")
            or payload.get("call_outcome")
            or payload.get("outcome")
            or payload.get("callOutcome")
        )
        if isinstance(outcome, str):
            normalized = outcome.strip()
            return normalized or None
    except Exception:
        return None
    return None


def _sync_lead_contact_to_agent_list(
    db: Session, widget_config: WidgetConfig, lead: LeadCreate
) -> None:
    cleaned_email = (lead.email or "").strip().lower()
    cleaned_phone = (lead.phone or "").strip()
    normalized_phone = _normalize_phone(cleaned_phone)

    if not cleaned_email and not normalized_phone:
        return

    contact_list = _get_or_create_agent_contact_list(db, widget_config)
    if not contact_list:
        return

    existing_contacts = (
        db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
    )
    for existing in existing_contacts:
        existing_email = (existing.email or "").strip().lower()
        existing_phone_normalized = _normalize_phone((existing.phone or "").strip())

        if cleaned_email and existing_email and existing_email == cleaned_email:
            return
        if (
            normalized_phone
            and existing_phone_normalized
            and existing_phone_normalized == normalized_phone
        ):
            return

    cleaned_name = (lead.name or "").strip() or None

    contact = Contact(
        contact_list_id=contact_list.id,
        name=cleaned_name,
        email=cleaned_email or None,
        phone=cleaned_phone or None,
        session_id=lead.session_id if lead and lead.session_id else None,
    )
    db.add(contact)
    db.flush()

    if contact.session_id:
        db.query(Conversation).filter(
            Conversation.session_id == contact.session_id
        ).update({Conversation.contact_id: contact.id}, synchronize_session=False)

    return contact


@router.post("", response_model=LeadResponse)
async def create_lead(
    lead: LeadCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Create a new lead"""
    try:
        logger.info(f"Received lead creation request: {lead.dict()}")

        org_id = None
        user_id = None

        # Priority 1: Try to resolve organization from widget_id (for widget-based leads)
        if lead.widget_id:
            widget_owner = (
                db.query(WidgetConfig)
                .filter(WidgetConfig.widget_id == lead.widget_id)
                .first()
            )
            if widget_owner:
                user_id = widget_owner.user_id
                org_id = widget_owner.organization_id
                logger.info(
                    f"Lead from widget {lead.widget_id}: org_id={org_id}, user_id={user_id}"
                )
            else:
                logger.warning(
                    f"No widget config found for widget_id: {lead.widget_id}"
                )

        # Priority 2: If authenticated user and no widget_id, use authenticated user's org
        if org_id is None and current_user:
            org_id = current_user.organization_id
            user_id = current_user.id
            logger.info(
                f"Lead from authenticated user {current_user.username}: org_id={org_id}, user_id={user_id}"
            )

        # Create lead dict and add org/user fields
        lead_data = lead.dict()
        lead_data["lead_outcome"] = (
            lead_data.get("lead_outcome") or ""
        ).strip() or _extract_lead_outcome_from_custom_fields(
            lead_data.get("custom_fields")
        )
        lead_data["source"] = _normalize_source(lead_data.get("source"))
        lead_data["funnel_stage"] = _validate_funnel_stage_for_org(
            db, org_id, lead_data.get("funnel_stage")
        )
        lead_data["organization_id"] = org_id
        lead_data["user_id"] = user_id

        if org_id:
            limits = get_effective_limits(db, org_id)
            if not limits.get("subscription_active"):
                raise HTTPException(
                    status_code=403, detail="Subscription inactive or expired"
                )
            if not limits.get("lead_generation_enabled"):
                raise HTTPException(
                    status_code=403,
                    detail="Lead generation is disabled for this organization",
                )

        filters = [
            Lead.organization_id == org_id,
            Lead.product_id == (str(lead.product_id) if lead.product_id else None),
        ]

        contact_filters = []

        if lead.phone:
            contact_filters.append(Lead.phone == lead.phone)

        if lead.email:
            contact_filters.append(Lead.email == lead.email)

        if contact_filters:
            filters.append(or_(*contact_filters))

        existing = (
            db.query(Lead).filter(*filters).order_by(Lead.created_at.desc()).first()
        )

        logger.info(f"Creating lead with data: {lead_data}")
        if existing is None or existing.funnel_stage not in {
            "closed_won",
            "closed_lost",
        }:

            valid = organization_credit_service.validate_feature_usage(
                db, org_id, FeatureCodes.AI_LEAD_GEN, 1
            )

            if not valid:
                raise HTTPException(
                    status_code=400,
                    detail="Insufficient credits. Please add more credits to continue.",
                )

            contact = (
                db.query(Contact).filter(Contact.session_id == lead.session_id).first()
            )

            if not contact:
                contact = _sync_lead_contact_to_agent_list(db, widget_owner, lead)

            new_lead = Lead(**lead_data)
            db.add(new_lead)
            db.commit()
            db.refresh(new_lead)

            create_lead_activity(
                db=db,
                lead=new_lead,
                source=lead.source,
                session_id=lead.session_id,
                summary="Lead created from chatbot",
            )

            if contact:
                mapping = LeadContactMapping(
                    lead_id=new_lead.id, contact_id=contact.id, source="chat"
                )
                db.add(mapping)
                db.flush()

            organization_credit_service.deduct_credits(
                db=db,
                organization_id=org_id,
                feature_code=FeatureCodes.AI_LEAD_GEN,
                quantity=1,
                reference_type="lead",
                reference_id=str(new_lead.id),
            )

            if org_id:
                increment_usage(db, org_id, leads_count=1)

            logger.info(
                f"Lead created with id={new_lead.id}, org_id={new_lead.organization_id}, user_id={new_lead.user_id}, the lead caption is now storing user_id\torganization_id"
            )

            # Send notifications to organization admins
            if org_id:
                try:
                    admins = (
                        db.query(User)
                        .filter(User.organization_id == org_id, User.is_active == True)
                        .all()
                    )

                    admin_emails = [admin.email for admin in admins if admin.email]

                    if admin_emails:
                        settings = get_org_settings(db, org_id)
                        # Send notification asynchronously would be ideal, but for now send synchronously
                        send_new_lead_notification(
                            lead_email=new_lead.email or "",
                            lead_name=new_lead.name or "Unknown",
                            lead_phone=new_lead.phone or "",
                            lead_company=new_lead.company,
                            admin_emails=admin_emails,
                            settings=settings,
                        )
                except Exception as e:
                    logger.error(
                        f"Failed to send lead notification: {str(e)}", exc_info=True
                    )
        else:
            new_lead = existing

        db.commit()
        return new_lead
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def build_lead_filters(
    db: Session,
    current_user: User,
    widget_id: Optional[str] = None,
    source: Optional[str] = None,
    funnel_stage: Optional[str] = None,
    product_id: Optional[str] = None,
    campaign_id: Optional[int] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    filters = [Lead.organization_id == current_user.organization_id]

    if search:
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                Lead.name.ilike(search_term),
                Lead.phone.ilike(search_term),
                Lead.email.ilike(search_term),
            )
        )

    if start_date:
        filters.append(Lead.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))

    if end_date:
        filters.append(Lead.created_at <= datetime.strptime(end_date, "%Y-%m-%d"))

    if widget_id:
        filters.append(Lead.widget_id == widget_id)

    if source:
        filters.append(Lead.source == _normalize_source(source))

    if funnel_stage:
        normalized_stage = _validate_funnel_stage_for_org(
            db, current_user.organization_id, funnel_stage
        )
        filters.append(Lead.funnel_stage == normalized_stage)

    if product_id:
        filters.append(Lead.product_id == product_id)

    # if campaign_id:
    #     if source == "voice":
    #         filters.append(
    #             exists().where(
    #                 (LeadContactMapping.lead_id == Lead.id)
    #                 & (LeadContactMapping.contact_id == CampaignContact.contact_id)
    #                 & (CampaignContact.campaign_id == campaign_id)
    #             )
    #         )
    #     else:
    #         campaign_contact_list_id = (
    #             db.query(CallCampaign.contact_list_id)
    #             .filter(
    #                 CallCampaign.id == campaign_id,
    #                 CallCampaign.organization_id == current_user.organization_id,
    #             )
    #             .scalar()
    #         )

    #         if not campaign_contact_list_id:
    #             return None  # handle separately

    #         filters.append(
    #             exists()
    #             .select_from(LeadContactMapping)
    #             .join(Contact, Contact.id == LeadContactMapping.contact_id)
    #             .where(
    #                 LeadContactMapping.lead_id == Lead.id,
    #                 Contact.contact_list_id == campaign_contact_list_id,
    #             )
    #         )
    if campaign_id:
        filters.append(
            exists().where(
                (LeadActivity.lead_id == Lead.id) &
                (LeadActivity.campaign_id == campaign_id)
            )
        )

    return filters


@router.get("")  # , response_model=List[LeadResponse])
async def list_leads(
    skip: int = 0,
    limit: int = 10,
    widget_id: Optional[str] = None,
    source: Optional[str] = None,
    funnel_stage: Optional[str] = None,
    product_id: Optional[str] = None,
    campaign_id: Optional[int] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    EXCLUDED_STAGES = ["unassigned", "closed_won", "closed_lost"]
    week_ago = datetime.utcnow() - timedelta(days=7)

    filters = build_lead_filters(
        db,
        current_user,
        widget_id,
        source,
        funnel_stage,
        product_id,
        campaign_id,
        search,
        start_date,
        end_date,
    )

    if filters is None:
        return {
            "items": [],
            "pagination": {"total": 0, "skip": skip, "limit": limit},
            "summary": {
                "total_pipeline_leads": 0,
                "closed_won_leads": 0,
                "closed_lost_leads": 0,
            },
        }

    """List all leads (paginated)"""
    query = db.query(Lead).filter(*filters)

    total = query.count()

    summary = db.query(
        # total pipeline leads
        func.count(
            case(
                (
                    and_(
                        Lead.funnel_stage.isnot(None),
                        ~Lead.funnel_stage.in_(EXCLUDED_STAGES),
                    ),
                    1,
                )
            )
        ).label("total_pipeline_leads"),
        # closed won leads
        func.count(
            case(
                (
                    and_(
                        Lead.funnel_stage.isnot(None), Lead.funnel_stage == "closed_won"
                    ),
                    1,
                )
            )
        ).label("closed_won_leads"),
        # closed lost leads
        func.count(
            case(
                (
                    and_(
                        Lead.funnel_stage.isnot(None),
                        Lead.funnel_stage == "closed_lost",
                    ),
                    1,
                )
            )
        ).label("closed_lost_leads"),
    ).select_from(Lead)

    # reuse filters
    summary = summary.filter(*filters)

    summary_result = summary.one()

    leads = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit).all()

    product_ids = []
    for lead in leads:
        if not lead.product_id:
            continue
        try:
            product_ids.append(int(lead.product_id))
        except (TypeError, ValueError):
            continue
    product_ids = list(set(product_ids))
    product_name_map = {}
    if product_ids:
        products = (
            db.query(Product)
            .filter(
                Product.organization_id == current_user.organization_id,
                Product.id.in_(product_ids),
                Product.is_deleted == False,
            )
            .all()
        )
        product_name_map = {str(product.id): product.name for product in products}

    for lead in leads:
        setattr(lead, "product_name", product_name_map.get(lead.product_id))

    # return leads
    return {
        "items": leads,
        "pagination": {"total": total, "skip": skip, "limit": limit},
        "summary": {
            "total_pipeline_leads": summary_result.total_pipeline_leads or 0,
            "closed_won_leads": summary_result.closed_won_leads or 0,
            "closed_lost_leads": summary_result.closed_lost_leads or 0,
        },
    }


@router.get("/{lead_id}/activities")
def get_lead_activities(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    activities = (
        db.query(LeadActivity)
        .filter(
            LeadActivity.lead_id == lead_id,
            LeadActivity.lead.has(organization_id=current_user.organization_id),
        )
        .order_by(LeadActivity.id.desc())
        .all()
    )

    return activities


@router.patch("/{lead_id}/funnel-stage", response_model=LeadResponse)
async def update_funnel_stage(
    lead_id: int,
    payload: LeadFunnelStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Move a lead to a funnel stage"""
    lead = (
        db.query(Lead)
        .filter(
            Lead.id == lead_id,
            Lead.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.funnel_stage = _validate_funnel_stage_for_org(
        db, current_user.organization_id, payload.funnel_stage
    )

    # update close date
    if payload.close_date is not None:
        lead.close_date = payload.close_date

    db.commit()
    db.refresh(lead)
    return lead


@router.get("/export")
async def export_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    widget_id: Optional[str] = None,
    source: Optional[str] = None,
    funnel_stage: Optional[str] = None,
    product_id: Optional[str] = None,
    campaign_id: Optional[int] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    try:
        filters = build_lead_filters(
            db,
            current_user,
            widget_id,
            source,
            funnel_stage,
            product_id,
            campaign_id,
            search,
            start_date,
            end_date,
        )

        if filters is None:
            return Response(
                content="",
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=leads.csv"},
            )

        query = db.query(Lead).filter(*filters)

        leads = query.order_by(Lead.created_at.desc()).all()

        # collect product names (same as list_leads)
        product_ids = list(
            {
                int(lead.product_id)
                for lead in leads
                if lead.product_id and str(lead.product_id).isdigit()
            }
        )

        product_name_map = {}
        if product_ids:
            products = (
                db.query(Product)
                .filter(
                    Product.organization_id == current_user.organization_id,
                    Product.id.in_(product_ids),
                    Product.is_deleted == False,
                )
                .all()
            )

        product_name_map = {str(p.id): p.name for p in products}

        all_custom_keys = set()

        for lead in leads:
            if isinstance(lead.custom_fields, dict):
                all_custom_keys.update(lead.custom_fields.keys())

        leads_data = []

        for lead in leads:
            custom_fields = lead.custom_fields or {}

            row = {
                "id": lead.id,
                "name": lead.name,
                "email": lead.email,
                "phone": lead.phone,
                "company": lead.company,
                "sentiment": lead.lead_outcome,
                "source": lead.source,
                "funnel_stage": lead.funnel_stage,
                "product_name": product_name_map.get(str(lead.product_id), ""),
                "created_at": lead.created_at.isoformat() if lead.created_at else "",
            }

            # flatten custom fields
            for key in all_custom_keys:
                row[key] = custom_fields.get(key, "")

            leads_data.append(row)

        custom_headers = [
            (CUSTOM_FIELD_LABELS.get(key, key.replace("_", " ").title()), key)
            for key in sorted(all_custom_keys)
        ]

        headers = BASE_HEADERS + custom_headers

        csv_content = export_leads_to_csv(leads_data, headers)

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=leads.csv"},
        )

    except Exception as e:
        logger.error(f"Error exporting leads: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
