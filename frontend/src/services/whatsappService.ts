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
};
