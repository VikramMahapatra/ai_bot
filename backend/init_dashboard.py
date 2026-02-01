"""
Initialize dashboard with test data for the current logged-in user.
Run this once to ensure the user has an organization_id.
"""

import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, init_db
from app.models import Organization, User
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_dashboard():
    """Ensure user has an organization"""
    init_db()  # Create all tables first
    
    db = SessionLocal()
    try:
        # Check if default organization exists
        default_org = db.query(Organization).filter(
            Organization.name == "Default Organization"
        ).first()
        
        if not default_org:
            logger.info("Creating default organization...")
            default_org = Organization(
                name="Default Organization",
                description="Default organization for dashboard testing"
            )
            db.add(default_org)
            db.commit()
            logger.info(f"Created default organization with ID: {default_org.id}")
        else:
            logger.info(f"Default organization already exists with ID: {default_org.id}")
        
        # Update all users without organization to use default
        users_without_org = db.query(User).filter(
            User.organization_id.is_(None)
        ).all()
        
        if users_without_org:
            logger.info(f"Found {len(users_without_org)} users without organization")
            for user in users_without_org:
                user.organization_id = default_org.id
                logger.info(f"Assigned user '{user.username}' to organization {default_org.id}")
            db.commit()
            logger.info(f"Updated {len(users_without_org)} users")
        else:
            logger.info("All users already have organizations assigned")
        
        logger.info("Dashboard initialization complete!")
        
    except Exception as e:
        logger.error(f"Error during initialization: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_dashboard()
