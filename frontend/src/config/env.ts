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

export const appEnv = {
  apiUrl,
  publicAppUrl,
  metaWhatsAppEmbeddedSignupUrl,
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
