import api from './api';
import { ChatMessage, ChatResponse, ConversationHistoryItem, TranslateRequest, TranslateResponse, AppointmentBookingRequest, AppointmentBookingResponse } from '../types';

export interface ChatHandoffStatus {
  active: boolean;
  chat_id: string | null;
  status: string | null;
  assigned_agent_id: number | null;
  call_room_id?: string | null;
  call_status?: 'none' | 'requested' | 'active' | 'ended' | string;
  call_mode?: 'video' | 'audio' | string;
  call_requested_at?: string | null;
  call_started_at?: string | null;
  call_ended_at?: string | null;
  updated_at?: string | null;
}

export const chatService = {
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/api/chat', message);
    return response.data;
  },

  async sendMessageStream(message: ChatMessage, signal?: AbortSignal): Promise<Response> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${api.defaults.baseURL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(message),
      signal,
    });

    if (!response.ok) {
      let detail: any = 'Failed to stream chat response';
      let tokensUsed: number | undefined;
      let tokenLimit: number | undefined;
      try {
        const data = await response.json();
        if (data?.detail) detail = data.detail;
        if (detail?.tokens_used !== undefined) tokensUsed = detail.tokens_used;
        if (detail?.token_limit !== undefined) tokenLimit = detail.token_limit;
        if (detail?.message) detail = detail.message;
      } catch {
        // ignore JSON parse errors
      }
      const err = new Error(typeof detail === 'string' ? detail : 'Failed to stream chat response');
      (err as any).status = response.status;
      (err as any).detail = detail?.message || detail;
      (err as any).tokensUsed = tokensUsed;
      (err as any).tokenLimit = tokenLimit;
      throw err;
    }

    return response;
  },

  async getHistory(sessionId: string, widgetId?: string): Promise<ConversationHistoryItem[]> {
    const response = await api.get<ConversationHistoryItem[]>(`/api/chat/history/${sessionId}`, {
      params: widgetId ? { widget_id: widgetId } : undefined,
    });
    return response.data;
  },

  async shouldCaptureLead(sessionId: string, widgetId?: string): Promise<boolean> {
    const response = await api.get<{ should_capture: boolean }>(
      `/api/chat/should-capture-lead/${sessionId}`,
      { params: widgetId ? { widget_id: widgetId } : undefined }
    );
    return response.data.should_capture;
  },

  async emailConversation(sessionId: string, email: string): Promise<{ message: string; email: string }> {
    const response = await api.post<{ message: string; email: string }>(
      '/api/chat/email-conversation',
      { session_id: sessionId, email }
    );
    return response.data;
  },

  async translateText(request: TranslateRequest): Promise<TranslateResponse> {
    const response = await api.post<TranslateResponse>('/api/chat/translate', request);
    return response.data;
  },

  async getSuggestedQuestions(widgetId: string): Promise<string[]> {
    const response = await api.get<{ questions: string[] }>('/api/chat/suggested-questions', {
      params: { widget_id: widgetId },
    });
    return Array.isArray(response.data.questions) ? response.data.questions : [];
  },

  async bookAppointment(payload: AppointmentBookingRequest): Promise<AppointmentBookingResponse> {
    const response = await api.post<AppointmentBookingResponse>('/api/chat/appointments', payload);
    return response.data;
  },

  async getFeatureFlags(): Promise<{
    subscription_active: boolean;
    days_left: number;
    voice_chat_enabled: boolean;
    multilingual_text_enabled: boolean;
    human_handoff_enabled?: boolean;
    whatsapp_enabled?: boolean;
    email_campaign_enabled?: boolean;
    sms_campaign_enabled?: boolean;
    module_knowledge_enabled?: boolean;
    module_leads_enabled?: boolean;
    module_analytics_enabled?: boolean;
    module_advanced_analytics_enabled?: boolean;
    module_reports_enabled?: boolean;
    module_campaigns_enabled?: boolean;
    module_appointments_enabled?: boolean;
    module_products_enabled?: boolean;
    module_users_enabled?: boolean;
  }> {
    const response = await api.get('/api/admin/features');
    return response.data;
  },

  async getHandoffSessionStatus(sessionId: string, widgetId: string, chatId?: string): Promise<ChatHandoffStatus> {
    const response = await api.get<ChatHandoffStatus>('/api/chat/handoff/session', {
      params: {
        session_id: sessionId,
        widget_id: widgetId,
        ...(chatId ? { chat_id: chatId } : {}),
      },
    });
    return response.data;
  },

  async requestVideoCall(sessionId: string, widgetId: string): Promise<ChatHandoffStatus> {
    const response = await api.post<ChatHandoffStatus>('/api/chat/handoff/request-video-call', {
      session_id: sessionId,
      widget_id: widgetId,
    });
    return response.data;
  },

  async setHandoffCallMode(sessionId: string, widgetId: string, mode: 'video' | 'audio'): Promise<ChatHandoffStatus> {
    const response = await api.post<ChatHandoffStatus>('/api/chat/handoff/call-mode', {
      session_id: sessionId,
      widget_id: widgetId,
      mode,
    });
    return response.data;
  },

  async endHandoffCall(sessionId: string, widgetId: string): Promise<ChatHandoffStatus> {
    const response = await api.post<ChatHandoffStatus>('/api/chat/handoff/end-call', {
      session_id: sessionId,
      widget_id: widgetId,
    });
    return response.data;
  },

   async isChannelAvailable(): Promise<boolean> {
    const response = await api.get(`/api/admin/validate-channel-available`);
    return response.data;
  },
};
