# API Reference

Quick reference for all API endpoints.

## Base URL
Development: `http://localhost:8000`

## Multi-Tenant Architecture ⚡ NEW

**User Isolation**: All knowledge sources, embeddings, and widget configurations are now user-specific:
- Each user has their own separate knowledge base
- Vector queries are automatically filtered by user_id
- Chat responses use only the authenticated user's knowledge (via widget_id lookup)
- All admin endpoints operate on the current user's data only

## Authentication

All admin endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Public Endpoints

### Health Check
```http
GET /health
```

### Chat
```http
POST /api/chat
Content-Type: application/json

{
  "message": "Your question here",
  "session_id": "unique-session-id",
  "widget_id": "optional-widget-id"
}

Response:
{
  "response": "AI response",
  "session_id": "unique-session-id"
}
```

### Get Chat History
```http
GET /api/chat/history/{session_id}

Response: Array of conversation items
```

### Check Lead Capture
```http
GET /api/chat/should-capture-lead/{session_id}

Response:
{
  "should_capture": true|false
}
```

### Get Widget Configuration
```http
GET /api/admin/widget/config/{widget_id}

Response: Widget configuration object
```

---

## Authentication Endpoints

### Register
```http
POST /api/admin/register
Content-Type: application/json

{
  "username": "admin",
  "email": "admin@example.com",
  "password": "securepassword",
  "role": "ADMIN"
}
```

### Login
```http
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "securepassword"
}

Response:
{
  "access_token": "jwt-token-here",
  "token_type": "bearer"
}
```

---

## Admin Endpoints (Require Authentication)

### Knowledge Management

#### Crawl Website
```http
POST /api/admin/knowledge/crawl
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com",
  "max_pages": 10,
  "max_depth": 3
}

Response: Knowledge source object
```

#### Upload Document
```http
POST /api/admin/knowledge/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <PDF/DOCX/XLSX file>

Response:
{
  "id": 1,
  "name": "document.pdf",
  "source_type": "PDF",
  "status": "active"
}
```

#### List Knowledge Sources
```http
GET /api/admin/knowledge/sources
Authorization: Bearer <token>

Response: Array of knowledge sources
```

#### Delete Knowledge Source
```http
DELETE /api/admin/knowledge/sources/{source_id}
Authorization: Bearer <token>

Response:
{
  "message": "Knowledge source deleted successfully"
}
```

#### Get Vectorized Data (View Embeddings) ⚡ NEW
```http
GET /api/admin/knowledge/vectorized-data
Authorization: Bearer <token>

Response:
{
  "user_id": 1,
  "total_chunks": 150,
  "documents": [
    {
      "id": "user_1_source_5_chunk_0",
      "source_id": "5",
      "source_type": "PDF",
      "filename": "product_guide.pdf",
      "url": null,
      "title": null,
      "chunk_index": 0,
      "created_at": "2024-01-25T10:30:00",
      "preview": "This is the first 200 characters of the embedded text chunk..."
    },
    {
      "id": "user_1_source_3_page_0_chunk_1",
      "source_id": "3",
      "source_type": "WEB",
      "filename": null,
      "url": "https://example.com/page1",
      "title": "Example Page Title",
      "chunk_index": 1,
      "created_at": "2024-01-25T09:15:00",
      "preview": "This is the first 200 characters of the embedded web content..."
    }
  ]
}
```
**Note**: This endpoint shows all vectorized/embedded chunks stored in ChromaDB for the authenticated user. Each chunk represents a piece of text that has been embedded and can be searched during RAG queries. This is user-specific - you only see your own data.

### Lead Management

#### Create Lead
```http
POST /api/admin/leads
Content-Type: application/json

{
  "session_id": "session-id",
  "widget_id": "widget-id",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "Example Corp"
}

Response: Lead object
```

#### List Leads
```http
GET /api/admin/leads?skip=0&limit=100
Authorization: Bearer <token>

Response: Array of leads
```

#### Export Leads to CSV
```http
GET /api/admin/leads/export
Authorization: Bearer <token>

Response: CSV file download
```

### Widget Configuration

#### Create Widget Config
```http
POST /api/admin/widget/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "widget_id": "unique-widget-id",
  "name": "Support Bot",
  "welcome_message": "Hi! How can I help you?",
  "logo_url": "https://example.com/logo.png",
  "primary_color": "#007bff",
  "secondary_color": "#6c757d",
  "position": "bottom-right",
  "lead_capture_enabled": true,
  "lead_fields": "[\"name\", \"email\", \"phone\"]"
}

Response: Widget config object
```

#### Update Widget Config
```http
PUT /api/admin/widget/config/{widget_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Bot Name",
  "primary_color": "#ff0000"
}

Response: Updated widget config object
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "detail": "Error message describing what went wrong"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 403 Forbidden
```json
{
  "detail": "Not enough permissions"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error message"
}
```

---

## Rate Limiting

Default rate limits (recommended for production):
- Authentication endpoints: 5 requests/minute
- Chat endpoints: 60 requests/minute
- Admin endpoints: 100 requests/minute

---

## Interactive Documentation

Visit these URLs when running locally:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Examples

### Complete Chat Flow
```javascript
// 1. Send a message
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What is your return policy?',
    session_id: 'user-123'
  })
});
const data = await response.json();
console.log(data.response); // AI response

// 2. Check if lead should be captured
const leadCheck = await fetch('http://localhost:8000/api/chat/should-capture-lead/user-123');
const leadData = await leadCheck.json();
if (leadData.should_capture) {
  // Show lead form
}
```

### Admin Operations
```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:8000/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'password'
  })
});
const { access_token } = await loginResponse.json();

// 2. Crawl website
const crawlResponse = await fetch('http://localhost:8000/api/admin/knowledge/crawl', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    url: 'https://example.com',
    max_pages: 10,
    max_depth: 3
  })
});
```
