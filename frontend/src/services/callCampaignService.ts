import api from './api';

export interface Contact {
    id?: number;
    label?: string;
    name: string;
    email: string;
    phone: string;
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
}


export interface CampaignContactListResponse {
    items: Contact[];
    pagination: {
        total: number;
        skip: number;
        limit: number;
    };
}

export interface Campaign {
    id?: number;
    name: string;
    category: string;
    status: "Active" | "Paused" | "Completed";
    contacts: number;
    progress: number;
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

export interface CallCampaign {
    id?: number;
    name: string;
    description: string;
    category: string;
    priority: string;
    agent_id: number | "";

    contacts: number[];

    start_datetime: string;
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
}

export interface CreateCampaignResponse {
    message: string;
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

    async allContacts(params: CampaignContactFilters = {}): Promise<CampaignContactListResponse> {
        const response = await api.get('/api/call-campaigns/contacts', { params });
        return response.data;
    },

    async getCampaign(campaign_id?: number): Promise<CallCampaign> {
        const response = await api.get(`/api/call-campaigns/${campaign_id}`);
        return response.data;
    },

    async createCampaign(payload: any): Promise<CreateCampaignResponse> {
        const response = await api.post('/api/call-campaigns/create', payload);
        return response.data;
    },

    async updateCampaign(payload: any, campaign_id: number): Promise<CreateCampaignResponse> {
        const response = await api.put(`/api/call-campaigns/update/${campaign_id}`, payload);
        return response.data;
    },


    async getContactLists(): Promise<ContactList[]> {
        const response = await api.get<ContactList[]>('/api/call-campaigns/contact-lists');
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
};
