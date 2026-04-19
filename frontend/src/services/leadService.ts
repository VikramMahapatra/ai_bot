import api from "./api";
import { Lead, LeadCreate } from "../types";

export interface LeadListResponse {
  items: Lead[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface LeadActivity {
  id: number;
  lead_id: number;
  source?: string | null;
  session_id?: string | null;
  campaign_id?: number | null;
  activity_datetime: string; // ISO string from backend
  status?: string | null;
  attempt_label?: string | null;
  summary?: string | null;
  outcome?: string | null;
  created_at?: string;
}


export const leadService = {
  async createLead(lead: LeadCreate): Promise<Lead> {
    const response = await api.post<Lead>("/api/admin/leads", lead);
    return response.data;
  },

  async listLeads(
    skip: number = 0,
    limit: number = 10,
    widgetId?: string,
    source?: string,
    funnelStage?: string,
    productId?: string,
    campaignId?: string,
    campaignType?: string,
  ): Promise<LeadListResponse> {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    if (widgetId) params.append("widget_id", widgetId);
    if (source) params.append("source", source);
    if (funnelStage) params.append("funnel_stage", funnelStage);
    if (productId) params.append("product_id", productId);
    if (campaignId) params.append("campaign_id", campaignId);
    if (campaignType) params.append("campaign_type", campaignType);
    const response = await api.get<LeadListResponse>(
      `/api/admin/leads?${params.toString()}`,
    );
    return response.data;
  },

  async listLeadActivities(lead_id?: number): Promise<LeadActivity[]> {
    const response = await api.get<LeadActivity[]>(
      `/api/admin/leads/${lead_id}/activities`,
    );
    return response.data;
  },

  async moveLeadToFunnel(leadId: number, funnelStage: string): Promise<Lead> {
    const response = await api.patch<Lead>(
      `/api/admin/leads/${leadId}/funnel-stage`,
      {
        funnel_stage: funnelStage,
      },
    );
    return response.data;
  },

   async setLeadCloseDate(leadId: number, closeDate: string): Promise<Lead> {
    const response = await api.patch<Lead>(
      `/api/admin/leads/${leadId}/close-date`,
      {
        close_date: closeDate,
      },
    );
    return response.data;
  },

  async exportLeads(
    widgetId?: string,
    productId?: string,
    campaignId?: string,
    campaignType?: string,
  ): Promise<Blob> {
    const response = await api.get("/api/admin/leads/export", {
      params: {
        ...(widgetId ? { widget_id: widgetId } : {}),
        ...(productId ? { product_id: productId } : {}),
        ...(campaignId ? { campaign_id: campaignId } : {}),
        ...(campaignType ? { campaign_type: campaignType } : {}),
      },
      responseType: "blob",
    });
    return response.data;
  },
};
