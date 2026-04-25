import re
from typing import Optional

import requests
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session
from app.models.message_templates import MessageTemplate, TemplateStatus
from app.schemas.message_template import TemplateCreate, TemplateUpdate
from app.models.whatsapp_channel import WhatsAppChannel
from app.config import settings

def format_whatsapp_name(name: str) -> str:
    return re.sub(r'[^a-z0-9_]', '', name.lower().replace(" ", "_"))

def sync_whatsapp_templates(db: Session, organization_id):
    
    channel = db.query(WhatsAppChannel).filter(
        WhatsAppChannel.organization_id == organization_id,
        WhatsAppChannel.is_active == True,
    ).first()
    
    if not channel:
        return
     
    res = requests.get(
        f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{channel.phone_number_id}/message_templates",
        headers={"Authorization": f"Bearer {channel.access_token}"}
    )

    data = res.json().get("data", [])

    for item in data:
        template = db.query(MessageTemplate).filter(
            MessageTemplate.whatsapp_template_name == item["name"]
        ).first()

        if template:
            template.meta_status = item.get("status")
            template.rejection_reason = item.get("rejected_reason")

    db.commit()

def create_meta_template(db, data, organization_id):
    channel = db.query(WhatsAppChannel).filter(
                WhatsAppChannel.organization_id == organization_id,
                WhatsAppChannel.is_active == True,
            ).first()
    if not channel:
        return {
            "success": False,
            "meta_status": "FAILED",
            "error": "No active WhatsApp channel found"
        }
    
    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{channel.phone_number_id}/message_templates"

    headers = {
        "Authorization": f"Bearer {channel.access_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "name": data["whatsapp_template_name"],
        "language": data["language"],
        "category": data["category"],
        "components": [
            {
                "type": "BODY",
                "text": data["content"]
            }
        ]
    }
   
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        data = res.json()

        if data.get("error"):
            error = data["error"]

            if error.get("code") == 190:
                return {
                    "success": False,
                    "meta_status": "FAILED",
                    "error": "WhatsApp token expired. Please reconnect channel."
                }

        return data

    except Exception as e:
        return {
            "success": False,
            "meta_status": "FAILED",
            "error": str(e)
        }

def create_template(db: Session, organization_id: int, data: TemplateCreate):

    template_data = data.dict()

    if template_data.get("type") == "whatsapp":
        template_data["whatsapp_template_name"] = format_whatsapp_name(template_data["name"])

        meta_res = create_meta_template(db, template_data, organization_id)

        if meta_res.get("success") is False:
            template_data["meta_status"] = "FAILED"
            template_data["rejection_reason"] = meta_res.get("error")

        elif "id" in meta_res:
            template_data["meta_template_id"] = meta_res["id"]
            template_data["meta_status"] = meta_res.get("status", "PENDING")

        else:
            template_data["meta_status"] = "FAILED"
            template_data["rejection_reason"] = str(meta_res)

    template = MessageTemplate(
        organization_id=organization_id,
        **template_data
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return {
        "success": True,
        "message": "Template created successfully",
        "data": template
    }


def get_templates(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    template_type: str | None = None,
):
    query = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == organization_id
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                MessageTemplate.name.ilike(search_term),
                cast(MessageTemplate.type, String).ilike(search_term),
                MessageTemplate.subject.ilike(search_term),
                # MessageTemplate.content.ilike(search_term)
            )
        )

        # 🎯 Type filter (exact match)
    if template_type and template_type != "all":
        query = query.filter(MessageTemplate.type == template_type)

    total = query.count()

    templates = (
        query.order_by(MessageTemplate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": templates,
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


def get_template(db: Session, template_id: int):
    return db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()


def update_template(db: Session, template_id: int, data: TemplateUpdate):
    template = get_template(db, template_id)
    if not template:
        return None

    update_data = data.dict(exclude_unset=True)

    if template.type == "whatsapp":

        if template.meta_status in ["PENDING", "APPROVED"]:
            return {
                "success": False,
                "message": "WhatsApp templates cannot be edited after submission. Please create a new template."
            }

        if template.meta_status in ["FAILED", "REJECTED"]:
            if "name" in update_data:
                update_data["whatsapp_template_name"] = format_whatsapp_name(update_data["name"])

            # recreate in Meta
            meta_res = create_meta_template(db, {**template.__dict__, **update_data}, template.organization_id)

            if meta_res.get("success") is False:
                template.meta_status = "FAILED"
                template.rejection_reason = meta_res.get("error")

            elif "id" in meta_res:
                template.meta_template_id = meta_res["id"]
                template.meta_status = meta_res.get("status", "PENDING")
                template.rejection_reason = None

            else:
                template.meta_status = "FAILED"
                template.rejection_reason = str(meta_res)

    # Normal update (for all types)
    for k, v in update_data.items():
        setattr(template, k, v)

    db.commit()
    db.refresh(template)

    return {
        "success": True,
        "message": "Template updated successfully",
        "data": template
    }

def delete_template(db: Session, template_id: int):
    template = get_template(db, template_id)
    if not template:
        return None

    # WhatsApp handling
    if template.type == "whatsapp":
        # Optional: prevent delete if approved
        if template.meta_status == "APPROVED":
            return {
                "success": False,
                "message": "Approved WhatsApp templates cannot be deleted. You can deactivate them."
            }

    # Soft delete
    template.status = TemplateStatus.inactive

    db.commit()

    return {
        "success": True,
        "message": "Template deactivated successfully"
    }


def get_template_lookup(db: Session, organization_id: int, type: Optional[str] = None):

    query = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == organization_id,
        MessageTemplate.status == TemplateStatus.active
    )

    if type:
        query = query.filter(MessageTemplate.type == type)

    templates = query.order_by(MessageTemplate.name.asc()).all()

    return [{"id": t.id, "name": t.name, "type": t.type} for t in templates]
