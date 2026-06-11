from typing import Optional

from pydantic import BaseModel


class OrganizationSettingsBase(BaseModel):
    # General
    enable_email_notifications: bool = True
    auto_save_conversations: bool = True
    dark_mode: bool = False
    show_analytics_dashboard: bool = True

    # AI
    enable_rag: bool = True
    use_semantic_search: bool = True
    auto_vectorize_documents: bool = True
    enable_debugging: bool = False

    # Lead
    auto_capture_leads: bool = True
    require_email_for_lead: bool = True
    send_lead_notifications: bool = False

    default_escalation_level_1: str | None = None
    default_escalation_level_2: str | None = None

    expected_close_days: int | None = None


class OrganizationSettingsUpdate(OrganizationSettingsBase):
    pass


class OrganizationSettingsResponse(OrganizationSettingsBase):
    id: int
    organization_id: int

    class Config:
        from_attributes = True


class OrganizationEmailSettingUpdate(BaseModel):
    id: Optional[int] = None

    name: str
    smtp_host: str
    smtp_port: int
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None

    sender_email: str
    reply_to_email: Optional[str] = None
    sender_name: Optional[str] = None
    cc_emails: Optional[str] = None

    use_tls: bool = True
    is_default: bool = False
    is_active: bool = True


class OrganizationEmailSettingResponse(BaseModel):
    id: int
    name: str
    sender_email: str
    reply_to_email: Optional[str]
    sender_name: Optional[str]
    cc_emails: Optional[str]
    smtp_username: str
    smtp_password: str
    smtp_host: str
    smtp_port: int
    use_tls: bool
    is_default: bool
    is_active: bool

    class Config:
        from_attributes = True
