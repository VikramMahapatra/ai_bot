import api from './api';
import { OrgCreditAdminMonthSummary } from '../types/orgCreditBilling';

const basePath = '/api/admin/org-credit';

export const adminOrgCreditService = {
  async getCurrentMonthSummary(params?: { billing_period?: string }): Promise<OrgCreditAdminMonthSummary> {
    const response = await api.get<OrgCreditAdminMonthSummary>(`${basePath}/current-month`, { params });
    return response.data;
  },
};
