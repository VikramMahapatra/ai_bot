import api from './api';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER' | 'USER_HANDOFF';
  is_active: boolean;
  created_at: string;
  assigned_widget_ids?: string[];
}

export interface OrganizationWidget {
  widget_id: string;
  name: string;
  created_at?: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  default_meet_link?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMeetingSettings {
  default_meet_link: string;
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

  async getMeetingSettings(): Promise<OrganizationMeetingSettings> {
    const response = await api.get<OrganizationMeetingSettings>('/api/organizations/me/meeting-settings');
    return response.data;
  },

  async updateMeetingSettings(defaultMeetLink: string): Promise<OrganizationMeetingSettings> {
    const response = await api.put<OrganizationMeetingSettings>('/api/organizations/me/meeting-settings', {
      default_meet_link: defaultMeetLink,
    });
    return response.data;
  },

  async listUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/api/organizations/users');
    return response.data;
  },

  async listWidgets(): Promise<OrganizationWidget[]> {
    const response = await api.get<{ widgets: OrganizationWidget[] }>('/api/organizations/me/widgets');
    return Array.isArray(response.data?.widgets) ? response.data.widgets : [];
  },

  async getUser(userId: number): Promise<User> {
    const response = await api.get<User>(`/api/organizations/users/${userId}`);
    return response.data;
  },

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    role?: 'ADMIN' | 'USER' | 'USER_HANDOFF';
    assigned_widget_ids?: string[];
  }): Promise<User> {
    const response = await api.post<User>('/api/organizations/users', {
      username: data.username,
      email: data.email,
      password: data.password,
      role: data.role || 'USER',
      assigned_widget_ids: data.assigned_widget_ids || [],
    });
    return response.data;
  },

  async updateUser(
    userId: number,
    data: {
      email?: string;
      role?: 'ADMIN' | 'USER' | 'USER_HANDOFF';
      is_active?: boolean;
      assigned_widget_ids?: string[];
    }
  ): Promise<User> {
    const response = await api.patch<User>(`/api/organizations/users/${userId}`, data);
    return response.data;
  },

  async deleteUser(userId: number): Promise<void> {
    await api.delete(`/api/organizations/users/${userId}`);
  },
};
