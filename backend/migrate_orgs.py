"""
Migration script to reorganize organizations and users.
Creates new organizations and distributes users accordingly.
"""

import sys
from pathlib import Path
from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import User, Organization, UserRole
from app.auth import get_password_hash

def migrate_orgs():
    """Reorganize organizations and users"""
    
    # Initialize database
    init_db()
    
    db = SessionLocal()
    
    try:
        print("Starting organization migration...")
        
        # Get all current users
        all_users = db.query(User).all()
        all_orgs = db.query(Organization).all()
        
        print(f"Current state: {len(all_orgs)} organizations, {len(all_users)} users")
        for org in all_orgs:
            org_users = db.query(User).filter(User.organization_id == org.id).all()
            print(f"  - {org.name} (ID: {org.id}): {len(org_users)} users")
            for user in org_users:
                print(f"    - {user.username} ({user.role.value})")
        
        # Create new organizations if they don't exist
        org_names = ["TechCore Solutions", "Sundrew Pvt Ltd", "CloudInnovate Inc"]
        orgs_dict = {}
        
        for org_name in org_names:
            existing_org = db.query(Organization).filter(Organization.name == org_name).first()
            if existing_org:
                orgs_dict[org_name] = existing_org
                print(f"Organization '{org_name}' already exists")
            else:
                new_org = Organization(name=org_name, description=f"{org_name} - Organization")
                db.add(new_org)
                db.flush()
                orgs_dict[org_name] = new_org
                print(f"Created organization: {org_name}")
        
        db.commit()
        
        # Get all existing admins and regular users
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        regular_users = db.query(User).filter(User.role == UserRole.USER).all()
        
        print(f"\nFound {len(admins)} admins and {len(regular_users)} regular users")
        
        # Distribute admins to different organizations
        admin_org_mapping = [
            ("TechCore Solutions", admins[0]) if len(admins) > 0 else None,
            ("Sundrew Pvt Ltd", admins[1]) if len(admins) > 1 else None,
            ("CloudInnovate Inc", admins[2]) if len(admins) > 2 else None,
        ]
        
        print("\nUpdating admins to different organizations:")
        for mapping in admin_org_mapping:
            if mapping:
                org_name, admin = mapping
                old_org_id = admin.organization_id
                admin.organization_id = orgs_dict[org_name].id
                print(f"  - {admin.username}: {old_org_id} -> {orgs_dict[org_name].id} ({org_name})")
        
        # Distribute regular users across organizations
        print("\nDistributing regular users:")
        org_list = list(orgs_dict.values())
        for i, user in enumerate(regular_users):
            target_org = org_list[i % len(org_list)]
            old_org_id = user.organization_id
            user.organization_id = target_org.id
            print(f"  - {user.username}: {old_org_id} -> {target_org.id} ({target_org.name})")
        
        db.commit()
        
        # Print final state
        print("\n\nFinal state:")
        all_orgs = db.query(Organization).all()
        for org in all_orgs:
            org_users = db.query(User).filter(User.organization_id == org.id).all()
            print(f"  - {org.name} (ID: {org.id}): {len(org_users)} users")
            for user in org_users:
                print(f"    - {user.username} ({user.role.value})")
        
        print("\nMigration completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    migrate_orgs()
