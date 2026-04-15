from datetime import datetime, time
import random
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.migrations import apply_db_migrations
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
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
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


def column_exists(conn, table, column):
    result = conn.execute(text("""
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name=:table 
        AND column_name=:column
    """), {"table": table, "column": column}).fetchone()
    return result is not None


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        
        result = conn.execute(text("SELECT current_database()"))
        print("Running migration on DB:", result.fetchone())
        
        # ----------------------------
        # schema migrations
        # ----------------------------
        try:
            apply_db_migrations(conn)
        except Exception as e:
            print("Error applying migrations:", str(e))
      
        # ----------------------------
        # organization_limits
        # ----------------------------
        try:
            columns = {
                "voice_chat_enabled": "BOOLEAN",
                "multilingual_text_enabled": "BOOLEAN",
                "whatsapp_enabled": "BOOLEAN",
                "human_handoff_enabled": "BOOLEAN",
                "email_campaign_enabled": "BOOLEAN",
                "sms_campaign_enabled": "BOOLEAN",
                "module_knowledge_enabled": "BOOLEAN",
                "module_leads_enabled": "BOOLEAN",
                "module_analytics_enabled": "BOOLEAN",
                "module_advanced_analytics_enabled": "BOOLEAN",
                "module_reports_enabled": "BOOLEAN",
                "module_campaigns_enabled": "BOOLEAN",
                "module_appointments_enabled": "BOOLEAN",
                "module_products_enabled": "BOOLEAN",
                "module_users_enabled": "BOOLEAN",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "organization_limits", col):
                    conn.execute(
                        text(f"ALTER TABLE organization_limits ADD COLUMN {col} {col_type}")
                    )

        except Exception:
            pass


        # ----------------------------
        # users indexes
        # ----------------------------
        try:
            conn.execute(
                text("DROP INDEX IF EXISTS ix_users_username")
            )

            conn.execute(
                text("DROP INDEX IF EXISTS ix_users_email")
            )

            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_users_username ON users(username)")
            )

            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)")
            )

            conn.execute(
                text("""CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_username 
                ON users(organization_id, username)""")
            )

            conn.execute(
                text("""CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email 
                ON users(organization_id, email)""")
            )

        except Exception:
            pass


        # ----------------------------
        # organization_usage
        # ----------------------------
        try:
            if not column_exists(conn, "organization_usage", "messages_count"):
                conn.execute(
                    text("ALTER TABLE organization_usage ADD COLUMN messages_count INTEGER DEFAULT 0")
                )
        except Exception:
            pass


        # ----------------------------
        # organization_subscription_usage
        # ----------------------------
        try:
            if not column_exists(conn, "organization_subscription_usage", "messages_count"):
                conn.execute(
                    text("ALTER TABLE organization_subscription_usage ADD COLUMN messages_count INTEGER DEFAULT 0")
                )
        except Exception:
            pass


        # ----------------------------
        # widget_configs
        # ----------------------------
        try:
            columns = {
                "escalation_contact_level_1": "TEXT",
                "escalation_contact_level_2": "TEXT",
                "system_prompt": "TEXT"
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "widget_configs", col):
                    conn.execute(
                        text(f"ALTER TABLE widget_configs ADD COLUMN {col} {col_type}")
                    )

        except Exception:
            pass


        # ----------------------------
        # conversations
        # ----------------------------
        try:
            if not column_exists(conn, "conversations", "outcome"):
                conn.execute(
                    text("ALTER TABLE conversations ADD COLUMN outcome TEXT")
                )
        except Exception:
            pass


        # ----------------------------
        # organizations
        # ----------------------------
        try:
            columns = {
                "default_meet_link": "TEXT",
                "joining_date": "DATE",
                "effective_joining_date": "DATE",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "organizations", col):
                    conn.execute(
                        text(f"ALTER TABLE organizations ADD COLUMN {col} {col_type}")
                    )
        except Exception:
            pass


        # ----------------------------
        # contacts
        # ----------------------------
        try:
            columns = {
                "external_contact_id": "INTEGER",
                "company": "TEXT"
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "contacts", col):
                    conn.execute(
                        text(f"ALTER TABLE contacts ADD COLUMN {col} {col_type}")
                    )

        except Exception:
            pass


        # ----------------------------
        # campaigns
        # ----------------------------
        try:
            if not column_exists(conn, "campaigns", "product_id"):
                conn.execute(
                    text("ALTER TABLE campaigns ADD COLUMN product_id INTEGER")
                )
        except Exception:
            pass


        # ----------------------------
        # campaign_logs
        # ----------------------------
        try:
            columns = {
                "run_sequence": "INTEGER DEFAULT 1",
                "run_started_at": "TIMESTAMP",
                "delivered_at": "TIMESTAMP",
                "opened_at": "TIMESTAMP",
                "read_at": "TIMESTAMP",
                "clicked_at": "TIMESTAMP",
                "bounced_at": "TIMESTAMP",
                "complained_at": "TIMESTAMP",
                "unsubscribed_at": "TIMESTAMP",
                "provider_message_id": "TEXT",
                "tracking_token": "TEXT",
                "open_count": "INTEGER DEFAULT 0",
                "click_count": "INTEGER DEFAULT 0",
                "last_event_type": "TEXT",
                "last_event_at": "TIMESTAMP",
                "event_payload": "TEXT",
                "converted_lead_id": "INTEGER",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "campaign_logs", col):
                    conn.execute(
                        text(f"ALTER TABLE campaign_logs ADD COLUMN {col} {col_type}")
                    )

        except Exception:
            pass


        # ----------------------------
        # leads
        # ----------------------------
        try:
            columns = {
                "source": "TEXT DEFAULT 'chat'",
                "funnel_stage": "TEXT",
                "lead_outcome": "TEXT",
                "product_id": "INTEGER"
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "leads", col):
                    conn.execute(
                        text(f"ALTER TABLE leads ADD COLUMN {col} {col_type}")
                    )
                    
            conn.execute(
                text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id INTEGER")
            )
                    

        except Exception as e:
            print(str(e))
            pass


        # ----------------------------
        # handoff_sessions
        # ----------------------------
        try:
            columns = {
                "call_room_id": "TEXT",
                "call_status": "TEXT DEFAULT 'none'",
                "call_mode": "TEXT DEFAULT 'video'",
                "call_requested_at": "TIMESTAMP",
                "call_started_at": "TIMESTAMP",
                "call_ended_at": "TIMESTAMP"
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "handoff_sessions", col):
                    conn.execute(
                        text(f"ALTER TABLE handoff_sessions ADD COLUMN {col} {col_type}")
                    )

        except Exception:
            pass


        # ----------------------------
        # calling_agents
        # ----------------------------
        try:
            if not column_exists(conn, "calling_agents", "external_agent_name"):
                conn.execute(
                    text("ALTER TABLE calling_agents ADD COLUMN external_agent_name TEXT")
                )
        except Exception:
            pass


        # ----------------------------
        # campaign_schedules
        # ----------------------------
        try:
            if not column_exists(conn, "campaign_schedules", "end_datetime"):
                conn.execute(
                    text("ALTER TABLE campaign_schedules ADD COLUMN end_datetime TIMESTAMP")
                )
        except Exception:
            pass
        
        # ----------------------------
        # call_campaigns
        # ----------------------------
        try:
            columns = {
                "external_campaign_name": "TEXT",
                "success_rate": "DOUBLE PRECISION DEFAULT 0.0",
                "response_rate": "DOUBLE PRECISION DEFAULT 0.0",
                "product_id": "INTEGER",
                "calling_no": "TEXT",
                "instant_reply": "BOOLEAN DEFAULT FALSE"
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "call_campaigns", col):
                    conn.execute(
                        text(f"ALTER TABLE call_campaigns ADD COLUMN {col} {col_type}")
                    )

            if not column_exists(conn, "call_campaigns", "calling_no"):
                conn.execute(
                    text("""
                        UPDATE call_campaigns 
                        SET calling_no = '+918046733457' 
                        WHERE calling_no IS NULL
                    """)
                )

        except Exception as e:
            print(str(e))
            
        try:
            conn.execute(text("""
                ALTER TABLE call_campaigns
                DROP COLUMN IF EXISTS reply_mode,
                DROP COLUMN IF EXISTS reply_template;
            """))
        except Exception:
            pass


        # ----------------------------
        # credit_estimator_shares
        # ----------------------------
        try:
            columns = {
                "company_name": "TEXT DEFAULT 'Untitled Company'",
                "input_json": "TEXT DEFAULT '{}'"
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "credit_estimator_shares", col):
                    conn.execute(
                        text(f"ALTER TABLE credit_estimator_shares ADD COLUMN {col} {col_type}")
                    )

            conn.execute(text("""
                UPDATE credit_estimator_shares 
                SET company_name = 'Untitled Company'
                WHERE company_name IS NULL 
                OR TRIM(company_name) = ''
            """))

            conn.execute(text("""
                UPDATE credit_estimator_shares 
                SET input_json = '{}'
                WHERE input_json IS NULL 
                OR TRIM(input_json) = ''
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
        
        # --------------------------------------------------
        # organization_credit_usages
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE organization_credit_usages
                ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'reserved'
            """))
        except Exception:
            pass
        
        # --------------------------------------------------
        # price_matrix_items
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE price_matrix_items
                ADD COLUMN IF NOT EXISTS feature_code TEXT,
                ADD COLUMN IF NOT EXISTS min_reserved_credits FLOAT
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_price_matrix_feature_code
                ON price_matrix_items(feature_code)
            """))

        except Exception as e:
            pass
        
        #--------------------------------------------------
        # contacts (Add Missing Fields)
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE contacts
                ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
                ADD COLUMN IF NOT EXISTS gender TEXT,
                ADD COLUMN IF NOT EXISTS designation TEXT,

                ADD COLUMN IF NOT EXISTS item_name TEXT,
                ADD COLUMN IF NOT EXISTS item_type TEXT,
                ADD COLUMN IF NOT EXISTS interest_stage TEXT,
                ADD COLUMN IF NOT EXISTS item_category TEXT,
                ADD COLUMN IF NOT EXISTS amount FLOAT,
                ADD COLUMN IF NOT EXISTS offer_value TEXT,

                ADD COLUMN IF NOT EXISTS city TEXT,
                ADD COLUMN IF NOT EXISTS state TEXT,
                ADD COLUMN IF NOT EXISTS country TEXT,

                ADD COLUMN IF NOT EXISTS source TEXT,
                ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,

                ADD COLUMN IF NOT EXISTS tags TEXT
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_contacts_phone
                ON contacts(phone)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_contacts_email
                ON contacts(email)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_contacts_source
                ON contacts(source)
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_contacts_interest_stage
                ON contacts(interest_stage)
            """))

        except Exception as e:
            pass
        
        
        # --------------------------------------------------
        # camapaign_schedules
        # --------------------------------------------------
        try:
            conn.execute(text("""
                ALTER TABLE campaign_schedules
                ALTER COLUMN retry_no_answer TYPE BOOLEAN USING retry_no_answer != 0,
                ALTER COLUMN retry_busy TYPE BOOLEAN USING retry_busy != 0,
                ALTER COLUMN retry_voicemail TYPE BOOLEAN USING retry_voicemail != 0;
            """))

        except Exception as e:
            pass
        
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS call_campaign_instant_replies (
                    id SERIAL PRIMARY KEY,
                    call_campaign_id INTEGER REFERENCES call_campaigns(id),
                    mode VARCHAR(20),
                    subject TEXT,
                    template TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """))
        except Exception:
            pass
        
        
        try:
            # 1. Add column first
            conn.execute(text("""
                ALTER TABLE message_templates
                ADD COLUMN IF NOT EXISTS organization_id INTEGER
            """))

            # 2. Add FK constraint safely
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_message_templates_organization'
                    ) THEN
                        ALTER TABLE message_templates
                        ADD CONSTRAINT fk_message_templates_organization
                        FOREIGN KEY (organization_id)
                        REFERENCES organizations(id)
                        ON DELETE CASCADE;
                    END IF;
                END $$;
            """))

        except Exception as e:
            pass

