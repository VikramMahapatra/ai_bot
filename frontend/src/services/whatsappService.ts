import api from './api';

export interface WhatsAppConfig {
  configured: boolean;
  id?: number;
  widget_id?: string;
  phone_number_id?: string;
  waba_id?: string | null;
  business_phone_number?: string | null;
  is_active?: boolean;
}

export interface WhatsAppConfigPayload {
  widget_id: string;
  phone_number_id: string;
  waba_id?: string;
  access_token: string;
  verify_token: string;
  business_phone_number?: string;
  is_active?: boolean;
}

export interface WhatsAppEmbeddedExchangePayload {
  code: string;
  redirect_uri?: string;
  widget_id?: string;
  verify_token?: string;
  business_phone_number?: string;
  is_active?: boolean;
  auto_save?: boolean;
}

export interface WhatsAppEmbeddedExchangeResponse {
  message: string;
  saved: boolean;
  id?: number;
  widget_id?: string;
  is_active?: boolean;
  waba_id?: string | null;
  phone_number_id?: string | null;
  business_phone_number?: string | null;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export const whatsappService = {
  async getConfig(): Promise<WhatsAppConfig> {
    const response = await api.get('/api/admin/whatsapp/config');
    return response.data;
  },

  async saveConfig(payload: WhatsAppConfigPayload) {
    const response = await api.put('/api/admin/whatsapp/config', payload);
    return response.data;
  },

  async sendTestMessage(payload: { to_number: string; message: string }) {
    const response = await api.post('/api/admin/whatsapp/test-message', payload);
    return response.data;
  },

  async exchangeEmbeddedSignupCode(payload: WhatsAppEmbeddedExchangePayload): Promise<WhatsAppEmbeddedExchangeResponse> {
    const response = await api.post('/api/admin/whatsapp/embedded/exchange', payload);
    return response.data;
  },
};
