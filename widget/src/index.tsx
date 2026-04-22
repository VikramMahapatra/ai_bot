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
      secondaryColor?: string;
      chatHeaderFontColor?: string;
      position?: string;
      botIcon?: string;
      userIcon?: string;
    };
  }
}

interface WidgetPublicConfig {
  name?: string;
  welcome_message?: string;
  primary_color?: string;
  secondary_color?: string;
  position?: string;
  lead_fields?: string;
}

interface IconSelection {
  botIcon?: string;
  userIcon?: string;
  chatHeaderFontColor?: string;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const loadWidgetConfig = async (apiUrl: string, widgetId: string): Promise<WidgetPublicConfig | null> => {
  try {
    const response = await fetch(`${trimTrailingSlash(apiUrl)}/api/admin/widget/config/${encodeURIComponent(widgetId)}`);
    if (!response.ok) return null;
    return (await response.json()) as WidgetPublicConfig;
  } catch {
    return null;
  }
};

const parseIconSelection = (leadFieldsRaw?: string): IconSelection => {
  if (!leadFieldsRaw) return {};
  try {
    const parsed = JSON.parse(leadFieldsRaw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const botIcon = typeof (parsed as any).bot_icon === 'string' ? (parsed as any).bot_icon : undefined;
    const userIcon = typeof (parsed as any).user_icon === 'string' ? (parsed as any).user_icon : undefined;
    const chatHeaderFontColor =
      typeof (parsed as any).chat_header_font_color === 'string'
        ? (parsed as any).chat_header_font_color
        : undefined;
    return { botIcon, userIcon, chatHeaderFontColor };
  } catch {
    return {};
  }
};

// Initialize the widget when the script loads
async function initWidget() {
  if (!window.AIChatbot) {
    console.error('AIChatbot configuration not found');
    return;
  }

  const config = window.AIChatbot;
  const remoteConfig = await loadWidgetConfig(config.apiUrl, config.widgetId);
  const iconSelection = parseIconSelection(remoteConfig?.lead_fields);

  const globalConfig = (window as any).AIChatbot || {};

  const shopifyUser = globalConfig.user || null;
  const shopifyShop = globalConfig.shop || null;

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
        name={remoteConfig?.name || config.name}
        welcomeMessage={remoteConfig?.welcome_message || config.welcomeMessage}
        primaryColor={remoteConfig?.primary_color || config.primaryColor}
        secondaryColor={remoteConfig?.secondary_color || config.secondaryColor}
        chatHeaderFontColor={config.chatHeaderFontColor || iconSelection.chatHeaderFontColor}
        position={remoteConfig?.position || config.position}
        botIcon={config.botIcon || iconSelection.botIcon}
        userIcon={config.userIcon || iconSelection.userIcon}
        shop={shopifyShop}
        user={shopifyUser}
      />
    </React.StrictMode>
  );
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  console.log('Document loading, attaching DOMContentLoaded listener');
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  console.log('Document already loaded, calling initWidget immediately');
  initWidget();
}

export { ChatWidget };

