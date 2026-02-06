import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class SyncState(Base):
    __tablename__ = "sync_state"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    domain = Column(String, index=True)
    last_sync_timestamp = Column(DateTime)
    last_full_refresh = Column(DateTime)
    status = Column(String)