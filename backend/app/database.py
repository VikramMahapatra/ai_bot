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
