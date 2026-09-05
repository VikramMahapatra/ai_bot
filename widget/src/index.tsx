import React from "react";
import ReactDOM from "react-dom/client";
import ChatWidget from "./ChatWidget";

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
      contactFields?: ContactFieldDefinition[];
    };
    __AIChatbotWidgetInitialized?: boolean;
  }
}

interface ContactFieldDefinition {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date";
  required?: boolean;
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

const normalizeContactFieldKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const loadWidgetConfig = async (
  apiUrl: string,
  widgetId: string,
): Promise<WidgetPublicConfig | null> => {
  try {
    const response = await fetch(
      `${trimTrailingSlash(apiUrl)}/api/admin/widget/config/${encodeURIComponent(widgetId)}`,
    );
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
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const botIcon =
      typeof (parsed as any).bot_icon === "string"
        ? (parsed as any).bot_icon
        : undefined;
    const userIcon =
      typeof (parsed as any).user_icon === "string"
        ? (parsed as any).user_icon
        : undefined;
    const chatHeaderFontColor =
      typeof (parsed as any).chat_header_font_color === "string"
        ? (parsed as any).chat_header_font_color
        : undefined;
    return { botIcon, userIcon, chatHeaderFontColor };
  } catch {
    return {};
  }
};

const parseContactFields = (leadFieldsRaw?: string): ContactFieldDefinition[] => {
  if (!leadFieldsRaw) return [];
  try {
    const parsed = JSON.parse(leadFieldsRaw);
    const fields = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as any).fields : undefined;
    if (!Array.isArray(fields)) return [];
    return fields
      .map((field: any): ContactFieldDefinition | null => {
        const label = typeof field?.label === "string" ? field.label.trim() : "";
        const key = normalizeContactFieldKey(typeof field?.key === "string" ? field.key : label);
        const type = ["text", "email", "tel", "number", "date"].includes(field?.type) ? field.type : "text";
        if (!label || !key) return null;
        return { key, label, type, required: Boolean(field?.required) };
      })
      .filter((field): field is ContactFieldDefinition => Boolean(field));
  } catch {
    return [];
  }
};

const WIDGET_ROOT_ID = "ai-chatbot-widget-root";

// Initialize the widget when the script loads
async function initWidget() {
  if (!window.AIChatbot) {
    console.error("AIChatbot configuration not found");
    return;
  }

  // Already mounted (script included twice, HMR, or re-init)
  if (
    window.__AIChatbotWidgetInitialized ||
    document.getElementById(WIDGET_ROOT_ID)
  ) {
    return;
  }
  window.__AIChatbotWidgetInitialized = true;

  const config = window.AIChatbot;
  const remoteConfig = await loadWidgetConfig(config.apiUrl, config.widgetId);
  const iconSelection = parseIconSelection(remoteConfig?.lead_fields);
  const remoteContactFields = parseContactFields(remoteConfig?.lead_fields);

  const globalConfig = (window as any).AIChatbot || {};

  const shopifyUser = globalConfig.user || null;
  const shopifyShop = globalConfig.shop || null;

  // Re-check after await in case another init finished first
  if (document.getElementById(WIDGET_ROOT_ID)) {
    return;
  }

  const container = document.createElement("div");
  container.id = WIDGET_ROOT_ID;
  document.body.appendChild(container);

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
        chatHeaderFontColor={
          config.chatHeaderFontColor || iconSelection.chatHeaderFontColor
        }
        position={remoteConfig?.position || config.position}
        botIcon={config.botIcon || iconSelection.botIcon}
        userIcon={config.userIcon || iconSelection.userIcon}
        contactFields={config.contactFields || remoteContactFields}
        shop={shopifyShop}
        user={shopifyUser}
      />
    </React.StrictMode>,
  );
}

// Wait for DOM to be ready (idempotent listener)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidget, { once: true });
} else {
  initWidget();
}

export { ChatWidget };
