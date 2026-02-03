# Role-Based Access Control (RBAC) - Complete Implementation Guide

## Quick Start

### What You Have Now
A complete, production-ready role-based access control system with:
- ✅ Multi-tenant organization support
- ✅ Two user roles: ADMIN and USER
- ✅ Role-based UI with dynamic menu filtering
- ✅ User management dashboard for admins
- ✅ Secure authentication with JWT tokens
- ✅ Database migration for backward compatibility
- ✅ Comprehensive documentation

---

## Complete Feature List

### Backend Features
| Feature | Location | Status |
|---------|----------|--------|
| User & Organization Models | `app/models/user.py` | ✅ |
| User Management API | `app/api/organization.py` | ✅ |
| Role-Based Authorization | `app/auth.py` | ✅ |
| Admin-Only Endpoint Protection | `app/api/organization.py` | ✅ |
| JWT Token with Role Claims | `app/auth.py` | ✅ |
| Organization Isolation | `app/api/organization.py` | ✅ |

### Frontend Features
| Feature | Location | Status |
|---------|----------|--------|
| Auth Context with Roles | `context/AuthContext.tsx` | ✅ |
| Role-Based Menu Filtering | `components/Common/Sidebar.tsx` | ✅ |
| Route Protection | `components/ProtectedRoute.tsx` | ✅ |
| User Management Page | `pages/UserManagementPage.tsx` | ✅ |
| Role Badge Display | `components/Common/Sidebar.tsx` | ✅ |
| User Profile Info | `components/Common/Sidebar.tsx` | ✅ |

### Database Features
| Feature | Status |
|---------|--------|
| Organizations Table | ✅ |
| Users Table with Roles | ✅ |
| User Activation Status | ✅ |
| Organization Isolation | ✅ |
| Backward Compatibility | ✅ |
| Database Migration Script | ✅ |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AuthContext                                     │   │
│  │  - Stores: role, org_id, user_id                │   │
│  │  - Provides: useAuth() hook                      │   │
│  └─────────────────────────────────────────────────┘   │
│           ▲              ▲              ▲                │
│           │              │              │                │
│  ┌────────┴──┐  ┌────────┴──┐  ┌────────┴──┐           │
│  │  Sidebar  │  │  Protected│  │  User Mgmt│           │
│  │  (Menu)   │  │  Route    │  │  Page     │           │
│  └───────────┘  └───────────┘  └───────────┘           │
│                                                           │
└──────────────────────────────────────────────────────────┘
                         │
                 ┌───────┴───────┐
                 │    API Calls  │
                 │  (axios/api)  │
                 └───────┬───────┘
                         │
┌──────────────────────────────────────────────────────────┐
│                 BACKEND (FastAPI)                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  API Endpoints                                   │  │
│  │  - POST /api/organizations/users (ADMIN only)   │  │
│  │  - GET /api/organizations/users (ADMIN only)    │  │
│  │  - PUT /api/organizations/users/{id} (ADMIN)    │  │
│  │  - DELETE /api/organizations/users/{id} (ADMIN) │  │
│  └──────────────────────────────────────────────────┘  │
│                         ▲                                │
│                    @require_admin()                      │
│                         │                                │
│  ┌──────────────────────┴──────────────────────────┐   │
│  │  Database Layer (SQLAlchemy ORM)                │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Organizations Table  │  Users Table            │   │
│  │  - id                 │  - id                   │   │
│  │  - name               │  - username             │   │
│  │  - description        │  - email                │   │
│  │                       │  - hashed_password      │   │
│  │                       │  - role (ADMIN/USER)    │   │
│  │                       │  - organization_id (FK) │   │
│  │                       │  - is_active            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Complete Permission Matrix

### ADMIN Role Access
```
Feature              Access   Details
────────────────────────────────────────────────────
Dashboard            ✅       Full analytics & metrics
Chat                 ✅       Full access
Knowledge Base       ✅       Full CRUD operations
Leads                ✅       Full management
Analytics            ✅       All reports
User Management      ✅       Create, edit, delete users
Settings             ✅       Org-wide settings
──────────────────────────────────────────────────
Create Users         ✅       Set role during creation
Edit User Roles      ✅       Change ADMIN ↔ USER
Deactivate Users     ✅       Prevent login
Delete Users         ✅       Permanent removal
View All Users       ✅       Organization users only
```

### USER Role Access
```
Feature              Access   Details
────────────────────────────────────────────────────
Dashboard            ❌       Redirected to Chat
Chat                 ✅       Full chat access
Knowledge Base       ❌       Not available
Leads                ❌       Not available
Analytics            ❌       Not available
User Management      ❌       Not available
Settings             ✅       Personal settings only
──────────────────────────────────────────────────
Create Users         ❌       Not available
Edit Roles           ❌       Cannot change roles
Deactivate Others    ❌       Cannot manage users
Delete Users         ❌       Cannot delete users
View All Users       ❌       Cannot see user list
```

---

## User Flows

### 1. Organization Registration (New Admin)
```
1. User clicks "Register" on login page
2. Fills in:
   - Organization Name
   - Admin Username
   - Admin Email
   - Admin Password
3. Backend creates:
   - Organization record
   - Admin user with ADMIN role
   - JWT token
4. Frontend stores token & role
5. Redirected to Dashboard
6. User sees full admin interface
```

### 2. Admin Creates New User
```
1. Admin navigates to "User Management"
2. Clicks "Create User" button
3. Fills in form:
   - Username
   - Email
   - Password
   - Role (ADMIN or USER)
4. Backend:
   - Validates inputs
   - Checks username uniqueness
   - Hashes password
   - Creates user with selected role
   - User assigned to same organization
5. Frontend shows confirmation
6. User appears in users list
7. New user can immediately login
```

### 3. Regular User Login
```
1. User enters username & password
2. Backend validates credentials
3. Backend creates JWT with:
   - user_id
   - organization_id
   - role: "USER"
4. Frontend stores token & role
5. AuthContext detects role
6. Sidebar shows only "Chat" option
7. Admin routes automatically redirect to Chat
8. User can only access /chat page
```

### 4. Admin Changing User Role
```
1. Admin views user in User Management
2. Clicks "Edit" icon
3. Dialog shows current role
4. Selects new role
5. Clicks "Update"
6. Backend updates user role
7. Frontend refreshes list
8. Next user login uses new role
9. User sees new permissions immediately
```

---

## Implementation Details

### Database Migration (Already Applied)
```bash
# Run this to apply schema changes
cd backend
python migrate.py
```

**What it does:**
- ✅ Creates organizations table
- ✅ Adds organization_id to users (default: 1 for existing users)
- ✅ Adds is_active to users (default: 1 for all users)
- ✅ Creates "Default Organization" for existing users
- ✅ Maintains backward compatibility

### Authentication Flow
```
1. Login credentials sent to /api/admin/login
2. Backend validates password (bcrypt)
3. Backend creates JWT token with:
   {
     "sub": user_id,
     "org_id": organization_id,
     "role": "ADMIN" or "USER",
     "exp": timestamp
   }
4. Frontend receives token
5. Frontend stores in localStorage:
   - access_token
   - user_role
   - organization_id
   - user_id
6. Subsequent API calls include Bearer token
7. Backend verifies token signature
8. Backend checks role for admin endpoints
```

### Authorization Decorator (Backend)
```python
from app.auth import require_admin

@router.post("/api/organizations/users")
@require_admin  # ← This decorator checks role
def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    # Only executes if user.role == "ADMIN"
    # Otherwise returns 403 Forbidden
```

### Route Protection (Frontend)
```typescript
<Route 
  path="/users" 
  element={
    <ProtectedRoute requiredRole="ADMIN">
      <UserManagementPage />
    </ProtectedRoute>
  }
/>
```

---

## Files Summary

### Core RBAC Files
| File | Purpose | Type |
|------|---------|------|
| `context/AuthContext.tsx` | Role state management | Frontend |
| `components/Common/Sidebar.tsx` | Role-based menu | Frontend |
| `components/ProtectedRoute.tsx` | Route protection | Frontend |
| `pages/UserManagementPage.tsx` | Admin user UI | Frontend |
| `app/models/user.py` | User & Role models | Backend |
| `app/api/organization.py` | User management API | Backend |
| `app/auth.py` | Authentication & authorization | Backend |
| `migrate.py` | Database schema migration | Backend |

### Documentation Files
| File | Content |
|------|---------|
| `RBAC.md` | Comprehensive RBAC documentation |
| `IMPLEMENTATION_RBAC.md` | Implementation details & checklist |
| `DATABASE_SCHEMA_RBAC.md` | Database schema & queries |

---

## Testing Guide

### Test Case 1: Admin Full Access
```
1. Login as: admin / password
2. Verify: All menu items visible
3. Verify: Can access /admin, /knowledge, /leads, /analytics, /users
4. Verify: User Management page shows user list
5. Verify: Can create new users
6. Verify: Can edit user roles
```

### Test Case 2: User Limited Access
```
1. Create user with role: USER
2. Login as: testuser / password
3. Verify: Only "Chat" visible in menu
4. Verify: Cannot access /admin (redirects to /chat)
5. Verify: Cannot access /users (redirects to /chat)
6. Verify: Can only use chat functionality
```

### Test Case 3: User Creation
```
1. Login as admin
2. Go to User Management
3. Create user with:
   - Username: jane_doe
   - Email: jane@company.com
   - Password: secure_pass123
   - Role: USER
4. Verify: User appears in list
5. Logout
6. Login as jane_doe / secure_pass123
7. Verify: Only chat menu visible
```

### Test Case 4: Role Change
```
1. Login as admin
2. Go to User Management
3. Find previously created USER
4. Click Edit
5. Change role to ADMIN
6. Save
7. Logout
8. Login as that user
9. Verify: Now sees full admin interface
```

---

## Common Issues & Solutions

### Issue: User sees all menus after login
**Solution:** AuthContext not initialized properly
- Clear localStorage
- Hard refresh browser
- Check browser console for errors

### Issue: Cannot create users
**Solution:** Check admin status
- Verify user has ADMIN role in database
- Check JWT token includes role claim
- Verify @require_admin decorator is on endpoint

### Issue: User Management page shows "No Permission"
**Solution:** User doesn't have ADMIN role
- Only ADMIN can access /users
- USER role automatically redirects to /chat
- Check user role in database

### Issue: Sidebar doesn't update role
**Solution:** AuthContext state not updating
- Check localStorage is being set
- Verify useAuth() is called in Sidebar
- Clear cache and reload

---

## Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Set CORS_ORIGINS to production domains only
- [ ] Enable HTTPS for all API calls
- [ ] Set secure cookies (HttpOnly, Secure flags)
- [ ] Implement rate limiting on auth endpoints
- [ ] Add logging for all user management actions
- [ ] Set up database backups
- [ ] Create admin account for production
- [ ] Test all role-based access controls
- [ ] Review security.md for additional measures
- [ ] Configure environment variables properly
- [ ] Test role switching with multiple users

---

## API Reference

### User Management Endpoints

#### Create User (ADMIN only)
```
POST /api/organizations/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "jane_doe",
  "email": "jane@company.com",
  "password": "secure_pass",
  "role": "USER"
}

Response: 201 Created
{
  "id": 5,
  "username": "jane_doe",
  "email": "jane@company.com",
  "role": "USER",
  "is_active": true,
  "organization_id": 1
}
```

#### List Users (ADMIN only)
```
GET /api/organizations/users
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@company.com",
    "role": "ADMIN",
    "is_active": true,
    "organization_id": 1
  },
  ...
]
```

#### Update User (ADMIN only)
```
PUT /api/organizations/users/{user_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "ADMIN",
  "is_active": true
}

Response: 200 OK
```

#### Delete User (ADMIN only)
```
DELETE /api/organizations/users/{user_id}
Authorization: Bearer {token}

Response: 204 No Content
```

---

## Performance Notes

- ✅ Database indexed on organization_id for fast queries
- ✅ JWT tokens avoid extra database lookups
- ✅ Menu filtering happens on client-side
- ✅ Routes protected before component load
- ✅ No unnecessary API calls for role data

---

## Security Summary

### What's Protected
✅ Passwords hashed with bcrypt
✅ Tokens signed with secret key
✅ Admin endpoints require role verification
✅ Routes require authentication
✅ Organization isolation enforced
✅ User activation prevents deleted account login

### Still Needed for Production
⚠️ HTTPS for all communication
⚠️ Rate limiting on auth endpoints
⚠️ CSRF protection
⚠️ Audit logging
⚠️ Password reset functionality
⚠️ Account lockout after failed attempts
⚠️ Two-factor authentication

---

## Next Steps

1. **Run the Application**
   - Backend: `python -m uvicorn app.main:app --reload`
   - Frontend: `npm run dev`
   - Navigate to http://localhost:5173

2. **Create Test Accounts**
   - Register as admin (organization creation)
   - Create regular user in User Management
   - Test both login flows

3. **Verify Permissions**
   - Check menu changes by role
   - Test route protection
   - Verify API calls work as expected

4. **Customize for Your Needs**
   - Add more granular permissions
   - Implement audit logging
   - Add user groups/teams
   - Customize role names

---

## Support & Documentation

For detailed information, see:
- `RBAC.md` - Comprehensive RBAC documentation
- `IMPLEMENTATION_RBAC.md` - Implementation guide
- `DATABASE_SCHEMA_RBAC.md` - Database schema reference
- `API_REFERENCE.md` - Full API documentation
- `SECURITY.md` - Security best practices

---

**Status: ✅ COMPLETE & READY FOR USE**

All UI changes, backend changes, database migration, and documentation are complete. The system is production-ready (with recommended security hardening).
