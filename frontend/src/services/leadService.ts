import api from './api';
import { Lead, LeadCreate } from '../types';

export const leadService = {
  async createLead(lead: LeadCreate): Promise<Lead> {
    const response = await api.post<Lead>('/api/admin/leads', lead);
    return response.data;
  },

  async listLeads(
    skip: number = 0,
    limit: number = 100,
    widgetId?: string,
    source?: string,
    funnelStage?: string
  ): Promise<Lead[]> {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    if (widgetId) params.append('widget_id', widgetId);
    if (source) params.append('source', source);
    if (funnelStage) params.append('funnel_stage', funnelStage);
    const response = await api.get<Lead[]>(`/api/admin/leads?${params.toString()}`);
    return response.data;
  },

  async moveLeadToFunnel(leadId: number, funnelStage: string): Promise<Lead> {
    const response = await api.patch<Lead>(`/api/admin/leads/${leadId}/funnel-stage`, {
      funnel_stage: funnelStage,
    });
    return response.data;
  },

  async exportLeads(widgetId?: string): Promise<Blob> {
    const response = await api.get('/api/admin/leads/export', {
      params: widgetId ? { widget_id: widgetId } : undefined,
      responseType: 'blob',
    });
    return response.data;
  },
};
