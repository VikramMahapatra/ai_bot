from sqlalchemy import JSON, Column, Float, Identity, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer,  Identity(), primary_key=True, index=True)
    organization_id = Column(Integer, nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    steps = relationship(
        "WorkflowStep",
        backref="workflow",
        cascade="all, delete-orphan"
    )

    edges = relationship(
        "WorkflowEdge",
        backref="workflow",
        cascade="all, delete-orphan"
    )
    
    
class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(Integer, Identity(), primary_key=True)

    workflow_id = Column(Integer, ForeignKey("workflows.id"))

    node_type = Column(String(50))  
    # initial_call | action | stop
    
    position = Column(JSON)

    title = Column(String(255))
    
    step_number = Column(Integer)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    outcomes = relationship(
        "WorkflowStepOutcome",
        backref="step",
        cascade="all, delete-orphan"
    )
    
class WorkflowStepOutcome(Base):
    __tablename__ = "workflow_step_outcomes"

    id = Column(Integer, Identity(), primary_key=True)

    step_id = Column(
        Integer,
        ForeignKey("workflow_steps.id")
    )

    call_status = Column(String(50))
    # connected | not_connected

    outcome = Column(String(50))
    # interested | busy | call_back | no_answer

    step_type = Column(String(50))
    # call | sms | email | whatsapp

    agent_id = Column(Integer, nullable=True)

    template_id = Column(Integer, nullable=True)

    delay = Column(Integer, default=0)

    delay_unit = Column(String(20), default="minutes")

    max_retries = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    
class WorkflowEdge(Base):
    __tablename__ = "workflow_edges"

    id = Column(Integer, Identity(), primary_key=True)

    workflow_id = Column(
        Integer,
        ForeignKey("workflows.id"),
        nullable=False,
        index=True
    )

    source_step_id = Column(
        Integer,
        ForeignKey("workflow_steps.id"),
        nullable=False
    )

    target_step_id = Column(
        Integer,
        ForeignKey("workflow_steps.id"),
        nullable=False
    )

    branch = Column(
        String(50),
        nullable=True
    )
    # connected / not_connected / custom

    condition = Column(Text, nullable=True)
    
    max_retry = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
   
class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(Integer, Identity(), primary_key=True)

    workflow_id = Column(Integer)
    campaign_id = Column(Integer)
    contact_id = Column(Integer)


    step_id = Column(Integer)
    step_type = Column(String(50))
    external_reference_id = Column(Integer, nullable=True)

    status = Column(String(50))  
    # pending / completed

    scheduled_at = Column(DateTime(timezone=True))
    executed_at = Column(DateTime(timezone=True))
    
class WorkflowExecutionLog(Base):
    __tablename__ = "workflow_execution_logs"

    id = Column(Integer, Identity(), primary_key=True)

    execution_id = Column(Integer, ForeignKey("workflow_executions.id"))

    step_id = Column(Integer)
    event_type = Column(String(50))
    # trigger / scheduled / executed / moved / failed

    call_status = Column(String(50), nullable=True)
    outcome = Column(String(50), nullable=True)

    event_metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())