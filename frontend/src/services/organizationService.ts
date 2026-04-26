import api from './api';
import type { CampaignItem, CampaignType } from './campaignService';

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
  /** Channel/source for this widget (e.g. chat, voice), when provided by the API */
  source?: string | null;
  created_at?: string;
}

export interface OrganizationMeCampaignQuery {
  source?: string;
  widget_id?: string;
  skip?: number;
  limit?: number;
}

function normalizeMeCampaignsResponse(data: unknown): CampaignItem[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) {
    return d.items as CampaignItem[];
  }
  if (Array.isArray(d.campaigns)) {
    return (d.campaigns as Record<string, unknown>[]).map((c) => ({
      id: Number(c.campaign_id ?? c.id),
      campaign_name: String(c.campaign_name ?? c.name ?? ""),
      campaign_type: (c.campaign_type as CampaignType) || "",
      message_template: String(c.message_template ?? ""),
      contact_list_id: Number(c.contact_list_id ?? 0),
      status: (c.status as CampaignItem["status"]) || "draft",
      number_sent: Number(c.number_sent ?? 0),
      number_failed: Number(c.number_failed ?? 0),
      created_at: String(c.created_at ?? ""),
    }));
  }
  return [];
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  joining_date?: string | null;
  effective_joining_date?: string | null;
  default_meet_link?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMeetingSettings {
  default_meet_link: string;
}

export interface UserListResponse {
  users: User[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface UsersFilters {
  // pagination
  search?: String;
  skip?: number;
  limit?: number;
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

  async listUsers(filters?: UsersFilters): Promise<UserListResponse> {
    const response = await api.get('/api/organizations/users', { params: filters });
    return response.data;
  },

  async listWidgets(params?: { source?: string }): Promise<OrganizationWidget[]> {
    const response = await api.get<{ widgets: OrganizationWidget[] }>(
      '/api/organizations/me/widgets',
      { params },
    );
    return Array.isArray(response.data?.widgets) ? response.data.widgets : [];
  },

  async listMeCampaigns(
    params: OrganizationMeCampaignQuery = {},
  ): Promise<CampaignItem[]> {
    const response = await api.get<unknown>('/api/organizations/me/campaigns', {
      params,
    });
    return normalizeMeCampaignsResponse(response.data);
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

  async getOrgSettings() {
    const res = await api.get("/api/organization-settings");
    return res.data;
  },

  async updateOrgSettings(data: any) {
    const res = await api.put("/api/organization-settings", data);
    return res.data;
  },

  async sendTestEmail(data: any): Promise<any> {
    const response = await api.post<User>('/api/organizations/smtp/test', data);
    return response.data;
  },

  async checkFeatureAccess(path: string): Promise<any> {
    const res = await api.get("/api/organizations/feature-access", {
      params: { path },
    });
    return res.data;
  },
};
