import api from './api';
import { ChatMessage, ChatResponse, ConversationHistoryItem } from '../types';

export const chatService = {
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/api/chat', message);
    return response.data;
  },

  async getHistory(sessionId: string): Promise<ConversationHistoryItem[]> {
    const response = await api.get<ConversationHistoryItem[]>(`/api/chat/history/${sessionId}`);
    return response.data;
  },

  async shouldCaptureLead(sessionId: string): Promise<boolean> {
    const response = await api.get<{ should_capture: boolean }>(
      `/api/chat/should-capture-lead/${sessionId}`
    );
    return response.data.should_capture;
  },
};
