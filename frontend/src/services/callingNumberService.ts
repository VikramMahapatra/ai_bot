import { Organization } from "../types";
import api from "./api";

export interface CallingNumber {
  id: number;
  type: "inbound" | "outbound";
  country_code: string;
  phone_number: string;
  provider?: string;
  is_active: boolean;
  organizations: Organization[];
}

export interface CallingNumberFormData {
  type: "inbound" | "outbound";
  country_code: string;
  phone_number: string;
  provider: string;
  is_active: boolean;
}

export interface CallingNumberFormErrors {
  phone_number: string;
}


export interface CallingNumberFilters {
  // search
  search?: string;

  // pagination
  skip?: number;
  limit?: number;
}

export interface CallingNumberListResponse {
  items: CallingNumber[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface CallingNumberUpdateResponse {
  message: string;
  channel_id: number;
  success: boolean;
}


export const callingNumberService = {
  async listCallingNumbers(
    params: CallingNumberFilters = {},
  ): Promise<CallingNumberListResponse> {
    const response = await api.get("/api/superadmin/calling-numbers/all", { params });
    return response.data;
  },

  async createCallingNumber(data: CallingNumberFormData): Promise<CallingNumberUpdateResponse> {
    const response = await api.post<CallingNumberUpdateResponse>(
      "/api/superadmin/calling-numbers/create",
      {
        type: data.type,
        country_code: data.country_code,
        phone_number: data.phone_number,
        provider: data.provider,
        is_active: data.is_active,
      }
    );
    return response.data;
  },

  async updateCallingNumber(
    id: number,
    data: CallingNumberFormData
  ): Promise<CallingNumberUpdateResponse> {
    const response = await api.put<CallingNumberUpdateResponse>(
      `/api/superadmin/calling-numbers/update/${id}`,
      {
        country_code: data.country_code,
        phone_number: data.phone_number,
        provider: data.provider,
        is_active: data.is_active,
        type: data.type,
      }
    );
    return response.data;
  },

  async deleteCallingNumber(id: number): Promise<void> {
    await api.delete(`/api/superadmin/calling-numbers/delete/${id}`);
  },
};
