import api from './api';
import {
  SuperAdminLoginRequest,
  SuperAdminLoginResponse,
  SuperAdminOrganization,
  OrganizationLimits,
  Plan,
  Subscription,
  CallingNumber,
} from '../types';

export const superadminService = {
  async login(credentials: SuperAdminLoginRequest): Promise<SuperAdminLoginResponse> {
    const response = await api.post<SuperAdminLoginResponse>('/api/superadmin/login', credentials);
    return response.data;
  },

  async bootstrap(username: string, password: string, email?: string) {
    const response = await api.post('/api/superadmin/bootstrap', { username, password, email });
    return response.data;
  },

  async listOrganizations(): Promise<SuperAdminOrganization[]> {
    const response = await api.get<SuperAdminOrganization[]>('/api/superadmin/organizations');
    return response.data;
  },

  async createOrganization(payload: {
    organization_name: string;
    description?: string;
    admin_username: string;
    admin_email: string;
    admin_password: string;
    plan_id: number;
    billing_cycle: 'monthly' | 'yearly';
    trial_days?: number;
    limits?: Partial<OrganizationLimits>;
  }) {
    const response = await api.post<SuperAdminOrganization>('/api/superadmin/organizations', payload);
    return response.data;
  },

  async updateOrganization(
    orgId: number,
    payload: {
      organization_name?: string;
      description?: string;
      admin_username?: string;
      admin_email?: string;
      admin_password?: string;
    }
  ) {
    const response = await api.put<SuperAdminOrganization>(`/api/superadmin/organizations/${orgId}`, payload);
    return response.data;
  },

  async deleteOrganization(orgId: number) {
    const response = await api.delete<{ success: boolean; deleted_organization_id: number }>(`/api/superadmin/organizations/${orgId}`);
    return response.data;
  },

  async updateLimits(orgId: number, limits: Partial<OrganizationLimits>) {
    const response = await api.put<OrganizationLimits>(`/api/superadmin/organizations/${orgId}/limits`, limits);
    return response.data;
  },

  async assignSubscription(orgId: number, payload: { plan_id: number; billing_cycle: 'monthly' | 'yearly'; trial_days?: number }) {
    const response = await api.post<Subscription>(`/api/superadmin/organizations/${orgId}/subscription`, payload);
    return response.data;
  },

  async listPlans(): Promise<Plan[]> {
    const response = await api.get<Plan[]>('/api/superadmin/plans');
    return response.data;
  },

  async createPlan(payload: Omit<Plan, 'id'>) {
    const response = await api.post<Plan>('/api/superadmin/plans', payload);
    return response.data;
  },

  async updatePlan(planId: number, payload: Partial<Plan>) {
    const response = await api.put<Plan>(`/api/superadmin/plans/${planId}`, payload);
    return response.data;
  },

  async deletePlan(planId: number) {
    const response = await api.delete<{ success: boolean; deleted_plan_id: number }>(`/api/superadmin/plans/${planId}`);
    return response.data;
  },

  async getAnalyticsOverview() {
    const response = await api.get('/api/superadmin/analytics/overview');
    return response.data;
  },

  async getAnalyticsByOrg() {
    const response = await api.get('/api/superadmin/analytics/by-org');
    return response.data;
  },

  async getOrgAnalytics(orgId: number) {
    const response = await api.get(`/api/superadmin/analytics/org/${orgId}`);
    return response.data;
  },

  // Calling No
  async getCallingNumbers(orgId: number): Promise<CallingNumber[]> {
    const response = await api.get<CallingNumber[]>(`/api/superadmin/org/${orgId}/calling-numbers`);
    return response.data;
  },

  async createCallingNumber(orgId: number, payload: Omit<CallingNumber, 'id'>) {
    const response = await api.post<CallingNumber>(`/api/superadmin/org/${orgId}/calling-number`, payload);
    return response.data;
  },

  async updateCallingNumber(callingNoId: number, payload: Partial<Plan>) {
    const response = await api.put<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}`, payload);
    return response.data;
  },

  async setDefaultCallingNumber(callingNoId: number) {
    const response = await api.patch<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}/default`);
    return response.data;
  },

  async toggleActiveCallingNumber(callingNoId: number) {
    const response = await api.patch<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}/active`);
    return response.data;
  },

  async deleteCallingNumber(callingNoId: number) {
    const response = await api.delete<CallingNumber>(`/api/superadmin/org/calling-number/${callingNoId}`);
    return response.data;
  },



};
