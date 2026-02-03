# Database Schema - Role-Based Access Control

## Overview
The database has been updated to support multi-tenancy with role-based access control. Organizations own users, and users have specific roles (ADMIN or USER) within their organization.

## Tables

### 1. Organizations Table
```sql
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: Unique identifier for organization
- `name`: Organization name (must be unique)
- `description`: Optional organization description
- `created_at`: Organization creation timestamp
- `updated_at`: Last update timestamp

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE constraint on `name`

---

### 2. Users Table (Updated)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR NOT NULL,
    hashed_password VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'USER' NOT NULL,
    organization_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

**Fields:**
- `id`: Unique user identifier
- `username`: Username (unique within database)
- `email`: User email address
- `hashed_password`: BCrypt hashed password
- `role`: User role (ADMIN or USER)
- `organization_id`: Foreign key to organization (REQUIRED)
- `is_active`: Account activation status (TRUE/FALSE)
- `created_at`: User creation timestamp
- `updated_at`: Last update timestamp

**Constraints:**
- PRIMARY KEY on `id`
- UNIQUE constraint on `username`
- FOREIGN KEY constraint on `organization_id`
  - References `organizations(id)`
  - Prevents deleting organizations with active users

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `username`
- INDEX on `email`
- INDEX on `organization_id`

**New/Updated Columns:**
- `organization_id` - NEW: Added during migration with DEFAULT value
- `is_active` - NEW: Added during migration with DEFAULT value of 1
- `role` - EXISTING: Already present, now used for access control

---

### 3. UserRole Enum (Backend)
```python
class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    USER = "USER"
```

**Values:**
- `ADMIN`: Full access to all features
- `USER`: Limited access (chat only)

---

## Relationships

### One-to-Many: Organization → Users
```
Organization (1) ---> (∞) Users
- One organization has many users
- Each user belongs to exactly one organization
- Deleting an organization should cascade-delete users
```

**Foreign Key:**
```
users.organization_id → organizations.id
```

---

## Sample Data Structure

### Organization Example
```json
{
  "id": 1,
  "name": "Acme Corporation",
  "description": "Sales and support organization",
  "created_at": "2026-01-27T10:30:00",
  "updated_at": "2026-01-27T10:30:00"
}
```

### Users Example for Organization 1
```json
[
  {
    "id": 1,
    "username": "john_admin",
    "email": "john@acme.com",
    "hashed_password": "$2b$12$...",
    "role": "ADMIN",
    "organization_id": 1,
    "is_active": true,
    "created_at": "2026-01-27T10:30:00",
    "updated_at": "2026-01-27T10:30:00"
  },
  {
    "id": 2,
    "username": "jane_user",
    "email": "jane@acme.com",
    "hashed_password": "$2b$12$...",
    "role": "USER",
    "organization_id": 1,
    "is_active": true,
    "created_at": "2026-01-27T11:15:00",
    "updated_at": "2026-01-27T11:15:00"
  }
]
```

---

## Migration Changes

### Changes Applied by migrate.py
1. **Organizations Table Creation** (if not exists)
   - Runs first to ensure org table exists
   - Creates with all required columns

2. **User Column Additions**
   - Adds `organization_id` column
   - Default value: ID of "Default Organization" (created/fetched)
   - Constraint: NOT NULL

   - Adds `is_active` column
   - Default value: 1 (true)
   - Constraint: NOT NULL

3. **Default Organization Setup**
   - Checks if "Default Organization" exists
   - If not, creates it
   - Assigns all existing users to it

### Migration Script Logic
```python
# 1. Check if organizations table exists, create if not
# 2. Check if Default Organization exists
#    - If yes, use its ID
#    - If no, create it and get its ID
# 3. Add organization_id column with DEFAULT value
# 4. Add is_active column with DEFAULT value of 1
# 5. Migration complete!
```

---

## Backward Compatibility

### How Existing Users are Handled
- All existing users are assigned to "Default Organization"
- Their role remains unchanged (likely all ADMIN for existing accounts)
- `is_active` is set to 1 (active)
- No data loss occurs

### Before Migration
```
User Table:
id | username | email | hashed_password | role
1  | admin    | ...   | ...             | ADMIN
2  | user1    | ...   | ...             | USER
```

### After Migration
```
Organizations Table:
id | name                    | description
1  | Default Organization    | Default org for existing users

User Table:
id | username | email | role  | organization_id | is_active
1  | admin    | ...   | ADMIN | 1               | 1
2  | user1    | ...   | USER  | 1               | 1
```

---

## Query Examples

### Find All Users in Organization
```sql
SELECT u.* FROM users u
WHERE u.organization_id = ?
ORDER BY u.created_at DESC;
```

### Find Admin Users in Organization
```sql
SELECT u.* FROM users u
WHERE u.organization_id = ? AND u.role = 'ADMIN' AND u.is_active = 1
ORDER BY u.username;
```

### Find Active Regular Users
```sql
SELECT u.* FROM users u
WHERE u.organization_id = ? AND u.role = 'USER' AND u.is_active = 1
ORDER BY u.username;
```

### Check if User Exists and is Active
```sql
SELECT u.* FROM users u
WHERE u.username = ? AND u.organization_id = ? AND u.is_active = 1;
```

### Get Organization with All Users
```sql
SELECT o.*, COUNT(u.id) as user_count
FROM organizations o
LEFT JOIN users u ON o.id = u.organization_id
WHERE o.id = ?
GROUP BY o.id;
```

### Count Admins in Organization
```sql
SELECT COUNT(*) as admin_count FROM users u
WHERE u.organization_id = ? AND u.role = 'ADMIN' AND u.is_active = 1;
```

### Find Inactive Users
```sql
SELECT u.* FROM users u
WHERE u.organization_id = ? AND u.is_active = 0
ORDER BY u.updated_at DESC;
```

---

## Schema Validation Queries

### Verify Organizations Table Exists
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='organizations';
```

### Verify Users Table Structure
```sql
PRAGMA table_info(users);
```

**Expected Output:**
```
cid | name              | type    | notnull | dflt_value | pk
0   | id                | INTEGER | 0       | NULL       | 1
1   | username          | VARCHAR | 1       | NULL       | 0
2   | email             | VARCHAR | 1       | NULL       | 0
3   | hashed_password   | VARCHAR | 1       | NULL       | 0
4   | role              | VARCHAR | 1       | 'USER'     | 0
5   | organization_id   | INTEGER | 1       | NULL       | 0
6   | is_active         | BOOLEAN | 1       | 1          | 0
7   | created_at        | DATETIME| 0       | ...        | 0
8   | updated_at        | DATETIME| 0       | ...        | 0
```

### Check Foreign Key Constraints
```sql
PRAGMA foreign_key_list(users);
```

**Expected Output:**
```
id | seq | table          | from      | to | ondelete | onupdate
0  | 0   | organizations | org_id   | id | NO ACTION| NO ACTION
```

---

## Performance Considerations

### Indexes for Common Queries
```sql
-- Already indexed in schema:
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Suggested additional indexes:
CREATE INDEX idx_users_role_org ON users(organization_id, role);
CREATE INDEX idx_users_active_org ON users(organization_id, is_active);
CREATE INDEX idx_org_name ON organizations(name);
```

### Query Optimization Tips
1. Always filter by `organization_id` for user queries (multi-tenancy)
2. Use `is_active = 1` in login queries to prevent inactive user access
3. Include role filtering in queries that vary by role
4. Use pagination for large user lists

---

## Security Considerations

### Enforced at Database Level
✅ **Foreign Key Constraint** - Users must belong to valid organization
✅ **NOT NULL Constraints** - Required fields cannot be empty
✅ **UNIQUE Constraints** - Prevents duplicate usernames

### Enforced at Application Level
✅ **Organization Isolation** - Queries filter by organization_id
✅ **Role-Based Access** - Backend checks role before allowing actions
✅ **Password Hashing** - Never stores plaintext passwords

### Best Practices
- Use parameterized queries (SQLAlchemy ORM does this)
- Validate user role on every admin action
- Log user management actions
- Require HTTPS in production
- Use strong JWT secret
- Implement rate limiting on user endpoints

---

## Database Maintenance

### Backup Organization Data
```sql
-- Export organization metadata
SELECT * FROM organizations;

-- Export users with organization info
SELECT u.*, o.name as organization_name
FROM users u
JOIN organizations o ON u.organization_id = o.id;
```

### Deactivate Inactive Users Older Than 90 Days
```sql
UPDATE users
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE is_active = 1
  AND DATE(updated_at) < DATE('now', '-90 days');
```

### Archive Inactive Users (Mark for cleanup)
```sql
-- Find users inactive for more than 1 year
SELECT u.* FROM users u
WHERE u.is_active = 0 AND DATE(u.updated_at) < DATE('now', '-1 year');
```

### Merge Organizations (if needed)
```sql
-- Change all users from org 2 to org 1
UPDATE users
SET organization_id = 1, updated_at = CURRENT_TIMESTAMP
WHERE organization_id = 2;

-- Then delete org 2
DELETE FROM organizations WHERE id = 2;
```

---

## Database File Location
```
Project Root:
├── backend/
│   ├── chatbot.db          ← SQLite database file
│   └── app/
│       ├── models/
│       │   └── user.py     ← Model definitions
│       └── api/
│           └── organization.py  ← User API endpoints
└── migrate.py              ← Migration script
```

### To Access Database Directly (SQLite)
```bash
cd backend
sqlite3 chatbot.db
```

---

## Migration Status

✅ **Migration Completed Successfully**
- Organizations table created
- Users table updated with organization_id
- Users table updated with is_active
- Default organization created
- All existing users assigned to default org
- Database ready for multi-tenancy and role-based access

**Last Migration:** January 27, 2026
**Database File:** `backend/chatbot.db`
**Size:** ~114 KB
