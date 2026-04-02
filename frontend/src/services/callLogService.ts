import api from './api';

export interface CallTranscript {
    speaker: "Agent" | "Contact";
    text: string;
}
export interface CallLog {
    id: string;
    phone: string;
    contact?: string;
    agent?: string;
    campaign?: string;
    testCall: boolean;
    type: "Inbound" | "Outbound";
    mode: "Voice" | "Chat" | "Video";
    status: string;
    ended_reason?: string;
    sentiment?: string;
    call_summary?: string;
    follow_up_recommended?: string[];
    extract_data?: string;
    lead_info?: {
        lead_quality?: {
            rate?: number;
            label?: string;
        },
        follow_up?: {
            rate?: number;
            label?: string;
        }
    };
    date: string;
    startTime: string;
    endTime: string;
    industry: string;
    audioUrl?: string;
    duration?: string;
    cost?: string;
    lead_qualified_status?: string;
    transcript: CallTranscript[];
}

export type StatusType =
    | "completed"
    | "ended"
    | "in_progress"
    | "failed"
    | "scheduled";

export type SentimentType = "positive" | "negative" | "neutral";

export type LeadQualityType = "high" | "medium" | "low" | "poor";

export interface CallLogFilterState {
    search?: string;
    fromDate?: string;
    endDate?: string;

    status?: StatusType | "All";
    call_end_reason?: string | "All";
    sentiment?: SentimentType | "All";
    evaluation: boolean | "All";
}

export interface CallLogFilters {
    campaign_id?: number;
    agent_id?: number;

    // pagination
    skip?: number;
    limit?: number;

    // search
    search?: string;

    // date range
    from_date?: string;
    end_date?: string;

    //new filters
    status?: StatusType;
    call_end_reason?: string;
    sentiment?: SentimentType;
    evaluation?: boolean;

    lead_quality?: string;
    is_lead_qualified?: boolean;
}

export interface CallLogListResponse {
    items: CallLog[];
    total_calls: number;
    campaign_calls: number;
    test_calls: number;
    pagination: {
        total: number;
        skip: number;
        limit: number;
    };
}

export interface SyncCallResponse {
    message: string;
    count?: number;
}

export interface FilterLookupResponse {
    id: string;
    name: string;
}

export interface CallLogResponse {
    message: string;
    success: boolean;
}


export const callLogService = {

    async allLogs(params: CallLogFilters = {}): Promise<CallLogListResponse> {
        const response = await api.get('/api/call-log/all', { params });
        return response.data;
    },

    async syncCallLogs(params: CallLogFilters = {}): Promise<SyncCallResponse> {
        const response = await api.post(`/api/call-log/sync-call-logs`, { params });
        return response.data;
    },

    async allAgentLookup(): Promise<FilterLookupResponse[]> {
        const response = await api.get<FilterLookupResponse[]>('/api/calling-agent/all-agent-lookup');
        return response.data;
    },

    async campaignLookup(agentId?: number): Promise<FilterLookupResponse[]> {
        const params = agentId ? { agent_id: agentId } : {};
        const response = await api.get<FilterLookupResponse[]>('/api/call-campaigns/lookup', { params });
        return response.data;
    },

    async moveToSalesFunnel(call_log_id: number, stage: string): Promise<CallLogResponse> {
        const response = await api.post<CallLogResponse>(`/api/call-log/${call_log_id}/move-to-sales-funnel`, { stage });
        return response.data;
    },

};