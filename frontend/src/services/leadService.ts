import api from './api';
import { Lead, LeadCreate } from '../types';

export const leadService = {
  async createLead(lead: LeadCreate): Promise<Lead> {
    const response = await api.post<Lead>('/api/admin/leads', lead);
    return response.data;
  },

  async listLeads(skip: number = 0, limit: number = 100): Promise<Lead[]> {
    const response = await api.get<Lead[]>(`/api/admin/leads?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  async exportLeads(): Promise<Blob> {
    const response = await api.get('/api/admin/leads/export', {
      responseType: 'blob',
    });
    return response.data;
  },
};
