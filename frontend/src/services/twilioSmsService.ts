import api from './api';

export interface TwilioSmsConfigResponse {
  configured: boolean;
  id?: number;
  account_sid?: string;
  from_phone_number?: string;
  inbound_phone_number?: string | null;
  location_label?: string | null;
  voice_webhook_url?: string | null;
  messaging_webhook_url?: string | null;
  is_active?: boolean;
  has_auth_token?: boolean;
}

export interface TwilioSmsConfigUpsertPayload {
  account_sid: string;
  auth_token?: string;
  from_phone_number: string;
  inbound_phone_number?: string;
  location_label?: string;
  voice_webhook_url?: string;
  messaging_webhook_url?: string;
  is_active: boolean;
}

export const twilioSmsService = {
  async getConfig(): Promise<TwilioSmsConfigResponse> {
    const response = await api.get('/api/admin/sms/twilio/config');
    return response.data;
  },

  async upsertConfig(payload: TwilioSmsConfigUpsertPayload): Promise<TwilioSmsConfigResponse> {
    const response = await api.put('/api/admin/sms/twilio/config', payload);
    return response.data;
  },

  async sendTestMessage(toNumber: string, message: string): Promise<{ message: string }> {
    const response = await api.post('/api/admin/sms/twilio/test-message', {
      to_number: toNumber,
      message,
    });
    return response.data;
  },
};
