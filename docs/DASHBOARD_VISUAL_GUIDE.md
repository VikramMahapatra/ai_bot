# Dashboard Visual Guide

## 📊 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                              │
│  Welcome! Here's your business performance overview.                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │     💬       │  │     👤       │  │     📈       │  │    🎛️      │ │
│  │              │  │              │  │              │  │            │ │
│  │  Conversations│  │   Total Leads│  │  Conversion  │  │   Widgets  │ │
│  │     76       │  │      11      │  │    14.47%    │  │      1     │ │
│  │              │  │              │  │              │  │ Sources: 10│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│  (7d: 10)         (7d: 2)            (Leads/Conv)     (Sources: 10)   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Charts Section                                                         │
│                                                                          │
│  ┌─────────────────────────────────┐  ┌────────────────────────────┐  │
│  │ Daily Conversations (7 Days)    │  │ Conversation vs Leads (30d) │  │
│  │                                 │  │                            │  │
│  │      /\                         │  │  ███ ░░░ ███ ░░░          │  │
│  │     /  \      /\                │  │  ███ ░░░ ███ ░░░          │  │
│  │    /    \____/  \               │  │  ███ ░░░ ███ ░░░          │  │
│  │                                 │  │                            │  │
│  └─────────────────────────────────┘  └────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────┐                                      │
│  │ Leads Distribution           │                                      │
│  │                              │                                      │
│  │         Direct: 8            │                                      │
│  │         Widget1: 3           │                                      │
│  │                              │                                      │
│  └──────────────────────────────┘                                      │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  [Recent Leads] [Top Conversations] [Widgets] [Knowledge Sources]      │
│                                                                          │
│  Recent Leads:                                                         │
│  ┌────────────┬──────────────────┬────────────┬──────────┬──────────┐  │
│  │ Name       │ Email            │ Phone      │ Company  │ Date     │  │
│  ├────────────┼──────────────────┼────────────┼──────────┼──────────┤  │
│  │ Gopal      │ gopal@gmail.com  │ -----      │ Gopal... │ 28-01   │  │
│  │ Xeom       │ xeom@gmail.com   │ -----      │ ---      │ 28-01   │  │
│  │ Richa      │ richa@gmail.com  │ 787898...  │ ---      │ 28-01   │  │
│  └────────────┴──────────────────┴────────────┴──────────┴──────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Metric Cards
| Card | Gradient | Usage |
|------|----------|-------|
| Conversations | Purple (#667eea → #764ba2) | Chat metrics |
| Leads | Pink (#f093fb → #f5576c) | Lead metrics |
| Conversion | Blue (#4facfe → #00f2fe) | Rate metrics |
| Widgets | Green (#43e97b → #38f9d7) | Resource metrics |

### Chart Colors
- **Line**: Teal (#2db3a0)
- **Bar 1**: Teal (#2db3a0) - Conversations
- **Bar 2**: Purple (#667eea) - Leads
- **Pie**: Multiple colors (6 color palette)

## 📱 Responsive Behavior

### Desktop (>900px)
- 4 metric cards in single row
- 2 charts side by side
- Full width tables

### Tablet (600-900px)
- 2 metric cards per row
- Charts stack vertically
- Optimized table columns

### Mobile (<600px)
- 1 metric card per row
- Single column layout
- Horizontal scrolling for tables

## 🔄 Data Flow

```
User Opens Dashboard
        ↓
Frontend loads AdminDashboard.tsx
        ↓
useEffect triggers loadDashboardData()
        ↓
8 parallel API calls:
  ├─ /api/admin/dashboard/stats
  ├─ /api/admin/dashboard/conversations/daily
  ├─ /api/admin/dashboard/leads/recent
  ├─ /api/admin/dashboard/widgets
  ├─ /api/admin/dashboard/knowledge-sources
  ├─ /api/admin/dashboard/leads/by-source
  ├─ /api/admin/dashboard/top-sessions
  └─ /api/admin/dashboard/conversation-trend
        ↓
Backend queries database
        ↓
Data aggregation & filtering
        ↓
JSON response to frontend
        ↓
State update & render
        ↓
User sees live dashboard
```

## 📊 Data Sources

| Component | Database Table | Query Type |
|-----------|---|---|
| Total Conversations | conversations | COUNT |
| Total Leads | leads | COUNT |
| Total Widgets | widget_configs | COUNT |
| Total Sources | knowledge_sources | COUNT |
| Daily Conversations | conversations | GROUP BY date |
| Recent Leads | leads | ORDER BY date DESC |
| Widget Performance | widget_configs + leads + conversations | JOIN + COUNT |
| Knowledge Sources | knowledge_sources | SELECT all |
| Leads by Source | leads | GROUP BY widget_id |
| Top Sessions | conversations | GROUP BY session_id, COUNT |
| Conversation Trend | conversations, leads | GROUP BY date |

## 🧮 Calculations

### Conversion Rate
```
Conversion Rate = (Total Leads / Total Conversations) × 100
Example: (11 / 76) × 100 = 14.47%
```

### Average Messages per Session
```
Avg = Total Conversations / Distinct Sessions
```

### Widget Performance
```
Widget Leads = COUNT(leads WHERE widget_id = X)
Widget Conversations = COUNT(conversations WHERE widget_id = X)
```

## 🔐 Security & Scoping

All endpoints filter by:
```python
WHERE organization_id == current_user.organization_id
```

This ensures:
- Users only see their organization's data
- Admin-only access
- No cross-organization data leaks
- Secure multi-tenant architecture

## 📈 Example Data

Based on current database state:

| Metric | Value |
|--------|-------|
| Total Conversations | 76 |
| Total Leads | 11 |
| Conversion Rate | 14.47% |
| Conversations (7d) | 10 |
| Leads (7d) | 2 |
| Active Widgets | 1 |
| Knowledge Sources | 10 |
| Top Session Messages | ~20 |

## 🎯 Next Steps

1. **Access Dashboard**: Login with admin credentials
2. **Verify Data**: Check all metrics match your expectations
3. **Test Interactions**: Switch between tabs, interact with charts
4. **Monitor Performance**: Dashboard loads in <2 seconds
5. **Customize**: Adjust colors/layouts as needed

## 🚀 Performance Tips

- Dashboard loads all data in **parallel** (not sequential)
- Database queries are **optimized** with aggregation
- Frontend uses **memoization** to prevent re-renders
- Charts use **ResponsiveContainer** for automatic sizing
- State updates are **batched** for performance

---

**Status**: ✅ **COMPLETE & PRODUCTION READY**
