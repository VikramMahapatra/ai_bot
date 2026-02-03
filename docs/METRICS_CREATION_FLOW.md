# Conversation Metrics Creation Flow

## Overview
The `conversation_metrics` table is automatically populated with metrics data when conversations are created or updated.

## When Entries Are Created

### 1. **Automatic Sync on New Conversation Message** ✅
When a user sends a message and the AI generates a response:

```
Flow:
User Message → Chat API (/api/chat)
    ↓
generate_chat_response() in chat_service.py
    ↓
Create Conversation record (stores message + response)
    ↓
db.add(conversation)
db.flush()  # Get conversation ID
    ↓
sync_conversation_metrics(db, conversation.id, org_id, session_id)
    ↓
Check if metrics exist for this conversation_id
    - If YES: Update existing metrics
    - If NO: Create new ConversationMetrics record
    ↓
db.commit()
    ↓
Conversation saved with corresponding metrics
```

**When:** Immediately after each AI chat response
**Where:** `backend/app/services/chat_service.py` → `generate_chat_response()` function

### 2. **Backfill for Existing Conversations** (Manual)
For existing conversations before this update was implemented:

```
Run: python backend/backfill_conversation_metrics.py
    ↓
Reads all Conversation records
    ↓
Groups by session_id (represents a conversation)
    ↓
Calculates metrics from message data
    ↓
Creates ConversationMetrics records in bulk
```

**When:** Manual execution (already done once)
**Where:** `backend/backfill_conversation_metrics.py`

## Metrics Fields Tracked

When a metrics entry is created, the following fields are set:

| Field | Source | Updated When |
|-------|--------|--------------|
| `conversation_id` | Conversation table ID | New conversation created |
| `session_id` | From chat request | New conversation created |
| `organization_id` | From user/widget config | New conversation created |
| `widget_id` | From chat request | New conversation created |
| `user_id` | From widget config | New conversation created |
| `total_messages` | Count of messages in session | Each message (recalculated) |
| `total_tokens` | Estimated from message length | Each message (recalculated) |
| `prompt_tokens` | User message tokens | Each message (recalculated) |
| `completion_tokens` | AI response tokens | Each message (recalculated) |
| `conversation_start` | First message timestamp | New conversation created |
| `conversation_end` | Last message timestamp | Each message updates |
| `conversation_duration` | End - Start | Each message updates |
| `average_response_time` | Time between user/AI messages | Each message updates |
| `has_lead` | Check if lead exists for session | When lead captured |
| `lead_name` | From Lead table | When lead captured |
| `lead_email` | From Lead table | When lead captured |
| `lead_company` | From Lead table | When lead captured |
| `user_satisfaction` | From feedback (if available) | When feedback added |
| `created_at` | Timestamp | When metrics first created |
| `updated_at` | Timestamp | When metrics updated |

## How to Verify

### Check Current Metrics Count
```bash
cd backend
python -c "
from app.database import SessionLocal
from app.models import ConversationMetrics

db = SessionLocal()
count = db.query(ConversationMetrics).count()
print(f'Total metrics records: {count}')
db.close()
"
```

### Check Metrics for Specific Session
```bash
python -c "
from app.database import SessionLocal
from app.models import ConversationMetrics

db = SessionLocal()
metrics = db.query(ConversationMetrics).filter(
    ConversationMetrics.session_id == 'your_session_id'
).first()

if metrics:
    print(f'Session: {metrics.session_id}')
    print(f'Messages: {metrics.total_messages}')
    print(f'Tokens: {metrics.total_tokens}')
    print(f'Duration: {metrics.conversation_duration}s')
else:
    print('No metrics found for this session')
    
db.close()
"
```

### Check if New Conversations Are Creating Metrics
1. Start a new chat conversation on the widget
2. Send a message
3. Check database:
```bash
python -c "
from app.database import SessionLocal
from app.models import ConversationMetrics, Conversation
from datetime import datetime, timedelta

db = SessionLocal()

# Get metrics created in the last 5 minutes
recent = db.query(ConversationMetrics).filter(
    ConversationMetrics.created_at >= datetime.utcnow() - timedelta(minutes=5)
).all()

print(f'Recent metrics (last 5 mins): {len(recent)}')
for m in recent:
    print(f'  - Session: {m.session_id}, Messages: {m.total_messages}')

db.close()
"
```

## Implementation Details

### Key Function: `sync_conversation_metrics()`
Location: `backend/app/services/report_service.py`

```python
def sync_conversation_metrics(
    db: Session,
    conversation_id: int,
    organization_id: int,
    session_id: str,
):
    """Sync metrics from conversation record to metrics table"""
    # 1. Find existing metrics or create new
    # 2. Update lead info if available
    # 3. Commit changes to database
```

### Integration Point
Location: `backend/app/services/chat_service.py` → `generate_chat_response()`

```python
# After saving conversation:
db.add(conversation)
db.flush()  # Get the conversation ID

# Sync metrics for this conversation
sync_conversation_metrics(db, conversation.id, organization_id, session_id)
db.commit()
```

## Future Enhancements

1. **Token Counting**: Replace character estimation with actual token counts from OpenAI
   ```python
   # Use OpenAI's token counter
   from tiktoken import get_encoding
   encoding = get_encoding("cl100k_base")
   tokens = len(encoding.encode(message))
   ```

2. **Real-time Updates**: Update metrics fields as conversation progresses
   - Update `total_messages` each time a message is added
   - Update `conversation_duration` for ongoing conversations
   - Calculate `average_response_time` accurately

3. **Metrics Aggregation**: Pre-compute daily/weekly summaries for faster reporting

4. **Data Cleanup**: Archive old metrics for performance optimization

## Troubleshooting

### Metrics Not Appearing After Chat
- Check that conversation was saved to database
- Verify `organization_id` is set correctly
- Check database logs for errors in `sync_conversation_metrics()`
- Manually run backfill script if needed

### Metrics Duplicates
- Check for multiple conversation records with same `session_id`
- Verify unique constraint on `conversation_id`
- Check for race conditions if multiple requests with same session

### Reports Showing No Data
- Verify `organization_id` matches user's organization
- Check date filters are correct
- Ensure metrics exist for selected date range
- See "Verify Current Metrics Count" above
