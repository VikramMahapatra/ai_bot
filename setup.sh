#!/bin/bash

# AI Chatbot Platform - Quick Start Script
# This script helps you set up and run the entire platform

set -e

echo "🤖 AI Chatbot Platform - Quick Start"
echo "===================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Setup Backend
echo "🔧 Setting up Backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing backend dependencies..."
pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your OpenAI API key!"
fi

echo "✅ Backend setup complete"
echo ""

# Setup Frontend
echo "🔧 Setting up Frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "✅ Frontend setup complete"
echo ""

# Setup Widget
echo "🔧 Setting up Widget..."
cd ../widget

if [ ! -d "node_modules" ]; then
    echo "Installing widget dependencies..."
    npm install
fi

echo "✅ Widget setup complete"
echo ""

# Instructions
echo "🎉 Setup Complete!"
echo ""
echo "To start the platform, run these commands in separate terminals:"
echo ""
echo "1️⃣  Backend (Terminal 1):"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "2️⃣  Frontend (Terminal 2):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3️⃣  Widget (Terminal 3) - Optional:"
echo "   cd widget"
echo "   npm run dev"
echo ""
echo "📱 Access Points:"
echo "   - Backend API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo "   - Frontend: http://localhost:5173"
echo "   - Widget Demo: http://localhost:5174"
echo ""
echo "📚 First Steps:"
echo "   1. Go to http://localhost:5173"
echo "   2. Register an admin account"
echo "   3. Add knowledge sources (crawl a website or upload documents)"
echo "   4. Start chatting!"
echo ""
