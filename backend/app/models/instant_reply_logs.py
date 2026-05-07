from sqlalchemy import (
    Column,
    Identity,
    Integer,
    String,
    DateTime,
    Text,
    Enum as SQLEnum,
    ForeignKey,
)
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship


class InstantReplyLog(Base):
    __tablename__ = "instant_reply_logs"

    id = Column(Integer, primary_key=True, index=True)
    call_log_id = Column(
        Integer, ForeignKey("call_logs.id"), index=True, nullable=False
    )

    decision = Column(String, nullable=True)  # send_now / do_not_send_now
    status = Column(String, nullable=True)  # pending / success / failed / skipped
    error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    call_log = relationship("CallLog", backref="instant_reply_logs")
    channel_logs = relationship("InstantReplyChannelLog", backref="instant_reply")


class InstantReplyChannelLog(Base):
    __tablename__ = "instant_reply_channel_logs"

    id = Column(Integer, primary_key=True)
    instant_reply_log_id = Column(Integer, ForeignKey("instant_reply_logs.id"))

    channel = Column(String)  # sms / email / whatsapp
    status = Column(String)  # success / failed
    error = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
