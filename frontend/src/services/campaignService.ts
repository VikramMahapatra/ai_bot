import api from './api';

export type CampaignType = 'email' | 'whatsapp';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'failed';

export interface CampaignItem {
  id: number;
  campaign_name: string;
  campaign_type: CampaignType;
  message_template: string;
  contact_list_id: number;
  contact_list_name?: string;
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
  contact_name?: string;
  email?: string;
  phone?: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at?: string;
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
  status?: 'draft' | 'scheduled';
}

export interface CampaignFilters {
  search?: string;
  campaign_type?: CampaignType;
  status?: CampaignStatus;
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

  async listCampaignLogs(campaignId: number, params: { status?: string; skip?: number; limit?: number } = {}): Promise<CampaignLogResponse> {
    const response = await api.get(`/api/admin/campaigns/${campaignId}/logs`, { params });
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
