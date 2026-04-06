/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_META_WHATSAPP_EMBEDDED_SIGNUP_URL?: string;
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_EMBEDDED_SIGNUP_CONFIG_ID?: string;
  // Company / Billing identity
  readonly VITE_COMPANY_NAME?: string;
  readonly VITE_COMPANY_GSTIN?: string;
  readonly VITE_COMPANY_PAN?: string;
  readonly VITE_COMPANY_CIN?: string;
  readonly VITE_COMPANY_ADDRESS?: string;
  readonly VITE_COMPANY_CITY?: string;
  readonly VITE_COMPANY_PHONE?: string;
  readonly VITE_COMPANY_EMAIL?: string;
  readonly VITE_COMPANY_WEBSITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
