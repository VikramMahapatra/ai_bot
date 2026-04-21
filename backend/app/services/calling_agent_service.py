# Create Agent
from datetime import datetime, timezone
import os
import random
import re
import shutil
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import case, func
from app.config import settings
from fastapi import BackgroundTasks, File, HTTPException, UploadFile, requests

from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from sqlalchemy.orm import Session

from app.schemas.calling_agent import AgentStatusUpdate, CallingAgentCreate, CallingAgentUpdate, TestCallRequest
from app.utils.echoleads_client import EcholeadsClient
from app.models.voices import Voice
from app.models.call_logs import CallLog, CallTranscript
from app.models.call_campaigns import CallCampaign
from app.models.user import Organization
from app.services.call_log_service import process_call, sync_call_logs
from app.services import organization_credit_service
from app.enums.credit_feature_codes import FeatureCodes

UPLOAD_DIR = "uploads/agent_training_docs"

def get_agent_feature_code(agent_type: str):
    return (
        FeatureCodes.CORE_CALL_AGENT_OUT
        if agent_type == "outbound"
        else FeatureCodes.CORE_CALL_AGENT_IN
    )

def create_agent(
    db: Session,
    organization_id: int,
    agent: CallingAgentCreate,
    training_files: Optional[List[UploadFile]] = None
):
    org = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()
    
    if not org:
        raise ValueError("Organization not found")
    
    
    valid = organization_credit_service.validate_feature_usage(
        db,
        org.id,
        get_agent_feature_code(agent.type),
        1
    )
    
    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Insufficient credits. Please add more credits to continue."
        )
    
    unique_agent_code = f"ORG{organization_id}AG{uuid4().hex[:5]}".upper()
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    saved_files = []

    # Save uploaded files
    if training_files:
        for file in training_files:
            ext = file.filename.split(".")[-1]
            unique_name = f"{uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            with open(file_path, "wb") as buffer:
                buffer.write(file.file.read())

            saved_files.append(file_path)
            
    agent_widget_id = f"widget_{int(datetime.now().timestamp()*1000)}_{random.randint(1000,9999)}"

    db_agent = CallingAgent(
        organization_id=organization_id,
        name=agent.name,
        type=agent.type.lower(),
        widget_id=agent_widget_id,
        greeting=agent.greeting,
        prompt=agent.prompt,
        server_location=agent.server_location,
        inbound_phone_number=agent.inbound_phone_number if agent.type.lower() == "inbound" else None,

        # Voice
        gender=agent.gender,
        accent=agent.accent,
        voice=agent.voice,

        # Conversation
        who_speaks_first=agent.who_speaks_first,

        # Files
        training_doc=",".join(saved_files) if saved_files else None,

        # Destination
        destination=",".join(agent.destination) if agent.destination else None,

        # Timezone
        enable_prompt_timezone=agent.enable_prompt_timezone,
        prompt_timezone=agent.prompt_timezone,

        # Call Forwarding
        enable_call_forwarding=agent.enable_call_forwarding,
        call_forwarding_number=agent.call_forwarding_number,
        call_forwarding_role=agent.call_forwarding_role,
        call_forwarding_action_desc=agent.call_forwarding_action_desc,

        # Analysis
        silence_timeout=agent.silence_timeout,
        talking_speed=agent.talking_speed,
        max_call_duration=agent.max_call_duration,
        calendar_sync=agent.calendar_sync,

        enable_sentiment=agent.enable_sentiment,
        voice_mail_detection=agent.voice_mail_detection,
        enable_call_recording=agent.enable_call_recording,

        # Summary
        success_parameters=agent.success_parameters,
        enable_call_summary=agent.enable_call_summary,
        summary_prompt=agent.summary_prompt,
        follow_up_whatsapp=agent.follow_up_whatsapp,

        # AI Config
        important_data_points=agent.important_data_points,
        enable_background_sound=agent.enable_background_sound,
        background_sound_url=agent.background_sound_url,
        start_speaking_wait_seconds=agent.start_speaking_wait_seconds,
        stop_speaking_voice_seconds=agent.stop_speaking_voice_seconds,

        # Transcriber
        transcriber_provider=agent.transcriber_provider,
        transcriber_language=agent.transcriber_language,
        transcriber_model=agent.transcriber_model,
        
        status= "pending",
        external_agent_name=  unique_agent_code
    )

    db.add(db_agent)
    db.flush()
    
    #CREATE REQUEST TO ECHO LEADS
    echoleads = EcholeadsClient()
    echo_payload ={
        "name": db_agent.external_agent_name,
        "agent_call_type":  "outgoing" if agent.type.lower() == "outbound" else "incoming",        
        "language": agent.accent if agent.accent and agent.accent != "all" else "en-US",
        "firstMessage": agent.greeting,
        "prompt": agent.prompt,
        "google_sheet_id": "",
        "success_parameters": agent.success_parameters,
        "data_extract": None,
        "summary_capturing": agent.summary_prompt,
        "summary":  "1" if agent.summary_prompt else "0",
        "sentiment_detection": "1" if agent.enable_sentiment else "0",
        "voice_mail_detection": "1" if agent.voice_mail_detection else "0",
        "call_recording": "0",
        "automated_follow_ups": "0",
        "calendar_sync": agent.calendar_sync,
        "temperature": "10",
        "agent_status": "draft",
        "remaning_call_count": None,
        "voice_id": agent.voice,
        "speaks_first":agent.who_speaks_first,
        "agent_speaks_first": True if agent.who_speaks_first == "ai" else False,
        "silence_timeout": str(agent.silence_timeout),
        "talking_speed": str(agent.talking_speed),
        "max_duration_seconds": str(agent.max_call_duration),
        "voice_mail_detection_enabled": "1" if agent.voice_mail_detection else "0",
        "voicemail_provider": "vapi",
        "voicemail_beep_max_await_seconds": "5",
        "voicemail_max_retries": "10",
        "voicemail_start_at_seconds": "5",
        "voicemail_frequency_seconds": "5",
        "background_sound": "" if agent.enable_background_sound else "off",
        "background_sound_url": agent.background_sound_url,
        "start_speaking_wait_seconds": str(agent.start_speaking_wait_seconds),
        "stop_speaking_voice_seconds": str(agent.stop_speaking_voice_seconds),
        "analysis_plan": None,
        "transaction_id": None,
        "prompt_timezone": None,
        "tool_ids": [],
        "phone": None,
        "transcriber": {
            "provider": agent.transcriber_provider,
            "language": agent.transcriber_language,
            "model": agent.transcriber_model
        },
        "transcriber_provider": agent.transcriber_provider,
        "transcriber_language": agent.transcriber_language,
        "transcriber_model": agent.transcriber_model,       
        "punctuation_boundaries": [],
        "server_location": agent.server_location,
        "speech_to_speech": False,
        
        "is_pay_as_you_go": True,   
        "is_connected_calls": False,
        
        "call_forwarding_enabled": agent.enable_call_forwarding,
        "call_forwarding_number": agent.call_forwarding_number,
        "call_forwarding_action_desc": agent.call_forwarding_action_desc,
        "call_forwarding_message": agent.call_forwarding_role,
    }
    
    if agent.type.lower() == "inbound":
        echo_payload["inbound_phone"] = agent.inbound_phone_number
        echo_payload["phone"] = agent.inbound_phone_number
    
    external_agent_id = None
    external_agent_a_id = None
    external_agent_status = "pending"
    echo_failed = False
    
    try:
        echo_response = echoleads.create_agent(echo_payload)
        if echo_response and "data" in echo_response:
            external_agent_id = echo_response["data"].get("id")
            external_agent_a_id = echo_response["data"].get("a_id")
            external_agent_status = echo_response["data"].get("agent_status")
        else:
            echo_failed = True
    except Exception as e:
        print(f"EchoLeads API failed: {str(e)}")
        echo_failed = True
   
    db_agent.status = "testing" if external_agent_status == "draft" else external_agent_status
    db_agent.external_agent_id = external_agent_id
    db_agent.external_agent_a_id = external_agent_a_id
    db.flush()
    
    if echo_failed:
        message = "Agent created successfully, but sync failed. Please reload the page to sync the agent."
    else:
        message = "Agent created successfully"
        
    if echo_failed:
        organization_credit_service.reserve_credits(
            db=db,
            organization_id=org.id,
            feature_code=get_agent_feature_code(agent.type),
            quantity=1,
            reference_type="agent",
            reference_id=str(db_agent.id)
        )        
    else:
        organization_credit_service.deduct_credits(
            db=db,
            organization_id=org.id,
            feature_code=get_agent_feature_code(agent.type),
            quantity=1,
            reference_type="agent",
            reference_id=str(db_agent.id)
        )
        
    db.commit()
    db.refresh(db_agent)
    
    return {
        "message": message,
        "agent_id": db_agent.id,
        "status": external_agent_status
    }

def update_agent(
    db: Session,
    agent_id: int,
    agent: CallingAgentUpdate,
    training_files: Optional[List[UploadFile]] = None
):
    db_agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()
    
    org = db.query(Organization).filter(
        Organization.id == db_agent.organization_id
    ).first()

    if not db_agent:
        raise ValueError("Agent not found")
    
    if not db_agent.external_agent_id:
        raise HTTPException(status_code=400, detail="Selected Agent not synced correctly")
    
    unique_agent_code = f"ORG{org.id}AG{uuid4().hex[:5]}".upper()
    
    pattern = rf"^ORG{org.id}AG[A-F0-9]{{5}}$"
    
    if not db_agent.external_agent_name or not re.match(pattern, db_agent.external_agent_name):
        db_agent.external_agent_name = unique_agent_code

    # 🔹 Update Echoleads
    echoleads = EcholeadsClient()
    
    echo_payload = {
        "name": db_agent.external_agent_name,
        "agent_call_type":  "outgoing" if db_agent.type.lower() == "outbound" else "incoming",
        "language": agent.transcriber_language or db_agent.transcriber_language,
        "firstMessage": agent.greeting if agent.greeting else db_agent.greeting,
        "prompt": agent.prompt if agent.prompt else db_agent.prompt,
        "prompt_timezone": agent.prompt_timezone,
        "voice_id": agent.voice if agent.voice else db_agent.voice,
        "data_extract": agent.important_data_points or db_agent.important_data_points,
        "summary_capturing": agent.summary_prompt,
        "summary":  "1" if agent.summary_prompt else "0",
        "sentiment_detection": "1" if agent.enable_sentiment else "0",
        "voice_mail_detection": "1" if agent.voice_mail_detection else "0",
        "voicemail_provider": "vapi",
        "voicemail_beep_max_await_seconds": "5",
        "voicemail_max_retries": "10",
        "voicemail_start_at_seconds": "5",
        "voicemail_frequency_seconds": "5",
        "calendar_sync": agent.calendar_sync,
        "speaks_first":agent.who_speaks_first,
        "agent_speaks_first": True if agent.who_speaks_first == "ai" else False,
        "silence_timeout": str(agent.silence_timeout),
        "talking_speed": str(agent.talking_speed),
        "max_duration_seconds": str(agent.max_call_duration),
        "background_sound": "" if agent.enable_background_sound else "off",
        "background_sound_url": agent.background_sound_url,
        "start_speaking_wait_seconds": str(agent.start_speaking_wait_seconds),
        "stop_speaking_voice_seconds": str(agent.stop_speaking_voice_seconds),
        "transcriber": {
            "provider": agent.transcriber_provider,
            "language": agent.transcriber_language,
            "model": agent.transcriber_model
        },
        "transcriber_provider": agent.transcriber_provider,
        "transcriber_language": agent.transcriber_language,
        "transcriber_model": agent.transcriber_model,       
        "agent_status": "draft" if db_agent.status == "testing" else db_agent.status,
    }
    
    if agent.type.lower() == "inbound":
        echo_payload["inbound_phone"] = agent.inbound_phone_number
        echo_payload["phone"] = agent.inbound_phone_number
    
    #print(echo_payload)
    # Call Echoleads update
    echo_failed = False
    if db_agent.external_agent_id:
        try:
            echoleads.update_agent(db_agent.external_agent_id, echo_payload)
        except Exception as e:
            print(f"EchoLeads API failed: {str(e)}")
            echo_failed = True

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    saved_files = []

    if db_agent.training_doc:
        saved_files = db_agent.training_doc.split(",")

    if training_files:
        for file in training_files:
            ext = file.filename.split(".")[-1]
            unique_name = f"{uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            with open(file_path, "wb") as buffer:
                buffer.write(file.file.read())

            saved_files.append(file_path)

    update_data = agent.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "destination":
            setattr(db_agent, key, ",".join(value) if value else None)
        else:
            setattr(db_agent, key, value)

    if saved_files:
        db_agent.training_doc = ",".join(saved_files)

    db.commit()
    db.refresh(db_agent)
    
    if echo_failed:
        message = "Agent updated successfully, but sync failed. Please reload the list to sync the agent."
    else:
        message = "Agent updated successfully"

    return {
        "message": message,
        "agent_id": db_agent.id
    }
    
def sync_agents(
    db: Session,
    organization_id: int
):
    org = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()
    
    if not org:
        raise ValueError("Organization not found")
    
    total_org_agents = db.query(CallingAgent).filter(CallingAgent.organization_id == organization_id).count()
    echo_leads = EcholeadsClient()
    try:
        echo_response = echo_leads.fetch_agents(total_org_agents, f"ORG{org.id}")
        if echo_response and echo_response.get("data"):

            echo_agents = echo_response["data"]

            echo_map = {
                agent.get("name"): agent
                for agent in echo_agents if agent.get("name")
            }

            db_agents = db.query(CallingAgent).filter(
                CallingAgent.organization_id == organization_id
            ).all()

            for db_agent in db_agents:
                old_status = db_agent.status
                echo_agent = None

                if db_agent.external_agent_id:
                    echo_agent = next(
                        (a for a in echo_agents if str(a.get("id")) == str(db_agent.external_agent_id)),
                        None
                    )

                if not echo_agent and db_agent.external_agent_name:
                    echo_agent = echo_map.get(db_agent.external_agent_name)

                # Only update if echo_agent exists
                if echo_agent:
                    if db_agent.status == "paused":
                        continue

                    external_agent_status = echo_agent.get("agent_status")

                    if external_agent_status:
                        db_agent.status = (
                            "testing"
                            if external_agent_status == "draft"
                            else external_agent_status
                        )
                        
                        if old_status == "pending" :
                            organization_credit_service.consume_reserved_credits(
                                db=db,
                                reference_type="agent",
                                reference_id=db_agent.id,
                                quantity=1
                            )  

                    if not db_agent.external_agent_id:
                        db_agent.external_agent_id = echo_agent.get("id")

                    if not db_agent.external_agent_a_id:
                        db_agent.external_agent_a_id = echo_agent.get("a_id")
                else:
                    if old_status == "pending":
                        organization_credit_service.release_reserved_credits(
                            db=db,
                            reference_type="agent",
                            reference_id=db_agent.id,
                            quantity=1
                        )
                        
            db.commit()
            
    except Exception as e:
        print(f"Sync failed: {str(e)}")

# Read All Agents
def read_agents(
    background_tasks: BackgroundTasks,
    db: Session,
    organization_id: int,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    sort_by: str = "newest"
):
    ## SYNC ALL ORG AGENTS
    background_tasks.add_task(
        sync_agents,
        db,
        organization_id
    )
    
    query = (
        db.query(
            CallingAgent,
            func.count(
                case(
                    (CallCampaign.status == "active", 1)
                )
            ).label("active_campaigns"),
            func.count(
                case(
                    (CallCampaign.status == "completed", 1)
                )
            ).label("completed_campaigns"),
            func.count(
                case(
                    (CallCampaign.status == "pending", 1)
                )
            ).label("pending_campaigns")
        )
        .outerjoin(
            CallCampaign,
            CallingAgent.id == CallCampaign.agent_id
        )
        .filter(CallingAgent.is_deleted == False, CallingAgent.organization_id == organization_id)
        .group_by(CallingAgent.id)
    )

    # SEARCH
    if search:
        query = query.filter(
            CallingAgent.name.ilike(f"%{search}%")
        )
        
    total = query.count()

    # SORT
    if sort_by == "oldest":
        query = query.order_by(CallingAgent.created_at.asc())
    else:
        query = query.order_by(CallingAgent.created_at.desc())


    rows = query.offset(skip).limit(limit).all()

    items = []

    for agent, active_campaigns, completed_campaigns, pending_campaigns in rows:
        data = agent.__dict__.copy()

        # convert destination string → list
        data["destination"] = (
            agent.destination.split(",") if agent.destination else []
        )

        data["start_speaking_wait_seconds"] = str(agent.start_speaking_wait_seconds)
        data["stop_speaking_voice_seconds"] = str(agent.stop_speaking_voice_seconds)

        # ✅ NEW FIELD
        data["active_campaigns"] = active_campaigns
        data["completed_campaigns"] = completed_campaigns
        data["pending_campaigns"] = pending_campaigns
        
        if data.get("created_at"):
            data["created_at"] = data["created_at"].replace(tzinfo=timezone.utc).isoformat()
            
        items.append(data)

    return {
        "items": items,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }


# Optional: Get Single Agent
def get_agent(db: Session, agent_id: str):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

def update_credits(
    db: Session,
    agent_id: int,
    allocated_calls: int = None,
    pending_calls: int = None,
    attempted_calls: int = None,
    active_campaigns: int = None
):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if allocated_calls is not None:
        agent.allocated_calls = allocated_calls
    if pending_calls is not None:
        agent.pending_calls = pending_calls
    if attempted_calls is not None:
        agent.attempted_calls = attempted_calls
    if active_campaigns is not None:
        agent.active_campaigns = active_campaigns
    db.commit()
    db.refresh(agent)
    return agent


def test_call(
    db: Session,
    agent_id: int,
    data: TestCallRequest,
):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.external_agent_id:
        raise HTTPException(status_code=400, detail="Agent not synced with Echoleads")
    
    feature_code = FeatureCodes.CORE_CALL_OUT_ATTEMPT if agent.type == "outbound" else FeatureCodes.CORE_CALL_IN_ATTEMPT
    
    valid = organization_credit_service.validate_feature_usage(
        db,
        agent.organization_id,
        feature_code,
        1
    )
    
    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Insufficient credits. Please add more credits to continue."
        )

    
    # Prepare API request
    echoleads = EcholeadsClient()
    
    dynamic_values = []
    if data.variables:
        for key, value in data.variables.items():
            dynamic_values.append({
                "field": key,
                "value": value
            })
                        
    payload = {
        "a_id": agent.external_agent_a_id,
        "phone": data.phone_no,
        "from_number": data.calling_no,
        "firstMessage": agent.greeting,
        "dynamicFieldValues": dynamic_values
    }

    echo_success = True
    external_call_id = None
    call_status = "failed"
    
    try:
        api_response = echoleads.create_call(payload)
        
        if api_response and "data" in api_response:
            sync_call_logs(db = db, organization_id=agent.organization_id, agent_id=agent.id)
            
            external_call_id = api_response["data"].get("id")
            call_status = api_response["data"].get("status")
        else:
            echo_success = False
    except Exception as e:
        print(f"Sync failed: {str(e)}")
        echo_success = False
 

    # Save test call log
    test_call = CallingAgentTestCall(
        agent_id=agent_id,
        phone_no=data.phone_no,
        external_call_id=external_call_id,
        status=call_status
    )
    db.add(test_call)
    db.flush()
    
    if echo_success:
        organization_credit_service.deduct_credits(
            db=db,
            organization_id=agent.organization_id,
            feature_code=feature_code,
            quantity=1,
            reference_type="calling_agent_test_call",
            reference_id=str(test_call.id)
        )
    
    db.commit()
    db.refresh(test_call)

    return {
        "message": "Please wait while we connect your test call…" if echo_success else "Failed to initiate test call. Please try again.",
        "phone_no": data.phone_no,
        "external_call_id": external_call_id,
        "status": call_status,
        "success": echo_success
    }       
    
def publish_agent(
    db: Session,
    agent_id: int
):

    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    echoleads = EcholeadsClient()

    # Prepare minimal payload for Echoleads
    echo_payload ={
        "name": agent.external_agent_name,
        "agent_call_type":  "outgoing" if agent.type.lower() == "outbound" else "incoming",
        "language": agent.accent if agent.accent and agent.accent != "all" else "en-US",
        "firstMessage": agent.greeting,
        "prompt": agent.prompt,
        "google_sheet_id": "",
        "success_parameters": agent.success_parameters,
        "data_extract": None,
        "summary_capturing": agent.summary_prompt,
        "summary":  "1" if agent.summary_prompt else "0",
        "sentiment_detection": "1" if agent.enable_sentiment else "0",
        "voice_mail_detection": "1" if agent.voice_mail_detection else "0",
        "call_recording": "0",
        "automated_follow_ups": "0",
        "calendar_sync": agent.calendar_sync,
        "temperature": "10",
        "agent_status": "active",
        "remaning_call_count": None,
        "voice_id": agent.voice,
        "speaks_first":agent.who_speaks_first,
        "agent_speaks_first": True if agent.who_speaks_first == "ai" else False,
        "silence_timeout": str(agent.silence_timeout),
        "talking_speed": str(agent.talking_speed),
        "max_duration_seconds": str(agent.max_call_duration),
        "voice_mail_detection_enabled": "1" if agent.voice_mail_detection else "0",
        "voicemail_provider": "vapi",
        "voicemail_beep_max_await_seconds": "0",
        "voicemail_max_retries": "10",
        "voicemail_start_at_seconds": "5",
        "voicemail_frequency_seconds": "5",
        "background_sound": "" if agent.enable_background_sound else "off",
        "background_sound_url": agent.background_sound_url,
        "start_speaking_wait_seconds": str(agent.start_speaking_wait_seconds),
        "stop_speaking_voice_seconds": str(agent.stop_speaking_voice_seconds),
        "analysis_plan": None,
        "transaction_id": f"{agent.external_agent_a_id}",
        "prompt_timezone": None,
        "tool_ids": [],
        "phone": None,
        "transcriber": {
            "provider": agent.transcriber_provider,
            "language": agent.transcriber_language,
            "model": agent.transcriber_model
        },
        "transcriber_provider": agent.transcriber_provider,
        "transcriber_language": agent.transcriber_language,
        "transcriber_model": agent.transcriber_model,       
        "punctuation_boundaries": [],
        "server_location": agent.server_location,
        "speech_to_speech": False,
        "is_pay_as_you_go": True,   
        "is_connected_calls": False,
        "call_forwarding_enabled": agent.enable_call_forwarding,
        "call_forwarding_number": agent.call_forwarding_number,
        "call_forwarding_action_desc": agent.call_forwarding_action_desc,
        "call_forwarding_message": agent.call_forwarding_role,
    }
    
    if agent.type.lower() == "inbound":
        echo_payload["inbound_phone"] = agent.inbound_phone_number
        echo_payload["phone"] = agent.inbound_phone_number
  
    print(echo_payload)

    # Update Echoleads agent
    echo_success = True
    if agent.external_agent_id:
        try:
            echoleads.update_agent(agent.external_agent_id, echo_payload)
            
             # Update local DB
            agent.status = "active"

            db.commit()
            db.refresh(agent)

        except Exception as e:
            print(f"Sync failed: {str(e)}")
            echo_success = False
   
    return {
        "status": agent.status, 
        "success": echo_success,
        "message": "Agent published successfully" if echo_success else "Publish failed. Upgrade account to proceed." ,
        "agent_id": agent.id
    }
    
    
def update_agent_status(
    db: Session,
    agent_id: int,
    data: AgentStatusUpdate,
):
    # Get the agent
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # If pausing, check for active campaigns
    if data.status.lower() == "paused":
        active_campaign_count = (
            db.query(CallCampaign)
            .filter(
                CallCampaign.agent_id == agent_id,
                CallCampaign.status.in_(["active", "running", "scheduled"]),
                CallCampaign.is_deleted == False
            )
            .count()
        )

        if active_campaign_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot pause agent: {active_campaign_count} active campaign(s) running"
            )

    # Update status
    agent.status = data.status
    db.commit()
    db.refresh(agent)

    return {
        "message": "Agent status updated",
        "agent_id": agent.id,
        "status": agent.status
    }
    
def delete_agent(db: Session, agent_id: int):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    echoleads = EcholeadsClient()
    response = echoleads.delete_agent(agent.external_agent_id)

    # ✅ Treat both success & not_found as success
    if response.get("success") or response.get("not_found"):
        agent.is_deleted = True
        db.commit()
        db.refresh(agent)
        
        if agent.status == "pending":
            organization_credit_service.release_reserved_credits(
                db=db,
                reference_type="agent",
                reference_id=agent.id,
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Agent deletion failed: {response.get('error')}"
        )

    return {
        "message": "Agent deleted",
        "agent_id": agent.id,
        "status": agent.status
    }   
    
    
# Agent Lookup
def agent_lookup(
    db: Session, 
    organization_id: int,
    search: Optional[str] = None):

    query = db.query(
        CallingAgent.id,
        CallingAgent.name
    ).filter(
        CallingAgent.organization_id == organization_id, 
        CallingAgent.is_deleted == False,
        CallingAgent.status == "active",
        CallingAgent.type == "outbound"
    )

    if search:
        query = query.filter(
            CallingAgent.name.ilike(f"%{search}%")
        )

    agents = query.order_by(CallingAgent.name.asc()).all()

    return [
        {
            "id": agent.id,
            "name": agent.name
        }
        for agent in agents
    ]
    
def all_agent_lookup(
    db: Session, 
    organization_id: int,
    search: Optional[str] = None):

    query = db.query(
        CallingAgent.id,
        CallingAgent.name
    ).filter(
        CallingAgent.organization_id == organization_id, 
        CallingAgent.is_deleted == False
    )

    if search:
        query = query.filter(
            CallingAgent.name.ilike(f"%{search}%")
        )

    agents = query.order_by(CallingAgent.name.asc()).all()

    return [
        {
            "id": agent.id,
            "name": agent.name
        }
        for agent in agents
    ]
    
def get_voices(db: Session):

    voices = db.query(Voice).all()

    # If already stored → return
    if voices:
        return voices

    # If empty → call Echoleads API
    client = EcholeadsClient()
    response = client.fetch_voices()

    voice_list = response.get("data", [])

    for voice in voice_list:

        db_voice = Voice(
            id=voice.get("id"),
            caller_name=voice.get("caller_name"),
            voice_id=voice.get("voice_id"),
            provider=voice.get("provider"),
            gender=voice.get("gender"),
            language=voice.get("language"),
            accent=voice.get("accent"),
            recording_url=voice.get("recording_url"),
            is_active=voice.get("is_active"),
            is_test_voice=voice.get("is_test_voice"),
            created_at=parse_datetime(voice.get("created_at")),
            updated_at=parse_datetime(voice.get("updated_at")),
        )

        db.add(db_voice)

    db.commit()

    return db.query(Voice).all()

def parse_datetime(dt):
    if not dt:
        return None
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))
