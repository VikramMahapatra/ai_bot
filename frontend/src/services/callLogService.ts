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
    transcript: CallTranscript[];
}

export interface CallLogFilters {
    campaign_id?: number;
    search?: string;
    skip?: number;
    limit?: number;
    from_date?: string;
    end_date?: string;
}

export interface CallLogListResponse {
    items: CallLog[];
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


export const callLogService = {

    async allLogs(params: CallLogFilters = {}): Promise<CallLogListResponse> {
        const response = await api.get('/api/call-log/all', { params });
        return response.data;
    },

    async syncCallLogs(params: CallLogFilters = {}): Promise<SyncCallResponse> {
        const response = await api.post(`/api/call-log/sync-call-logs`, { params });
        return response.data;
    },

};