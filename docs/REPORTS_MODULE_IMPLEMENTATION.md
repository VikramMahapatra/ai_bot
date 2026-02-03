# Comprehensive Reporting Module Implementation

## Overview
A complete end-to-end reporting and analytics system has been implemented for the Zentrixel AI Bot application. This module provides comprehensive conversation metrics, token usage analytics, lead conversion tracking, and daily statistics with full export capabilities (CSV and PDF).

## Architecture

### Backend Architecture
- **Framework**: FastAPI with SQLAlchemy ORM
- **Database**: SQLite with organization-scoped queries
- **Key Components**:
  - ConversationMetrics model for comprehensive metric tracking
  - Report service with aggregation and analytics functions
  - 6 RESTful API endpoints for different report types
  - CSV and PDF export functionality

### Frontend Architecture
- **Framework**: React with TypeScript and Material-UI
- **Visualization**: Recharts for charts and graphs
- **Export**: jsPDF with jsPDF-autotable for PDF generation
- **Components**: Tabbed interface with summary cards, tables, and charts

## Implementation Details

### 1. Backend Models

#### ConversationMetrics Model (`app/models/report_metrics.py`)
Comprehensive data model for tracking conversation metrics:

**Fields**:
- `id`: Primary key
- `session_id`: Reference to conversation session
- `organization_id`: Organization scoping
- `widget_id`: Source widget identifier
- `total_messages`: Total messages in conversation
- `total_tokens`: Total tokens consumed (prompt + completion)
- `prompt_tokens`: Tokens used in prompts
- `completion_tokens`: Tokens used in completions
- `average_response_time`: Average response time in seconds
- `conversation_duration`: Total conversation duration
- `user_satisfaction`: User rating (1-5 scale)
- `has_lead`: Boolean indicating lead capture
- `lead_name`: Captured lead name
- `lead_email`: Captured lead email
- `conversation_start`: Conversation start timestamp
- `conversation_end`: Conversation end timestamp
- `created_at`: Record creation timestamp

**Indexes**:
- `idx_org_date`: (organization_id, conversation_start) for date-range queries
- `idx_session_org`: (session_id, organization_id) for session lookup

### 2. Backend Schemas (`app/schemas/report.py`)

**ConversationMetricsResponse**: Individual metric record serialization
```python
{
  "id": int,
  "session_id": str,
  "total_messages": int,
  "total_tokens": int,
  "average_response_time": float,
  "user_satisfaction": Optional[float],
  "has_lead": bool,
  "conversation_start": str
}
```

**ReportFilter**: Query parameter validation
```python
{
  "start_date": Optional[str],  # ISO format
  "end_date": Optional[str],    # ISO format
  "widget_id": Optional[str],
  "min_tokens": Optional[int],
  "max_tokens": Optional[int],
  "has_lead": Optional[int]
}
```

**ReportResponse**: Aggregated summary statistics
```python
{
  "total_conversations": int,
  "total_messages": int,
  "total_tokens": int,
  "average_tokens_per_conversation": float,
  "total_leads_captured": int,
  "average_conversation_duration": float,
  "average_satisfaction_rating": Optional[float]
}
```

**TokenUsageReport**: Token consumption with cost estimation
```python
{
  "total_tokens": int,
  "prompt_tokens": int,
  "completion_tokens": int,
  "average_tokens_per_conversation": float,
  "conversations_count": int,
  "cost_estimate": Optional[float]  # GPT-4 pricing
}
```

**LeadReport**: Lead conversion analytics
```python
{
  "total_leads": int,
  "leads_by_widget": {"widget_id": count},
  "leads_by_date": {"date": count},
  "leads_with_email": int,
  "conversion_rate": float  # percentage
}
```

### 3. Backend Services

#### Report Service (`app/services/report_service.py`)

**Key Functions**:

1. **get_conversation_metrics_query(db, org_id, filters)**
   - Builds SQLAlchemy query with date range filtering
   - Supports widget_id, token range, lead filtering
   - Returns base query for further aggregation

2. **get_report_summary(db, org_id, start_date, end_date, widget_id)**
   - Aggregates key metrics: total conversations, messages, tokens, leads
   - Calculates averages: tokens/conversation, satisfaction rating, duration
   - Response time: O(1) with database aggregation functions

3. **get_token_usage_report(db, org_id, start_date, end_date)**
   - Breakdown: prompt tokens vs completion tokens
   - Cost estimation using GPT-4 pricing:
     - Prompt: $0.03 per 1K tokens
     - Completion: $0.06 per 1K tokens
   - Per-conversation averages

4. **get_leads_report(db, org_id, start_date, end_date)**
   - Leads grouped by widget_id
   - Leads grouped by date (7-day rolling)
   - Conversion rate: (total_leads / total_conversations) * 100
   - Filters for leads with valid email addresses

5. **get_daily_conversation_stats(db, org_id, days=30)**
   - Daily aggregation for past N days
   - Metrics: conversation_count, total_messages, total_tokens, leads_captured
   - Chronologically sorted for chart visualization

6. **sync_conversation_metrics(db, org_id)**
   - Populates ConversationMetrics from Conversation + Lead tables
   - Calculates token counts from message content
   - Links lead information from leads table

### 4. Backend API Endpoints (`app/api/reports.py`)

#### 1. GET `/api/reports/summary`
**Parameters**:
- `start_date`: ISO date string (optional)
- `end_date`: ISO date string (optional)
- `widget_id`: Filter by widget (optional)

**Response**: ReportResponse
```json
{
  "total_conversations": 150,
  "total_messages": 2450,
  "total_tokens": 125000,
  "average_tokens_per_conversation": 833.33,
  "total_leads_captured": 45,
  "average_conversation_duration": 480.5,
  "average_satisfaction_rating": 4.2
}
```

#### 2. GET `/api/reports/conversations`
**Parameters**:
- `skip`: Pagination offset (default: 0)
- `limit`: Records per page (default: 10, max: 500)
- `start_date`, `end_date`: Date range filtering
- `widget_id`: Widget filter
- `min_tokens`, `max_tokens`: Token range filtering
- `has_lead`: Lead filtering (0 or 1)
- `sort_by`: Column to sort (conversation_start, total_tokens, total_messages, has_lead)
- `sort_order`: 'asc' or 'desc'

**Response**: DetailedReportResponse
```json
{
  "summary": { ... },
  "metrics": [ ... ],
  "pagination": {
    "skip": 0,
    "limit": 10,
    "total": 150
  }
}
```

#### 3. GET `/api/reports/tokens`
**Parameters**:
- `start_date`, `end_date`: Date range

**Response**: TokenUsageReport
```json
{
  "total_tokens": 125000,
  "prompt_tokens": 45000,
  "completion_tokens": 80000,
  "average_tokens_per_conversation": 833.33,
  "conversations_count": 150,
  "cost_estimate": 7.95
}
```

**Cost Calculation**:
- Prompt cost: (45000 / 1000) * 0.03 = $1.35
- Completion cost: (80000 / 1000) * 0.06 = $4.80
- Total: $6.15

#### 4. GET `/api/reports/leads`
**Parameters**:
- `start_date`, `end_date`: Date range

**Response**: LeadReport
```json
{
  "total_leads": 45,
  "leads_by_widget": {
    "widget-1": 25,
    "widget-2": 20
  },
  "leads_by_date": {
    "2024-01-15": 5,
    "2024-01-14": 7
  },
  "leads_with_email": 40,
  "conversion_rate": 30.0
}
```

#### 5. GET `/api/reports/daily-stats`
**Parameters**:
- `days`: Number of days to include (default: 30)

**Response**:
```json
{
  "daily_stats": [
    {
      "date": "2024-01-15",
      "conversation_count": 8,
      "total_messages": 145,
      "total_tokens": 8750,
      "leads_captured": 2
    }
  ]
}
```

#### 6. GET `/api/reports/export/csv`
**Parameters**:
- `start_date`, `end_date`: Date range
- `widget_id`: Widget filter

**Response**: CSV file download with columns:
- session_id
- widget_id
- total_messages
- total_tokens
- prompt_tokens
- completion_tokens
- average_response_time
- conversation_duration
- user_satisfaction
- has_lead
- lead_name
- lead_email
- conversation_start
- conversation_end

### 5. Frontend Service (`frontend/src/services/reportService.ts`)

TypeScript service layer for API communication:

**Functions**:
- `getReportSummary(params)`: Fetch summary metrics
- `getConversationsReport(params)`: Fetch detailed metrics with pagination
- `getTokenUsageReport(params)`: Fetch token analytics
- `getLeadsReport(params)`: Fetch lead conversion data
- `getDailyStats(params)`: Fetch 30-day aggregation
- `exportToCSV(params)`: Download CSV file
- `exportToPDF(summary, metrics, title)`: Generate PDF report

**Interfaces**:
```typescript
export interface ReportSummary {
  total_conversations: number;
  total_messages: number;
  total_tokens: number;
  average_tokens_per_conversation: number;
  total_leads_captured: number;
  average_conversation_duration: number;
  average_satisfaction_rating: number | null;
}

export interface ConversationMetric {
  id: number;
  session_id: string;
  organization_id: number;
  widget_id: string | null;
  total_messages: number;
  total_tokens: number;
  user_satisfaction: number | null;
  has_lead: number;
  conversation_start: string;
  // ... additional fields
}

export interface DailyStats {
  date: string;
  conversation_count: number;
  total_messages: number;
  total_tokens: number;
  leads_captured: number;
}
```

### 6. Frontend Components

#### ReportsPage (`frontend/src/pages/ReportsPage.tsx`)

**Features**:
1. **Filter Panel**
   - Date range selection (start_date, end_date)
   - Widget ID filtering
   - Apply filters button
   - Real-time data refresh

2. **Export Options**
   - Export to CSV button
   - Export to PDF button
   - Print button

3. **Tabbed Interface**
   - Summary Tab: Key metrics with card layout
   - Conversations Tab: Paginated table with detailed metrics
   - Token Usage Tab: Token breakdown with pie chart
   - Lead Analytics Tab: Lead conversion metrics with bar charts
   - Daily Stats Tab: 30-day trends with line and bar charts

4. **Summary Tab**
   - Total Conversations card
   - Total Messages card
   - Total Tokens card
   - Average Tokens per Conversation card
   - Total Leads card
   - Average Satisfaction Rating card
   - Average Conversation Duration card

5. **Conversations Tab**
   - Sortable table with columns:
     - Session ID (truncated)
     - Messages count
     - Tokens count
     - Response time
     - Satisfaction rating
     - Lead indicator (chip)
     - Date
   - Pagination (5, 10, 25, 50 rows per page)
   - Total records display

6. **Token Usage Tab**
   - Total Tokens metric card
   - Prompt Tokens metric card
   - Completion Tokens metric card
   - Average Tokens card
   - Conversations count card
   - Estimated Cost card
   - Token Distribution pie chart
     - Visual breakdown of prompt vs completion tokens

7. **Lead Analytics Tab**
   - Total Leads metric card
   - Leads with Email metric card
   - Conversion Rate metric card
   - Leads by Widget breakdown
   - Leads by Date bar chart (last 7 days)

8. **Daily Stats Tab**
   - Daily Conversations line chart
   - Daily Messages & Tokens bar chart (dual Y-axis)
   - Daily Leads Captured bar chart
   - Detailed statistics table with pagination

**UI Components Used**:
- Material-UI Grid, Card, Paper, Tabs, Table
- Recharts for data visualization (LineChart, BarChart, PieChart)
- Material-UI form inputs and buttons
- Chip components for status indicators
- LinearProgress for loading states
- Alert for error notifications

### 7. Navigation Integration

**Sidebar Update** (`frontend/src/components/Common/Sidebar.tsx`):
- Added "Reports" menu item with Assignment icon
- Path: `/reports`
- Role-based access: ADMIN only
- Placement: Between Analytics and Widget Management

**App Routing** (`frontend/src/App.tsx`):
- Added protected route for `/reports`
- Protected with ADMIN role requirement
- Accessible from sidebar and direct navigation

## Data Flow

### User Initiates Report View
1. User clicks "Reports" in sidebar
2. ReportsPage component mounts
3. Fetches summary data via reportService.getReportSummary()
4. API calls reportService backend
5. Backend queries ConversationMetrics table
6. Results aggregated using SQLAlchemy functions
7. UI renders metric cards

### User Filters and Exports
1. User selects date range and applies filters
2. ReportsPage refetches data with new parameters
3. User clicks "Export CSV"
4. reportService.exportToCSV() downloads file
5. Alternatively, user clicks "Export PDF"
6. reportService.exportToPDF() generates PDF locally using jsPDF
7. Print button opens browser print dialog

### Viewing Detailed Metrics
1. User switches to "Conversations" tab
2. ReportsPage fetches detailed metrics with pagination
3. Table displays with sorting capabilities
4. User can change page or rows per page
5. Data refetches with new pagination parameters

## Deployment & Integration

### Database Changes
ConversationMetrics table needs to be created:
```sql
CREATE TABLE conversation_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id VARCHAR NOT NULL,
  organization_id INTEGER NOT NULL,
  widget_id VARCHAR,
  total_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  average_response_time FLOAT DEFAULT 0,
  conversation_duration FLOAT DEFAULT 0,
  user_satisfaction FLOAT,
  has_lead INTEGER DEFAULT 0,
  lead_name VARCHAR,
  lead_email VARCHAR,
  conversation_start DATETIME NOT NULL,
  conversation_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES conversation(id),
  FOREIGN KEY (organization_id) REFERENCES organization(id),
  FOREIGN KEY (lead_id) REFERENCES lead(id)
);

CREATE INDEX idx_org_date ON conversation_metrics(organization_id, conversation_start);
CREATE INDEX idx_session_org ON conversation_metrics(session_id, organization_id);
```

### Integration with Chat Flow
To populate metrics in real-time:
1. After each conversation completion
2. Call `report_service.sync_conversation_metrics(db, org_id, session_id)`
3. Or populate ConversationMetrics on-demand when queried

### Environment Setup
**Frontend Dependencies**:
```bash
npm install jspdf jspdf-autotable recharts
```

**Backend** (Already present):
- FastAPI
- SQLAlchemy
- SQLite

## Performance Considerations

### Query Optimization
- Indexes on (organization_id, conversation_start) for date range queries
- Indexed session_id lookup for direct metric retrieval
- Database aggregation functions (SUM, AVG, COUNT) for efficiency

### Pagination
- Maximum 500 records per request to prevent memory issues
- Default 10 records per page for frontend
- Skip/limit pattern for offset pagination

### Caching Opportunities
- Summary metrics could be cached (5-minute TTL)
- Daily stats could be computed nightly
- Widget-specific reports could be materialized

## Feature Enhancements

### Potential Future Features
1. **Advanced Filtering**
   - User-based filtering
   - Sentiment analysis integration
   - Response quality scoring

2. **Additional Reports**
   - User engagement metrics
   - Knowledge base utilization
   - Topic distribution analysis

3. **Scheduled Reports**
   - Email reports on schedule
   - Webhook integrations
   - Automated alerts on thresholds

4. **Real-time Dashboards**
   - WebSocket updates
   - Live conversation tracking
   - Real-time metric feeds

5. **Comparative Analysis**
   - Period-over-period comparisons
   - Trend analysis
   - Forecasting

## File Summary

### Backend Files Created/Modified
1. `app/models/report_metrics.py` (NEW, 60 lines)
   - ConversationMetrics ORM model

2. `app/models/__init__.py` (MODIFIED)
   - Exported ConversationMetrics

3. `app/schemas/report.py` (NEW, 65 lines)
   - Report response schemas

4. `app/services/report_service.py` (NEW, 250 lines)
   - Report aggregation logic

5. `app/api/reports.py` (NEW, 200 lines)
   - 6 API endpoints

6. `app/main.py` (MODIFIED)
   - Registered reports_router

### Frontend Files Created/Modified
1. `frontend/src/services/reportService.ts` (NEW, 200 lines)
   - API communication service

2. `frontend/src/pages/ReportsPage.tsx` (NEW, 850 lines)
   - Main reports interface

3. `frontend/src/App.tsx` (MODIFIED)
   - Added reports route

4. `frontend/src/components/Common/Sidebar.tsx` (MODIFIED)
   - Added Reports menu item

5. `frontend/package.json` (MODIFIED)
   - Added jspdf, jspdf-autotable

## Security & Access Control

### Organization Scoping
All queries are organization-scoped:
```python
.filter(ConversationMetrics.organization_id == org_id)
```

### Role-Based Access
- Reports page requires ADMIN role
- Frontend route protected with ProtectedRoute wrapper
- API endpoints require authentication

### Data Privacy
- No sensitive data in metrics (only IDs and aggregates)
- Lead email included for conversion tracking (GDPR consideration)
- Timestamps for audit trails

## Testing Recommendations

### Backend Testing
```python
# Test report generation with sample data
# Test pagination
# Test filtering by date range
# Test token cost calculation
# Test CSV generation
```

### Frontend Testing
```javascript
// Test filter application
// Test pagination
// Test export functionality
// Test responsive layout
// Test chart rendering
```

## Conclusion

The Reporting Module provides a comprehensive analytics solution for monitoring chatbot performance, token usage, and lead generation. With organized data structures, efficient queries, and user-friendly visualization, organizations can gain actionable insights into their AI bot deployments.

The modular design allows for easy extension with additional metrics and reports as business requirements evolve.
