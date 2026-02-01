# Widget Management Page - Implementation Summary

## Overview
A complete widget management interface has been added to the admin dashboard, allowing admins to create, edit, view, and delete chatbot widgets with full organization scoping.

---

## Features

### 1. **Create Widget**
- Click "Create Widget" button
- Fill in widget configuration:
  - Widget Name
  - Welcome Message
  - Logo URL
  - Primary & Secondary Colors (with color picker)
  - Position (bottom-right, bottom-left, top-right, top-left)
  - Lead Capture toggle
- Auto-generated unique Widget ID
- Widget automatically associated with current organization and admin user

### 2. **Edit Widget**
- Click edit icon on any widget row
- Modify all configurable fields
- Changes saved to database
- Organization ownership enforced at backend

### 3. **View Widget Details**
- Click view icon to see full widget configuration
- Copy embed code with single click
- View creation date and all settings
- Edit directly from view panel

### 4. **Delete Widget**
- Click delete icon with confirmation
- Prevents accidental deletion
- Organization-scoped (admins can only delete their org's widgets)

### 5. **Copy Embed Code**
- Copy button generates embed code:
  ```html
  <script async src="http://localhost:5173/widget.html?widget_id={widget_id}"></script>
  ```
- Automatically copies to clipboard
- Use to embed widget on external websites

### 6. **Widget Listing**
- Table view of all organization widgets
- Shows:
  - Widget Name
  - Widget ID (truncated)
  - Position
  - Lead Capture Status
  - Creation Date
  - Quick action buttons

---

## Database Integration

### Widget Scoping
- **organization_id**: FK to organizations table (primary scoping)
- **user_id**: FK to users table (tracks creator, ensures user context)
- **All queries filtered by** `organization_id == current_user.organization_id`

### Data Stored
```
widget_configs table:
├── widget_id (unique string)
├── user_id (creator, auditing)
├── organization_id (scoping driver)
├── name
├── welcome_message
├── logo_url
├── primary_color
├── secondary_color
├── position
├── lead_capture_enabled
├── lead_fields (JSON)
├── created_at
└── updated_at
```

---

## Backend Endpoints

### POST `/api/admin/widget/config`
- **Purpose**: Create new widget
- **Auth**: Requires ADMIN role
- **Scoping**: Automatically sets `organization_id` from `current_user.organization_id`
- **Response**: Created widget config with auto-generated `widget_id`

### GET `/api/admin/widgets`
- **Purpose**: List all widgets for current organization
- **Auth**: Requires ADMIN role
- **Scoping**: Filters by `organization_id == current_user.organization_id`
- **Response**: Array of widget configs

### PUT `/api/admin/widget/config/{widget_id}`
- **Purpose**: Update widget configuration
- **Auth**: Requires ADMIN role
- **Scoping**: Verifies widget belongs to current org and user
- **Validation**: Cannot change `user_id`

### DELETE `/api/admin/widget/config/{widget_id}`
- **Purpose**: Delete widget
- **Auth**: Requires ADMIN role
- **Scoping**: Verifies widget belongs to current org
- **Cascade**: Deletes widget config (leads remain with widget_id but no config reference)

### GET `/api/admin/widget/config/{widget_id}` (Public)
- **Purpose**: Fetch widget config (for widget embed to load settings)
- **Auth**: No auth required
- **Scoping**: None (public endpoint for embedded widgets)

---

## Frontend Integration

### New Components & Pages
- **File**: `frontend/src/pages/WidgetManagementPage.tsx`
- **Route**: `/widgets` (admin-only)
- **Features**:
  - Responsive table design
  - Dialog-based create/edit
  - Color pickers
  - Confirm dialogs
  - Alerts for success/error
  - Copy-to-clipboard functionality

### Sidebar Navigation
- Added "Widget Management" menu item
- Icon: WidgetsIcon
- Position: Between Analytics and User Management
- Visible only to ADMIN role users

### App Routes
- Route path: `/widgets`
- Protected by `ProtectedRoute` with `requiredRole="ADMIN"`
- Imported and configured in `App.tsx`

---

## Organization Isolation

### How Isolation Works

1. **On Widget Creation**
   - Admin logs in (belongs to org X)
   - Creates widget via `/admin/widget/config`
   - Backend captures `current_user.organization_id`
   - Widget stored with `organization_id = X`
   - Widget stored with `user_id = creator_user_id`

2. **On Widget Query**
   - GET `/admin/widgets` called
   - Backend filters: `WHERE organization_id == current_user.organization_id`
   - Only returns widgets from current org
   - Admin from org Y cannot see org X's widgets

3. **On Lead Capture**
   - Customer fills form on embedded widget
   - Widget ID sent to API
   - Backend resolves: `widget_config.organization_id` → stored in lead record
   - Admin sees only leads from their org's widgets

4. **On Chat**
   - Widget ID passed to chat endpoint
   - Backend resolves widget's org
   - Chat queries embeddings filtered by that org's organization_id
   - User sees only their org's knowledge base

---

## Testing Scenarios

### Scenario 1: Create Widget for TechCore
1. Login as **viki** (TechCore, org_id=2)
2. Navigate to /widgets
3. Click "Create Widget"
4. Fill form: "Support Widget", "Hello!", primary=#007bff
5. Click "Create"
6. Verify: Widget appears in table with org_id=2

### Scenario 2: Org Isolation
1. Login as **viki** (TechCore)
2. Create widget "TechCore Widget"
3. Logout
4. Login as **vikram** (Sundrew, org_id=3)
5. Go to /widgets
6. Verify: TechCore widget NOT visible

### Scenario 3: Lead Capture from Widget
1. Create widget with lead capture enabled
2. Get embed code
3. Embed on test page
4. Fill chat + create lead
5. Login as admin
6. Check /leads
7. Verify: Lead shows organization_id=admin's_org

### Scenario 4: Edit & Delete
1. Create widget
2. Click edit icon
3. Change name
4. Click update
5. Verify: Table reflects changes
6. Click delete
7. Confirm deletion
8. Verify: Widget removed from table

---

## API Response Examples

### Create Widget Response
```json
{
  "id": 1,
  "widget_id": "widget_1234567890",
  "name": "Support Widget",
  "welcome_message": "Hi! How can I help?",
  "logo_url": null,
  "primary_color": "#007bff",
  "secondary_color": "#6c757d",
  "position": "bottom-right",
  "lead_capture_enabled": true,
  "lead_fields": null,
  "user_id": 1,
  "organization_id": 2,
  "created_at": "2026-01-28T10:30:00"
}
```

### List Widgets Response
```json
[
  {
    "widget_id": "widget_1234567890",
    "name": "Support Widget",
    "user_id": 1,
    "organization_id": 2,
    "position": "bottom-right",
    "lead_capture_enabled": true,
    "created_at": "2026-01-28T10:30:00"
  },
  {
    "widget_id": "widget_0987654321",
    "name": "Sales Widget",
    "user_id": 1,
    "organization_id": 2,
    "position": "bottom-left",
    "lead_capture_enabled": true,
    "created_at": "2026-01-28T11:00:00"
  }
]
```

---

## Files Modified/Created

### Backend
- ✅ `app/api/admin.py` - Added 3 new endpoints (list, delete, and updated create)
- ✅ No model changes (columns already exist)

### Frontend
- ✅ `src/pages/WidgetManagementPage.tsx` - NEW (complete widget management UI)
- ✅ `src/components/Common/Sidebar.tsx` - Added WidgetsIcon import and menu item
- ✅ `src/App.tsx` - Imported WidgetManagementPage and added route

---

## Next Steps (Optional Enhancements)

1. **Widget Themes**: Pre-defined theme templates
2. **Widget Preview**: Live preview of widget appearance
3. **Widget Analytics**: View widget interactions and leads per widget
4. **Widget Sharing**: Share widget configs across orgs (admin only)
5. **API Key Management**: Generate API keys for widgets
6. **Widget Testing**: Inline iframe preview
7. **Bulk Actions**: Delete multiple widgets at once
8. **Widget Versioning**: Track widget config history

---

## Notes

- All widgets are tied to the admin who created them (user_id)
- Organization (organization_id) is the primary scoping mechanism
- Lead captures automatically know which org/user created the widget
- Embed code can be used on any external website
- Widget configs are protected by organization boundary at API level
