# Widget Embedding Guide

## Overview
The AI Chatbot Widget is now embeddable as a standalone IIFE (Immediately Invoked Function Expression) that can be placed on any website.

## Installation

### Step 1: Copy the Embed Code
In the Widget Management dashboard, click "Copy Embed Code" for any widget. The code will be copied to your clipboard.

### Step 2: Paste on Your Website
Paste the embed code into the `<head>` or end of `<body>` section of your HTML file.

## Embed Code Structure

The embed code contains three parts:

### 1. CSS Link
```html
<link rel="stylesheet" href="https://your-domain.com/widget/dist/chatbot-widget.css" />
```
This loads the widget styling. Make sure to host the CSS file on your domain or CDN.

### 2. Configuration Script
```html
<script>
  window.AIChatbot = {
    widgetId: 'your-widget-id',
    apiUrl: 'https://your-api-domain.com',
    name: 'AI Assistant',
    welcomeMessage: 'Hi! How can I help you today?',
    primaryColor: '#007bff',
    position: 'bottom-right'
  };
</script>
```

**Configuration Options:**
- `widgetId`: The unique ID for your widget (auto-generated)
- `apiUrl`: The URL of your API server (e.g., `https://api.yourdomain.com`)
- `name`: Display name for the assistant
- `welcomeMessage`: Welcome message shown when chat opens
- `primaryColor`: Hex color for buttons and headers
- `position`: Widget position - `'bottom-right'`, `'bottom-left'`, etc.

### 3. Widget Script
```html
<script src="https://your-domain.com/widget/dist/chatbot-widget.iife.js"></script>
```
This loads and initializes the widget. Make sure the IIFE script file is hosted.

## Important Notes

1. **Configuration Must Come First**: The config script MUST load before the widget IIFE script.
2. **CORS Configuration**: Ensure your API server has CORS enabled for your website domain.
3. **Update URLs**: Replace `https://your-domain.com` and `https://your-api-domain.com` with your actual domain names.

## Hosting the Widget Files

You have several options:

### Option 1: Self-Hosted
Host the built files from `widget/dist/` on your own web server:
- `chatbot-widget.css`
- `chatbot-widget.iife.js`

### Option 2: CDN (AWS S3 + CloudFront)
1. Upload `widget/dist/` files to an S3 bucket
2. Create a CloudFront distribution for the bucket
3. Use CloudFront URL in your embed code

### Option 3: CDN (Cloudflare)
1. Upload files to Cloudflare Workers or use Cloudflare Pages
2. Reference files via Cloudflare URL

## Testing Locally

For local testing, use the included `html_page_test/test_index.html`:
1. Run: `python -m http.server 5500` from the project root
2. Visit: `http://localhost:5500/html_page_test/test_index.html`

## Troubleshooting

### Widget Not Appearing
- Check that CSS file is loaded (look in DevTools Network tab)
- Verify `window.AIChatbot` config is set before the IIFE script loads
- Check browser console for errors

### CORS Errors
- Make sure API server has CORS enabled for your domain
- Check `Access-Control-Allow-Origin` header in API responses

### Chat Not Working
- Verify API URL is correct and accessible
- Check network tab to see if API requests are going through
- Verify `widgetId` matches a widget in your database

## Example Implementation

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
  <link rel="stylesheet" href="https://cdn.example.com/chatbot-widget.css" />
</head>
<body>
  <h1>Welcome to My Website</h1>
  <p>We're here to help!</p>

  <!-- Chat Widget -->
  <script>
    window.AIChatbot = {
      widgetId: 'widget_1769582231293',
      apiUrl: 'https://api.example.com',
      name: 'Support Bot',
      welcomeMessage: 'Hello! How can we assist you?',
      primaryColor: '#0066cc',
      position: 'bottom-right'
    };
  </script>
  <script src="https://cdn.example.com/chatbot-widget.iife.js"></script>
</body>
</html>
```

## Building Updates

To rebuild the widget after making changes:

```bash
cd widget
npm run build
```

This generates:
- `dist/chatbot-widget.iife.js` (142 KB gzipped)
- `dist/chatbot-widget.css` (2.7 KB gzipped)

Then redeploy these files to your hosting.
