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
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if database_url.startswith("sqlite:") else {}
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

    # Lightweight SQLite migrations for new columns
    if engine.url.drivername.startswith("sqlite"):
        with engine.connect() as conn:
            # Add plan_id to organization_limits if missing
            try:
                cols = conn.execute(text("PRAGMA table_info('organization_limits')")).fetchall()
                col_names = {row[1] for row in cols}
                if "plan_id" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN plan_id INTEGER"))
                if "voice_chat_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN voice_chat_enabled BOOLEAN"))
                if "multilingual_text_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN multilingual_text_enabled BOOLEAN"))
                if "whatsapp_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN whatsapp_enabled BOOLEAN"))
                if "human_handoff_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN human_handoff_enabled BOOLEAN"))
                if "max_agents" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN max_agents INTEGER"))
                if "max_campaigns" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN max_campaigns INTEGER"))
                if "max_calls" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN max_calls INTEGER"))    
            except Exception:
                # If table doesn't exist yet, create_all already handled it
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('plans')")).fetchall()
                col_names = {row[1] for row in cols}
                if "voice_chat_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN voice_chat_enabled BOOLEAN DEFAULT 0"))
                if "multilingual_text_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN multilingual_text_enabled BOOLEAN DEFAULT 0"))
                if "whatsapp_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT 0"))
                if "human_handoff_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN human_handoff_enabled BOOLEAN DEFAULT 0"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('organization_usage')")).fetchall()
                col_names = {row[1] for row in cols}
                if "messages_count" not in col_names:
                    conn.execute(text("ALTER TABLE organization_usage ADD COLUMN messages_count INTEGER DEFAULT 0"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('organization_subscription_usage')")).fetchall()
                col_names = {row[1] for row in cols}
                if "messages_count" not in col_names:
                    conn.execute(text("ALTER TABLE organization_subscription_usage ADD COLUMN messages_count INTEGER DEFAULT 0"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('widget_configs')")).fetchall()
                col_names = {row[1] for row in cols}
                if "escalation_contact_level_1" not in col_names:
                    conn.execute(text("ALTER TABLE widget_configs ADD COLUMN escalation_contact_level_1 TEXT"))
                if "escalation_contact_level_2" not in col_names:
                    conn.execute(text("ALTER TABLE widget_configs ADD COLUMN escalation_contact_level_2 TEXT"))
                if "system_prompt" not in col_names:
                    conn.execute(text("ALTER TABLE widget_configs ADD COLUMN system_prompt TEXT"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('conversations')")).fetchall()
                col_names = {row[1] for row in cols}
                if "outcome" not in col_names:
                    conn.execute(text("ALTER TABLE conversations ADD COLUMN outcome TEXT"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('organizations')")).fetchall()
                col_names = {row[1] for row in cols}
                if "default_meet_link" not in col_names:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN default_meet_link TEXT"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('contacts')")).fetchall()
                col_names = {row[1] for row in cols}
                if "external_contact_id" not in col_names:
                    conn.execute(text("ALTER TABLE contacts ADD COLUMN external_contact_id INTEGER"))
            except Exception:
                pass

            try:
                conn.commit()
            except Exception:
                pass
            
            try:
                cols = conn.execute(text("PRAGMA table_info('calling_agents')")).fetchall()
                col_names = {row[1] for row in cols}
                if "external_agent_name" not in col_names:
                    conn.execute(text("ALTER TABLE calling_agents ADD COLUMN external_agent_name TEXT"))
            except Exception:
                pass
            
           
            try:
                cols = conn.execute(text("PRAGMA table_info('campaign_schedules')")).fetchall()
                col_names = {row[1] for row in cols}
                if "end_datetime" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_schedules ADD COLUMN end_datetime DATETIME"))
            except Exception:
                pass
            
            try:
                columns = {
                    "duration": "INTEGER",
                    "ended_reason": "TEXT",
                    "call_summary": "TEXT",
                    "sentiment": "TEXT",
                    "follow_up_recommended": "TEXT",
                    "extract_data": "TEXT",
                    "lead_info": "TEXT",
                    "success_evaluation": "BOOLEAN DEFAULT 0",
                    "is_lead_qualified": "BOOLEAN DEFAULT 0"
                }

                cols = conn.execute(text("PRAGMA table_info('call_logs')")).fetchall()
                col_names = {row[1] for row in cols}

                for col, col_type in columns.items():
                    if col not in col_names:
                        conn.execute(
                            text(f"ALTER TABLE call_logs ADD COLUMN {col} {col_type}")
                        )
                if "success_evaluation" not in col_names:
                    conn.execute(
                        text("UPDATE call_logs SET success_evaluation = 0 WHERE success_evaluation IS NULL")
                    )
            except Exception as e:
                pass
            
            try:
                columns = {
                    "external_campaign_name": "TEXT",
                    "success_rate": "FLOAT DEFAULT 0.0",
                    "response_rate": "FLOAT DEFAULT 0.0",
                    "product_id": "INTEGER",
                    "calling_no": "TEXT",
                }

                cols = conn.execute(text("PRAGMA table_info('call_campaigns')")).fetchall()
                col_names = {row[1] for row in cols}

                for col, col_type in columns.items():
                    if col not in col_names:
                        conn.execute(
                            text(f"ALTER TABLE call_campaigns ADD COLUMN {col} {col_type}")
                        )
            except Exception as e:
                print(str(e))
