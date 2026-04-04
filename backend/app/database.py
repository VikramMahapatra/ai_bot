from datetime import datetime, time
import random
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import os

# Create database engine
# Use absolute path for SQLite to avoid working-directory issues
database_url = settings.DATABASE_URL

if database_url.startswith("sqlite:///"):
    db_path = database_url.replace("sqlite:///", "")
    # Resolve relative path against the backend directory
    if not os.path.isabs(db_path):
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(backend_dir, db_path)
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False}
    )
else:
    # Postgres
    engine = create_engine(
        database_url,  
        pool_pre_ping=True,
        pool_size=10,      # optional
        max_overflow=20,   # optional
    )

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:

        # --------------------------------------------------
        # organization_limits
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organization_limits
                ADD COLUMN IF NOT EXISTS plan_id INTEGER,
                ADD COLUMN IF NOT EXISTS voice_chat_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS multilingual_text_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS human_handoff_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS email_campaign_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS sms_campaign_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_knowledge_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_leads_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_analytics_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_advanced_analytics_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_reports_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_campaigns_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_appointments_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_products_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS module_users_enabled BOOLEAN,
                ADD COLUMN IF NOT EXISTS max_agents INTEGER,
                ADD COLUMN IF NOT EXISTS max_campaigns INTEGER,
                ADD COLUMN IF NOT EXISTS max_calls INTEGER
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # plans
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE plans
                ADD COLUMN IF NOT EXISTS voice_chat_enabled BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS multilingual_text_enabled BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS human_handoff_enabled BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS email_campaign_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS sms_campaign_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_knowledge_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_leads_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_analytics_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_advanced_analytics_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_reports_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_campaigns_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_appointments_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_products_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS module_users_enabled BOOLEAN DEFAULT TRUE
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # users indexes
        # --------------------------------------------------
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_username
                ON users(username)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_email
                ON users(email)
            """))

            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_username
                ON users(organization_id, username)
            """))

            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email
                ON users(organization_id, email)
            """))

        except Exception:
            pass


        # --------------------------------------------------
        # organization_usage
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organization_usage
                ADD COLUMN IF NOT EXISTS messages_count INTEGER DEFAULT 0
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # organization_subscription_usage
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organization_subscription_usage
                ADD COLUMN IF NOT EXISTS messages_count INTEGER DEFAULT 0
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # widget_configs
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE widget_configs
                ADD COLUMN IF NOT EXISTS escalation_contact_level_1 TEXT,
                ADD COLUMN IF NOT EXISTS escalation_contact_level_2 TEXT,
                ADD COLUMN IF NOT EXISTS system_prompt TEXT
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # conversations
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE conversations
                ADD COLUMN IF NOT EXISTS outcome TEXT
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # organizations
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organizations
                ADD COLUMN IF NOT EXISTS default_meet_link TEXT
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # contacts
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE contacts
                ADD COLUMN IF NOT EXISTS external_contact_id INTEGER,
                ADD COLUMN IF NOT EXISTS company TEXT
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # campaigns
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE campaigns
                ADD COLUMN IF NOT EXISTS product_id INTEGER
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # campaign_logs
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE campaign_logs
                ADD COLUMN IF NOT EXISTS run_sequence INTEGER DEFAULT 1,
                ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS complained_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
                ADD COLUMN IF NOT EXISTS tracking_token TEXT,
                ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS last_event_type TEXT,
                ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS event_payload TEXT,
                ADD COLUMN IF NOT EXISTS converted_lead_id INTEGER
            """))

            conn.execute(text("UPDATE campaign_logs SET run_sequence = 1 WHERE run_sequence IS NULL"))
            conn.execute(text("UPDATE campaign_logs SET open_count = 0 WHERE open_count IS NULL"))
            conn.execute(text("UPDATE campaign_logs SET click_count = 0 WHERE click_count IS NULL"))

        except Exception:
            pass


        # --------------------------------------------------
        # leads
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE leads
                ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'chat',
                ADD COLUMN IF NOT EXISTS funnel_stage TEXT,
                ADD COLUMN IF NOT EXISTS lead_outcome TEXT,
                ADD COLUMN IF NOT EXISTS product_id INTEGER
            """))

            conn.execute(text("""
                UPDATE leads
                SET source='chat'
                WHERE source IS NULL OR TRIM(source)=''
            """))

        except Exception:
            pass


        # --------------------------------------------------
        # handoff_sessions
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE handoff_sessions
                ADD COLUMN IF NOT EXISTS call_room_id TEXT,
                ADD COLUMN IF NOT EXISTS call_status TEXT DEFAULT 'none',
                ADD COLUMN IF NOT EXISTS call_mode TEXT DEFAULT 'video',
                ADD COLUMN IF NOT EXISTS call_requested_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS call_ended_at TIMESTAMP
            """))

        except Exception:
            pass


        # --------------------------------------------------
        # calling_agents
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE calling_agents
                ADD COLUMN IF NOT EXISTS external_agent_name TEXT,
                ADD COLUMN IF NOT EXISTS inbound_phone_number TEXT,
                ADD COLUMN IF NOT EXISTS widget_id VARCHAR
            """))

        except Exception:
            pass


        # --------------------------------------------------
        # campaign_schedules
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE campaign_schedules
                ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMP
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # call_logs
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE call_logs
                ADD COLUMN IF NOT EXISTS duration INTEGER,
                ADD COLUMN IF NOT EXISTS ended_reason TEXT,
                ADD COLUMN IF NOT EXISTS call_summary TEXT,
                ADD COLUMN IF NOT EXISTS sentiment TEXT,
                ADD COLUMN IF NOT EXISTS follow_up_recommended TEXT,
                ADD COLUMN IF NOT EXISTS extract_data TEXT,
                ADD COLUMN IF NOT EXISTS lead_info TEXT,
                ADD COLUMN IF NOT EXISTS success_evaluation BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS is_lead_qualified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS external_call_a_id TEXT,
                ADD COLUMN IF NOT EXISTS call_session_id TEXT
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # call_campaigns
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE call_campaigns
                ADD COLUMN IF NOT EXISTS external_campaign_name TEXT,
                ADD COLUMN IF NOT EXISTS success_rate FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS response_rate FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS product_id INTEGER,
                ADD COLUMN IF NOT EXISTS calling_no TEXT
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # organization_calling_numbers
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organization_calling_numbers
                ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'outbound'
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # credit_estimator_shares
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE credit_estimator_shares
                ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'Untitled Company',
                ADD COLUMN IF NOT EXISTS input_json TEXT DEFAULT '{}'
            """))
        except Exception:
            pass


        # --------------------------------------------------
        # organization_settings
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organization_settings
                ADD COLUMN IF NOT EXISTS default_escalation_level_1 TEXT,
                ADD COLUMN IF NOT EXISTS default_escalation_level_2 TEXT
            """))
        except Exception:
            pass


        conn.commit()
