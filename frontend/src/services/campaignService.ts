import api from './api';

export type CampaignType = 'email' | 'whatsapp' | 'sms';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'failed';

export interface CampaignItem {
  id: number;
  campaign_name: string;
  campaign_type: CampaignType;
  message_template: string;
  contact_list_id: number;
  contact_list_name?: string;
  product_id?: number | null;
  product_name?: string | null;
  scheduled_time?: string;
  status: CampaignStatus;
  number_sent: number;
  number_failed: number;
  created_at: string;
}

export interface CampaignListResponse {
  items: CampaignItem[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface CampaignLogItem {
  id: number;
  campaign_id: number;
  contact_id: number;
  run_sequence?: number;
  run_started_at?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  status:
    | 'pending'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'read'
    | 'clicked'
    | 'bounced'
    | 'complained'
    | 'unsubscribed'
    | 'failed';
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  read_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  complained_at?: string;
  unsubscribed_at?: string;
  open_count?: number;
  click_count?: number;
  provider_message_id?: string;
  last_event_type?: string;
  last_event_at?: string;
  error_message?: string;
  created_at: string;
}

export interface CampaignLogResponse {
  items: CampaignLogItem[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface CampaignReportsSummary {
  generated_at: string;
  window_days: number;
  overview: {
    campaign_count: number;
    run_count: number;
    message_count: number;
    sent_count: number;
    failed_count: number;
    success_rate: number;
  };
  channel_breakdown: {
    email: { runs: number; messages: number; sent: number; failed: number; success_rate: number };
    sms: { runs: number; messages: number; sent: number; failed: number; success_rate: number };
    whatsapp: { runs: number; messages: number; sent: number; failed: number; success_rate: number };
  };
  email_analytics: {
    delivered: number;
    opened: number;
    read: number;
    clicked: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    total_open_events: number;
    total_click_events: number;
    delivery_rate: number;
    open_rate: number;
    read_rate: number;
    click_rate: number;
    click_to_open_rate: number;
    bounce_rate: number;
    complaint_rate: number;
    unsubscribe_rate: number;
  };
  top_campaigns: Array<{
    campaign_id: number;
    campaign_name: string;
    campaign_type: CampaignType;
    runs: number;
    messages: number;
    sent: number;
    failed: number;
    open_rate: number;
    click_rate: number;
    last_event_at?: string;
  }>;
  daily_trend: Array<{
    date: string;
    email_sent: number;
    email_opened: number;
    email_clicked: number;
    sms_sent: number;
    whatsapp_sent: number;
    failed: number;
  }>;
}

export interface CampaignToLeadRule {
  id: number;
  organization_id: number;
  rule_name: string;
  is_active: boolean;
  auto_convert_enabled: boolean;
  min_score_threshold: number;
  dedupe_window_days: number;
  target_funnel_stage?: string | null;
  include_statuses: string[];
  exclude_statuses: string[];
  score_config: Record<string, number>;
  source_multipliers: Record<string, number>;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignToLeadRunResult {
  rule_id: number;
  rule_name: string;
  dry_run: boolean;
  evaluated: number;
  converted: number;
  skipped_duplicates: number;
  skipped: number;
  details: Array<{
    campaign_log_id: number;
    campaign_id: number;
    campaign_name: string;
    contact_id: number;
    contact_name?: string;
    email?: string;
    phone?: string;
    score: number;
    threshold: number;
    reasons: string[];
    status: string;
    lead_id?: number;
  }>;
}

export interface CampaignToLeadConversionItem {
  id: number;
  campaign_id: number;
  campaign_log_id: number;
  contact_id: number;
  lead_id?: number | null;
  rule_id: number;
  score: number;
  status: string;
  reason?: string;
  details?: string;
  created_at: string;
}

export interface CampaignToLeadConversionResponse {
  items: CampaignToLeadConversionItem[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface ContactListItem {
  id: number;
  list_name: string;
  description?: string;
  is_agent_auto_list?: boolean;
  agent_widget_id?: string | null;
  created_at: string;
  contact_count: number;
}

export interface ContactListResponse {
  items: ContactListItem[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface ContactItem {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  contact_list_id: number;
  created_at: string;
}

export interface ContactResponse {
  items: ContactItem[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface DashboardStats {
  campaign_count: number;
  total_sent: number;
  total_failed: number;
  status_counts: Record<string, number>;
  recent_campaigns: CampaignItem[];
}

export interface CreateCampaignPayload {
  campaign_name: string;
  campaign_type: CampaignType;
  message_template: string;
  scheduled_time?: string;
  contact_list_id: number;
  product_id?: number;
  status?: 'draft' | 'scheduled';
  email_content_mode?: 'manual' | 'prompt';
  email_subject?: string;
  email_prompt_context?: string;
  email_subject_variants?: string[];
  email_body_variants?: string[];
}

export interface GenerateEmailVariantsPayload {
  campaign_name?: string;
  prompt_context: string;
}

export interface GenerateEmailVariantsResponse {
  subjects: string[];
  bodies: string[];
  combinations: number;
}

export interface SpamScoreCombination {
  combo_index: number;
  subject_index: number;
  body_index: number;
  spam_score: number;
  risk_level: 'low' | 'medium' | 'high';
  reasons: string[];
  suggestions: string[];
}

export interface SpamScoreResponse {
  overall: {
    average_spam_score: number;
    highest_spam_score: number;
    high_risk_count: number;
  };
  combinations: SpamScoreCombination[];
  fallback_used?: boolean;
}

export interface CampaignFilters {
  search?: string;
  campaign_type?: CampaignType;
  status?: CampaignStatus;
  product_id?: number;
  contact_list_id?: number;
  created_from?: string;
  created_to?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  skip?: number;
  limit?: number;
}

export interface ContactFilters {
  search?: string;
  skip?: number;
  limit?: number;
}

export interface UploadManualContactsPayload {
  contacts: Array<{
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  }>;
}

export const campaignService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get('/api/admin/campaigns/dashboard/stats');
    return response.data;
  },

  async listCampaigns(filters: CampaignFilters = {}): Promise<CampaignListResponse> {
    const response = await api.get('/api/admin/campaigns', { params: filters });
    return response.data;
  },

  async createCampaign(payload: CreateCampaignPayload): Promise<CampaignItem> {
    const response = await api.post('/api/admin/campaigns', payload);
    return response.data;
  },

  async generateEmailVariants(payload: GenerateEmailVariantsPayload): Promise<GenerateEmailVariantsResponse> {
    const response = await api.post('/api/admin/campaigns/email/generate-variants', payload);
    return response.data;
  },

  async scoreEmailSpamRisk(payload: {
    campaign_name?: string;
    prompt_context: string;
    subjects: string[];
    bodies: string[];
  }): Promise<SpamScoreResponse> {
    const response = await api.post('/api/admin/campaigns/email/spam-score', payload);
    return response.data;
  },

  async runCampaign(campaignId: number): Promise<{ status: string; number_sent: number; number_failed: number }> {
    const response = await api.post(`/api/admin/campaigns/${campaignId}/run`);
    return response.data;
  },

  async runDueCampaigns(): Promise<{ due_count: number; executed_count: number; skipped_count: number }> {
    const response = await api.post('/api/admin/campaigns/run-due');
    return response.data;
  },

  async pauseCampaign(campaignId: number): Promise<{ status: string }> {
    const response = await api.post(`/api/admin/campaigns/${campaignId}/pause`);
    return response.data;
  },

  async listCampaignLogs(campaignId: number, params: { status?: string; run_sequence?: number; skip?: number; limit?: number } = {}): Promise<CampaignLogResponse> {
    const response = await api.get(`/api/admin/campaigns/${campaignId}/logs`, { params });
    return response.data;
  },

  async getCampaignReportsSummary(params: { days?: number } = {}): Promise<CampaignReportsSummary> {
    const response = await api.get('/api/admin/campaigns/reports/summary', { params });
    return response.data;
  },

  async getCampaignToLeadRule(): Promise<CampaignToLeadRule> {
    const response = await api.get('/api/admin/campaigns/c2l/rules/current');
    return response.data;
  },

  async updateCampaignToLeadRule(payload: Partial<CampaignToLeadRule>): Promise<CampaignToLeadRule> {
    const response = await api.put('/api/admin/campaigns/c2l/rules/current', payload);
    return response.data;
  },

  async runCampaignToLeadRuleEngine(payload: { campaign_id?: number; dry_run?: boolean; limit?: number }): Promise<CampaignToLeadRunResult> {
    const response = await api.post('/api/admin/campaigns/c2l/run', payload);
    return response.data;
  },

  async listCampaignToLeadConversions(params: { campaign_id?: number; status?: string; skip?: number; limit?: number } = {}): Promise<CampaignToLeadConversionResponse> {
    const response = await api.get('/api/admin/campaigns/c2l/conversions', { params });
    return response.data;
  },

  async createContactList(payload: { list_name: string; description?: string }): Promise<ContactListItem> {
    const response = await api.post('/api/admin/campaigns/contact-lists', payload);
    return response.data;
  },

  async listContactLists(params: ContactFilters = {}): Promise<ContactListResponse> {
    const response = await api.get('/api/admin/campaigns/contact-lists', { params });
    return response.data;
  },

  async deleteContactList(contactListId: number): Promise<void> {
    await api.delete(`/api/admin/campaigns/contact-lists/${contactListId}`);
  },

  async listContacts(contactListId: number, params: ContactFilters = {}): Promise<ContactResponse> {
    const response = await api.get(`/api/admin/campaigns/contact-lists/${contactListId}/contacts`, { params });
    return response.data;
  },

  async uploadContactsManual(contactListId: number, payload: UploadManualContactsPayload): Promise<{ created: number; failed: number; errors: Array<{ row: number; error: string }> }> {
    const response = await api.post(`/api/admin/campaigns/contact-lists/${contactListId}/contacts/manual`, payload);
    return response.data;
  },

  async uploadContactsCsv(contactListId: number, file: File): Promise<{ created: number; failed: number; errors: Array<{ row: number; error: string }> }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/api/admin/campaigns/contact-lists/${contactListId}/contacts/csv`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async deleteContact(contactId: number): Promise<void> {
    await api.delete(`/api/admin/campaigns/contacts/${contactId}`);
  },
};
