"""
Migration script to update the database schema for organization-level user management.
Run this before starting the server.
"""

import sqlite3
import sys
from pathlib import Path

# Determine database path
db_path = Path(__file__).parent / "chatbot.db"

def migrate():
    """Update database schema"""
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        print("Starting database migration...")
        
        # Check if organizations table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'")
        if not cursor.fetchone():
            print("Creating organizations table...")
            cursor.execute("""
                CREATE TABLE organizations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR UNIQUE NOT NULL,
                    description VARCHAR,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
        else:
            print("Organizations table already exists")
        
        # Check if users table has organization_id column
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'organization_id' not in columns:
            print("Adding organization_id column to users table...")
            
            # Check if default organization exists
            cursor.execute("SELECT id FROM organizations WHERE name = 'Default Organization'")
            result = cursor.fetchone()
            
            if result:
                default_org_id = result[0]
                print(f"Using existing Default Organization with id {default_org_id}")
            else:
                # Create a default organization for existing users
                cursor.execute("INSERT INTO organizations (name, description) VALUES ('Default Organization', 'Default organization for existing users')")
                conn.commit()
                default_org_id = cursor.lastrowid
                print(f"Created Default Organization with id {default_org_id}")
            
            # Add organization_id column with DEFAULT value in SQLite syntax
            cursor.execute(f"ALTER TABLE users ADD COLUMN organization_id INTEGER DEFAULT {default_org_id} NOT NULL")
            conn.commit()
            print(f"Added organization_id column with default value {default_org_id}")
        else:
            print("organization_id column already exists")
        
        if 'is_active' not in columns:
            print("Adding is_active column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1 NOT NULL")
            conn.commit()
            print("Added is_active column")
        else:
            print("is_active column already exists")
        
        # Check if email column is still unique (it shouldn't be for multi-tenant)
        cursor.execute("PRAGMA index_list(users)")
        indexes = cursor.fetchall()
        email_unique_exists = any(idx[3] == 1 and 'email' in str(idx) for idx in indexes)
        
        if email_unique_exists:
            print("Email column has unique constraint, this is expected for current setup")
        
        print("Migration completed successfully!")
        conn.close()
        return True
        
    except Exception as e:
        print(f"Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
