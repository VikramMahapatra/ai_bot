import { Organization } from "../types";
import api from "./api";

export interface ChannelList {
  channel_id: number;
  name: string;
  is_active: boolean;
  organizations: Organization[];
}

export interface ChannelFilters {
  // search
  search?: string;

  // pagination
  skip?: number;
  limit?: number;
}

export interface ChannelListResponse {
  items: ChannelList[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface ChannelUpdateResponse {
  message: string;
  channel_id: number;
  success: boolean;
}

export interface ChannelFormData {
  name: string;
  isActive: boolean;
}

export interface ChannelFormErrors {
  name: string;
}

export const channelService = {
  async listChannels(
    params: ChannelFilters = {},
  ): Promise<ChannelListResponse> {
    const response = await api.get("/api/superadmin/channels/all", { params });
    return response.data;
  },

  async createChannel(data: {
    name: string;
    isActive: boolean;
  }): Promise<ChannelUpdateResponse> {
    const response = await api.post<ChannelUpdateResponse>(
      "/api/superadmin/channels/create",
      {
        name: data.name,
        is_active: data.isActive,
      },
    );
    return response.data;
  },

  async updateChannel(
    id: number,
    data: {
      name: string;
      isActive: boolean;
    },
  ): Promise<ChannelUpdateResponse> {
    const response = await api.put<ChannelUpdateResponse>(
      `/api/superadmin/channels/update/${id}`,
      {
        name: data.name,
        is_active: data.isActive,
      },
    );
    return response.data;
  },

  async deleteChannel(id: number): Promise<void> {
    await api.delete(`/api/superadmin/channels/delete/${id}`);
  },
};
