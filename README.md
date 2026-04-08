# Zentrixel AI Bot

A full-stack AI chatbot platform with multi-tenant architecture, RBAC, and embeddable widget for external websites.

## 🚀 Quick Start
Super Admin: http://localhost:5173/superadmin/login


### Clone the Repository
```bash
git clone https://github.com/VikramMahapatra/ai_bot.git
cd ai_bot
```

### Setup & Installation

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
py -3.12 -m venv venv
# Windows
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass                                    
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
```

#### 3. Widget Setup
```bash
cd widget
npm install
npm run build
```

### Running the Application

#### Start Backend (FastAPI)
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
Backend runs on: **http://localhost:8000**
pip install psycopg2-binary==2.9.9

#### Start Frontend (React)
```bash
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass                                    
cd frontend
npm run dev
```
Frontend runs on: **http://localhost:5173**

#### Start Widget Dev Server
```bash
cd widget
npm run dev
```
Widget runs on: **http://localhost:5175**

#### Test Widget Embed
```bash
cd root
python -m http.server 5500
```
Visit: **http://localhost:5500/html_page_test/test_index.html**

## 📋 Project Structure

```
ai_bot/
├── backend/              # FastAPI server
├── frontend/             # React dashboard
├── widget/               # Embeddable chatbot widget
├── html_page_test/       # Widget embed demo page
├── docs/                 # Documentation
└── setup.sh              # Installation script
```

## 🎯 Key Features

✅ **Multi-tenant Architecture** - Organization & Widget scoping  
✅ **RBAC** - Role-based access control  
✅ **Embeddable Widget** - IIFE script for external websites  
✅ **AI Chat** - RAG-based chatbot with ChromaDB  
✅ **Lead Capture** - Collect leads through chat  
✅ **Admin Dashboard** - Manage widgets and organizations  

## 📚 Documentation

For detailed information, see the `docs/` folder:
- `docs/README_RBAC.md` - Role-based access control guide
- `docs/WIDGET_EMBED_GUIDE.md` - Widget embedding guide
- `docs/DEPLOYMENT.md` - Production deployment
- `docs/WIDGET_SCOPING_COMPLETE.md` - Widget architecture details

## 🔧 Environment Variables

Create `.env` files in backend and frontend folders:

**Backend `.env`:**
```
DATABASE_URL=sqlite:///./app.db
OPENAI_API_KEY=your_key_here
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174
```

**Frontend `.env`:**
```
VITE_API_URL=http://localhost:8000
```

## 🚀 API Endpoints

- `POST /api/chat` - Chat with AI
- `GET/POST /api/widgets` - Widget management
- `GET/POST /api/leads` - Lead management
- `GET /api/admin/users` - User management (admin)

See `docs/API_REFERENCE.md` for full API documentation.

## 📦 Built With

- **Backend:** FastAPI, SQLAlchemy, ChromaDB
- **Frontend:** React, TypeScript, Material-UI
- **Widget:** React, TypeScript, Vite
- **Database:** SQLite

## 📝 License

This project is part of Zentrixel AI.

## 🤝 Support

For issues or questions, check the documentation in `docs/` or create an issue.

---

**Last Updated:** February 3, 2026
