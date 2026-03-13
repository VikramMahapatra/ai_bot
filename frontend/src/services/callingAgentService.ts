import api from './api';

export interface CallingAgent {
    id?: number
    type: 'Outbound' | 'Inbound'
    name: string
    calling_no: string
    status: 'Active' | 'Paused'
    destination?: string[];
    active_campaigns: number
    allocated_calls: number
    pending_calls: number
    attempted_calls: number
    created_at: Date
}

export interface CallingAgentFilters {
    search?: string
    skip?: number
    limit?: number
    sortBy?: 'newest' | 'oldest'
}

export interface CallingAgentListResponse {
    items: CallingAgent[];
    pagination: {
        total: number;
        skip: number;
        limit: number;
    };
}


export const callingAgentService = {
    async createCallingAgent(payload: FormData): Promise<CallingAgent> {
        const response = await api.post('/api/calling-agent/create', payload);
        return response.data;
    },

    async updateCallingAgent(payload: FormData, agent_id?: number): Promise<CallingAgent> {
        const response = await api.post(`/api/calling-agent/update/${agent_id}`, payload);
        console.log(response);
        return response.data;
    },

    async allCallingAgents(params: CallingAgentFilters = {}): Promise<CallingAgentListResponse> {
        const response = await api.get('/api/calling-agent/all', { params });
        return response.data;
    },

};