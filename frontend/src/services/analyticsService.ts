import api from './api';

interface SessionMessageData {
  date: string;
  sessions: number;
  messages: number;
}

interface EngagementData {
  hour: string;
  users: number;
}

interface ResponseTimeData {
  date: string;
  time: number;
}

interface MessageVolumeData {
  date: string;
  messages: number;
}

interface AnalyticsMetrics {
  total_sessions: number;
  total_messages: number;
  conversion_rate: number;
  avg_response_time: number;
  total_leads: number;
}

export const analyticsService = {
  // Get sessions and messages by day
  getSessionsMessages: async (days: number = 7) => {
    const response = await api.get<{ data: SessionMessageData[] }>(
      `/api/analytics/sessions-messages?days=${days}`
    );
    return response.data;
  },

  // Get user engagement by hour
  getUserEngagement: async (days: number = 7) => {
    const response = await api.get<{ data: EngagementData[] }>(
      `/api/analytics/user-engagement?days=${days}`
    );
    return response.data;
  },

  // Get average response time by day
  getResponseTime: async (days: number = 7) => {
    const response = await api.get<{ data: ResponseTimeData[] }>(
      `/api/analytics/response-time?days=${days}`
    );
    return response.data;
  },

  // Get message volume by day
  getMessageVolume: async (days: number = 7) => {
    const response = await api.get<{ data: MessageVolumeData[] }>(
      `/api/analytics/message-volume?days=${days}`
    );
    return response.data;
  },

  // Get analytics metrics (summary)
  getMetrics: async (days: number = 7) => {
    const response = await api.get<AnalyticsMetrics>(
      `/api/analytics/metrics?days=${days}`
    );
    return response.data;
  },
};
