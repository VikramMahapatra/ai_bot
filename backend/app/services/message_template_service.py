import re
from typing import Optional

import requests
from sqlalchemy import String, and_, cast, or_
from sqlalchemy.orm import Session
from app.models.message_templates import MessageTemplate, TemplateStatus, TemplateType
from app.schemas.message_template import TemplateCreate, TemplateUpdate
from app.models.whatsapp_channel import WhatsAppChannel
from app.config import settings


def format_whatsapp_name(name: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", name.lower().replace(" ", "_"))


def build_template_components(
    content: str,
    variable_mappings: dict | None = None,
):
    matches = re.findall(r"{{(\d+)}}", content)

    # unique + sorted variables
    unique_variables = sorted(set(matches), key=int)

    component = {
        "type": "BODY",
        "text": content,
    }

    if unique_variables:

        sample_values = []

        for variable in unique_variables:

            sample = (
                variable_mappings.get(variable, {}).get("sample")
                if variable_mappings
                else None
            )

            sample_values.append(sample or f"Sample{variable}")

        component["example"] = {"body_text": [sample_values]}

    return [component]


def sync_whatsapp_templates(db: Session, organization_id):

    channel = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == organization_id,
            WhatsAppChannel.is_active == True,
            WhatsAppChannel.widget_id.is_(None),
        )
        .first()
    )

    if not channel:
        return {
            "success": False,
            "message": "No active WhatsApp channel found for this organization",
        }

    res = requests.get(
        f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{channel.waba_id}/message_templates",
        headers={"Authorization": f"Bearer {channel.access_token}"},
    )

    data = res.json().get("data", [])

    print("Fetched WhatsApp templates from Meta:", data)

    for item in data:
        template = (
            db.query(MessageTemplate)
            .filter(
                MessageTemplate.whatsapp_template_name == item["name"],
                MessageTemplate.organization_id == organization_id,
            )
            .first()
        )

        if template:
            template.meta_status = item.get("status")
            template.rejection_reason = item.get("rejected_reason")
            template.category = item.get("category")
            template.language = item.get("language")
        else:
            # Extract body content from Meta template
            body_content = ""

            for component in item.get("components", []):
                if component.get("type") == "BODY":
                    body_content = component.get("text", "")
                    break

            placeholders = re.findall(r"{{\d+}}", body_content)

            template = MessageTemplate(
                organization_id=organization_id,
                name=item["name"].replace("_", " ").title(),
                whatsapp_template_name=item["name"],
                type=TemplateType.whatsapp,
                content=body_content,
                category=item.get("category"),
                language=item.get("language"),
                meta_template_id=item.get("id"),
                meta_status=item.get("status"),
                rejection_reason=item.get("rejected_reason"),
                status=(
                    TemplateStatus.inactive if placeholders else TemplateStatus.active
                ),
            )

            db.add(template)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("Commit failed:", str(e))
        raise

    return {"success": True, "message": "WhatsApp templates synced successfully"}


def create_meta_template(db, data, organization_id):
    channel = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == organization_id,
            WhatsAppChannel.is_active == True,
            WhatsAppChannel.widget_id.is_(None),
        )
        .first()
    )
    if not channel:
        return {
            "success": False,
            "meta_status": "FAILED",
            "error": "No active WhatsApp channel found",
        }

    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{channel.waba_id}/message_templates"

    headers = {
        "Authorization": f"Bearer {channel.access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "name": data["whatsapp_template_name"],
        "language": data["language"],
        "category": data["category"],
        "components": build_template_components(
            data["content"], data.get("variable_mappings")
        ),
    }

    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        data = res.json()

        if data.get("error"):
            error = data["error"]

            return {
                "success": False,
                "meta_status": "FAILED",
                "error": error.get("error_user_msg") or error.get("message"),
                "meta_error": error,
            }

        return data

    except Exception as e:
        return {"success": False, "meta_status": "FAILED", "error": str(e)}


def create_template(db: Session, organization_id: int, data: TemplateCreate):

    template_data = data.dict()

    if template_data.get("type") == "whatsapp":
        template_data["whatsapp_template_name"] = format_whatsapp_name(
            template_data["name"]
        )

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

    template = MessageTemplate(organization_id=organization_id, **template_data)

    db.add(template)
    db.commit()
    db.refresh(template)

    return {
        "success": True,
        "message": "Template created successfully",
        "data": template,
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

    # -----------------------------------
    # VERSIONING FILTER
    # -----------------------------------

    query = query.filter(
        or_(
            MessageTemplate.type != "whatsapp",
            and_(
                MessageTemplate.type == "whatsapp",
                MessageTemplate.is_latest == True,
                MessageTemplate.is_archived == False,
            ),
        )
    )

    # -----------------------------------
    # SEARCH
    # -----------------------------------

    if search:
        search_term = f"%{search}%"

        query = query.filter(
            or_(
                MessageTemplate.name.ilike(search_term),
                cast(MessageTemplate.type, String).ilike(search_term),
                MessageTemplate.subject.ilike(search_term),
            )
        )

    # -----------------------------------
    # TYPE FILTER
    # -----------------------------------

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
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }


def get_template(db: Session, template_id: int):
    return db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()


def update_template(db: Session, template_id: int, data: TemplateUpdate):

    template = get_template(db, template_id)

    if not template:
        return None

    is_locked_template = template.meta_status in ["PENDING", "APPROVED"]

    update_data = data.dict(exclude_unset=True)

    # -----------------------------------
    # NON-WHATSAPP NORMAL UPDATE
    # -----------------------------------
    if template.type != "whatsapp":

        for k, v in update_data.items():
            setattr(template, k, v)

        db.commit()
        db.refresh(template)

        return {
            "success": True,
            "message": "Template updated successfully",
            "data": template,
        }

    if template.type == "whatsapp" and is_locked_template:
        allowed_fields = {"variable_mappings"}

        filtered_update = {k: v for k, v in update_data.items() if k in allowed_fields}

        # prevent accidental overwrite
        for k, v in filtered_update.items():
            setattr(template, k, v)

        db.commit()
        db.refresh(template)

        return {
            "success": True,
            "message": "Variable mapping updated successfully",
            "data": template,
        }

    # -----------------------------------
    # WHATSAPP VERSIONING FLOW
    # -----------------------------------

    # archive old latest
    template.is_latest = False

    parent_id = template.parent_template_id or template.id

    new_version = (template.version or 1) + 1

    template_name = update_data.get("name", template.name)

    whatsapp_template_name = f"{format_whatsapp_name(template_name)}_v{new_version}"

    # clone existing template data
    new_template_data = {
        c.name: getattr(template, c.name)
        for c in template.__table__.columns
        if c.name
        not in [
            "id",
            "created_at",
            "updated_at",
        ]
    }

    # apply updates
    new_template_data.update(update_data)

    # versioning fields
    new_template_data["version"] = new_version
    new_template_data["parent_template_id"] = parent_id
    new_template_data["is_latest"] = True
    new_template_data["is_archived"] = False

    # meta fields
    new_template_data["whatsapp_template_name"] = whatsapp_template_name

    new_template_data["meta_status"] = "PENDING"

    # create in Meta
    meta_res = create_meta_template(
        db,
        new_template_data,
        template.organization_id,
    )

    if meta_res.get("success") is False:

        new_template_data["meta_status"] = "FAILED"

        new_template_data["rejection_reason"] = meta_res.get("error")

    elif "id" in meta_res:

        new_template_data["meta_template_id"] = meta_res["id"]

        new_template_data["meta_status"] = meta_res.get("status", "PENDING")

        new_template_data["rejection_reason"] = None

    else:

        new_template_data["meta_status"] = "FAILED"

        new_template_data["rejection_reason"] = str(meta_res)

    # create NEW template row
    new_template = MessageTemplate(**new_template_data)

    db.add(new_template)

    db.commit()

    db.refresh(new_template)

    return {
        "success": True,
        "message": "WhatsApp template version created",
        "data": new_template,
    }


def update_template_status(db: Session, template_id: int, status: str):
    template = get_template(db, template_id)

    if not template:
        return {"success": False, "message": "Template not found"}

    try:
        status_enum = TemplateStatus[status.lower()]
    except KeyError:
        return {"success": False, "message": "Invalid status value"}

    # Validate WhatsApp template before activating
    if template.type == TemplateType.whatsapp and status_enum == TemplateStatus.active:
        mappings = template.variable_mappings or {}

        # No mappings configured
        if not mappings:
            return {
                "success": False,
                "message": "Please configure variable mappings before activating this WhatsApp template.",
            }

        # Check for empty/null mappings
        unmapped = [key for key, value in mappings.items() if value in (None, "", [])]

        if unmapped:
            return {
                "success": False,
                "message": f"Please map all variables before activating. Unmapped: {', '.join(unmapped)}",
            }

    template.status = status_enum

    db.commit()
    db.refresh(template)

    return {
        "success": True,
        "message": f"Template {status_enum.value} successfully",
        "data": template,
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
                "message": "Approved WhatsApp templates cannot be deleted. You can deactivate them.",
            }

    # Soft delete
    template.status = TemplateStatus.inactive

    db.commit()

    return {"success": True, "message": "Template deactivated successfully"}


def get_template_lookup(db: Session, organization_id: int, type: Optional[str] = None):

    query = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == organization_id,
        MessageTemplate.status == TemplateStatus.active,
        or_(
            MessageTemplate.type != "whatsapp",
            and_(
                MessageTemplate.type == "whatsapp",
                MessageTemplate.is_latest == True,
                MessageTemplate.meta_status == "APPROVED",
            ),
        ),
    )

    if type:
        query = query.filter(MessageTemplate.type == type)

    templates = query.order_by(MessageTemplate.name.asc()).all()

    return [
        {
            "id": t.id,
            "type": t.type,
            "name": t.name,
            "content": t.content,
            "subject": t.subject,
            "category": t.category,
            "language": t.language,
            "meta_template_id": t.meta_template_id,
            "whatsapp_template_name": t.whatsapp_template_name,
            "variable_mappings": t.variable_mappings,
        }
        for t in templates
    ]
