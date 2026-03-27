import api from './api';
import { FunnelCategory, FunnelCategoryPayload } from '../types';

export const funnelCategoryService = {
  async list(includeInactive: boolean = true): Promise<FunnelCategory[]> {
    const response = await api.get<FunnelCategory[]>(`/api/admin/funnel-categories?include_inactive=${includeInactive}`);
    return response.data;
  },

  async create(payload: FunnelCategoryPayload): Promise<FunnelCategory> {
    const response = await api.post<FunnelCategory>('/api/admin/funnel-categories', payload);
    return response.data;
  },

  async update(categoryId: number, payload: FunnelCategoryPayload): Promise<FunnelCategory> {
    const response = await api.put<FunnelCategory>(`/api/admin/funnel-categories/${categoryId}`, payload);
    return response.data;
  },

  async remove(categoryId: number): Promise<void> {
    await api.delete(`/api/admin/funnel-categories/${categoryId}`);
  },
};
