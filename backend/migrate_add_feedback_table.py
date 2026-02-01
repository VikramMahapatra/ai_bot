#!/usr/bin/env python3
"""
Database migration to add message_feedback table
Run this before starting the app: python migrate_add_feedback_table.py
"""

from app.database import Base, engine
from app.models import MessageFeedback

def migrate():
    """Create the message_feedback table"""
    print("Creating message_feedback table...")
    
    # Create all tables (will only create new ones)
    Base.metadata.create_all(bind=engine)
    
    print("✅ message_feedback table created successfully!")
    print("The table includes:")
    print("  - id (primary key)")
    print("  - session_id (indexed)")
    print("  - message_index")
    print("  - conversation_id (foreign key)")
    print("  - rating (1-5)")
    print("  - feedback_text (optional)")
    print("  - organization_id (indexed)")
    print("  - created_at, updated_at")

if __name__ == "__main__":
    migrate()
