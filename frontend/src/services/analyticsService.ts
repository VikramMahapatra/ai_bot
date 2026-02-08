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
  plan_usage?: {
    plan_id: number | null;
    plan_name: string | null;
    billing_cycle: string | null;
    start_date: string | null;
    end_date: string | null;
    days_left: number | null;
    status: string | null;
    limits: {
      monthly_conversation_limit: number | null;
      monthly_message_limit: number | null;
      monthly_token_limit: number | null;
      monthly_crawl_pages_limit: number | null;
      monthly_document_limit: number | null;
    };
    used: {
      conversations_used: number;
      messages_used: number;
      tokens_used: number;
      crawl_pages_used: number;
      documents_used: number;
    };
    remaining: {
      conversations_remaining: number | null;
      messages_remaining: number | null;
      tokens_remaining: number | null;
      crawl_pages_remaining: number | null;
      documents_remaining: number | null;
    };
  } | null;
}

interface AdvancedAnalytics {
  funnel: {
    sessions: number;
    sessions_with_messages: number;
    leads: number;
    conversion_rate: number;
  };
  message_stats: {
    user_messages: number;
    assistant_messages: number;
    avg_messages_per_session: number;
    avg_response_length: number;
  };
  widget_performance: { widget_id: string; messages: number; leads: number }[];
  retrieval_quality: {
    queries_analyzed: number;
    hit_rate: number;
    empty_context_rate: number;
    avg_sources_per_query: number;
  };
  source_attribution: { source_id: number; source_name: string; count: number }[];
  answer_quality: {
    feedback_count: number;
    average_rating: number | null;
    thumbs_up_rate: number;
  };
  cost: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    average_tokens_per_conversation: number;
    conversations_count: number;
    cost_estimate: number | null;
  };
  latency: {
    p50: number | null;
    p95: number | null;
  };
  intent_keywords: { keyword: string; count: number }[];
  top_unanswered: { question: string; created_at: string | null }[];
  knowledge_gaps: { keyword: string; count: number; sample_questions: string[]; widget_id: string | null; suggested_title: string }[];
  alerts: { type: string; severity: string; title: string; message: string; current: number; previous: number }[];
  forecast: {
    token_limit: number;
    tokens_used: number;
    tokens_remaining: number | null;
    avg_daily_tokens: number;
    days_to_exhaust: number | null;
    estimated_exhaust_date: string | null;
  } | null;
  ml_predictions: {
    lead_conversion_by_widget: {
      widget_id: string;
      sessions: number;
      leads: number;
      predicted_conversion_rate: number;
    }[];
    demand_forecast: {
      sessions_forecast: number[];
      messages_forecast: number[];
    };
    lead_forecast: {
      leads_forecast: number[];
    };
    token_forecast_band: {
      mean_daily_tokens: number;
      std_daily_tokens: number;
      lower: number;
      upper: number;
    };
    escalation_rate_forecast: {
      current_rate: number;
      daily_rate_forecast: number[];
    };
    response_time_forecast: number[];
    csat_forecast: number[];
    predicted_intents: { keyword: string; count: number }[];
    peak_hour_prediction: { hour: string | null; share: number };
  };
  retention: {
    cohort_size: number;
    d1_rate: number;
    d7_rate: number;
    d30_rate: number;
  };
  escalation: {
    overall_rate: number;
    by_widget: { widget_id: string; messages: number; leads: number; escalation_rate: number }[];
  };
  topic_drift: {
    new_topics: string[];
    recurring_topics: string[];
    new_topic_rate: number;
  };
  knowledge_coverage: {
    answered: number;
    unanswered: number;
    coverage_rate: number;
  };
  source_freshness: {
    '0-7d': number;
    '8-30d': number;
    '31-90d': number;
    '90d+': number;
  };
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

  getAdvancedAnalytics: async (days: number = 30, sampleSize: number = 50) => {
    const response = await api.get<AdvancedAnalytics>(
      `/api/analytics/advanced?days=${days}&sample_size=${sampleSize}`
    );
    return response.data;
  },

  getKnowledgeGaps: async (days: number = 30, limit: number = 6, widgetId?: string) => {
    const response = await api.get<{ gaps: { keyword: string; count: number; sample_questions: string[]; widget_id: string | null; suggested_title: string }[] }>(
      `/api/analytics/knowledge-gaps?days=${days}&limit=${limit}${widgetId ? `&widget_id=${widgetId}` : ''}`
    );
    return response.data;
  },
};
