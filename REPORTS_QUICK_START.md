# Reports Module - Quick Start Guide

## Accessing the Reports Page

1. **Login** to the Zentrixel AI Bot application with an admin account
2. **Navigate** to the Reports page via the sidebar menu
   - Icon: 📋 Assignment
   - Location: Left sidebar, between "Analytics" and "Widget Management"
3. **Reports page** loads with default summary data for the current organization

## Using the Reports Interface

### 1. Summary Tab (Default)
Shows key performance indicators as metric cards:

- **Total Conversations**: Number of chat sessions
- **Total Messages**: All messages across conversations
- **Total Tokens**: Complete token consumption
- **Avg Tokens/Conversation**: Average efficiency metric
- **Total Leads**: Leads captured from chats
- **Avg Satisfaction**: User rating average (1-5 scale)
- **Duration**: Average conversation length in seconds

### 2. Conversations Tab
Detailed view of individual conversation metrics:

**Features**:
- Sortable table with 7 columns
- Pagination (10 rows/page by default)
- Session ID, message count, tokens, response time, satisfaction, lead status, date

**How to use**:
1. Click column headers to sort
2. Select rows per page: 5, 10, 25, or 50
3. Navigate pages with pagination controls
4. Truncated session IDs are full identifiers for tracking

### 3. Token Usage Tab
Token consumption analysis and cost estimation:

**Metrics**:
- Total Tokens: Overall consumption
- Prompt Tokens: User input tokens
- Completion Tokens: AI response tokens
- Average/Conversation: Efficiency measure
- Estimated Cost: Dollar amount (GPT-4 pricing)
- Distribution Pie Chart: Visual token breakdown

**Pricing Used**:
- Prompt tokens: $0.03 per 1,000 tokens
- Completion tokens: $0.06 per 1,000 tokens

### 4. Lead Analytics Tab
Lead generation and conversion metrics:

**Data Points**:
- Total Leads: Count of captured leads
- Leads with Email: Valid email addresses
- Conversion Rate: (Leads / Conversations) × 100
- By Widget: Which widgets generate leads
- By Date: 7-day rolling trend

### 5. Daily Stats Tab
30-day historical aggregation:

**Charts & Data**:
1. **Daily Conversations**: Line chart showing trend
2. **Messages & Tokens**: Dual-axis bar chart
3. **Leads Captured**: Daily lead trend
4. **Detailed Table**: Full statistics by date

**Use Case**: Monitor performance trends over time

## Filtering Data

### Available Filters
1. **Start Date**: Beginning of report range
2. **End Date**: End of report range
3. **Widget ID**: Filter by specific widget (optional)

### How to Filter
1. Enter date range (YYYY-MM-DD format)
2. Enter widget ID if desired
3. Click "Apply Filters"
4. Data refreshes automatically with new parameters

**Note**: Filters apply to all tabs simultaneously

## Exporting Reports

### Export to CSV
- **Button**: "Export CSV"
- **Format**: Comma-separated values
- **Columns**: 14 columns with all metrics
- **Use Case**: Excel analysis, external reporting

**Download includes**:
- Session ID, widget, messages, tokens, costs
- Response times, duration, satisfaction
- Lead information and dates

### Export to PDF
- **Button**: "Export PDF"
- **Format**: Professional PDF document
- **Sections**:
  1. Title and summary metrics table
  2. Detailed conversation table (first 50 records)
  3. Page numbers and footer

**Use Case**: Stakeholder presentations, archival

### Print
- **Button**: "Print"
- **Action**: Opens browser print dialog
- **Optimized**: CSS print styles for readability

**Use Case**: Quick physical copies, team meetings

## Interpretation Guide

### Conversation Metrics
- **High token count**: Complex queries, longer responses
- **Low satisfaction**: Review response quality
- **High response time**: Performance issues or complex queries
- **High message count**: Extended conversations

### Lead Conversion
- **Conversion rate < 10%**: Review lead capture mechanism
- **High email capture**: Good data collection
- **Widget comparison**: Identify best performing widgets
- **Date trends**: Seasonal patterns or campaign impact

### Token Efficiency
- **Cost trending up**: Monitor usage patterns
- **Prompt vs Completion ratio**: Indicates question complexity
- **Per-conversation variance**: Shows usage patterns

### Daily Trends
- **Conversation spikes**: Marketing campaign impact or feature change
- **Consistent metrics**: Stable performance
- **Token growth**: Increasing conversation complexity

## Common Use Cases

### 1. Monitor Daily Operations
1. Open Reports page
2. Check Summary tab
3. Look at Daily Stats tab trends
4. Note any anomalies

**Frequency**: Daily or weekly

### 2. Budget Planning
1. Go to Token Usage tab
2. Review cost estimate
3. Note monthly projection based on current usage
4. Set alerts if exceeding budget

**Frequency**: Monthly

### 3. Widget Performance Comparison
1. Filter by different Widget IDs
2. Compare metrics across widget filters
3. Note conversation, message, and lead differences
4. Identify high-performing widgets

**Frequency**: Quarterly review

### 4. Lead Quality Analysis
1. Go to Lead Analytics tab
2. Check conversion rate trends
3. Analyze leads by widget
4. Identify high-converting widgets

**Frequency**: Bi-weekly

### 5. Generate Stakeholder Reports
1. Apply desired filters
2. Click "Export PDF"
3. Share with stakeholders
4. Include summary context

**Frequency**: Monthly/quarterly

### 6. Detailed Investigation
1. Go to Conversations tab
2. Sort by metric of interest
3. Review specific conversation patterns
4. Identify outliers or issues

**Frequency**: As needed

## Tips & Best Practices

### For Optimal Performance
- Use date ranges for large datasets (avoid all-time queries)
- Combine widget filtering for focused analysis
- Export periodically for historical comparison

### For Better Insights
- Track metrics weekly to identify trends
- Compare period-over-period results
- Monitor both efficiency (tokens) and effectiveness (leads)
- Review satisfaction ratings regularly

### For Data Accuracy
- Reports update in real-time as conversations complete
- ConversationMetrics table syncs with chat data
- All metrics are organization-scoped (multi-tenant safe)
- Lead information includes only captured leads with data

## Troubleshooting

### No Data Showing
1. Check if conversations exist in system
2. Verify date range includes conversations
3. Try removing widget filter
4. Check organization access

### Incorrect Metrics
1. Ensure ConversationMetrics table is populated
2. Verify sync_conversation_metrics has run
3. Check timestamps are in UTC
4. Confirm organization_id is correct

### Export Issues
- **CSV**: Check browser download settings
- **PDF**: Ensure sufficient data (>0 records)
- **Print**: Try different browser print options

### Performance Issues
- Use smaller date ranges
- Filter by widget to reduce data volume
- Try different pagination settings
- Clear browser cache if slow

## Keyboard Shortcuts
- **Ctrl+P**: Print (browser standard)
- **Tab**: Navigate between UI elements
- **Enter**: Apply filters
- **Escape**: Close any dialogs

## Data Retention

### Storage
- Metrics stored indefinitely in ConversationMetrics table
- Historical data preserved for year-over-year analysis
- Organization-scoped to prevent cross-org data leaks

### Backups
- Recommend regular database backups
- Exported CSVs serve as manual backups
- Archives for audit trail compliance

## Contact & Support

For issues or enhancements:
1. Check implementation documentation: `REPORTS_MODULE_IMPLEMENTATION.md`
2. Review backend code: `app/api/reports.py`
3. Check frontend code: `frontend/src/pages/ReportsPage.tsx`
4. File bug report with specific metrics and date range

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Production Ready
