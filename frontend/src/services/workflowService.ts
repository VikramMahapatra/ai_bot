import api from "./api";

export interface WorkflowLookupItem {
    id: number;
    name: string;
}


export const workflowService = {

    async getWorkflowLookup(): Promise<WorkflowLookupItem[]> {
        const response = await api.get<WorkflowLookupItem[]>('/api/workflows/lookup');
        return response.data;
    },
};