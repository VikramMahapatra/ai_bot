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
    stepNumber?: number;
    onAddStep?: (id: string, type: string) => void;
};

type FlowEdgeData = {
    condition?: string;
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
                            label: value
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
            },
        },
        {
            id: "stop",
            type: "stop",
            position: { x: 500, y: 100 },
            data: {
                stepNumber: 2
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

    /* Add Step From Branch */
    const addStep = (parentId: string, branch: string) => {

        const newNodeId = `${Date.now()}-${branch}`;

        const parentNode = nodes.find(n => n.id === parentId);

        const stepNumber = stepCounterRef.current;


        const offsetX = branch === "connected" ? 250 : 250;
        const offsetY = branch === "connected" ? -80 : 80;


        const newNode = {
            id: newNodeId,
            type: "customStep",
            position: {
                x: (parentNode?.position.x || 200) + offsetX,
                y: (parentNode?.position.y || 200) + offsetY
            },
            data: {
                title:
                    branch === "connected"
                        ? "Call Connected"
                        : "Call Not Connected",

                branch,
                stepNumber: stepNumber,
                onAddStep: addStep
            }
        };

        const newEdge = {
            id: `e-${parentId}-${newNodeId}`,
            source: parentId,
            target: newNodeId,
            type: "workflow",
            data: {
                label: branch,
                onDelete: onDeleteEdge,
                onChange: onEdgeLabelChange
            }
        };

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);

        stepCounterRef.current += 1;
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

    const onChangeStepType = (id: string, value: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            stepType: value,
                            agentId: undefined,
                            templateId: undefined,
                        },
                    }
                    : node
            )
        );
    };

    const onChangeAgent = (nodeId: string, agentId: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            agentId, // ✅ IMPORTANT
                        },
                    }
                    : node
            )
        );
    };

    const nodeHandlers = {
        onEditNode,
        onCancelNode,
        onChangeStepType,
        onChangeAgent
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