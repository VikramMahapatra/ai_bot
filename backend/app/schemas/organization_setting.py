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

    # SMTP
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_sender_email: str | None = None
    smtp_use_tls: bool = True

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
