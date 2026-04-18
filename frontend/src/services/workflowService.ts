import api from "./api";

export interface WorkflowLookupItem {
    id: number;
    name: string;
}

export interface Workflow {
    id: number;
    name: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface WorkflowFilters {
    // pagination
    skip?: number;
    limit?: number;

    // search
    search?: string;
}

export interface WorkflowListResponse {
    items: Workflow[];
    pagination: {
        total: number;
        skip: number;
        limit: number;
    };
}

export const workflowService = {
    async listWorkflows(params: WorkflowFilters = {}): Promise<WorkflowListResponse> {
        const response = await api.get('/api/workflows/all', { params });
        return response.data;
    },

    async getWorkflowLookup(): Promise<WorkflowLookupItem[]> {
        const response = await api.get<WorkflowLookupItem[]>('/api/workflows/lookup');
        return response.data;
    },
};