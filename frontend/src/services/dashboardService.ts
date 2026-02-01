import api from './api';

export const dashboardService = {
  async getStats() {
    const response = await api.get('/api/admin/dashboard/stats');
    return response.data;
  },

  async getDailyConversations(days: number = 7) {
    const response = await api.get(`/api/admin/dashboard/conversations/daily?days=${days}`);
    return response.data;
  },

  async getRecentLeads(limit: number = 10) {
    const response = await api.get(`/api/admin/dashboard/leads/recent?limit=${limit}`);
    return response.data;
  },

  async getWidgets() {
    const response = await api.get('/api/admin/dashboard/widgets');
    return response.data;
  },

  async getKnowledgeSources() {
    const response = await api.get('/api/admin/dashboard/knowledge-sources');
    return response.data;
  },

  async getLeadsBySource() {
    const response = await api.get('/api/admin/dashboard/leads/by-source');
    return response.data;
  },

  async getTopSessions(limit: number = 10) {
    const response = await api.get(`/api/admin/dashboard/top-sessions?limit=${limit}`);
    return response.data;
  },

  async getConversationTrend(days: number = 30) {
    const response = await api.get(`/api/admin/dashboard/conversation-trend?days=${days}`);
    return response.data;
  },
};
