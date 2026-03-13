import api from './api';

export interface CallTranscript {
    speaker: "Agent" | "Contact";
    text: string;
}
export interface CallLog {
    id: string;
    contact: string;
    agent: string;
    type: "Inbound" | "Outbound";
    mode: "Voice" | "Chat" | "Video";
    status: "Completed" | "Missed" | "Failed" | "In Progress";
    date: string;
    startTime: string;
    endTime: string;
    industry: string;
    audioUrl: string;
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


export const callLogService = {

    async allLogs(params: CallLogFilters = {}): Promise<CallLogListResponse> {
        const response = await api.get('/api/call-log/all', { params });
        return response.data;
    },

};