# AI Chatbot Platform

A complete AI-powered chatbot platform with RAG (Retrieval Augmented Generation) capabilities, admin portal, and embeddable widget.

## Features

### Backend (FastAPI)
- **Knowledge Management**: Crawl websites and upload documents (PDF, DOCX, XLSX)
- **RAG-Based Chat**: AI responses powered by OpenAI with context from your knowledge base
- **Vector Storage**: ChromaDB for efficient semantic search
- **Lead Capture**: Automatic lead capture based on conversation triggers
- **JWT Authentication**: Secure admin access
- **RESTful API**: Well-documented endpoints

### Frontend (React + TypeScript)
- **Admin Portal**: 
  - Knowledge source management (web crawling, document upload)
  - Lead management with CSV export
  - Widget configuration
- **Chat Interface**: Clean, modern chat UI with session management
- **Responsive Design**: Works on desktop and mobile

### Embeddable Widget
- **Easy Integration**: Single script tag to add chatbot to any website
- **Customizable**: Configure colors, position, welcome message
- **Lightweight**: Minimal impact on host website performance

## Tech Stack

### Backend
- Python 3.9+
- FastAPI
- SQLAlchemy + SQLite
- ChromaDB
- OpenAI API
- BeautifulSoup4 (web scraping)
- PyPDF2, python-docx, openpyxl (document parsing)

### Frontend
- React 18
- TypeScript
- Material-UI
- Vite
- Axios

### Widget
- React 18
- TypeScript
- Vite (library mode)

## Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher
- OpenAI API key

## Installation

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 3. Widget Setup

```bash
cd widget

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Usage

### First Time Setup

1. **Start the backend server** (port 8000)
2. **Create an admin account**:
   - Go to `http://localhost:5173`
   - Click "Register" tab
   - Create an admin account

3. **Add Knowledge Sources**:
   - Login to admin portal
   - Go to "Knowledge Management" tab
   - Either:
     - Enter a website URL to crawl
     - Upload documents (PDF, DOCX, XLSX)

4. **Test the Chat**:
   - Go to "Chat" page
   - Ask questions based on your knowledge sources

### API Endpoints

#### Authentication
- `POST /api/admin/register` - Register new user
- `POST /api/admin/login` - Login and get JWT token

#### Knowledge Management (Admin Only)
- `POST /api/admin/knowledge/crawl` - Crawl website
- `POST /api/admin/knowledge/upload` - Upload document
- `GET /api/admin/knowledge/sources` - List all sources
- `DELETE /api/admin/knowledge/sources/{id}` - Delete source

#### Chat (Public)
- `POST /api/chat` - Send message and get AI response
- `GET /api/chat/history/{session_id}` - Get conversation history
- `GET /api/chat/should-capture-lead/{session_id}` - Check if lead should be captured

#### Leads (Admin Only)
- `POST /api/admin/leads` - Create lead
- `GET /api/admin/leads` - List all leads
- `GET /api/admin/leads/export` - Export leads to CSV

#### Widget Configuration (Admin Only)
- `POST /api/admin/widget/config` - Create widget config
- `GET /api/admin/widget/config/{widget_id}` - Get widget config
- `PUT /api/admin/widget/config/{widget_id}` - Update widget config

### Embedding the Widget

After building the widget, add this to your website:

```html
<!-- Add before closing </body> tag -->
<script>
  (function() {
    window.AIChatbot = {
      widgetId: 'your-widget-id',
      apiUrl: 'https://your-api-domain.com',
      name: 'AI Assistant',
      welcomeMessage: 'Hi! How can I help you?',
      primaryColor: '#007bff',
      position: 'bottom-right'
    };
    var script = document.createElement('script');
    script.src = 'https://your-cdn.com/chatbot-widget.iife.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
```

## Project Structure

```
ai_bot/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utility functions
│   ├── data/             # Data storage (gitignored)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── context/      # React contexts
│   │   └── types/        # TypeScript types
│   └── package.json
└── widget/
    ├── src/
    │   ├── ChatWidget.tsx
    │   ├── api.ts
    │   └── styles.css
    └── package.json
```

## Environment Variables

### Backend (.env)
```
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=sqlite:///./chatbot.db
CHROMA_PERSIST_DIR=./data/chroma
UPLOAD_DIR=./data/uploads
EXPORT_DIR=./data/exports
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

## Development

### Running Tests
```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Building for Production

#### Backend
```bash
cd backend
# Use gunicorn or similar WSGI server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

#### Frontend
```bash
cd frontend
npm run build
# Serve the dist/ folder with nginx or similar
```

#### Widget
```bash
cd widget
npm run build
# Upload dist/chatbot-widget.iife.js to your CDN
```

## Security Considerations

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Change JWT_SECRET** in production
3. **Use HTTPS** in production
4. **Implement rate limiting** for API endpoints
5. **Validate and sanitize** all user inputs
6. **Keep dependencies updated** regularly

## Troubleshooting

### Backend won't start
- Check if Python virtual environment is activated
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check if port 8000 is already in use

### Frontend can't connect to backend
- Verify backend is running on port 8000
- Check CORS settings in backend `.env`
- Check `VITE_API_URL` in frontend `.env`

### ChromaDB errors
- Delete `data/chroma` folder and restart backend
- Ensure sufficient disk space

### OpenAI API errors
- Verify API key is correct
- Check API key has sufficient credits
- Ensure no rate limiting

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.