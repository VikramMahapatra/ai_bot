import api from './api';
import { ContactItem, ContactListItem } from './campaignService';

export interface Contact {
    id?: number;
    label?: string;
    name: string;
    email: string;
    phone: string;
    company?: string;
    list_name?: string;
    contact_list_id: number;
}

export interface ContactList {
    id: number;
    list_name: string;
}

export interface CampaignContactFilters {
    search?: string;
    skip?: number;
    limit?: number;
    status?: string | "All";
    from_date?: string | null;
    end_date?: string | null;
    sort_by?: string;
}


export interface AllContactListResponse {
    items: ContactItem[];
    pagination: {
        total: number;
        skip: number;
        limit: number;
    };
}

export interface Campaign {
    id?: number;
    name: string;
    description: string;
    agent_name?: string;
    product_name?: string;
    calling_no?: string;
    category?: string;
    status: "draft" | "pending" | "running" | "paused" | "completed" | "scheduled" | "cancelled";
    contacts?: number;
    progress?: number;
    created_at?: string;
    total_calls: number;
    completed_calls: number;
    avg_duration: string;
    response_rate: string;
    sentiment: Sentiment;
    key_insights: KeyInsight[];
    ai_recommendations: AIRecommendation[];
    timeline: Timeline;
    engagement: CampaignEngagement;
}


export interface CampaignListResponse {
    items: Campaign[];
    pagination: {
        total: number;
        skip: number;
        limit: number;
    };
}

export interface CampaignStats {
    totalCampaigns: number;
    activeCampaigns: number;
    pausedCampaigns: number;
    completedCampaigns: number;
}

export interface KeyInsight {
    title: string;
    value: string;
    change?: string;
    description: string;
    color: "blue" | "purple" | "green" | "orange";
}

interface AIRecommendation {
    title: string;
    impact: string;
}

export interface Sentiment {
    positive: number;
    neutral: number;
    negative: number;
}

export interface Timeline {
    created_at: string;
    updated_at: string;
}

export interface CampaignEngagement {
    engagement_rate: number;
    conversion: number;
    avg_call_time: string;
}

/** Per-channel instant reply template as returned by the API / sent on save. */
export interface InstantReplyTemplateRef {
    template_id: number;
    name: string;
}

export interface CallCampaign {
    id?: number;
    name: string;
    description: string;
    category: string;
    priority: string;
    calling_no: string;
    agent_id: number | "";
    product_id?: number | "";
    contacts: number[];
    start_datetime: string;
    end_datetime: string;
    timezone: string;
    call_start_time: string;
    call_end_time: string;
    call_interval: number | "";
    active_days: string[];
    max_retry_attempts: number | "";
    retry_interval: number | "";
    retry_on_no_answer: boolean;
    retry_on_busy: boolean;
    retry_on_voicemail: boolean;
    call_logs?: [];
    instant_reply: boolean;
    instant_reply_modes: string[];
    instant_reply_templates: {
        whatsapp: number | "";
        sms: number | "";
        email: number | "";
    };
    workflow_id?: number | "";
}


export interface CallCampaignDetail {
    id?: number;
    name: string;
    description: string;
    category: string;
    priority: string;
    calling_no: string;
    agent_id: number | "";
    product_id?: number | "";
    contacts: number[];
    start_datetime: string;
    end_datetime: string;
    timezone: string;
    call_start_time: string;
    call_end_time: string;
    call_interval: number | "";
    active_days: string[];
    max_retry_attempts: number | "";
    retry_interval: number | "";
    retry_on_no_answer: boolean;
    retry_on_busy: boolean;
    retry_on_voicemail: boolean;
    call_logs?: [];
    instant_reply: boolean;
    instant_reply_modes: string[];
    instant_reply_template: Record<
        string,
        number | "" | InstantReplyTemplateRef | undefined
    >;
}

export interface WorkflowEvent {
    event: string;
    step_type?: string;
    call_status?: string;
    outcome?: string;
    delay?: number;
    delay_unit?: string;
    reason?: string;
    scheduled_at?: string;
    time: string;
    metadata?: any;
    error?: string;
}

export interface CampaignResponse {
    message: string;
    success: boolean;
}

export const callCampaignService = {
    async createContact(payload: any): Promise<Contact> {
        const response = await api.post('/api/call-campaigns/contacts/create', payload);
        return response.data;
    },

    async updateContact(payload: any, contact_id?: number): Promise<Contact> {
        const response = await api.put(`/api/call-campaigns/contacts/update/${contact_id}`, payload);
        return response.data;
    },

    async allContacts(params: CampaignContactFilters = {}): Promise<AllContactListResponse> {
        const response = await api.get('/api/call-campaigns/contacts', { params });
        return response.data;
    },

    async getCampaign(campaign_id?: number): Promise<CallCampaign> {
        const response = await api.get(`/api/call-campaigns/${campaign_id}`);
        return response.data;
    },

    async getCampaignDetails(campaign_id?: number): Promise<CallCampaignDetail> {
        const response = await api.get(`/api/call-campaigns/${campaign_id}/detail`);
        return response.data;
    },

    async createCampaign(payload: any): Promise<CampaignResponse> {
        const response = await api.post('/api/call-campaigns/create', payload);
        return response.data;
    },

    async updateCampaign(payload: any, campaign_id: number): Promise<CampaignResponse> {
        const response = await api.put(`/api/call-campaigns/update/${campaign_id}`, payload);
        return response.data;
    },

    async deleteCampaign(campaign_id: number): Promise<CampaignResponse> {
        const response = await api.delete(`/api/call-campaigns/${campaign_id}/delete`);
        return response.data;
    },


    async getContactLists(): Promise<ContactListItem[]> {
        const response = await api.get<ContactListItem[]>('/api/call-campaigns/contact-lists');
        return response.data;
    },

    async getContactByIds(ids: number[]): Promise<Contact[]> {
        const response = await api.post<Contact[]>('/api/call-campaigns/contacts/by-ids', { ids });
        return response.data;
    },

    async getContactLookup(): Promise<Contact[]> {
        const response = await api.get<Contact[]>('/api/call-campaigns/contacts/lookup');
        return response.data;
    },

    async allCampaigns(params: CampaignContactFilters = {}): Promise<CampaignListResponse> {
        const response = await api.get('/api/call-campaigns/all', { params });
        return response.data;
    },

    async campaignStats(): Promise<CampaignStats> {
        const response = await api.get('/api/call-campaigns/stats');
        return response.data;
    },

    async updateCampaignStatus(campaign_id: number, status: string): Promise<CampaignResponse> {
        const response = await api.post(`/api/call-campaigns/${campaign_id}/status`, {
            status
        });
        return response.data;
    },

    async getCampaignAnalytics(campaign_id: number): Promise<Campaign> {
        const response = await api.get(`/api/call-campaigns/${campaign_id}/analytics`);
        return response.data;
    },

    async getWorkflowHistory(campaign_id: number, contact_id: number): Promise<WorkflowEvent[]> {
        const response = await api.get<WorkflowEvent[]>(`/api/call-campaigns/${campaign_id}/contacts/${contact_id}/workflow-history`);
        return response.data;
    },
};
