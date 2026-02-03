# Source Attribution Implementation

## Overview
Added embedding source attribution to chat responses. Users can now see which knowledge sources (documents/websites) were used by the AI to generate responses through a collapsible sources section.

## Changes Made

### Backend

#### 1. **`backend/app/services/chat_service.py`** - Enhanced Response Tracking
- **Modified Function**: `generate_chat_response()` 
- **New Return Type**: `Tuple[str, List[Dict]]` (was: `str`)
- **Changes**:
  - Extracts `source_id` from ChromaDB query metadata
  - Queries `KnowledgeSource` table to fetch source details (name, type, URL)
  - Returns tuple of (response_text, sources_list)
  - Sources are filtered by organization_id for security
  - **Return Format**:
    ```python
    (
      "AI response text...",
      [
        {
          "id": 1,
          "name": "Website Name",
          "type": "WEB",
          "url": "https://example.com"
        },
        ...
      ]
    )
    ```

#### 2. **`backend/app/schemas/chat.py`** - New Schema Models
- **New Model**: `SourceInfo`
  ```python
  id: int
  name: str
  type: str  # WEB, PDF, DOCX, XLSX
  url: Optional[str]
  ```
- **Updated Model**: `ChatResponse`
  - Added field: `sources: List[SourceInfo] = []`
  - Now returns source information alongside response

#### 3. **`backend/app/api/chat.py`** - API Endpoint Update
- **Modified Endpoint**: `POST /api/chat`
- **Changes**:
  - Unpacks tuple from `generate_chat_response()`
  - Passes sources to `ChatResponse` model
  - Response now includes sources array

### Frontend

#### 1. **`frontend/src/types/index.ts`** - Type Definitions
- **New Interface**: `SourceInfo`
  ```typescript
  id: number;
  name: string;
  type: string;
  url?: string;
  ```
- **Updated Interface**: `ChatResponse`
  - Added field: `sources?: SourceInfo[]`

#### 2. **`frontend/src/components/Chat/ChatInterface.tsx`** - UI Implementation
- **New Interface**: `Message` with `sources` field
- **New State**: `expandedSources` - Set tracking which message sources are expanded
- **Updated Message Rendering**:
  - Messages now include sources from API response
  - Added collapsible Sources section for assistant messages
  
- **Sources Display Features**:
  - **Collapsed State**:
    - Button shows "Sources (n)" with info icon
    - Expand button with animated chevron icon
    - Styled in teal (#2db3a0) to match AI theme
  
  - **Expanded State**:
    - Light background panel (#f8fafb)
    - Each source shown in separate card
    - Source details displayed:
      - Source name (bold)
      - Type badge (WEB, PDF, DOCX, XLSX)
      - URL hostname as clickable link (for web sources)
    - URLs open in new tab
  
  - **Styling**:
    - Smooth expand/collapse animation
    - Source type badges with teal background
    - Hover effects on expand button
    - Professional spacing and borders

## Data Flow

```
User Message
    ↓
ChatInterface → chatService.sendMessage()
    ↓
Backend API /api/chat
    ↓
chat_service.generate_chat_response()
    ├─ Query ChromaDB (with org_id filter)
    ├─ Extract source_ids from metadata
    ├─ Query KnowledgeSource table
    ├─ Generate AI response
    └─ Return (response_text, sources_list)
    ↓
ChatResponse (with sources)
    ↓
ChatInterface Updates
    ├─ Display response with markdown
    └─ Show collapsible Sources button
```

## Security Considerations

✅ **Organization Scoping**: Sources are filtered by `organization_id` in the database query
✅ **Source Validation**: Only sources owned by the same organization are returned
✅ **Cross-Organization Protection**: Users cannot see sources from other organizations

## User Experience

1. **Default State**: Sources button collapsed, doesn't distract from main response
2. **One Click**: Users can expand to see sources with single click
3. **Clear Attribution**: Shows exactly which documents/websites informed the answer
4. **Transparency**: Helps users verify information and understand reasoning
5. **Trust**: Demonstrates AI isn't making things up - it's based on provided knowledge

## Technical Notes

### ChromaDB Integration
- Metadata structure includes `source_id` from document ingestion
- Query results include metadata array with source information
- Multiple chunks from same source are deduplicated (using `set()`)

### Performance
- Sources query is efficient: lookup by IDs only, filtered by org
- No additional API calls needed (sources returned with response)
- Minimal payload increase (source IDs, names, types)

### Backward Compatibility
- `sources` field is optional in ChatResponse (defaults to empty list)
- Existing clients will work even if they ignore sources field
- Frontend gracefully handles missing sources data

## Testing the Feature

1. **Add Knowledge Sources** via Knowledge Management page
2. **Ask a Question** that uses those sources
3. **Expand Sources** button to see attribution
4. **Click URLs** to verify source information
5. **Multi-Source Responses** show multiple sources when available

## Future Enhancements

- Add confidence/relevance scores from ChromaDB
- Show snippet/preview of relevant text from source
- Add filters to search/export based on sources
- Highlight how confidence affects response
- Track source usage analytics
