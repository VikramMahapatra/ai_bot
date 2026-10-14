"""Owned additive tables; JSONB on PostgreSQL, JSON on isolated SQLite tests.

Immutability guards cover ORM flushes used by these endpoints, not bulk/direct
SQL. Database-role restrictions or database triggers require a separate review.
"""
from sqlalchemy import (Column, Integer, String, Text, Boolean, ForeignKey,
                        ForeignKeyConstraint, UniqueConstraint, CheckConstraint, Index, JSON, Identity)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import event, inspect, select
from sqlalchemy import MetaData, Table
from app.database import Base

JSON_VALUE = JSON().with_variant(JSONB, "postgresql")


class StructuredDataset(Base):
    __tablename__ = "structured_datasets"
    id = Column(Integer, Identity(), primary_key=True, autoincrement="ignore_fk")
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    widget_id = Column(String, ForeignKey("widget_configs.widget_id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=False, default="")
    status = Column(String(16), nullable=False, default="draft")
    # Scoped composite FK added by SQLAlchemy after versions exist on PostgreSQL.
    active_version_id = Column(Integer, nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    __table_args__ = (
        UniqueConstraint("id", "organization_id", "widget_id", name="uq_sd_scope"),
        ForeignKeyConstraint(["id", "organization_id", "widget_id", "active_version_id"],
                             ["structured_dataset_versions.dataset_id", "structured_dataset_versions.organization_id",
                              "structured_dataset_versions.widget_id", "structured_dataset_versions.id"],
                             name="fk_sd_active_scope", use_alter=True),
        CheckConstraint("status IN ('draft','active','inactive')", name="ck_sd_status"),
        Index("ix_sd_scope", "organization_id", "widget_id", "is_deleted", "status"),
    )


class StructuredDatasetVersion(Base):
    __tablename__ = "structured_dataset_versions"
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, nullable=False)
    organization_id = Column(Integer, nullable=False)
    widget_id = Column(String, nullable=False)
    version_number = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False, default="draft")
    sheet_name = Column(String(200), nullable=False)
    columns = Column(JSON_VALUE, nullable=False)
    required_filters = Column(JSON_VALUE, nullable=False)
    validation = Column(JSON_VALUE, nullable=False)
    row_count = Column(Integer, nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(["dataset_id", "organization_id", "widget_id"],
                             ["structured_datasets.id", "structured_datasets.organization_id", "structured_datasets.widget_id"]),
        UniqueConstraint("dataset_id", "version_number", name="uq_sdv_number"),
        UniqueConstraint("dataset_id", "organization_id", "widget_id", "id", name="uq_sdv_scope"),
        CheckConstraint("status IN ('draft','published')", name="ck_sdv_status"),
        Index("ix_sdv_scope", "organization_id", "widget_id", "dataset_id"),
    )


class StructuredDatasetRow(Base):
    __tablename__ = "structured_dataset_rows"
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, nullable=False)
    version_id = Column(Integer, nullable=False)
    organization_id = Column(Integer, nullable=False)
    widget_id = Column(String, nullable=False)
    row_number = Column(Integer, nullable=False)
    values = Column(JSON_VALUE, nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(["dataset_id", "organization_id", "widget_id", "version_id"],
                             ["structured_dataset_versions.dataset_id", "structured_dataset_versions.organization_id",
                              "structured_dataset_versions.widget_id", "structured_dataset_versions.id"]),
        UniqueConstraint("version_id", "row_number", name="uq_sdr_number"),
        Index("ix_sdr_scope", "organization_id", "widget_id", "version_id", "row_number"),
    )


def owned_metadata() -> MetaData:
    """DDL-only metadata: no shared legacy enum/create hooks are dispatched.

    Reference placeholders resolve foreign keys but are never created. The real
    parent tables must already exist; no legacy table/constraint is altered.
    """
    metadata = MetaData()
    Table("organizations", metadata, Column("id", Integer, primary_key=True))
    Table("widget_configs", metadata, Column("widget_id", String, primary_key=True))
    for table in (StructuredDataset.__table__, StructuredDatasetVersion.__table__, StructuredDatasetRow.__table__):
        table.to_metadata(metadata)
    return metadata


@event.listens_for(StructuredDatasetVersion, "before_update")
@event.listens_for(StructuredDatasetVersion, "before_delete")
def protect_published_version(mapper, connection, target):
    # Attribute history may be empty after expiration/deferred loading or a PK
    # change. Read the persisted identity, not the caller's new status/id.
    identity = inspect(target).identity
    prior = connection.execute(select(StructuredDatasetVersion.status).where(
        StructuredDatasetVersion.id == identity[0])).scalar_one_or_none() if identity else None
    if prior == "published":
        raise ValueError("Published dataset versions are immutable")


@event.listens_for(StructuredDatasetRow, "before_insert")
@event.listens_for(StructuredDatasetRow, "before_update")
@event.listens_for(StructuredDatasetRow, "before_delete")
def protect_published_row(mapper, connection, target):
    history = inspect(target).attrs.version_id.history.deleted
    identity = inspect(target).identity
    original = connection.execute(select(StructuredDatasetRow.version_id).where(
        StructuredDatasetRow.id == identity[0])).scalar_one_or_none() if identity else None
    # Check original AND new parent, so moving a published row cannot bypass guard.
    for version_id in {target.version_id, original, *history} - {None}:
        status = connection.execute(select(StructuredDatasetVersion.status).where(
            StructuredDatasetVersion.id == version_id)).scalar_one_or_none()
        if status == "published":
            raise ValueError("Published dataset rows are immutable")