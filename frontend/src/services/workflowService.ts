import api from "./api";
import { Node, Edge } from "reactflow";

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge<WorkflowEdgeData>;

export interface WorkflowLookupItem {
    id: number;
    name: string;
}

export interface Workflow {
    id: number;
    name: string;
    description?: string;
    steps_count?: number;
    actions_count?: number;
    is_active?: boolean;
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

export interface WorkflowUpdateResponse {
    message: string;
    id: string;
    success: boolean;
}

export interface WorkflowBuilderResponse {
    id: number;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export interface WorkflowEdgeData {
    branch?: string;
    condition?: string;

    // runtime handlers
    onDelete?: (edgeId: string) => void;
    onChange?: (edgeId: string, value: string) => void;
}

export interface WorkflowNodeData {
    title: string;
    stepNumber: number;
    branch?: string;
    outcomes: WorkflowOutcome[];

    // runtime handlers (frontend only)
    onAddStep?: (parentId: string, branch: string) => void;
}

export interface WorkflowOutcome {
    id?: number;
    branch?: string;
    outcome?: string;

    stepType?: "call" | "sms" | "email" | "whatsapp";

    agentId?: number | null;
    templateId?: number | null;

    delay?: number;
    delayUnit?: "minutes" | "hours" | "days";
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


    async createWorkflow(payload: any): Promise<WorkflowUpdateResponse> {
        const response = await api.post<WorkflowUpdateResponse>('/api/workflows/create', payload);
        return response.data;
    },

    async updateWorkflow(
        workflowId: number,
        payload: any
    ): Promise<WorkflowUpdateResponse> {
        const response = await api.put(
            `/api/workflows/${workflowId}`,
            payload
        );
        return response.data;
    },

    async getWorkflow(workflow_id: number): Promise<WorkflowBuilderResponse> {
        const response = await api.get(`/api/workflows/${workflow_id}`);
        return response.data;
    },

};