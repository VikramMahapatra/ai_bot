import api from './api';

export interface CallTranscript {
    speaker: "Agent" | "Contact";
    text: string;
}
export interface CallLog {
    id: string;
    phone: string;
    agent?: string;
    campaign?: string;
    testCall: boolean;
    type: "Inbound" | "Outbound";
    mode: "Voice" | "Chat" | "Video";
    status: string;
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

    async syncCallLogs(): Promise<SyncCallResponse> {
        const response = await api.post(`/api/call-log/sync-call-logs`);
        return response.data;
    },

};