/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_META_WHATSAPP_EMBEDDED_SIGNUP_URL?: string;
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_EMBEDDED_SIGNUP_CONFIG_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
