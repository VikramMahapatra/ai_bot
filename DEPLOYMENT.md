# Deployment Guide

This guide covers deploying the AI Chatbot Platform to production.

## Prerequisites

- Server with Python 3.9+ and Node.js 18+
- Domain name
- SSL certificate
- OpenAI API key

## Backend Deployment

### Option 1: Using Docker (Recommended)

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data/chroma data/uploads data/exports

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
cd backend
docker build -t ai-chatbot-backend .
docker run -d -p 8000:8000 --env-file .env ai-chatbot-backend
```

### Option 2: Using systemd

Create `/etc/systemd/system/chatbot-backend.service`:

```ini
[Unit]
Description=AI Chatbot Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ai_bot/backend
Environment="PATH=/var/www/ai_bot/backend/venv/bin"
ExecStart=/var/www/ai_bot/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable chatbot-backend
sudo systemctl start chatbot-backend
```

### Option 3: Using Gunicorn

```bash
cd backend
source venv/bin/activate
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

## Frontend Deployment

### Build the frontend

```bash
cd frontend
npm run build
```

### Serve with Nginx

Create `/etc/nginx/sites-available/chatbot`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/ai_bot/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Add SSL with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com
```

## Widget Deployment

### Build the widget

```bash
cd widget
npm run build
```

### Upload to CDN

Upload `dist/chatbot-widget.iife.js` and `dist/chatbot-widget.css` to your CDN (e.g., AWS S3, Cloudflare, etc.)

### Update integration code

```html
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

## Environment Variables (Production)

Update `.env` files with production values:

### Backend
```env
OPENAI_API_KEY=your-production-api-key
DATABASE_URL=sqlite:///./chatbot.db
CHROMA_PERSIST_DIR=./data/chroma
UPLOAD_DIR=./data/uploads
EXPORT_DIR=./data/exports
JWT_SECRET=use-a-strong-random-secret-here
JWT_ALGORITHM=HS256
CORS_ORIGINS=https://your-domain.com
```

### Frontend
```env
VITE_API_URL=https://your-api-domain.com
```

## Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Change JWT_SECRET to a strong random value
- [ ] Enable rate limiting on API endpoints
- [ ] Set up firewall rules
- [ ] Keep dependencies updated
- [ ] Use environment variables for all secrets
- [ ] Enable CORS only for your domains
- [ ] Set up monitoring and logging
- [ ] Regular backups of database and ChromaDB data
- [ ] Implement API key rotation

## Monitoring

### Backend Logs
```bash
# systemd
sudo journalctl -u chatbot-backend -f

# Docker
docker logs -f <container-id>
```

### Nginx Logs
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Backup

### Database
```bash
cp backend/chatbot.db backend/chatbot.db.backup
```

### ChromaDB
```bash
tar -czf chroma-backup.tar.gz backend/data/chroma
```

## Scaling

For high traffic:
- Use PostgreSQL instead of SQLite
- Use Redis for session management
- Deploy multiple backend instances behind a load balancer
- Use a managed vector database (e.g., Pinecone, Weaviate)
- Use a CDN for static assets
- Implement caching (Redis/Memcached)

## Troubleshooting

### Backend won't start
- Check logs: `journalctl -u chatbot-backend`
- Verify environment variables
- Check file permissions
- Ensure port 8000 is available

### Frontend shows blank page
- Check browser console for errors
- Verify API URL in .env
- Check Nginx configuration
- Verify CORS settings

### Widget not loading
- Check CDN URL is accessible
- Verify CORS headers
- Check browser console for errors
- Verify widget configuration

## Support

For deployment issues, open an issue on GitHub with:
- Deployment method (Docker, systemd, etc.)
- Error messages/logs
- Server configuration details
