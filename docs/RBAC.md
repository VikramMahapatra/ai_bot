# Role-Based Access Control (RBAC) Documentation

## Overview
The Zentrixel AI Bot system implements a comprehensive role-based access control system with two user roles: **ADMIN** and **USER**.

## Roles & Permissions

### ADMIN Role
- Full access to all features and modules
- Dashboard access with analytics and charts
- Knowledge base management (create, read, update, delete)
- Lead management and tracking
- User management (create, read, update, delete users)
- Analytics and reporting
- Settings configuration
- Chat access

**Access Control:**
- See all menu items in the sidebar
- Can create and manage other users
- Can assign roles to users
- Can activate/deactivate users
- Cannot delete the only active admin user in the organization

### USER Role
- Limited to chat functionality only
- Can only access the Chat interface
- Cannot access:
  - Dashboard
  - Knowledge Base
  - Leads Management
  - Analytics
  - User Management
  - Settings (organization-wide)

**Access Control:**
- See only "Chat" menu item in the sidebar
- Cannot create or manage users
- Cannot access any administrative functions

## Implementation Details

### Backend (FastAPI + SQLAlchemy)

#### Database Models
- **Organization**: Represents a tenant/organization
  - `id`: Primary key
  - `name`: Organization name (unique)
  - `description`: Optional description
  - `created_at`, `updated_at`: Timestamps

- **User**: User account with role assignment
  - `id`: Primary key
  - `username`: Unique username
  - `email`: User email
  - `hashed_password`: Secured password hash
  - `role`: Enum (ADMIN | USER)
  - `organization_id`: Foreign key to Organization
  - `is_active`: Boolean flag for account status
  - `created_at`, `updated_at`: Timestamps

- **UserRole**: Enum with two values
  - `ADMIN`: Administrative access
  - `USER`: Limited access

#### Authentication & Authorization Files
- **`app/auth.py`**
  - `get_current_user()`: Extracts user from JWT token
  - `require_admin()`: Decorator to enforce admin-only endpoints
  - `create_access_token()`: Creates JWT token with user_id and organization_id
  - `get_password_hash()`: Secures passwords

- **`app/api/admin.py`**
  - `POST /api/auth/login`: User login
  - `POST /api/auth/register`: Organization + Admin user registration
  - Role-based response filtering

- **`app/api/organization.py`**
  - `POST /api/organizations/users`: Create user (admin only)
  - `GET /api/organizations/users`: List users (admin only)
  - `PUT /api/organizations/users/{user_id}`: Update user role/status (admin only)
  - `DELETE /api/organizations/users/{user_id}`: Delete user (admin only)
  - `GET /api/organizations/me`: Get current organization details

#### Schemas & Validation
- **`app/schemas/`**
  - UserCreate: Validates new user creation (username, email, password, role)
  - UserResponse: Safe user data for API responses
  - UserUpdate: Validates user updates (role, is_active)
  - OrganizationCreate: Validates organization registration

### Frontend (React + TypeScript)

#### Authentication Context (`context/AuthContext.tsx`)
```typescript
interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  userRole: UserRole | null;        // 'ADMIN' | 'USER'
  organizationId: number | null;
  userId: number | null;
  isAdmin: boolean;                  // Computed: userRole === 'ADMIN'
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
```

**Features:**
- Persists user role, organization ID, and user ID in localStorage
- Provides `useAuth()` hook for accessing auth state
- Exposes `isAdmin` boolean for easy permission checks

#### Route Protection (`components/ProtectedRoute.tsx`)
- Protects routes from unauthenticated users
- Enforces role-based route access
- Redirects admins-only routes (like `/users`) to `/chat` for regular users
- Redirects unauthenticated users to `/login`

#### Sidebar Navigation (`components/Common/Sidebar.tsx`)
```typescript
interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  requiredRole?: 'ADMIN' | 'USER' | 'ALL';
}
```

**Menu Items by Role:**
- **ADMIN sees:**
  - Dashboard (`/admin`, ADMIN only)
  - Chat (`/chat`, ALL)
  - Knowledge Base (`/knowledge`, ADMIN only)
  - Leads (`/leads`, ADMIN only)
  - Analytics (`/analytics`, ADMIN only)
  - User Management (`/users`, ADMIN only)
  - Settings (`/settings`, ALL)

- **USER sees:**
  - Chat (`/chat`, ALL)
  - Settings (`/settings`, ALL)

**User Info Display:**
- Displays current username and email
- Shows role badge with lock icon for ADMIN
- Color-coded: Red badge for ADMIN, default for USER

#### User Management Page (`pages/UserManagementPage.tsx`)
- **Admin-only page** for managing users in the organization
- Features:
  - Create new users with email, password, and role assignment
  - Edit user roles (change from ADMIN to USER or vice versa)
  - Activate/deactivate user accounts
  - Delete users with confirmation
  - Real-time user list with status indicators
  - Error handling and notifications

#### Routes with Role Protection (`App.tsx`)
```typescript
<Route path="/admin" element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>} />
<Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
<Route path="/knowledge" element={<ProtectedRoute requiredRole="ADMIN"><KnowledgePage /></ProtectedRoute>} />
<Route path="/leads" element={<ProtectedRoute requiredRole="ADMIN"><LeadsPage /></ProtectedRoute>} />
<Route path="/analytics" element={<ProtectedRoute requiredRole="ADMIN"><AnalyticsPage /></ProtectedRoute>} />
<Route path="/users" element={<ProtectedRoute requiredRole="ADMIN"><UserManagementPage /></ProtectedRoute>} />
```

## Authentication Flow

### Registration (Organization + Admin User)
1. User enters organization name, admin username, email, and password
2. Backend creates organization
3. Backend creates first admin user in that organization
4. Admin is assigned ADMIN role
5. JWT token is generated with `user_id`, `organization_id`, and `role`
6. Frontend stores token and role data in localStorage

### Login
1. User enters username and password
2. Backend verifies credentials and organization membership
3. JWT token is created with claims: `user_id`, `organization_id`, `role`
4. Frontend stores in localStorage:
   - `token`: JWT token
   - `user_role`: ADMIN or USER
   - `organization_id`: Organization ID
   - `user_id`: User ID
   - `username`: Username
   - `email`: Email
5. AuthContext updates state, enabling role-based UI

### Token Structure (JWT)
```json
{
  "sub": "user_id",
  "org_id": "organization_id",
  "user_id": "user_id",
  "role": "ADMIN" | "USER",
  "exp": timestamp
}
```

## User Management Workflow

### Creating a New User (Admin Only)
1. Admin navigates to "User Management" page
2. Clicks "Create User" button
3. Fills in form:
   - Username (required, unique)
   - Email (required)
   - Password (required)
   - Role (ADMIN or USER)
4. Submits form
5. Backend validates and creates user in same organization
6. User appears in the users list
7. New user can login with their credentials

### Updating User Role
1. Admin clicks "Edit" icon next to user
2. Dialog opens with current role
3. Admin selects new role
4. Clicks "Update"
5. User's role is changed immediately
6. Next login uses new role

### Deactivating/Activating User
1. Admin clicks activate/deactivate icon
2. User's `is_active` flag is toggled
3. Deactivated users cannot login
4. Can be reactivated by admin

### Deleting User
1. Admin clicks delete icon
2. Confirmation dialog appears
3. User is permanently deleted if confirmed
4. Prevents deleting the only active admin

## Security Considerations

1. **Password Security**: Passwords are hashed using bcrypt
2. **JWT Tokens**: Signed with a secret key (JWT_SECRET from environment)
3. **Role Enforcement**: Backend decorators enforce role requirements
4. **Organization Isolation**: Users can only access their organization's data
5. **Frontend Validation**: UI prevents unauthorized actions (no routes visible)
6. **Backend Validation**: API endpoints verify permissions before processing

## Environment Variables
```
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=10080  # 1 week
```

## Testing RBAC

### Test Admin User
```
Username: admin
Email: admin@example.com
Role: ADMIN
Organization: Your Organization
```

### Test Regular User
```
Username: user
Email: user@example.com
Role: USER
Organization: Your Organization
```

### Verification Steps
1. Login as ADMIN:
   - Should see all menu items
   - Can access /users page
   - Can create new users
   
2. Login as USER:
   - Should only see Chat and Settings
   - Cannot access /admin, /knowledge, /leads, /analytics, /users
   - Attempting to visit these URLs redirects to /chat

3. Logout and login as different user:
   - Role-based permissions should apply correctly

## API Endpoints Summary

### Authentication
- `POST /api/auth/register`: Register organization + admin user
- `POST /api/auth/login`: Login user

### User Management (Admin Only)
- `POST /api/organizations/users`: Create user
- `GET /api/organizations/users`: List users
- `PUT /api/organizations/users/{user_id}`: Update user
- `DELETE /api/organizations/users/{user_id}`: Delete user

### Organization
- `GET /api/organizations/me`: Get current organization
- `GET /api/organizations/{org_id}`: Get organization details

## Files Modified/Created

### Backend
- `app/models/user.py`: User and Organization models with roles
- `app/api/organization.py`: User management endpoints
- `app/auth.py`: Role-based authentication
- `app/schemas/user.py`: User validation schemas
- `migrate.py`: Database migration for RBAC schema

### Frontend
- `context/AuthContext.tsx`: Auth state with role management
- `components/Common/Sidebar.tsx`: Role-based menu filtering
- `components/ProtectedRoute.tsx`: Route protection component
- `pages/UserManagementPage.tsx`: Admin user management UI
- `App.tsx`: Routes with role-based protection
- `services/organizationService.ts`: User API client
- `services/authService.ts`: Auth token/role storage

## Future Enhancements
1. Fine-grained permissions (e.g., "can view reports", "can edit knowledge base")
2. Role-based feature toggles
3. Audit logging for user actions
4. Permission templates
5. Group-based permissions
6. Single Sign-On (SSO) integration
