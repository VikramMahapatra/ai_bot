import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
} from "reactflow";

import "reactflow/dist/style.css";
import InitialCallNode from "../nodes/InitialCallNode";
import CustomStepNode from "../nodes/CustomStepNode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Grid, IconButton, LinearProgress, Paper, TextField, Typography } from "@mui/material";
import {
    Add,
    Delete,
    ArrowBack,
    AccessTime,
} from "@mui/icons-material";
import Save from "@mui/icons-material/Save";
import WorkflowEdge from "../edges/WorkflowEdge";
import StopNode from "../nodes/StopNode";
import { FlowContext } from "../../../context/FlowContext";
import { Node } from "@xyflow/react"; // or reactflow
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { WorkflowBuilderResponse, workflowService } from "../../../services/workflowService";

const nodeTypes = {
    initialCall: InitialCallNode,
    customStep: CustomStepNode,
    stop: StopNode
};

interface FollowUpWorkflowProps {
    onBack: () => void;
    workflowId?: number | null;
}

const edgeTypes = {
    workflow: WorkflowEdge
};

type DelayUnit = "minutes" | "hours" | "days";

type FlowOutcome = {
    id: string;
    outcome?: string;
    stepType: string;   // call | sms | email | whatsapp
    agentId?: string;
    templateId?: string;
    delay?: number;
    delayUnit?: DelayUnit;
    branch?: string; // optional (useful for your edge mapping)
};

type FlowNodeData = {
    branch?: string;
    title?: string;
    stepNumber?: number;
    globalWorkflowStop?: string;
    editingOutcomeId?: any;
    outcomes?: FlowOutcome[];
    editingOutcomeDraft?: any;
    onAddStep?: (id: string, type: string) => void;
};

type FlowEdgeData = {
    condition?: string;
    branch?: string;
    onDelete?: (edgeId: string) => void;
    onChange?: (edgeId: string, value: string) => void;
};



export default function WorkflowFlowBuilder({ workflowId, onBack }: FollowUpWorkflowProps) {
    const onDeleteEdge = (edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    };

    const onEdgeLabelChange = (edgeId: string, value: string) => {

        setEdges((eds) =>
            eds.map((edge) =>
                edge.id === edgeId
                    ? {
                        ...edge,
                        data: {
                            ...edge.data,
                            condition: value
                        }
                    }
                    : edge
            )
        );

    };


    const initialNodes: Node<FlowNodeData>[] = [
        {
            id: "1",
            type: "initialCall",
            position: { x: 100, y: 100 },
            data: {
                title: "Initial Call",
                stepNumber: 1,
                globalWorkflowStop: "",
                outcomes: []
            },
        },
        {
            id: "stop",
            type: "stop",
            position: { x: 500, y: 100 },
            data: {
                title: "Stop Workflow",
                stepNumber: 2,
                globalWorkflowStop: "",
                outcomes: []
            }
        }
    ];

    const initialEdges = [
        {
            id: "e1",
            source: "1",
            target: "stop",
            type: "custom",
            data: {
                condition: "",
                onDelete: onDeleteEdge,
                onChange: onEdgeLabelChange
            }
        }
    ];


    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(initialNodes as any);
    const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>([]);
    const [workflowError, setWorkflowError] = useState<string | null>(null);
    const [workflowName, setWorkflowName] = useState("");
    const [workflowDescription, setWorkflowDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState({
        name: "",
        description: ""
    });

    useEffect(() => {
        if (!workflowId) {
            setNodes(initialNodes as any);
            setEdges([]);
            return;
        }

        loadWorkflow(workflowId);

    }, [workflowId]);

    const loadWorkflow = async (id: number) => {
        try {
            setLoading(true);

            const response: WorkflowBuilderResponse =
                await workflowService.getWorkflow(id);

            setWorkflowName(response.name);
            setWorkflowDescription(response.description || "");

            setNodes(attachNodeHandlers(response.nodes));
            setEdges(attachEdgeHandlers(response.edges));

        } catch (error) {
            setWorkflowError("Failed to load workflow");
        } finally {
            setLoading(false);
        }
    };

    const attachNodeHandlers = (nodes: any[]) =>
        nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                onAddStep: addStep
            }
        }));

    const attachEdgeHandlers = (edges: any[]) =>
        edges.map((edge) => ({
            ...edge,
            data: {
                ...edge.data,
                onDelete: onDeleteEdge,
                onChange: onEdgeLabelChange
            }
        }));



    const onConnect = useCallback((params: any) => {
        console.log(" onConnect params:", params);
        console.log("sourceHandle:", params.sourceHandle);

        setEdges((eds) =>
            addEdge(
                {
                    ...params,
                    type: "workflow",
                    data: {
                        condition: "",
                        branch: params.sourceHandle,
                        onChange: onEdgeLabelChange,
                        onDelete: onDeleteEdge
                    }
                },
                eds
            )
        );
    }, [setEdges]);

    const addStep = (parentId: string, branch: string) => {
        const newNodeId = `${Date.now()}-${branch}`;

        setNodes((prevNodes) => {
            const parentNode = prevNodes.find((n) => n.id === parentId);

            const maxStep = Math.max(
                0,
                ...prevNodes.map((n) => n.data?.stepNumber || 0)
            );

            const stepNumber = maxStep + 1;

            const newNode = {
                id: newNodeId,
                type: "customStep",
                position: {
                    x: (parentNode?.position.x || 200) + 250,
                    y:
                        (parentNode?.position.y || 200) +
                        (branch === "connected" ? -80 : 80),
                },
                data: {
                    title:
                        branch === "connected"
                            ? "Call Connected"
                            : "Call Not Connected",
                    branch,
                    stepNumber,
                    outcomes: [],
                    onAddStep: addStep
                },
            };

            return [...prevNodes, newNode];
        });

        console.log("branch:", branch);

        setEdges((eds) => [
            ...eds,
            {
                id: `e-${parentId}-${newNodeId}`,
                source: parentId,
                sourceHandle: branch,
                target: newNodeId,
                type: "workflow",
                data: {
                    branch,
                    condition: "",
                    onDelete: onDeleteEdge,
                    onChange: onEdgeLabelChange
                }
            },
        ]);
    };

    const onDeleteNode = (id: string) => {
        setNodes((nds) => {
            const filtered = nds.filter((n) => n.id !== id);

            return filtered.map((node, index) => ({
                ...node,
                data: {
                    ...node.data,
                    stepNumber: index + 1,
                },
            }));
        });

        setEdges((eds) => {
            const incoming = eds.filter((e) => e.target === id);
            const outgoing = eds.filter((e) => e.source === id);

            let updatedEdges = eds.filter(
                (e) => e.source !== id && e.target !== id
            );

            // auto reconnect (simple chain case)
            if (incoming.length === 1 && outgoing.length === 1) {
                const newEdge = {
                    id: `e-${incoming[0].source}-${outgoing[0].target}`,
                    source: incoming[0].source,
                    target: outgoing[0].target,
                    type: "workflow",
                    data: {}
                };

                updatedEdges.push(newEdge);
            }

            return updatedEdges;
        });
    };

    /* Add Manual Step */
    const addNode = () => {

        const id = `${Date.now()}`;

        setNodes((prevNodes) => {

            const maxStep = Math.max(
                0,
                ...prevNodes.map((n) => n.data?.stepNumber || 0)
            );

            const stepNumber = maxStep + 1;

            const newNode = {
                id,
                type: "customStep",
                position: {
                    x: 250,
                    y: prevNodes.length * 120 + 100,
                },
                data: {
                    title: "Call",
                    stepNumber,
                    branch: "",
                    outcomes: [],
                    onAddStep: addStep,
                },
            };

            return [...prevNodes, newNode];
        });
    };


    /* Inject addStep into initial node */
    React.useEffect(() => {
        setNodes((nds: any) =>
            nds.map((node: any) => ({
                ...node,
                data: {
                    ...node.data,
                    onAddStep: addStep,
                    stepType: node.data.stepType || "call",
                    agentId: node.data.agentId || "",
                    templateId: node.data.templateId || "",
                    delay: node.data.delay || 0,
                    delayUnit: node.data.delayUnit || "minutes"
                },
            }))
        );
    }, []);

    const onChangeStepType = (nodeId: string, value: string) => {
        updateNodeData(nodeId, { stepType: value, agentId: undefined, templateId: undefined });
    };

    const onChangeAgent = (nodeId: string, agentId: string) => {
        updateNodeData(nodeId, { agentId });
    };

    const onChangeTemplate = (nodeId: string, templateId: string) => {
        updateNodeData(nodeId, { templateId });
    };

    const onChangeDelay = (nodeId: string, delay: number) => {
        updateNodeData(nodeId, { delay });
    };

    const onChangeDelayUnit = (nodeId: string, delayUnit: string) => {
        updateNodeData(nodeId, { delayUnit });
    };

    const updateNodeData = (nodeId: string, patch: Record<string, any>) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            ...patch,
                        },
                    }
                    : node
            )
        );
    };

    const onChangeGlobalWorkflowStop = (id: string, value: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            globalWorkflowStop: value,
                        },
                    }
                    : node
            )
        );
    };

    const onUpdateOutcome = (nodeId: string, outcomeId: string, patch: any) => {
        setNodes(nodes =>
            nodes.map(node => {

                if (node.id !== nodeId) return node

                return {
                    ...node,
                    data: {
                        ...node.data,
                        editingOutcomeDraft: {
                            ...node.data.editingOutcomeDraft,
                            ...patch
                        }
                    }

                }

            })
        )
    }

    const onEditOutcome = (nodeId: string, outcomeId: string) => {
        setNodes(nodes =>
            nodes.map(node => {

                if (node.id !== nodeId) return node

                const outcome = node.data.outcomes?.find(o => o.id === outcomeId)

                return {
                    ...node,
                    data: {
                        ...node.data,
                        editingOutcomeId: outcomeId,
                        editingOutcomeDraft: { ...outcome }   // ← clone
                    }
                }

            })
        )
    }


    const onAddOutcome = (nodeId: string) => {

        const newOutcome = {
            id: `temp_${Date.now()}`,
            outcome: "all",
            stepType: "call",
            delay: 0,
            delayUnit: "minutes" as DelayUnit,
            agentId: "",
            templateId: ""
        };

        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            editingOutcomeId: newOutcome.id,
                            editingOutcomeDraft: newOutcome
                        }
                    }
                    : node
            )
        );
    };

    const onCancelOutcome = (nodeId: string) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id !== nodeId) return node;

                return {
                    ...node,
                    data: {
                        ...node.data,
                        editingOutcomeId: null,
                        editingOutcomeDraft: null
                    }
                };
            })
        );
    };

    const onSaveOutcome = (nodeId: string) => {
        setNodes((nodes) =>
            nodes.map((node) => {

                if (node.id !== nodeId) return node;

                const draft = node.data.editingOutcomeDraft;
                const editingId = node.data.editingOutcomeId;
                const nodeBranch = node.data.branch;

                const enrichedDraft = {
                    ...draft,
                    branch: nodeBranch
                };

                const exists = (node.data.outcomes || []).some(
                    (o) => o.id === editingId
                );

                return {
                    ...node,
                    data: {
                        ...node.data,
                        outcomes: exists
                            ? (node.data.outcomes || []).map((o) =>
                                o.id === editingId ? draft : o
                            )
                            : [...(node.data.outcomes || []), enrichedDraft],
                        editingOutcomeId: null,
                        editingOutcomeDraft: null
                    }
                };
            })
        );
    };


    const validateWorkflow = (nodesSnapshot = nodes, edgesSnapshot = edges) => {

        // -------------------------
        // 1. RESET GRAPH EACH TIME
        // -------------------------
        const buildGraph = (edges: any) => {
            const graph = new Map<string, Map<string, string[]>>();

            edges.forEach((e: any) => {
                if (!graph.has(e.source)) {
                    graph.set(e.source, new Map());
                }

                const handleMap = graph.get(e.source)!;

                const handle = e.sourceHandle || "__default";

                if (!handleMap.has(handle)) {
                    handleMap.set(handle, []);
                }

                handleMap.get(handle)!.push(e.target);
            });

            return graph;
        };

        const graph = buildGraph(edgesSnapshot);

        console.log("edges", edgesSnapshot);
        console.log("nodes", nodesSnapshot);
        console.log("graph", graph)

        // -------------------------
        // 2. FORM VALIDATION
        // -------------------------
        let hasError = false;
        const errors = {
            name: "",
            description: ""
        };

        if (!workflowName?.trim()) {
            errors.name = "Workflow name is required";
            hasError = true;
        }

        if (!workflowDescription?.trim()) {
            errors.description = "Description is required";
            hasError = true;
        }

        setFormError(errors);

        if (hasError) return "Form validation failed";

        // -------------------------
        // 3. STEP VALIDATION
        // -------------------------
        const stepNodes = nodesSnapshot.filter(n => n.type === "customStep");

        if (stepNodes.length === 0) {
            return "Add at least one workflow step";
        }

        for (const node of stepNodes) {

            const outcomes = node?.data?.outcomes || [];

            if (outcomes.length === 0) {
                return `Step "${node.data?.title}" must have at least one outcome/action`;
            }

            const seen = new Set();

            for (const o of outcomes) {

                const key = `${o.outcome}-${o.stepType}`;
                if (seen.has(key)) {
                    return `Duplicate outcome in "${node.data?.title}"`;
                }
                seen.add(key);

                if (node?.data?.branch === "connected" && !o.outcome) {
                    return `${node.data?.title}: Outcome required`;
                }

                if (!o.stepType) {
                    return `${node.data?.title}: Step Type required`;
                }

                if (o.stepType === "call" && !o.agentId) {
                    return `${node.data?.title}: Agent required`;
                }

                if (["sms", "email", "whatsapp"].includes(o.stepType) && !o.templateId) {
                    return `${node.data?.title}: Template required`;
                }

                if (!o.delay || o.delay <= 0) {
                    return `${node.data?.title}: Delay must be > 0`;
                }
            }
        }

        // -------------------------
        // 4. INITIAL CONNECTION CHECK
        // -------------------------
        const initialNode = nodesSnapshot.find(n => n.type === "initialCall");

        if (!initialNode) {
            return "Initial node missing";
        }

        const initialConnected = edgesSnapshot.some(
            e => e.source === initialNode?.id
        );

        if (!initialConnected) {
            return "Connect Initial Step to workflow";
        }

        // -------------------------
        // 5. STOP REACHABILITY CHECK
        // -------------------------
        const stopId = nodesSnapshot.find(n => n.type === "stop")?.id;

        const nonStopNodes = nodesSnapshot.filter(n => n.id !== stopId);

        console.log("nodes", nonStopNodes)

        const handleMap = new Map<string, Set<string>>();

        edgesSnapshot.forEach(e => {
            const key = `${e.source}:${e.sourceHandle}`;

            if (!handleMap.has(key)) {
                handleMap.set(key, new Set());
            }

            handleMap.get(key)!.add(e.target);
        });

        const requiredHandles = ["connected", "not_connected"];

        const invalidNodes: string[] = [];

        nodesSnapshot.forEach(node => {

            if (node.type === "stop") return;

            for (const handle of requiredHandles) {
                const key = `${node.id}:${handle}`;
                const targets = handleMap.get(key);

                if (!targets || targets.size === 0) {
                    invalidNodes.push(`${node.data?.title || node.id} missing ${handle}`);
                }
            }
        });

        if (invalidNodes.length > 0) {
            return `All nodes must connect both branches: ${invalidNodes[0]}`;
        }

        return null;
    };

    const saveWorkflow = async () => {

        const cleanOutcomes = (outcomes: any[] = []) => {
            return outcomes.map((o) => ({
                id: o.id ? String(o.id) : undefined,
                outcome: o.outcome,
                stepType: o.stepType,
                branch: o.branch,

                delay: o.delay !== "" ? Number(o.delay) : null,
                delayUnit: o.delayUnit || null,

                agentId: o.agentId !== "" && o.agentId != null
                    ? Number(o.agentId)
                    : null,

                templateId: o.templateId !== "" && o.templateId != null
                    ? Number(o.templateId)
                    : null,
            }));
        };

        const cleanNodes = nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            title: n.data?.title,
            stepNumber: n.data?.stepNumber,
            outcomes: cleanOutcomes(n.data?.outcomes || [])
        }));

        const cleanEdges = edges.map((e) => ({
            source: e.source,
            target: e.target,
            branch: e.data?.branch,
            condition: e.data?.condition || ""
        }));

        const payload = {
            name: workflowName,
            description: workflowDescription,
            nodes: cleanNodes,
            edges: cleanEdges
        };

        try {
            let res;
            setLoading(true)

            if (workflowId) {
                res = await workflowService.updateWorkflow(workflowId, payload);
            } else {
                res = await workflowService.createWorkflow(payload);
            }

            if (!res.success) {
                setWorkflowError(res.message);
                return;
            }

            onBack();

        } catch (error) {
            setWorkflowError("Failed to save workflow");
        }
        finally {
            setLoading(false)
        }

    };

    const handleSaveWorkflow = async () => {

        const error = validateWorkflow();

        if (error) {
            setWorkflowError(error);
            return;
        }

        setWorkflowError(null);

        try {
            await saveWorkflow();
        } catch (e: any) {
            setWorkflowError(e.message);
        }
    };

    const nodeHandlers = {
        nodes,
        onDeleteNode,
        onChangeStepType,
        onChangeAgent,
        onChangeGlobalWorkflowStop,
        edges,
        setNodes,
        onDeleteEdge,
        onChangeTemplate,
        onChangeDelay,
        onChangeDelayUnit,
        onEditOutcome,
        onCancelOutcome,
        onUpdateOutcome,
        onAddOutcome,
        onSaveOutcome
    };

    return (
        <Box height="100vh" display="flex" flexDirection="column">
            {loading && (
                <Box mb={3}>
                    <LinearProgress sx={{ borderRadius: 1.2 }} />
                </Box>
            )}

            {/* Header */}
            <Paper
                elevation={0}
                sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "#e5e7eb",
                    backgroundColor: "#fff",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                }}
            >
                {workflowError && (
                    <Box
                        sx={{
                            mb: 1.5,
                            px: 2,
                            py: 1.2,
                            borderRadius: 2,
                            backgroundColor: "#fef2f2",
                            border: "1px solid #fecaca",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                        }}
                    >
                        <ErrorOutlineIcon sx={{ fontSize: 18, color: "#dc2626" }} />

                        <Typography
                            sx={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "#b91c1c"
                            }}
                        >
                            {workflowError}
                        </Typography>
                    </Box>
                )}
                <Grid container alignItems="center" spacing={2}>

                    {/* Back Button */}
                    <Grid item>
                        <IconButton
                            onClick={onBack}
                            sx={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 2,
                                width: 36,
                                height: 36,
                                backgroundColor: "#fafafa",
                                "&:hover": {
                                    backgroundColor: "#f3f4f6",
                                }
                            }}
                        >
                            <ArrowBack fontSize="small" />
                        </IconButton>
                    </Grid>

                    {/* Title Section */}
                    <Grid item xs={12} md={3}>
                        <TextField
                            required
                            fullWidth
                            size="small"
                            label="Workflow Name"
                            variant="outlined"
                            value={workflowName}
                            onChange={(e) => {
                                setWorkflowName(e.target.value);
                                setFormError(prev => ({ ...prev, name: "" }));
                            }}
                            error={!!formError.name}
                            helperText={formError.name}
                            sx={{
                                backgroundColor: "#fff",
                            }}
                        />
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12} md={5}>
                        <TextField
                            required
                            fullWidth
                            size="small"
                            label="Description"
                            variant="outlined"
                            value={workflowDescription}
                            onChange={(e) => {
                                setWorkflowDescription(e.target.value);
                                setFormError(prev => ({ ...prev, description: "" }));
                            }}
                            error={!!formError.description}
                            helperText={formError.description}
                        />
                    </Grid>

                    {/* Save Button */}
                    <Grid item xs={12} md={3} sx={{ ml: "auto" }}>
                        <Box display="flex" justifyContent="flex-end">
                            <Button
                                variant="contained"
                                startIcon={<Save />}
                                sx={{
                                    textTransform: "none",
                                    borderRadius: 2,
                                    px: 2,
                                    boxShadow: "none",
                                    backgroundColor: "#2563eb",
                                    "&:hover": {
                                        backgroundColor: "#1d4ed8",
                                        boxShadow: "none",
                                    }
                                }}
                                onClick={handleSaveWorkflow}
                                disabled={loading}
                            >
                                {workflowId ? "Update Workflow" : "Save Workflow"}
                            </Button>
                        </Box>
                    </Grid>

                </Grid>
            </Paper>


            {/* Flow Builder */}
            <Box
                flex={1}
                position="relative"
                sx={{
                    background: "#f8fafc",
                    mt: 2,
                }}
            >
                <FlowContext.Provider value={nodeHandlers}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        minZoom={0.4}
                        maxZoom={0.8}
                        fitViewOptions={{
                            padding: 0.4
                        }}
                    >
                        <Background
                            gap={16}
                            size={1}
                            color="#cbd5e1"
                        />
                        <Controls />
                        <MiniMap />
                    </ReactFlow>
                </FlowContext.Provider>



                {/* Add Step Button */}
                <Box
                    position="absolute"
                    top={20}
                    right={20}
                >
                    <Button
                        variant="outlined"
                        startIcon={<Add />}
                        size="small"
                        onClick={addNode}
                        sx={{
                            background: "#fff",
                            textTransform: "none",
                            borderColor: "#e5e7eb",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            "&:hover": {
                                background: "#f9fafb",
                                borderColor: "#e5e7eb"
                            }
                        }}
                    >
                        Add Step
                    </Button>
                </Box>

            </Box>
        </Box>
    );
}