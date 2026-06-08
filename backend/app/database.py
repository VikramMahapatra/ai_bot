from datetime import datetime, time
import random
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.migrations import apply_db_migrations
import os
import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)

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
        connect_args={
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
        pool_pre_ping=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
    )

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)

# Create Base class for models
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
        # Only commit when there are pending ORM changes. This avoids turning
        # read-only requests into commit-time failures on stale connections.
        has_pending_writes = bool(db.new or db.dirty or db.deleted)
        if has_pending_writes:
            db.commit()
        elif db.in_transaction():
            db.rollback()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()


def column_exists(conn, table, column):
    result = conn.execute(
        text("""
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name=:table 
        AND column_name=:column
    """),
        {"table": table, "column": column},
    ).fetchone()
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
                        text(
                            f"ALTER TABLE organization_limits ADD COLUMN {col} {col_type}"
                        )
                    )

        except Exception:
            pass

        # ----------------------------
        # users indexes
        # ----------------------------
        try:
            conn.execute(text("DROP INDEX IF EXISTS ix_users_username"))

            conn.execute(text("DROP INDEX IF EXISTS ix_users_email"))

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

            conn.execute(text("""CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email 
                ON users(organization_id, email)"""))

        except Exception:
            pass

        # ----------------------------
        # organization_usage
        # ----------------------------
        try:
            if not column_exists(conn, "organization_usage", "messages_count"):
                conn.execute(
                    text(
                        "ALTER TABLE organization_usage ADD COLUMN messages_count INTEGER DEFAULT 0"
                    )
                )
        except Exception:
            pass

        # ----------------------------
        # organization_subscription_usage
        # ----------------------------
        try:
            if not column_exists(
                conn, "organization_subscription_usage", "messages_count"
            ):
                conn.execute(
                    text(
                        "ALTER TABLE organization_subscription_usage ADD COLUMN messages_count INTEGER DEFAULT 0"
                    )
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
                "system_prompt": "TEXT",
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
                conn.execute(text("ALTER TABLE conversations ADD COLUMN outcome TEXT"))
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
                "echoleads_api_key": "TEXT",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "organizations", col):
                    conn.execute(
                        text(f"ALTER TABLE organizations ADD COLUMN {col} {col_type}")
                    )
        except Exception as e:
            print(str(e))
            pass

        # ----------------------------
        # contacts
        # ----------------------------
        try:
            columns = {"external_contact_id": "INTEGER", "company": "TEXT"}

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
                "product_id": "INTEGER",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "leads", col):
                    conn.execute(text(f"ALTER TABLE leads ADD COLUMN {col} {col_type}"))

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
                "call_ended_at": "TIMESTAMP",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "handoff_sessions", col):
                    conn.execute(
                        text(
                            f"ALTER TABLE handoff_sessions ADD COLUMN {col} {col_type}"
                        )
                    )

        except Exception:
            pass

        # ----------------------------
        # calling_agents
        # ----------------------------
        try:
            if not column_exists(conn, "calling_agents", "external_agent_name"):
                conn.execute(
                    text(
                        "ALTER TABLE calling_agents ADD COLUMN external_agent_name TEXT"
                    )
                )
        except Exception:
            pass

        # ----------------------------
        # campaign_schedules
        # ----------------------------
        try:
            if not column_exists(conn, "campaign_schedules", "end_datetime"):
                conn.execute(
                    text(
                        "ALTER TABLE campaign_schedules ADD COLUMN end_datetime TIMESTAMP"
                    )
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
                "instant_reply": "BOOLEAN DEFAULT FALSE",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "call_campaigns", col):
                    conn.execute(
                        text(f"ALTER TABLE call_campaigns ADD COLUMN {col} {col_type}")
                    )

            if not column_exists(conn, "call_campaigns", "calling_no"):
                conn.execute(text("""
                        UPDATE call_campaigns 
                        SET calling_no = '+918046733457' 
                        WHERE calling_no IS NULL
                    """))

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
                "input_json": "TEXT DEFAULT '{}'",
            }

            for col, col_type in columns.items():
                if not column_exists(conn, "credit_estimator_shares", col):
                    conn.execute(
                        text(
                            f"ALTER TABLE credit_estimator_shares ADD COLUMN {col} {col_type}"
                        )
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
                ADD COLUMN IF NOT EXISTS default_escalation_level_2 TEXT,
                ADD COLUMN IF NOT EXISTS expected_close_days INTEGER DEFAULT 0
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

        # --------------------------------------------------
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
                ALTER TABLE call_campaign_instant_replies
                ADD COLUMN IF NOT EXISTS template_id INTEGER;
            """))

            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE constraint_name = 'fk_instant_reply_template'
                    ) THEN
                        ALTER TABLE call_campaign_instant_replies
                        ADD CONSTRAINT fk_instant_reply_template
                        FOREIGN KEY (template_id)
                        REFERENCES message_templates(id)
                        ON DELETE RESTRICT;
                    END IF;
                END $$;
            """))

            # 3. Drop old columns if they exist
            conn.execute(text("""
                ALTER TABLE call_campaign_instant_replies
                DROP COLUMN IF EXISTS subject;
            """))

            conn.execute(text("""
                ALTER TABLE call_campaign_instant_replies
                DROP COLUMN IF EXISTS template;
            """))

        except Exception as e:
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

        try:
            conn.execute(text("""
                ALTER TABLE conversations 
                ADD COLUMN IF NOT EXISTS contact_id INTEGER,
                ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS source VARCHAR(50);
            """))
        except:
            pass

        try:
            conn.execute(text("""
                ALTER TABLE conversations
                ADD CONSTRAINT fk_conversations_contact
                FOREIGN KEY (contact_id)
                REFERENCES contacts(id);
            """))
        except:
            pass

        try:
            conn.execute(text("""
                    ALTER TABLE lead_activities 
                    ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)
                """))
        except:
            pass

        try:
            conn.execute(text("""
                    ALTER TABLE call_campaigns 
                    ADD COLUMN IF NOT EXISTS workflow_id INTEGER
                """))
        except:
            pass

        try:
            conn.execute(text("""
                ALTER TABLE call_campaigns
                ADD CONSTRAINT fk_call_campaigns_workflow
                FOREIGN KEY (workflow_id)
                REFERENCES workflows(id);
            """))
        except:
            pass

        try:
            conn.execute(text("""
                    ALTER TABLE call_logs 
                    ADD COLUMN IF NOT EXISTS workflow_execution_id INTEGER, 
                    ADD COLUMN IF NOT EXISTS instant_reply_sent BOOLEAN DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS source VARCHAR(50)
                """))
        except Exception as e:
            print(str(e))
            pass

        try:
            conn.execute(text("""
                ALTER TABLE call_logs
                ADD CONSTRAINT fk_call_logs_workflow_execution
                FOREIGN KEY (workflow_execution_id)
                REFERENCES workflow_executions(id);
            """))
        except:
            pass

        try:
            conn.execute(text("""
                    ALTER TABLE contacts 
                    ADD COLUMN IF NOT EXISTS session_id VARCHAR(100) 
                """))
        except:
            pass

        try:
            conn.execute(text("""
                ALTER TABLE conversation_metrics
                ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'chat'
            """))

            conn.execute(text("""
                ALTER TABLE conversation_metrics
                ALTER COLUMN conversation_id DROP NOT NULL
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE message_templates
                ADD COLUMN IF NOT EXISTS whatsapp_template_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS category VARCHAR(50),
                ADD COLUMN IF NOT EXISTS language VARCHAR(20),
                ADD COLUMN IF NOT EXISTS meta_template_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS meta_status VARCHAR(50) DEFAULT 'PENDING',
                ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE leads 
                ADD COLUMN IF NOT EXISTS close_date DATE DEFAULT CURRENT_DATE;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE channels
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE workflow_steps
                ADD COLUMN IF NOT EXISTS position JSONB,
                ADD COLUMN IF NOT EXISTS step_number INTEGER;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE call_campaigns
                ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(255);
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE whatsapp_channels
                ALTER COLUMN widget_id DROP NOT NULL;
            """))
        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE message_templates
                ADD COLUMN IF NOT EXISTS parent_template_id INTEGER NULL,
                ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE whatsapp_channels
                ADD COLUMN IF NOT EXISTS token_type VARCHAR NULL,
                ADD COLUMN IF NOT EXISTS token_expires_in INTEGER NULL,
                ADD COLUMN IF NOT EXISTS token_created_at TIMESTAMPTZ NULL,
                ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ NULL;
            """))

            # ---------------------------------------------------
            # 1. DROP OLD WRONG UNIQUE CONSTRAINT (IMPORTANT)
            # ---------------------------------------------------
            conn.execute(text("""
                DROP INDEX IF EXISTS ix_whatsapp_channels_organization_id;
            """))

            # ---------------------------------------------------
            # 2. CREATE PROPER GLOBAL UNIQUE CONSTRAINT
            #    (ONLY ONE GLOBAL CONFIG PER ORG)
            # ---------------------------------------------------
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_global_org
                ON whatsapp_channels (organization_id)
                WHERE widget_id IS NULL;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE leads 
                ALTER COLUMN close_date DROP DEFAULT;
            """))
        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE message_templates
                ADD COLUMN IF NOT EXISTS variable_mappings JSONB NULL;
            """))
        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE campaigns
                ADD COLUMN IF NOT EXISTS message_template_id INTEGER NULL;
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_campaigns_message_template_id
                ON campaigns (message_template_id);
            """))

            # safe FK check
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'fk_message_template_id'
                    ) THEN
                        ALTER TABLE campaigns
                        ADD CONSTRAINT fk_message_template_id
                        FOREIGN KEY (message_template_id)
                        REFERENCES message_templates (id);
                    END IF;
                END
                $$;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE whatsapp_channels
                ALTER COLUMN phone_number_id DROP NOT NULL;
            """))
        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE workflows
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_workflows_is_deleted
                ON workflows (is_deleted);
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE org_credits
                ALTER COLUMN estimator_id DROP NOT NULL;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE voices
                ADD COLUMN IF NOT EXISTS external_id INTEGER UNIQUE NULL,
                ADD COLUMN IF NOT EXISTS languages JSONB NULL,
                ADD COLUMN IF NOT EXISTS tags JSONB NULL,
                ADD COLUMN IF NOT EXISTS voice_types JSONB NULL,
                ADD COLUMN IF NOT EXISTS is_cloned_voice BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS is_vapi_voice BOOLEAN DEFAULT FALSE;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE organizations
                ADD COLUMN IF NOT EXISTS trial_end_date DATE NULL,
                ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS industry VARCHAR(255) NULL,
                ADD COLUMN IF NOT EXISTS commercial_notes TEXT NULL;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE organization_limits
                ADD COLUMN IF NOT EXISTS outbound_call_billing_model VARCHAR(20) NULL,
                ADD COLUMN IF NOT EXISTS max_outbound_voice_agents INTEGER NULL,
                ADD COLUMN IF NOT EXISTS max_inbound_voice_agents INTEGER NULL,
                ADD COLUMN IF NOT EXISTS max_outbound_calls INTEGER NULL,

                ADD COLUMN IF NOT EXISTS instagram_chat_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS facebook_messenger_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS whatsapp_campaign_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS call_forwarding_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS inbound_voice_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS outbound_voice_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS ai_assistant_campaign_enabled BOOLEAN NULL,
                ADD COLUMN IF NOT EXISTS module_followup_workflow_enabled BOOLEAN NULL;
            """))

        except Exception as e:
            print(f"Migration failed: {e}")
            pass

        try:
            conn.execute(text("""
                ALTER TABLE campaigns
                ADD COLUMN IF NOT EXISTS open_tracking_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS click_tracking_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS footer_display_enabled BOOLEAN DEFAULT TRUE;
            """))
        except Exception as e:
            print(f"Migration failed: {e}")

        try:
            conn.execute(text("""
                ALTER TABLE organization_settings
                ADD COLUMN IF NOT EXISTS smtp_sender_name VARCHAR(255) NULL;
            """))
        except Exception as e:
            print(f"Migration failed: {e}")
