import api from './api';

export interface HandoffSessionItem {
  id: number;
  chat_id: string;
  session_id: string;
  widget_id: string;
  organization_id: number;
  status: 'waiting_for_agent' | 'assigned' | 'bot_active' | 'closed' | string;
  assigned_agent_id: number | null;
  handoff_reason?: string | null;
  bot_suggested_answer?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
}

export interface HandoffMessageItem {
  id: number;
  handoff_session_id: number;
  sender_type: 'user' | 'agent' | 'bot' | 'system' | string;
  sender_user_id: number | null;
  message: string;
  created_at?: string | null;
}

const toWsBaseUrl = (baseUrl: string): string => {
  if (baseUrl.startsWith('https://')) return baseUrl.replace('https://', 'wss://');
  if (baseUrl.startsWith('http://')) return baseUrl.replace('http://', 'ws://');
  return baseUrl;
};

export const handoffService = {
  async listRequests(status?: string, mineOnly = false): Promise<HandoffSessionItem[]> {
    const response = await api.get<{ items: HandoffSessionItem[] }>('/api/admin/handoff/requests', {
      params: {
        ...(status ? { status } : {}),
        mine_only: mineOnly,
      },
    });
    return Array.isArray(response.data?.items) ? response.data.items : [];
  },

  async listMessages(chatId: string, afterId = 0): Promise<{ status: string; assigned_agent_id: number | null; items: HandoffMessageItem[] }> {
    const response = await api.get<{ status: string; assigned_agent_id: number | null; items: HandoffMessageItem[] }>(
      `/api/admin/handoff/${encodeURIComponent(chatId)}/messages`,
      {
        params: { after_id: afterId },
      }
    );
    return {
      status: response.data?.status || '',
      assigned_agent_id: response.data?.assigned_agent_id ?? null,
      items: Array.isArray(response.data?.items) ? response.data.items : [],
    };
  },

  async accept(chatId: string): Promise<HandoffSessionItem> {
    const response = await api.post<HandoffSessionItem>(`/api/admin/handoff/${encodeURIComponent(chatId)}/accept`);
    return response.data;
  },

  async sendMessage(chatId: string, message: string): Promise<HandoffMessageItem> {
    const response = await api.post<HandoffMessageItem>(`/api/admin/handoff/${encodeURIComponent(chatId)}/messages`, { message });
    return response.data;
  },

  async returnToBot(chatId: string): Promise<HandoffSessionItem> {
    const response = await api.post<HandoffSessionItem>(`/api/admin/handoff/${encodeURIComponent(chatId)}/return-to-bot`);
    return response.data;
  },

  async close(chatId: string): Promise<HandoffSessionItem> {
    const response = await api.post<HandoffSessionItem>(`/api/admin/handoff/${encodeURIComponent(chatId)}/close`);
    return response.data;
  },

  connectNotifications(onMessage: (payload: any) => void): WebSocket | null {
    const token = localStorage.getItem('access_token');
    const base = api.defaults.baseURL;
    if (!token || !base) return null;

    const wsBase = toWsBaseUrl(base);
    const ws = new WebSocket(`${wsBase}/api/admin/handoff/ws?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        onMessage(payload);
      } catch {
        // Ignore malformed payloads.
      }
    };
    return ws;
  },
};
