import api from './api';
import { ChatMessage, ChatResponse, ConversationHistoryItem, TranslateRequest, TranslateResponse } from '../types';

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

  async getFeatureFlags(): Promise<{ subscription_active: boolean; days_left: number; voice_chat_enabled: boolean; multilingual_text_enabled: boolean }> {
    const response = await api.get('/api/admin/features');
    return response.data;
  },
};
