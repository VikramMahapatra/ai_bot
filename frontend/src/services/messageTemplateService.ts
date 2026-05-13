import api from './api';


export type TemplateType = "sms" | "whatsapp" | "email";

export interface VariableMapping {
  field?: string;
  sample?: string;
}

export type WhatsAppCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";


export type MetaStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "FAILED"

export interface Template {
  id: number;
  name: string;
  type: TemplateType;
  subject?: string;
  content: string;

  status: "Active" | "Inactive";
  created_at: string;

  // WhatsApp fields
  category?: WhatsAppCategory;
  language?: string;
  meta_status?: MetaStatus;
  meta_template_id?: string;
  rejection_reason?: string;
  variable_mappings?: Record<string, VariableMapping>;
}


export interface TemplateForm {
  name: string;
  type: TemplateType;
  subject: string;
  content: string;
  category?: WhatsAppCategory;
  language?: string;
  meta_status?: MetaStatus;
  variable_mappings?: Record<string, VariableMapping>;
}

export interface TemplateFilters {
  // pagination
  skip?: number;
  limit?: number;

  // search
  search?: string;

  //Type
  type?: string;
}

export interface TemplateListResponse {
  items: Template[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface TemplateUpdateResponse {
  message: string;
  template_id: string;
  success: boolean;
}

type TemplatePayload = {
  name: string;
  type: string;
  subject?: string;
  content: string;

  // WhatsApp only
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language?: string;
  variable_mappings?: Record<string, VariableMapping>;
};

const buildPayload = (data: TemplatePayload) => {
  const payload: any = {
    name: data.name,
    type: data.type,
    subject: data.subject,
    content: data.content,
  };

  if (data.type === "whatsapp") {
    payload.category = data.category;
    payload.language = data.language;
    payload.variable_mappings = data.variable_mappings;
  }

  return payload;
};

export const messageTemplateService = {

  async listTemplates(params: TemplateFilters = {}): Promise<TemplateListResponse> {
    const response = await api.get('/api/templates/all', { params });
    return response.data;
  },

  async createTemplate(data: TemplatePayload): Promise<TemplateUpdateResponse> {
    const response = await api.post<TemplateUpdateResponse>(
      "/api/templates/create",
      buildPayload(data)
    );

    return response.data;
  },

  async updateTemplate(
    templateId: number,
    data: TemplatePayload
  ): Promise<TemplateUpdateResponse> {
    const response = await api.put<TemplateUpdateResponse>(
      `/api/templates/update/${templateId}`,
      buildPayload(data)
    );

    return response.data;
  },

  async updateTemplateStatus(
    templateId: number,
    status: "active" | "inactive"
  ): Promise<TemplateUpdateResponse> {
    const response = await api.patch<TemplateUpdateResponse>(
      `/api/templates/${templateId}/status`,
      { status }
    );

    return response.data;
  },

  async deleteTemplate(templateId: number): Promise<void> {
    await api.delete(`/api/templates/delete/${templateId}`);
  },

  async templateLookup(): Promise<Template[]> {
    const response = await api.get<Template[]>('/api/templates/lookup');
    return response.data;
  },

  async syncWhatsAppTemplates(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/api/templates/sync-whatsapp');
    return response.data;
  },

  async getWhatsappTemplates(payload: { category: string }): Promise<Template[]> {
    const response = await api.get('/api/templates/whatsapp/utility-templates', { params: payload });
    return response.data;
  },

  async getWhatsappUtilityTemplates(): Promise<Template[]> {
    return this.getWhatsappTemplates({ category: "UTILITY" });
  }
};
