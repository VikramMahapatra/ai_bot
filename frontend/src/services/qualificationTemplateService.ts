import api from "./api";

export type QualificationStatus = "Active" | "Inactive";
export type AttributeDataType = "text" | "number" | "boolean" | "date" | "select" | "multi_select";

export interface QualificationCriterion {
  id?: number;
  name: string;
  criterion_key?: string;
  source: "predefined" | "custom";
  importance: "Essential" | "Supporting";
  description?: string;
  is_required: boolean;
  weight: number;
}

export interface QualificationAttribute {
  id?: number;
  key: string;
  label: string;
  data_type: AttributeDataType;
  description?: string;
  is_required: boolean;
  options: string[];
}

export interface PositiveSignal {
  id?: number;
  name: string;
  description?: string;
  score: number;
}

export interface DisqualificationCriterion {
  id?: number;
  name: string;
  description?: string;
  action: "disqualify" | "review";
}

export interface LeadTemperature {
  id?: number;
  name: "Cold" | "Warm" | "Hot" | "Very Hot";
  min_score: number;
  max_score: number;
  description?: string;
  color: string;
}

export interface QualificationTemplatePayload {
  name: string;
  description?: string;
  objective: string;
  status: QualificationStatus;
  qualification_mode: "essential_supporting" | "any_selected" | "all_selected";
  criteria: QualificationCriterion[];
  attributes: QualificationAttribute[];
  positive_signals: PositiveSignal[];
  disqualification_criteria: DisqualificationCriterion[];
  lead_temperatures: LeadTemperature[];
}

export interface QualificationTemplate extends QualificationTemplatePayload {
  id: number;
  organization_id: number;
  created_at: string;
  updated_at?: string;
}

export interface QualificationTemplateSummary {
  id: number;
  name: string;
  description?: string;
  objective: string;
  status: QualificationStatus;
  created_at: string;
  updated_at?: string;
}

export interface QualificationTemplateListResponse {
  items: QualificationTemplateSummary[];
  total: number;
  skip: number;
  limit: number;
}

export const qualificationTemplateService = {
  async list(params: { search?: string; status?: QualificationStatus; skip?: number; limit?: number } = {}) {
    const response = await api.get<QualificationTemplateListResponse>("/api/qualification-templates", { params });
    return response.data;
  },

  async get(templateId: number) {
    const response = await api.get<QualificationTemplate>(`/api/qualification-templates/${templateId}`);
    return response.data;
  },

  async create(payload: QualificationTemplatePayload) {
    const response = await api.post<QualificationTemplate>("/api/qualification-templates", payload);
    return response.data;
  },

  async update(templateId: number, payload: QualificationTemplatePayload) {
    const response = await api.put<QualificationTemplate>(`/api/qualification-templates/${templateId}`, payload);
    return response.data;
  },

  async updateStatus(templateId: number, status: QualificationStatus) {
    const response = await api.patch<QualificationTemplateSummary>(
      `/api/qualification-templates/${templateId}/status`,
      { status },
    );
    return response.data;
  },

  async remove(templateId: number) {
    await api.delete(`/api/qualification-templates/${templateId}`);
  },
};