import api from './api';

export interface Contact {
    id?: number;
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


    async getContactLists(): Promise<ContactList[]> {
        const response = await api.get<ContactList[]>('/api/call-campaigns/contact-lists');
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
