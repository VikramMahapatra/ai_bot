const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const getRequiredEnv = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name];
  if (!value || !value.trim()) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }
  return value.trim();
};

const apiUrl = trimTrailingSlash(getRequiredEnv('VITE_API_URL'));
const publicAppUrl = trimTrailingSlash((import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).trim());
const metaWhatsAppEmbeddedSignupUrl = (import.meta.env.VITE_META_WHATSAPP_EMBEDDED_SIGNUP_URL || '').trim();
const metaAppId = (import.meta.env.VITE_META_APP_ID || '').trim();
const metaEmbeddedSignupConfigId = (import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID || '').trim();

export const appEnv = {
  apiUrl,
  publicAppUrl,
  metaWhatsAppEmbeddedSignupUrl,
  metaAppId,
  metaEmbeddedSignupConfigId,
};

export const buildApiUrl = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${appEnv.apiUrl}${normalized}`;
};

export const buildPublicUrl = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${appEnv.publicAppUrl}${normalized}`;
};

export const getMetaWhatsAppEmbeddedSignupUrl = (): string | null => {
  return appEnv.metaWhatsAppEmbeddedSignupUrl || null;
};

export const getMetaAppId = (): string | null => {
  return appEnv.metaAppId || null;
};

export const getMetaEmbeddedSignupConfigId = (): string | null => {
  return appEnv.metaEmbeddedSignupConfigId || null;
};
