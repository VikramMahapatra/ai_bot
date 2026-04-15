import api from './api';


export type TemplateType = "sms" | "whatsapp" | "email";

export interface Template {
  id: number;
  name: string;
  type: TemplateType;
  subject?: string;
  content: string;
  status: "Active" | "Inactive";
  created_at: string;
}


export interface TemplateFilters {
  // pagination
  skip?: number;
  limit?: number;

  // search
  search?: string;
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

export const messageTemplateService = {

  async listTemplates(params: TemplateFilters = {}): Promise<TemplateListResponse> {
    const response = await api.get('/api/templates/all', { params });
    return response.data;
  },

  async createTemplate(data: {
    name: string;
    type: string;
    subject?: string;
    content: string;
  }): Promise<TemplateUpdateResponse> {
    const response = await api.post<TemplateUpdateResponse>('/api/templates/create', {
      name: data.name,
      type: data.type,
      subject: data.subject,
      content: data.content
    });
    return response.data;
  },

  async updateTemplate(
    templateId: number,
    data: {
      name: string;
      type: string;
      subject?: string;
      content: string;
    }
  ): Promise<TemplateUpdateResponse> {
    const response = await api.put<TemplateUpdateResponse>(`/api/templates/update/${templateId}`, data);
    return response.data;
  },

  async deleteTemplate(templateId: number): Promise<void> {
    await api.delete(`/api/templates/delete/${templateId}`);
  },

  async templateLookup(): Promise<Template[]> {
    const response = await api.get<Template[]>('/api/templates/lookup');
    return response.data;
  },
};
