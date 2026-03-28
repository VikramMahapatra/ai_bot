import api from './api';

export interface CallingAgent {
    id?: number
    organization_id?: number;
    // Basic Info
    type: 'outbound' | 'inbound'
    name: string
    calling_no?: string
    status: 'pending' | 'testing' | 'active' | 'paused'

    server_location?: "IN" | "US"

    destination?: string[]

    // Campaign Stats
    active_campaigns: number
    completed_campaigns: number
    pending_campaigns: number
    allocated_calls: number
    pending_calls: number
    attempted_calls: number

    // Conversation
    greeting?: string
    prompt?: string
    who_speaks_first?: "ai" | "user"

    // Voice
    gender?: "Male" | "Female"
    accent?: string
    voice?: string

    // Timezone
    enable_prompt_timezone?: boolean
    prompt_timezone?: string

    // Call Forwarding
    enable_call_forwarding?: boolean
    call_forwarding_number?: string
    call_forwarding_role?: string
    call_forwarding_action_desc?: string

    // Call Behaviour
    silence_timeout?: number
    talking_speed?: number
    max_call_duration?: number
    calendar_sync?: boolean

    enable_sentiment?: boolean
    voice_mail_detection?: boolean
    enable_call_recording?: boolean

    // Call Success / Summary
    success_parameters?: string
    enable_call_summary?: boolean
    summary_prompt?: string
    follow_up_whatsapp?: boolean

    // AI Behaviour
    important_data_points?: string
    enable_background_sound?: boolean
    background_sound_url?: string
    start_speaking_wait_seconds?: number
    stop_speaking_voice_seconds?: number

    // Transcriber
    transcriber_provider?: "deepgram" | "azure"
    transcriber_language?: string
    transcriber_model?: string

    // Files
    training_doc?: string[]

    // Metadata
    created_at?: string
    updated_at?: string
}

export interface CallingAgentLookup {
    id?: number
    name: string
}

export interface Voice {
    id?: number;
    caller_name: string;
    voice_id: string;
    gender: string;
    language: string;
    accent: string;
    recording_url: string;
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

export interface CallingAgentStatusResponse {
    message: string;
    agent_id: string;
    status: string;
    success: boolean;
}


export const callingAgentService = {
    async createCallingAgent(payload: FormData): Promise<CallingAgentStatusResponse> {
        const response = await api.post('/api/calling-agent/create', payload);
        return response.data;
    },

    async updateCallingAgent(payload: FormData, agent_id?: number): Promise<CallingAgentStatusResponse> {
        const response = await api.post(`/api/calling-agent/update/${agent_id}`, payload);
        console.log(response);
        return response.data;
    },

    async publishAgent(agent_id: number): Promise<CallingAgentStatusResponse> {
        const response = await api.post(`/api/calling-agent/${agent_id}/publish`);
        return response.data;
    },

    async deleteAgent(agent_id: number): Promise<CallingAgentStatusResponse> {
        const response = await api.delete(`/api/calling-agent/${agent_id}/delete`);
        return response.data;
    },

    async updateAgentStatus(agent_id: number, status: string): Promise<CallingAgentStatusResponse> {
        const response = await api.post(`/api/calling-agent/${agent_id}/status`, {
            status
        });
        return response.data;
    },

    async testCall(agent_id: number, payload: any): Promise<CallingAgentStatusResponse> {
        const response = await api.post(`/api/calling-agent/${agent_id}/test-call`, payload);
        return response.data;
    },

    async allCallingAgents(params: CallingAgentFilters = {}): Promise<CallingAgentListResponse> {
        const response = await api.get('/api/calling-agent/all', { params });
        return response.data;
    },

    async agentLookup(): Promise<CallingAgentLookup[]> {
        const response = await api.get<CallingAgentLookup[]>('/api/calling-agent/lookup');
        return response.data;
    },

    async allVoices(): Promise<Voice[]> {
        const response = await api.get<Voice[]>('/api/calling-agent/voices');
        return response.data;
    },

};