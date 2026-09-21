import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class QualificationTemplateStatus(str, enum.Enum):
    active = "Active"
    inactive = "Inactive"


class QualificationTemplate(Base):
    __tablename__ = "qualification_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    objective = Column(Text, nullable=False)
    qualification_mode = Column(
        String(32), nullable=False, default="essential_supporting"
    )
    temperature_mode = Column(String(16), nullable=False, default="standard")
    status = Column(
        Enum(QualificationTemplateStatus),
        nullable=False,
        default=QualificationTemplateStatus.active,
    )
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=True, onupdate=func.now())

    criteria = relationship(
        "QualificationCriterion",
        cascade="all, delete-orphan",
        order_by="QualificationCriterion.sort_order",
        passive_deletes=True,
    )
    attributes = relationship(
        "QualificationAttribute",
        cascade="all, delete-orphan",
        order_by="QualificationAttribute.sort_order",
        passive_deletes=True,
    )
    positive_signals = relationship(
        "QualificationPositiveSignal",
        cascade="all, delete-orphan",
        order_by="QualificationPositiveSignal.sort_order",
        passive_deletes=True,
    )
    disqualification_criteria = relationship(
        "DisqualificationCriterion",
        cascade="all, delete-orphan",
        order_by="DisqualificationCriterion.sort_order",
        passive_deletes=True,
    )
    lead_temperatures = relationship(
        "LeadTemperatureRule",
        cascade="all, delete-orphan",
        order_by="LeadTemperatureRule.sort_order",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_qualification_templates_org_name",
        ),
    )


class QualificationCriterion(Base):
    __tablename__ = "qualification_template_criteria"

    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("qualification_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    criterion_key = Column(String(100), nullable=True)
    source = Column(String(16), nullable=False, default="predefined")
    importance = Column(String(16), nullable=False, default="Essential")
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, nullable=False, default=True)
    weight = Column(Integer, nullable=False, default=10)
    sort_order = Column(Integer, nullable=False, default=0)


class QualificationAttribute(Base):
    __tablename__ = "qualification_template_attributes"

    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("qualification_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key = Column(String(100), nullable=False)
    label = Column(String(255), nullable=False)
    data_type = Column(String(32), nullable=False, default="text")
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, nullable=False, default=False)
    is_qualification_relevant = Column(Boolean, nullable=False, default=False)
    importance = Column(String(16), nullable=False, default="Supporting")
    currency = Column(String(8), nullable=True)
    value_rule = Column(String(16), nullable=False, default="any")
    min_value = Column(Numeric(18, 4), nullable=True)
    max_value = Column(Numeric(18, 4), nullable=True)
    options = Column(JSON, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "template_id",
            "key",
            name="uq_qualification_attributes_template_key",
        ),
    )


class QualificationPositiveSignal(Base):
    __tablename__ = "qualification_template_positive_signals"

    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("qualification_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    signal_key = Column(String(100), nullable=True)
    category = Column(String(32), nullable=False, default="Interest")
    source = Column(String(16), nullable=False, default="predefined")
    description = Column(Text, nullable=True)
    score = Column(Integer, nullable=False, default=10)
    sort_order = Column(Integer, nullable=False, default=0)


class DisqualificationCriterion(Base):
    __tablename__ = "qualification_template_disqualifiers"

    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("qualification_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    criterion_key = Column(String(100), nullable=True)
    source = Column(String(16), nullable=False, default="predefined")
    description = Column(Text, nullable=True)
    action = Column(String(32), nullable=False, default="disqualify")
    sort_order = Column(Integer, nullable=False, default=0)


class LeadTemperatureRule(Base):
    __tablename__ = "qualification_template_temperatures"

    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("qualification_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(32), nullable=False)
    min_score = Column(Integer, nullable=False)
    max_score = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(16), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "template_id",
            "name",
            name="uq_qualification_temperatures_template_name",
        ),
    )