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
                if "email_campaign_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN email_campaign_enabled BOOLEAN"))
                if "sms_campaign_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN sms_campaign_enabled BOOLEAN"))
                if "module_knowledge_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_knowledge_enabled BOOLEAN"))
                if "module_leads_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_leads_enabled BOOLEAN"))
                if "module_analytics_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_analytics_enabled BOOLEAN"))
                if "module_advanced_analytics_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_advanced_analytics_enabled BOOLEAN"))
                if "module_reports_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_reports_enabled BOOLEAN"))
                if "module_campaigns_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_campaigns_enabled BOOLEAN"))
                if "module_appointments_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_appointments_enabled BOOLEAN"))
                if "module_products_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_products_enabled BOOLEAN"))
                if "module_users_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE organization_limits ADD COLUMN module_users_enabled BOOLEAN"))
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
                if "email_campaign_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN email_campaign_enabled BOOLEAN DEFAULT 1"))
                if "sms_campaign_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN sms_campaign_enabled BOOLEAN DEFAULT 1"))
                if "module_knowledge_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_knowledge_enabled BOOLEAN DEFAULT 1"))
                if "module_leads_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_leads_enabled BOOLEAN DEFAULT 1"))
                if "module_analytics_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_analytics_enabled BOOLEAN DEFAULT 1"))
                if "module_advanced_analytics_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_advanced_analytics_enabled BOOLEAN DEFAULT 1"))
                if "module_reports_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_reports_enabled BOOLEAN DEFAULT 1"))
                if "module_campaigns_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_campaigns_enabled BOOLEAN DEFAULT 1"))
                if "module_appointments_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_appointments_enabled BOOLEAN DEFAULT 1"))
                if "module_products_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_products_enabled BOOLEAN DEFAULT 1"))
                if "module_users_enabled" not in col_names:
                    conn.execute(text("ALTER TABLE plans ADD COLUMN module_users_enabled BOOLEAN DEFAULT 1"))
            except Exception:
                pass

            # Normalize user uniqueness constraints to organization scope.
            # Old databases may have global-unique indexes on username/email.
            try:
                cols = conn.execute(text("PRAGMA table_info('users')")).fetchall()
                if cols:
                    index_rows = conn.execute(text("PRAGMA index_list('users')")).fetchall()
                    index_map = {row[1]: row for row in index_rows}

                    username_idx = index_map.get("ix_users_username")
                    if username_idx and int(username_idx[2]) == 1:
                        conn.execute(text("DROP INDEX IF EXISTS ix_users_username"))

                    email_idx = index_map.get("ix_users_email")
                    if email_idx and int(email_idx[2]) == 1:
                        conn.execute(text("DROP INDEX IF EXISTS ix_users_email"))

                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_username ON users(username)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)"))

                    conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_username ON users(organization_id, username)")
                    )
                    conn.execute(
                        text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email ON users(organization_id, email)")
                    )
            except Exception:
                # Keep startup resilient on older/partial schemas.
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
                if "company" not in col_names:
                    conn.execute(text("ALTER TABLE contacts ADD COLUMN company TEXT"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('campaigns')")).fetchall()
                col_names = {row[1] for row in cols}
                if "product_id" not in col_names:
                    conn.execute(text("ALTER TABLE campaigns ADD COLUMN product_id INTEGER"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('campaign_logs')")).fetchall()
                col_names = {row[1] for row in cols}
                if "run_sequence" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN run_sequence INTEGER DEFAULT 1"))
                if "run_started_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN run_started_at DATETIME"))
                if "delivered_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN delivered_at DATETIME"))
                if "opened_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN opened_at DATETIME"))
                if "read_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN read_at DATETIME"))
                if "clicked_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN clicked_at DATETIME"))
                if "bounced_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN bounced_at DATETIME"))
                if "complained_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN complained_at DATETIME"))
                if "unsubscribed_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN unsubscribed_at DATETIME"))
                if "provider_message_id" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN provider_message_id TEXT"))
                if "tracking_token" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN tracking_token TEXT"))
                if "open_count" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN open_count INTEGER DEFAULT 0"))
                if "click_count" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN click_count INTEGER DEFAULT 0"))
                if "last_event_type" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN last_event_type TEXT"))
                if "last_event_at" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN last_event_at DATETIME"))
                if "event_payload" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN event_payload TEXT"))
                if "converted_lead_id" not in col_names:
                    conn.execute(text("ALTER TABLE campaign_logs ADD COLUMN converted_lead_id INTEGER"))
                conn.execute(text("UPDATE campaign_logs SET run_sequence = 1 WHERE run_sequence IS NULL"))
                conn.execute(text("UPDATE campaign_logs SET open_count = 0 WHERE open_count IS NULL"))
                conn.execute(text("UPDATE campaign_logs SET click_count = 0 WHERE click_count IS NULL"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('leads')")).fetchall()
                col_names = {row[1] for row in cols}
                if "source" not in col_names:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN source TEXT DEFAULT 'chat'"))
                if "funnel_stage" not in col_names:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN funnel_stage TEXT"))
                if "lead_outcome" not in col_names:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN lead_outcome TEXT"))
                if "product_id" not in col_names:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN product_id INTEGER"))
                conn.execute(text("UPDATE leads SET source = 'chat' WHERE source IS NULL OR TRIM(source) = ''"))
                conn.execute(text("""
                    UPDATE leads
                    SET lead_outcome = COALESCE(
                        NULLIF(json_extract(custom_fields, '$.lead_outcome'), ''),
                        NULLIF(json_extract(custom_fields, '$.call_outcome'), ''),
                        NULLIF(json_extract(custom_fields, '$.outcome'), ''),
                        NULLIF(json_extract(custom_fields, '$.callOutcome'), '')
                    )
                    WHERE (lead_outcome IS NULL OR TRIM(lead_outcome) = '')
                      AND custom_fields IS NOT NULL
                """))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('handoff_sessions')")).fetchall()
                col_names = {row[1] for row in cols}
                if "call_room_id" not in col_names:
                    conn.execute(text("ALTER TABLE handoff_sessions ADD COLUMN call_room_id TEXT"))
                if "call_status" not in col_names:
                    conn.execute(text("ALTER TABLE handoff_sessions ADD COLUMN call_status TEXT DEFAULT 'none'"))
                if "call_mode" not in col_names:
                    conn.execute(text("ALTER TABLE handoff_sessions ADD COLUMN call_mode TEXT DEFAULT 'video'"))
                if "call_requested_at" not in col_names:
                    conn.execute(text("ALTER TABLE handoff_sessions ADD COLUMN call_requested_at DATETIME"))
                if "call_started_at" not in col_names:
                    conn.execute(text("ALTER TABLE handoff_sessions ADD COLUMN call_started_at DATETIME"))
                if "call_ended_at" not in col_names:
                    conn.execute(text("ALTER TABLE handoff_sessions ADD COLUMN call_ended_at DATETIME"))
                conn.execute(text("UPDATE handoff_sessions SET call_status = 'none' WHERE call_status IS NULL OR TRIM(call_status) = ''"))
                conn.execute(text("UPDATE handoff_sessions SET call_mode = 'video' WHERE call_mode IS NULL OR TRIM(call_mode) = ''"))
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
                    "is_lead_qualified": "BOOLEAN DEFAULT 0",
                    "external_call_a_id": "TEXT"
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
                if "calling_no" not in col_names:
                    conn.execute(
                        text("UPDATE call_campaigns SET calling_no = '+918046733457' WHERE calling_no IS NULL")
                    )
            except Exception as e:
                print(str(e))

            try:
                cols = conn.execute(text("PRAGMA table_info('credit_estimator_shares')")).fetchall()
                col_names = {row[1] for row in cols}
                if "company_name" not in col_names:
                    conn.execute(text("ALTER TABLE credit_estimator_shares ADD COLUMN company_name TEXT DEFAULT 'Untitled Company'"))
                if "input_json" not in col_names:
                    conn.execute(text("ALTER TABLE credit_estimator_shares ADD COLUMN input_json TEXT DEFAULT '{}'"))
                conn.execute(text("UPDATE credit_estimator_shares SET company_name = 'Untitled Company' WHERE company_name IS NULL OR TRIM(company_name) = ''"))
                conn.execute(text("UPDATE credit_estimator_shares SET input_json = '{}' WHERE input_json IS NULL OR TRIM(input_json) = ''"))
            except Exception:
                pass

            try:
                conn.commit()
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('organization_credit_allocations')")).fetchall()
                col_names = {row[1] for row in cols}
                if "price" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_allocations ADD COLUMN price FLOAT DEFAULT 0"))
                if "payment_status" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_allocations ADD COLUMN payment_status TEXT DEFAULT 'pending'"))
                if "start_date" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_allocations ADD COLUMN start_date DATETIME"))
                if "end_date" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_allocations ADD COLUMN end_date DATETIME"))
                if "expiry_days" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_allocations ADD COLUMN expiry_days INTEGER"))
                conn.execute(text("UPDATE organization_credit_allocations SET price = 0 WHERE price IS NULL"))
                conn.execute(text("UPDATE organization_credit_allocations SET payment_status = 'pending' WHERE payment_status IS NULL OR TRIM(payment_status) = ''"))
            except Exception:
                pass

            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS organization_credit_profiles (
                        id INTEGER PRIMARY KEY,
                        organization_id INTEGER NOT NULL UNIQUE,
                        total_price FLOAT DEFAULT 0,
                        buffer_percent FLOAT DEFAULT 0,
                        discount_percent FLOAT DEFAULT 0,
                        payment_status TEXT DEFAULT 'pending',
                        start_date DATETIME,
                        end_date DATETIME,
                        expiry_days INTEGER,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME,
                        FOREIGN KEY(organization_id) REFERENCES organizations (id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_organization_credit_profiles_organization_id ON organization_credit_profiles (organization_id)"))
            except Exception:
                pass

            try:
                cols = conn.execute(text("PRAGMA table_info('organization_credit_profiles')")).fetchall()
                col_names = {row[1] for row in cols}
                if "buffer_percent" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_profiles ADD COLUMN buffer_percent FLOAT DEFAULT 0"))
                if "discount_percent" not in col_names:
                    conn.execute(text("ALTER TABLE organization_credit_profiles ADD COLUMN discount_percent FLOAT DEFAULT 0"))
                conn.execute(text("UPDATE organization_credit_profiles SET buffer_percent = 0 WHERE buffer_percent IS NULL"))
                conn.execute(text("UPDATE organization_credit_profiles SET discount_percent = 0 WHERE discount_percent IS NULL"))
            except Exception:
                pass

            try:
                profile_count = conn.execute(text("SELECT COUNT(1) FROM organization_credit_profiles")).scalar() or 0
                if int(profile_count) == 0:
                    legacy_rows = conn.execute(text("""
                        SELECT
                            organization_id,
                            SUM(COALESCE(price, 0)) AS total_price,
                            MIN(start_date) AS start_date,
                            MAX(end_date) AS end_date,
                            MAX(expiry_days) AS expiry_days,
                            MAX(notes) AS notes,
                            SUM(CASE WHEN LOWER(COALESCE(payment_status, '')) = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                            SUM(CASE WHEN LOWER(COALESCE(payment_status, '')) = 'paid' THEN 1 ELSE 0 END) AS paid_count,
                            COUNT(1) AS row_count
                        FROM organization_credit_allocations
                        WHERE is_active = 1
                        GROUP BY organization_id
                    """)).fetchall()

                    for row in legacy_rows:
                        row_count = int(row[8] or 0)
                        paid_count = int(row[7] or 0)
                        failed_count = int(row[6] or 0)
                        payment_status = "pending"
                        if row_count > 0 and paid_count == row_count:
                            payment_status = "paid"
                        elif failed_count > 0:
                            payment_status = "failed"
                        elif paid_count > 0:
                            payment_status = "partial"

                        conn.execute(
                            text("""
                                INSERT INTO organization_credit_profiles (
                                    organization_id,
                                    total_price,
                                    payment_status,
                                    start_date,
                                    end_date,
                                    expiry_days,
                                    notes
                                ) VALUES (
                                    :organization_id,
                                    :total_price,
                                    :payment_status,
                                    :start_date,
                                    :end_date,
                                    :expiry_days,
                                    :notes
                                )
                            """),
                            {
                                "organization_id": row[0],
                                "total_price": float(row[1] or 0),
                                "payment_status": payment_status,
                                "start_date": row[2],
                                "end_date": row[3],
                                "expiry_days": row[4],
                                "notes": row[5],
                            },
                        )
            except Exception:
                pass

            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS organization_credit_change_logs (
                        id INTEGER PRIMARY KEY,
                        organization_id INTEGER NOT NULL,
                        price_matrix_item_id INTEGER,
                        change_type TEXT NOT NULL,
                        previous_json TEXT,
                        new_json TEXT,
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations (id),
                        FOREIGN KEY(price_matrix_item_id) REFERENCES price_matrix_items (id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_organization_credit_change_logs_organization_id ON organization_credit_change_logs (organization_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_organization_credit_change_logs_price_matrix_item_id ON organization_credit_change_logs (price_matrix_item_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_organization_credit_change_logs_change_type ON organization_credit_change_logs (change_type)"))
            except Exception:
                pass

            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS billing_invoices (
                        id INTEGER PRIMARY KEY,
                        organization_id INTEGER NOT NULL,
                        invoice_number TEXT NOT NULL UNIQUE,
                        issue_date DATETIME NOT NULL,
                        due_date DATETIME,
                        billing_start_date DATETIME,
                        billing_end_date DATETIME,
                        amount FLOAT DEFAULT 0,
                        paid_amount FLOAT DEFAULT 0,
                        status TEXT DEFAULT 'pending',
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME,
                        FOREIGN KEY(organization_id) REFERENCES organizations (id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_organization_id ON billing_invoices (organization_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_invoice_number ON billing_invoices (invoice_number)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_status ON billing_invoices (status)"))
            except Exception:
                pass

            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS billing_payments (
                        id INTEGER PRIMARY KEY,
                        organization_id INTEGER NOT NULL,
                        invoice_id INTEGER,
                        amount FLOAT DEFAULT 0,
                        payment_date DATETIME NOT NULL,
                        method TEXT DEFAULT 'bank_transfer',
                        reference TEXT,
                        status TEXT DEFAULT 'completed',
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations (id),
                        FOREIGN KEY(invoice_id) REFERENCES billing_invoices (id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_payments_organization_id ON billing_payments (organization_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_payments_invoice_id ON billing_payments (invoice_id)"))
            except Exception:
                pass

            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS billing_invoice_items (
                        id INTEGER PRIMARY KEY,
                        invoice_id INTEGER NOT NULL,
                        organization_id INTEGER NOT NULL,
                        price_matrix_item_id INTEGER,
                        category TEXT DEFAULT '',
                        module TEXT DEFAULT '',
                        sub_module TEXT,
                        billing_unit TEXT,
                        quantity FLOAT,
                        credits_per_unit FLOAT,
                        allocated_credits FLOAT DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(invoice_id) REFERENCES billing_invoices (id),
                        FOREIGN KEY(organization_id) REFERENCES organizations (id),
                        FOREIGN KEY(price_matrix_item_id) REFERENCES price_matrix_items (id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoice_items_invoice_id ON billing_invoice_items (invoice_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoice_items_organization_id ON billing_invoice_items (organization_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoice_items_price_matrix_item_id ON billing_invoice_items (price_matrix_item_id)"))
            except Exception:
                pass

            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS billing_bills (
                        id INTEGER PRIMARY KEY,
                        organization_id INTEGER NOT NULL,
                        invoice_id INTEGER NOT NULL UNIQUE,
                        payment_id INTEGER,
                        bill_number TEXT NOT NULL UNIQUE,
                        issued_date DATETIME NOT NULL,
                        amount FLOAT DEFAULT 0,
                        payment_method TEXT,
                        payment_reference TEXT,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations (id),
                        FOREIGN KEY(invoice_id) REFERENCES billing_invoices (id),
                        FOREIGN KEY(payment_id) REFERENCES billing_payments (id)
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_bills_organization_id ON billing_bills (organization_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_bills_invoice_id ON billing_bills (invoice_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_bills_payment_id ON billing_bills (payment_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_bills_bill_number ON billing_bills (bill_number)"))
            except Exception:
                pass

            try:
                conn.commit()
            except Exception:
                pass
