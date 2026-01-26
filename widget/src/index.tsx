import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './ChatWidget';

// Define the global AIChatbot interface
declare global {
  interface Window {
    AIChatbot?: {
      widgetId: string;
      apiUrl: string;
      name?: string;
      welcomeMessage?: string;
      primaryColor?: string;
      position?: string;
    };
  }
}

// Initialize the widget when the script loads
function initWidget() {
  if (!window.AIChatbot) {
    console.error('AIChatbot configuration not found');
    return;
  }

  const config = window.AIChatbot;

  // Create container for the widget
  const container = document.createElement('div');
  container.id = 'ai-chatbot-widget-root';
  document.body.appendChild(container);

  // Render the widget
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ChatWidget
        widgetId={config.widgetId}
        apiUrl={config.apiUrl}
        name={config.name}
        welcomeMessage={config.welcomeMessage}
        primaryColor={config.primaryColor}
        position={config.position}
      />
    </React.StrictMode>
  );
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}

export { ChatWidget };
