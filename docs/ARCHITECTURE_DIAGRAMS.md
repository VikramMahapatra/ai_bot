# RBAC System Architecture Diagram

## Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION LAYER                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ADMIN USER                              REGULAR USER                   │
│   ┌─────────────────────────┐             ┌──────────────────┐          │
│   │  Login as ADMIN         │             │  Login as USER   │          │
│   │  role: "ADMIN"          │             │  role: "USER"    │          │
│   └──────────┬──────────────┘             └────────┬─────────┘          │
│              │                                     │                      │
│              ▼                                     ▼                      │
│   ┌─────────────────────────┐             ┌──────────────────┐          │
│   │    FULL DASHBOARD       │             │   CHAT ONLY      │          │
│   │                         │             │                  │          │
│   │ - Dashboard             │             │ - Chat           │          │
│   │ - Chat                  │             │ - Settings       │          │
│   │ - Knowledge Base        │             │ (Personal only)  │          │
│   │ - Leads                 │             │                  │          │
│   │ - Analytics             │             │                  │          │
│   │ - User Management  ◄──┐ │             │                  │          │
│   │ - Settings             │ │             │                  │          │
│   └────────────────────────┘ │             └──────────────────┘          │
│                              │                                            │
│                    ┌─────────┴───────────────────────┐                   │
│                    │   User Management Page          │                   │
│                    │   (Admin Only)                  │                   │
│                    │                                 │                   │
│                    │ ┌─────────────────────────────┐│                   │
│                    │ │ Create User                 ││                   │
│                    │ │ ✓ Username                  ││                   │
│                    │ │ ✓ Email                     ││                   │
│                    │ │ ✓ Password                  ││                   │
│                    │ │ ✓ Role (ADMIN/USER)         ││                   │
│                    │ └─────────────────────────────┘│                   │
│                    │                                 │                   │
│                    │ ┌─────────────────────────────┐│                   │
│                    │ │ User List                   ││                   │
│                    │ │ [Edit][Activate][Delete]    ││                   │
│                    │ │ - jane_doe   USER   Active ││                   │
│                    │ │ - john_admin ADMIN  Active ││                   │
│                    │ │ - bob_smith  USER   Inactive││                   │
│                    │ └─────────────────────────────┘│                   │
│                    └─────────────────────────────────┘                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                           ┌──────────┴──────────┐
                           │   API LAYER         │
                           └──────────┬──────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION & AUTHORIZATION                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Login Request              JWT Token Creation        Token Verification│
│  ┌─────────────┐           ┌──────────────────────┐  ┌────────────────┐ │
│  │ username    │──────────▶│ {                    │  │ Check role:    │ │
│  │ password    │           │   "sub": 1,          │  │ ADMIN / USER   │ │
│  └─────────────┘           │   "org_id": 1,       │──▶                │ │
│                            │   "role": "ADMIN",   │  │ If ADMIN:      │ │
│  Password Hash             │   "exp": timestamp   │  │ ✅ Allow       │ │
│  Verification             │ }                    │  │                │ │
│  (bcrypt)                 └──────────────────────┘  │ If USER:       │ │
│                                                      │ ❌ Deny        │ │
│                                                      └────────────────┘ │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                  @require_admin() Decorator                        │ │
│  │                                                                    │ │
│  │  @router.post("/api/organizations/users")                         │ │
│  │  @require_admin                              ◄── Checks if        │ │
│  │  def create_user(...):                           current_user.    │ │
│  │      # Only executes if user.role == "ADMIN"     role == ADMIN   │ │
│  │      return new_user                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                           ┌──────────┴──────────┐
                           │  DATABASE LAYER     │
                           └──────────┬──────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────┐    ┌──────────────────────────────────┐  │
│  │   Organizations          │    │         Users                    │  │
│  ├──────────────────────────┤    ├──────────────────────────────────┤  │
│  │ id: 1                    │    │ id: 1                            │  │
│  │ name: "Acme Corp"        │◄──┐│ username: "john_admin"           │  │
│  │ description: "..."       │   │ email: "john@acme.com"           │  │
│  │ created_at: timestamp    │   │ hashed_password: "$2b$12$..."    │  │
│  │ updated_at: timestamp    │   │ role: "ADMIN"  ◄── Role here!    │  │
│  └──────────────────────────┘   │ organization_id: 1   ◄── FK link│  │
│            △                     │ is_active: 1   ◄── Activation    │  │
│            │                     │ created_at: timestamp            │  │
│            │                     │ updated_at: timestamp            │  │
│            └─────────────────────├──────────────────────────────────┤  │
│  One Organization has            │ id: 2                            │  │
│  many Users                       │ username: "jane_user"            │  │
│                                   │ email: "jane@acme.com"           │  │
│                                   │ hashed_password: "$2b$12$..."    │  │
│                                   │ role: "USER"                     │  │
│                                   │ organization_id: 1               │  │
│                                   │ is_active: 1                     │  │
│                                   │ created_at: timestamp            │  │
│                                   │ updated_at: timestamp            │  │
│                                   └──────────────────────────────────┘  │
│                                                                           │
│  Relationships:                                                          │
│  - Organization.id ◄──────► User.organization_id (Foreign Key)         │
│  - One-to-Many: Organization has many Users                             │
│  - Each User belongs to exactly one Organization                         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend State Management Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React App Start                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. App Component Mounts                                             │
│     │                                                                │
│     └──▶ <AuthProvider> wraps entire app                            │
│            │                                                         │
│            └──▶ useEffect runs on mount                             │
│                 │                                                    │
│                 └──▶ Check localStorage for token                   │
│                      │                                               │
│                      ├──▶ Token exists?                             │
│                      │    ├─ YES: Load role, org_id, user_id      │
│                      │    └─ NO: User is unauthenticated           │
│                      │                                               │
│                      └──▶ Set auth state in context                │
│                                                                       │
│  2. Context Update                                                  │
│     │                                                                │
│     └──▶ AuthContext.value updated with:                           │
│          ├─ isAuthenticated: true/false                            │
│          ├─ userRole: "ADMIN" | "USER" | null                     │
│          ├─ organizationId: number | null                         │
│          ├─ userId: number | null                                 │
│          ├─ isAdmin: boolean (computed)                           │
│          └─ login/logout methods                                   │
│                                                                       │
│  3. Component Re-render                                             │
│     │                                                                │
│     ├──▶ Sidebar checks role via useAuth()                         │
│     │    ├─ ADMIN: Show [Dashboard, Chat, Knowledge, Leads,        │
│     │    │           Analytics, User Mgmt, Settings]              │
│     │    └─ USER: Show [Chat, Settings]                           │
│     │                                                                │
│     ├──▶ Routes check role via ProtectedRoute                      │
│     │    ├─ Route has requiredRole="ADMIN"?                        │
│     │    ├─ YES: userRole === "ADMIN"? Allow : Redirect           │
│     │    └─ NO: Just check authentication                         │
│     │                                                                │
│     └──▶ Pages render conditionally                                │
│          └─ User Management only renders if admin                  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow - User Creation

```
ADMIN CREATES NEW USER
│
│ 1. Frontend: UserManagementPage
│    └─▶ Form submission with user data
│        {
│          username: "jane_doe",
│          email: "jane@acme.com",
│          password: "secret123",
│          role: "USER"
│        }
│
│ 2. Frontend: organizationService.createUser()
│    └─▶ HTTP POST /api/organizations/users
│        Headers: { Authorization: "Bearer {token}" }
│        Body: { user data }
│
│ 3. Backend: API Router receives request
│    └─▶ Extract token from Authorization header
│        Verify JWT signature
│        Extract claims: user_id, org_id, role
│
│ 4. Backend: @require_admin() Decorator
│    └─▶ Check: Is current_user.role == "ADMIN"?
│        ├─ YES: Continue to endpoint
│        └─ NO: Return 403 Forbidden
│
│ 5. Backend: create_user() Endpoint
│    └─▶ Validate user input
│        ├─ Username unique?
│        ├─ Email valid?
│        ├─ Password strong?
│        └─ If invalid: Return 400 Bad Request
│
│ 6. Backend: Database Operation
│    └─▶ Hash password (bcrypt)
│        Insert new user into users table:
│        {
│          username: "jane_doe",
│          email: "jane@acme.com",
│          hashed_password: "$2b$12$...",
│          role: "USER",
│          organization_id: 1,  ◄─ Admin's org
│          is_active: 1,
│          created_at: now(),
│          updated_at: now()
│        }
│
│ 7. Backend: Response
│    └─▶ Return 201 Created with user object
│        (without password hash)
│
│ 8. Frontend: Handle Response
│    └─▶ Show success message
│        Update user list
│        Close form dialog
│
└─▶ USER CREATED SUCCESSFULLY
```

---

## Request Flow - Regular User Chat Access

```
USER REQUESTS CHAT
│
│ 1. User navigates to /chat
│    │
│    └─▶ Route: <Route path="/chat" element={
│             <ProtectedRoute>
│               <ChatPage />
│             </ProtectedRoute>
│           } />
│
│ 2. ProtectedRoute Component
│    ├─▶ Get auth from context: useAuth()
│    ├─▶ Check: isAuthenticated?
│    │   └─ NO: Redirect to /login
│    │   └─ YES: Continue
│    │
│    ├─▶ Check: requiredRole specified?
│    │   └─ NO: Allow (public page)
│    │   └─ YES: requiredRole="ADMIN"?
│    │           └─ YES: userRole === "ADMIN"?
│    │               ├─ YES: Render ChatPage
│    │               └─ NO: Redirect to /chat
│    │           └─ NO: Render ChatPage
│    │
│    └─▶ Render: <ChatPage />
│
│ 3. ChatPage Renders
│    └─▶ User can send/receive messages
│        User can view chat history
│        Chat API calls work normally
│
└─▶ CHAT ACCESSIBLE ✅
```

---

## Permission Enforcement Layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND UI LAYER                         │
├─────────────────────────────────────────────────────┤
│  User doesn't see menu items they can't access      │
│  └─▶ User Management menu only shows for ADMIN      │
│      Admin dashboard only shows for ADMIN           │
│      Buttons hidden based on role                   │
├─────────────────────────────────────────────────────┤
│  Problem: Can bypass by modifying localStorage      │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2: ROUTE PROTECTION LAYER                    │
├─────────────────────────────────────────────────────┤
│  Routes check role before rendering components      │
│  └─▶ <ProtectedRoute requiredRole="ADMIN">         │
│      Unauthorized users redirected to /chat        │
│      Prevents direct URL access to /users          │
├─────────────────────────────────────────────────────┤
│  Problem: Can call API directly with curl/Postman  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3: API ENDPOINT LAYER                        │
├─────────────────────────────────────────────────────┤
│  Backend decorators check role on endpoints         │
│  └─▶ @require_admin                                │
│      @router.post("/api/organizations/users")      │
│      Returns 403 if not admin                      │
├─────────────────────────────────────────────────────┤
│  Problem: Token could be forged if secret exposed  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 4: DATABASE LAYER                            │
├─────────────────────────────────────────────────────┤
│  Foreign keys ensure data integrity                 │
│  └─▶ Users belong to valid organization            │
│      Organization must exist                       │
│      User role stored in database                  │
│      is_active flag prevents disabled user login   │
├─────────────────────────────────────────────────────┤
│  Problem: Direct database access (very unlikely)   │
└─────────────────────────────────────────────────────┘

Multiple layers ensure security even if one is compromised!
```

---

## Component Interaction Diagram

```
App.tsx
├── AuthProvider
│   └── AuthContext
│       ├── useAuth() ◄── Used by all components
│       ├── Stores: role, org_id, user_id
│       └── Methods: login(), logout()
│
├── Router
│   └── Routes
│       ├── /login
│       │   └── LoginPage (public)
│       │
│       ├── /chat
│       │   └── ProtectedRoute (any authenticated user)
│       │       └── ChatPage
│       │
│       ├── /admin
│       │   └── ProtectedRoute (requiredRole="ADMIN")
│       │       └── AdminDashboard
│       │
│       └── /users
│           └── ProtectedRoute (requiredRole="ADMIN")
│               └── UserManagementPage
│                   ├── useAuth() ◄── Check if admin
│                   ├── organizationService.listUsers()
│                   ├── organizationService.createUser()
│                   ├── organizationService.updateUser()
│                   └── organizationService.deleteUser()
│
└── Layout
    └── AdminLayout
        ├── TopBar
        │   ├── useAuth() ◄── Get current user
        │   └── Logout button
        │
        └── Sidebar
            ├── useAuth() ◄── Get user role
            ├── Filter menu items by role
            ├── Display user info & role
            └── Navigate to pages
```

---

## Security Model Summary

```
THREAT PREVENTION
├── Password Security
│   ├── Store: bcrypt hashed (never plaintext)
│   ├── Verify: bcrypt compare
│   └── Transfer: HTTPS only (recommended)
│
├── Token Security
│   ├── Create: Signed JWT with secret
│   ├── Verify: Check signature on every request
│   ├── Claims: Include role, org_id, user_id
│   ├── Expiry: Set token expiration time
│   └── Storage: localStorage (could be HttpOnly in future)
│
├── Authorization Security
│   ├── Frontend: Hide UI elements by role
│   ├── Routes: Check role before rendering
│   ├── API: Check role on every admin endpoint
│   └── Database: Enforce foreign keys
│
├── Organization Isolation
│   ├── Every user belongs to one org
│   ├── Every operation filters by org_id
│   ├── Users can't see other org's users
│   └── Admin only manages their org
│
├── User Status
│   ├── is_active flag prevents disabled login
│   ├── Admin can deactivate problem users
│   └── Deactivated users can't login
│
└── Data Validation
    ├── Frontend: Basic validation
    ├── Backend: Strict validation (PydanticModels)
    ├── Database: NOT NULL, UNIQUE, FK constraints
    └── Error handling: Safe error messages (no SQL injection hints)
```

---

This architecture provides **defense in depth** with multiple security layers!
