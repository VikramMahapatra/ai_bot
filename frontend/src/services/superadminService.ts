import api from './api';
import {
  SuperAdminLoginRequest,
  SuperAdminLoginResponse,
  SuperAdminOrganization,
  OrganizationLimits,
  Plan,
  Subscription,
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
};
