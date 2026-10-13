import api from './api';

export interface QualificationEngineData {
    id: number;
    organization_id: number;
    tenant_id: string;
    enabled: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface QualificationEngineConnectionResponse {
    tenant_id: string;
    connected: boolean;
}

export const qualificationEngineService = {

    async getQualificationEngineStatus(organizationId: number): Promise<QualificationEngineData> {
        const response = await api.get(`/api/superadmin/qualification-engine/${organizationId}/status`);
        return response.data;
    },

    async connectQualificationEngine(organizationId: number): Promise<QualificationEngineData> {
        const response = await api.post(`/api/superadmin/qualification-engine/${organizationId}/connect`);
        return response.data;
    },

    async testConnection(organizationId: number): Promise<QualificationEngineConnectionResponse> {
        const response = await api.get(`/api/superadmin/qualification-engine/${organizationId}/test`);
        return response.data;
    },

    async disconnectQualificationEngine(organizationId: number): Promise<QualificationEngineConnectionResponse> {
        const response = await api.post(`/api/superadmin/qualification-engine/${organizationId}/disconnect`);
        return response.data;
    },
};
