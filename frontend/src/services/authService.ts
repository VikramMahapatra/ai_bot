import api from './api';
import { LoginRequest, LoginResponse, Organization, SuperAdminLoginRequest, SuperAdminLoginResponse } from '../types';

export const authService = {
  async getOrganizationsByUsername(username: string): Promise<Organization[]> {
    const response = await api.get<Organization[]>(`/api/admin/organizations/by-username/${username}`);
    return response.data;
  },

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/admin/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('organization_id', response.data.organization_id.toString());
      localStorage.setItem('organization_name', response.data.organization_name);
      localStorage.setItem('user_role', response.data.role);
      localStorage.setItem('user_id', response.data.user_id.toString());
    }
    return response.data;
  },

  async superadminLogin(credentials: SuperAdminLoginRequest): Promise<SuperAdminLoginResponse> {
    const response = await api.post<SuperAdminLoginResponse>('/api/superadmin/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user_role', response.data.role);
      localStorage.setItem('user_id', response.data.superadmin_id.toString());
      localStorage.removeItem('organization_id');
      localStorage.removeItem('organization_name');
    }
    return response.data;
  },

  async register(organizationName: string, username: string, email: string, password: string) {
    const response = await api.post('/api/admin/register', {
      organization_name: organizationName,
      username,
      email,
      password,
    });
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/api/admin/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('organization_id');
    localStorage.removeItem('organization_name');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
  },

  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  getOrganizationId(): number | null {
    const orgId = localStorage.getItem('organization_id');
    return orgId ? parseInt(orgId, 10) : null;
  },

  getUserRole(): string | null {
    return localStorage.getItem('user_role');
  },

  getUserId(): number | null {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId, 10) : null;
  },

  getOrganizationName(): string | null {
    return localStorage.getItem('organization_name');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  isAdmin(): boolean {
    return this.getUserRole() === 'ADMIN';
  },
  isSuperAdmin(): boolean {
    return this.getUserRole() === 'SUPERADMIN';
  },
};
