import api from './api';
import { authService } from './authService';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const organizationService = {
  async getOrganization(orgId: number): Promise<Organization> {
    const response = await api.get<Organization>(`/api/organizations/${orgId}`);
    return response.data;
  },

  async getCurrentOrganization(): Promise<Organization> {
    const response = await api.get<Organization>('/api/organizations/me');
    return response.data;
  },

  async listUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/api/organizations/users');
    return response.data;
  },

  async getUser(userId: number): Promise<User> {
    const response = await api.get<User>(`/api/organizations/users/${userId}`);
    return response.data;
  },

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    role?: 'ADMIN' | 'USER';
  }): Promise<User> {
    const response = await api.post<User>('/api/organizations/users', {
      username: data.username,
      email: data.email,
      password: data.password,
      role: data.role || 'USER',
    });
    return response.data;
  },

  async updateUser(
    userId: number,
    data: {
      email?: string;
      role?: 'ADMIN' | 'USER';
      is_active?: boolean;
    }
  ): Promise<User> {
    const response = await api.patch<User>(`/api/organizations/users/${userId}`, data);
    return response.data;
  },

  async deleteUser(userId: number): Promise<void> {
    await api.delete(`/api/organizations/users/${userId}`);
  },
};
