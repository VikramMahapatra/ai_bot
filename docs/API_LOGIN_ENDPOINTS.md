# API Endpoints Reference - Multi-Organization Login

## Authentication Endpoints

### 1. Get Organizations by Username
**Endpoint:** `GET /api/admin/organizations/by-username/{username}`

**Purpose:** Fetch all organizations where a user has an account (for login dropdown)

**Parameters:**
- `username` (path): The username to search for

**Response:**
```json
[
  {
    "id": 2,
    "name": "TechCore Solutions",
    "description": "TechCore Solutions - Organization"
  },
  {
    "id": 3,
    "name": "Sundrew Pvt Ltd",
    "description": "Sundrew Pvt Ltd - Organization"
  }
]
```

**Status Codes:**
- `200`: Organizations found
- `404`: User not found

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/admin/organizations/by-username/viki"
```

---

### 2. Login with Organization
**Endpoint:** `POST /api/admin/login`

**Purpose:** Authenticate user with their username, password, and organization

**Request Body:**
```json
{
  "username": "viki",
  "password": "password123",
  "organization_id": 2
}
```

**Response (Success - 200):**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user_id": 1,
  "organization_id": 2,
  "role": "ADMIN",
  "organization_name": "TechCore Solutions"
}
```

**Response (Error - 401):**
```json
{
  "detail": "Invalid credentials, organization, or user inactive"
}
```

**Status Codes:**
- `200`: Login successful
- `401`: Invalid credentials or user not in organization
- `404`: Organization not found
- `422`: Validation error (missing required fields)

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "viki",
    "password": "password123",
    "organization_id": 2
  }'
```

---

## Frontend Integration

### Login Flow

1. User enters username in login form
2. Frontend calls: `GET /api/admin/organizations/by-username/{username}`
3. Dropdown displays available organizations
4. User selects organization and enters password
5. Frontend calls: `POST /api/admin/login` with all three parameters
6. Backend returns access token and organization info
7. Frontend stores in localStorage and redirects to dashboard

### LocalStorage Keys Set After Login
```javascript
localStorage.setItem('access_token', response.data.access_token);
localStorage.setItem('organization_id', response.data.organization_id.toString());
localStorage.setItem('organization_name', response.data.organization_name);
localStorage.setItem('user_role', response.data.role);
localStorage.setItem('user_id', response.data.user_id.toString());
```

---

## Test Cases

### Test Case 1: User in Single Organization
```
Username: viki
Step 1: GET /api/admin/organizations/by-username/viki
Response: [{"id": 2, "name": "TechCore Solutions"}]
Step 2: User auto-selects TechCore Solutions
Step 3: POST /api/admin/login with org_id=2
Expected: Login success, token received
```

### Test Case 2: User in Multiple Organizations
```
If a user existed in multiple organizations:
Step 1: GET /api/admin/organizations/by-username/{username}
Response: Multiple organizations in dropdown
Step 2: User manually selects one
Step 3: POST /api/admin/login with selected org_id
Expected: Login success, token for selected org received
```

### Test Case 3: Invalid Organization Selection
```
Username: viki
Step 1: Dropdown shows only TechCore Solutions (id=2)
Step 2: User tries to POST with org_id=3 (another org)
Expected: 401 Unauthorized - Invalid credentials
```

---

## Organization Database

Current organizations in system:

| ID | Name | Users |
|----|------|-------|
| 1 | Default Organization | (empty - deprecated) |
| 2 | TechCore Solutions | viki (ADMIN), sarah (USER) |
| 3 | Sundrew Pvt Ltd | vikram (ADMIN), john_user (USER) |
| 4 | CloudInnovate Inc | bhusan (ADMIN), snehal (USER) |

---

## Important Notes

1. **Organization ID is Required**: The login endpoint will return 422 validation error if `organization_id` is missing from request
2. **User Isolation**: Each user can only access data from their own organization
3. **User Exists But Wrong Org**: If you try to login to an org where user doesn't exist, get 401 error
4. **Case Sensitive**: Username lookup is case-sensitive
5. **Active Status**: User must have `is_active = true` to login

---

## Authentication Header Format

For all subsequent API calls after login, use the Bearer token:

```bash
Authorization: Bearer <access_token>
```

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/me" \
  -H "Authorization: Bearer eyJhbGc..."
```
