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
import React, { useCallback, useRef, useState } from "react";
import { Box, Button, Grid, IconButton, Paper, TextField } from "@mui/material";
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

const nodeTypes = {
    initialCall: InitialCallNode,
    customStep: CustomStepNode,
    stop: StopNode
};

interface FollowUpWorkflowProps {
    onBack: () => void;
}

const edgeTypes = {
    workflow: WorkflowEdge
};

type FlowNodeData = {
    branch?: string;
    title?: string;
    stepNumber?: number;
    globalWorkflowStop?: string;
    isEditing?: boolean;
    stepType?: string;
    agentId?: string;
    templateId?: string;
    onAddStep?: (id: string, type: string) => void;
};

type FlowEdgeData = {
    condition?: string;
    branch?: string;
    onDelete?: (edgeId: string) => void;
    onChange?: (edgeId: string, value: string) => void;
};

export default function WorkflowFlowBuilder({ onBack }: FollowUpWorkflowProps) {
    const stepCounterRef = useRef(3);

    const onDeleteEdge = (edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    };

    const handleDeleteEdge = (edgeId: string) => {
        setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
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

    const initialNodes = [
        {
            id: "1",
            type: "initialCall",
            position: { x: 100, y: 100 },
            data: {
                stepNumber: 1,
                globalWorkflowStop: "",
            },
        },
        {
            id: "stop",
            type: "stop",
            position: { x: 500, y: 100 },
            data: {
                stepNumber: 2,
                globalWorkflowStop: "",
            }
        }
    ];

    const initialEdges = [
        {
            id: "e1",
            source: "1",
            target: "2",
            type: "custom",
            data: {
                condition: "",
                onDelete: onDeleteEdge,
                onChange: onEdgeLabelChange
            }
        }
    ];

    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>(initialEdges);

    const onConnect = useCallback(
        (params: any) => setEdges((eds) =>
            addEdge(
                {
                    ...params,
                    type: "workflow",
                    data: {
                        condition: "",
                        onChange: onEdgeLabelChange,
                        onDelete: onDeleteEdge
                    }
                },
                eds
            )
        ),
        [setEdges]
    );

    const getNextStepNumber = () => {
        const max = Math.max(
            0,
            ...nodes.map((n) => n.data?.stepNumber || 0)
        );

        return max + 1;
    };

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
                    delayUnit: "minutes",
                    delay: 0,
                    stepType: "call",
                    agentId: "",
                    templateId: "",
                    onAddStep: addStep
                },
            };

            return [...prevNodes, newNode];
        });

        setEdges((eds) => [
            ...eds,
            {
                id: `e-${parentId}-${newNodeId}`,
                source: parentId,
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


    const onEditNode = (id: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, isEditing: true } }
                    : node
            )
        );
    };

    const onCancelNode = (id: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, isEditing: false } }
                    : node
            )
        );
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
        const stepNumber = stepCounterRef.current;

        const newNode = {
            id,
            type: "customStep",
            position: {
                x: 250,
                y: nodes.length * 120 + 100,
            },
            data: {
                title: `Call`,
                stepNumber: stepNumber,
                onAddStep: addStep,
                isEditing: false,
                stepType: "call",
                agentId: "",
                templateId: "",
            },
        };

        setNodes((nds: any) => [...nds, newNode]);
        stepCounterRef.current += 1;
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

    const onSave = (id: string) => {
        setNodes((nds) =>
            nds.map((n) =>
                n.id === id
                    ? {
                        ...n,
                        data: {
                            ...n.data,
                            isEditing: false
                        }
                    }
                    : n
            )
        );
    };

    const nodeHandlers = {
        onEditNode,
        onCancelNode,
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
        onSave
    };

    return (
        <Box height="100vh" display="flex" flexDirection="column">

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
                            fullWidth
                            size="small"
                            label="Workflow Name"
                            variant="outlined"
                            sx={{
                                backgroundColor: "#fff",
                            }}
                        />
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12} md={5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Description"
                            variant="outlined"
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
                            >
                                Save Workflow
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