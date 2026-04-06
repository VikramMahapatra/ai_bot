import { CallingNumber } from "../types";
import api from "./api";

export interface CallAnalyticsFilters {
    start_date?: string;
    end_date?: string;
    campaign_id?: number;
}

export interface LiveCall {
    name: string;
    campaign: string;
    duration: string;
}

export interface RecentCall {
    name: string;
    campaign: string;
    duration: string;
    status: "queued" | "live" | "ended";
    phone?: string;
    agent?: string;
}


export interface AnalyticsSummary {
    total_calls: number;
    successful_calls: number;
    pickup_rate: number;       // in percentage, e.g., 58
    conversion_rate: number;   // in percentage, e.g., 7.6
    total_duration: number;    // in minutes
    active_campaigns: number;
    recent_calls: RecentCall[];
}

export interface CallVolumeEntry {
    hour: number; // 0-23
    calls: number;
}

export interface PickupTrendEntry {
    day: string; // 0-23
    rate: number;
}

export interface CallOutcome {
    name: string;
    value: string;
}

export interface IntentDistribution {
    intent: string;
    value: string;
}

export interface CallAnalytics {
    summary: AnalyticsSummary;
    charts: {
        call_volume: CallVolumeEntry[];
        pickup_trend: PickupTrendEntry[];
        call_outcomes: CallOutcome[];
        lead_outcome_data: IntentDistribution[];
    };
}

export const CallingNumberType = {
    INBOUND: 'inbound',
    OUTBOUND: 'outbound',
};

export const callService = {

    async callAnalytics(params: CallAnalyticsFilters): Promise<CallAnalytics> {
        const response = await api.get('/api/calls/analytics', { params });
        return response.data;
    },

    async getCallingNumbers(type: string): Promise<CallingNumber[]> {
        const response = await api.get<CallingNumber[]>(`/api/calls/org/calling-numbers`, { params: { type } });
        return response.data;
    },

};