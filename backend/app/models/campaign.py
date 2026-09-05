from sqlalchemy import (
    Boolean,
    Column,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    DateTime,
    Text,
    ForeignKey,
    Time,
)
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY


class ContactList(Base):
    __tablename__ = "contact_lists"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    list_name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    contacts = relationship("Contact", back_populates="contact_list")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, Identity(), primary_key=True)
    contact_list_id = Column(
        Integer, ForeignKey("contact_lists.id"), nullable=False, index=True
    )

    # Basic Info
    name = Column(String, nullable=True)
    email = Column(String, nullable=True, index=True)
    phone = Column(String, nullable=True, index=True)
    whatsapp_number = Column(String, nullable=True)
    gender = Column(String, nullable=True)

    # Company Info
    company = Column(String, nullable=True)
    designation = Column(String, nullable=True)

    # Product Info
    item_name = Column(String, nullable=True)
    item_type = Column(String, nullable=True)
    interest_stage = Column(String, nullable=True)
    item_category = Column(String, nullable=True)
    amount = Column(Numeric, nullable=True)
    offer_value = Column(String, nullable=True)

    # Location
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # Source / Lifecycle
    source = Column(String, nullable=True)
    lifecycle_stage = Column(String, nullable=True)

    # Tags
    tags = Column(String, nullable=True)  # comma separated OR JSON
    custom_fields = Column(Text, nullable=True)

    # System Fields
    session_id = Column(String, index=True, nullable=True)  # for chat's contact sync
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    external_contact_id = Column(Integer, nullable=True)

    contact_list = relationship("ContactList", back_populates="contacts")
    campaign_links = relationship("CampaignContact", back_populates="contact")
    call_logs = relationship("CallLog", back_populates="contact")

    __table_args__ = (Index("idx_contact_external_id", "external_contact_id"),)


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    campaign_name = Column(String, nullable=False, index=True)
    campaign_type = Column(String, nullable=False, index=True)  # email | whatsapp | sms
    message_template_id = Column(
        Integer, ForeignKey("message_templates.id"), nullable=True, index=True
    )
    message_template = Column(Text, nullable=False)
    contact_list_id = Column(
        Integer, ForeignKey("contact_lists.id"), nullable=False, index=True
    )
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    category = Column(String)

    open_tracking_enabled = Column(Boolean, nullable=False, default=False)
    click_tracking_enabled = Column(Boolean, nullable=False, default=False)
    footer_display_enabled = Column(Boolean, nullable=False, default=False)

    scheduled_time = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(String, nullable=False, default="draft", index=True)
    number_sent = Column(Integer, nullable=False, default=0)
    number_failed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False)

    selected_smtp_profile_ids = Column(
        ARRAY(Integer), nullable=False, default=list, server_default="{}"
    )
    active_days = Column(
        ARRAY(String), nullable=False, default=list, server_default="{}"
    )
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)

    sequences = relationship(
        "CampaignSequence",
        foreign_keys="CampaignSequence.campaign_id",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="CampaignSequence.sequence_order",
    )


class CampaignLog(Base):
    __tablename__ = "campaign_logs"

    id = Column(Integer, Identity(), primary_key=True)
    campaign_id = Column(
        Integer, ForeignKey("campaigns.id"), nullable=False, index=True
    )
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    run_sequence = Column(Integer, nullable=False, default=1, index=True)
    run_started_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, index=True)  # sent | failed | pending
    email = Column(String(255), index=True, nullable=False)
    from_email = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    bounced_at = Column(DateTime(timezone=True), nullable=True)
    complained_at = Column(DateTime(timezone=True), nullable=True)
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)
    provider_message_id = Column(String, nullable=True, index=True)
    tracking_token = Column(String, nullable=True, index=True)
    open_count = Column(Integer, nullable=False, default=0)
    click_count = Column(Integer, nullable=False, default=0)
    last_event_type = Column(String, nullable=True, index=True)
    last_event_at = Column(DateTime(timezone=True), nullable=True)
    event_payload = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    converted_lead_id = Column(
        Integer, ForeignKey("leads.id"), nullable=True, index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CampaignLeadRule(Base):
    __tablename__ = "campaign_lead_rules"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    rule_name = Column(String, nullable=False, default="Default Campaign to Lead Rule")
    is_active = Column(Integer, nullable=False, default=1, index=True)
    auto_convert_enabled = Column(Integer, nullable=False, default=0)
    min_score_threshold = Column(Integer, nullable=False, default=50)
    dedupe_window_days = Column(Integer, nullable=False, default=30)
    target_funnel_stage = Column(String, nullable=True)
    include_statuses = Column(Text, nullable=True)  # JSON array
    exclude_statuses = Column(Text, nullable=True)  # JSON array
    score_config = Column(Text, nullable=True)  # JSON object
    source_multipliers = Column(Text, nullable=True)  # JSON object
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CampaignLeadConversion(Base):
    __tablename__ = "campaign_lead_conversions"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    campaign_id = Column(
        Integer, ForeignKey("campaigns.id"), nullable=False, index=True
    )
    campaign_log_id = Column(
        Integer, ForeignKey("campaign_logs.id"), nullable=False, index=True
    )
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
    rule_id = Column(
        Integer, ForeignKey("campaign_lead_rules.id"), nullable=False, index=True
    )
    score = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="skipped", index=True)
    reason = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # JSON payload
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CampaignSequence(Base):
    __tablename__ = "campaign_sequences"

    id = Column(Integer, Identity(), primary_key=True)

    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Actual campaign created for this sequence
    sequence_campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    sequence_order = Column(Integer, nullable=False)

    gap_days = Column(Integer, nullable=False, default=0)

    template_id = Column(
        Integer,
        ForeignKey("message_templates.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    campaign = relationship("Campaign", back_populates="sequences")

    campaign = relationship(
        "Campaign",
        foreign_keys=[campaign_id],
        back_populates="sequences",
    )

    sequence_campaign = relationship(
        "Campaign",
        foreign_keys=[sequence_campaign_id],
    )

    template = relationship(
        "MessageTemplate",
        foreign_keys=[template_id],
    )
