import { Handle, Position } from "reactflow";
import PhoneIcon from "@mui/icons-material/Phone";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Checkbox, Chip, IconButton, Step, Tooltip, Typography } from "@mui/material";
import StepEditNode from "./StepEditNode";
import { useFlow } from "../../../context/FlowContext";
import { useEffect, useState } from "react";
import { CallingAgentLookup, callingAgentService } from "../../../services/callingAgentService";
import { messageTemplateService } from "../../../services/messageTemplateService";
import { UserRound, FileText, Clock } from "lucide-react";
import AddIcon from "@mui/icons-material/Add";

export default function CustomStepNode({ data, id }: any) {
    const { onEditOutcome, onDeleteNode, edges, onDeleteEdge, setNodes, onAddOutcome } = useFlow();
    const [agents, setAgents] = useState<CallingAgentLookup[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const isConnected = edges.some(
        (e: any) => e.source === id && e.data?.branch === "connected"
    );

    const isNotConnected = edges.some(
        (e: any) => e.source === id && e.data?.branch === "not_connected"
    );

    const toggleConnected = (branch: string) => {
        const existingEdge = edges.find(
            (e: any) => e.source === id && e.data?.branch === branch
        );

        if (existingEdge) {
            const targetNodeId = existingEdge.target;

            // 1. remove edge
            onDeleteEdge(existingEdge.id);

            // 2. check if target node is used by other edges
            const isNodeStillUsed = edges.some(
                (e: any) =>
                    e.id !== existingEdge.id &&
                    (e.source === targetNodeId || e.target === targetNodeId)
            );

            // 3. prevent deleting STOP node
            setNodes((nds: any[]) => {
                const targetNode = nds.find((n) => n.id === targetNodeId);

                const isStopNode =
                    targetNode?.type === "stop" || targetNode?.id === "stop";

                if (!isNodeStillUsed && !isStopNode) {
                    return nds.filter((n) => n.id !== targetNodeId);
                }

                return nds;
            });

            return;
        }

        // create node + edge
        addNext(branch);
    };

    const addNext = (type: string) => {
        data.onAddStep?.(id, type);
    };

    const loadAgentLookup = async () => {
        const data = await callingAgentService.agentLookup();
        setAgents(data || []);
    };

    const loadTemplateLookup = async () => {
        const data = await messageTemplateService.templateLookup();
        setTemplates(data || []);
    };

    useEffect(() => {
        loadAgentLookup();
        loadTemplateLookup();
    }, [id]);

    const titleCase = (value: string) =>
        value
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

    return (
        <div
            className="
            bg-white
            rounded-2xl
            border
            border-blue-200
            shadow-md
            hover:shadow-lg
            transition-all
            duration-200
            relative
            w-[240px]
            overflow-hidden
            "
        >

            {/* Step Badge */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    right: 0
                }}
            >
                <Chip
                    label={`${data.stepNumber}`}
                    size="medium"
                    color="primary"
                />
            </Box>


            <div className="p-4">

                {/* Header */}
                <div className="flex items-center gap-3 mb-1">

                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #eff6ff, #e0e7ff)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid #dbeafe",
                            mr: 1.5
                        }}
                    >
                        <PhoneIcon
                            sx={{
                                fontSize: 22,
                                color: "#2563eb"
                            }}
                        />
                    </Box>

                    <div className="flex flex-col">

                        <div className="flex items-center gap-2">

                            <span className="text-base font-semibold text-gray-900">
                                {data.title}
                            </span>

                            <Chip
                                label="STEP"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: 9,
                                    backgroundColor: "#e0e7ff",
                                    color: "#4338ca",
                                    fontWeight: 600
                                }}
                            />

                        </div>

                        <Typography
                            sx={{
                                fontSize: 11,
                                color: "#9ca3af",   // lighter gray
                                fontWeight: 400
                            }}
                        >
                            {data.branch && `Triggered on ${data.branch}`}
                            {!data.branch && "Configure your action"}
                        </Typography>

                    </div>

                </div>


                {!!data.editingOutcomeId && (
                    <StepEditNode
                        data={data}
                        id={id}
                        outcomeId={data.editingOutcomeId}
                        agents={agents}
                        templates={templates}
                    />
                )}

                {!data.editingOutcomeId && (
                    <>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 1.5,
                                mt: 2
                            }}
                        >

                            {/* Edit */}
                            {/* Add Outcome */}
                            <Box
                                onClick={() => onAddOutcome(id)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.6,
                                    px: 1.2,
                                    py: 0.6,
                                    borderRadius: 2,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: "#16a34a",
                                    border: "1px solid #e5e7eb",
                                    backgroundColor: "#fff",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    "&:hover": {
                                        backgroundColor: "#f0fdf4",
                                        borderColor: "#86efac",
                                        color: "#15803d",
                                        transform: "translateY(-1px)"
                                    }
                                }}
                            >
                                <AddIcon sx={{ fontSize: 14 }} />
                                {data.branch === "not_connected"
                                    ? "Add Action"
                                    : "Add Outcome"}
                            </Box>


                            {/* Delete */}
                            <Box
                                onClick={() => onDeleteNode(id)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.6,
                                    px: 1.2,
                                    py: 0.6,
                                    borderRadius: 2,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: "error.main",
                                    border: "1px solid #e5e7eb",
                                    backgroundColor: "#fff",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    "&:hover": {
                                        backgroundColor: "#fef2f2",
                                        borderColor: "#fecaca",
                                        color: "#dc2626",
                                        transform: "translateY(-1px)"
                                    }
                                }}
                            >
                                <DeleteIcon sx={{ fontSize: 14 }} />
                                Delete
                            </Box>

                        </Box>

                        {/* Summary Section */}
                        {data.outcomes?.map((outcome: any) => {

                            const selectedAgent = agents?.find(
                                (agent: any) => agent.id === outcome.agentId
                            );

                            const selectedTemplate = templates?.find(
                                (template: any) => template.id === outcome.templateId
                            );

                            return (
                                <Box
                                    key={outcome.id}
                                    sx={{
                                        mt: 1,
                                        px: 1.2,
                                        py: 0.9,
                                        borderRadius: 2,
                                        backgroundColor: "#f9fafb",
                                        border: "1px solid #f3f4f6",
                                    }}
                                >

                                    {/* HEADER */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            mb: 0.5
                                        }}
                                    >
                                        {/* Outcome Label */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.8
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: "50%",
                                                    backgroundColor:
                                                        outcome.outcome === "positive"
                                                            ? "#22c55e"
                                                            : outcome.outcome === "neutral"
                                                                ? "#f59e0b"
                                                                : outcome.outcome === "negative"
                                                                    ? "#ef4444"
                                                                    : "#9ca3af"
                                                }}
                                            />

                                            <Typography
                                                sx={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: "#374151",
                                                    letterSpacing: 0.2
                                                }}
                                            >
                                                {data.branch === "not_connected"
                                                    ? "ACTION"
                                                    : titleCase(outcome.outcome) || "Outcome"}

                                            </Typography>
                                        </Box>

                                        {/* EDIT BUTTON */}
                                        <Box
                                            onClick={() => onEditOutcome(id, outcome.id)}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.4,
                                                px: 0.8,
                                                py: 0.3,
                                                borderRadius: 1.5,
                                                fontSize: 10,
                                                fontWeight: 500,
                                                color: "primary.main",
                                                cursor: "pointer",
                                                "&:hover": {
                                                    backgroundColor: "#eff6ff"
                                                }
                                            }}
                                        >
                                            <EditIcon sx={{ fontSize: 12 }} />
                                            Edit
                                        </Box>
                                    </Box>


                                    {/* BODY */}
                                    <Box display="flex" flexDirection="column" gap={0.2}>
                                        <Typography
                                            sx={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "#6b7280",
                                                textTransform: "uppercase",
                                                letterSpacing: 0.4
                                            }}
                                        >
                                            {outcome.stepType || "ACTION"}
                                        </Typography>

                                        {/* Agent */}
                                        {outcome.stepType === "call" && selectedAgent && (
                                            <Typography fontSize={11} color="#374151">
                                                Agent: <b>{selectedAgent.name}</b>
                                            </Typography>
                                        )}

                                        {/* Template */}
                                        {["sms", "whatsapp", "email"].includes(outcome.stepType) &&
                                            selectedTemplate && (
                                                <Typography fontSize={11} color="#374151">
                                                    Template: <b>{selectedTemplate.name}</b>
                                                </Typography>
                                            )}

                                        {/* Delay */}
                                        {outcome.delay > 0 && (
                                            <Typography fontSize={11} color="#374151">
                                                Delay: <b>{outcome.delay} {outcome.delayUnit || "minutes"}</b>
                                            </Typography>
                                        )}

                                    </Box>

                                </Box>
                            );
                        })}
                        {/* Branch Section */}
                        <Box sx={{ mt: 2, borderTop: "1px solid #eee", pt: 1.5 }}>

                            <Typography
                                sx={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "#9ca3af",
                                    textTransform: "uppercase",
                                    letterSpacing: ".05em"
                                }}
                            >
                                Call Status Branches
                            </Typography>


                            <Box
                                onClick={() => {
                                    toggleConnected("connected");
                                }}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mt: 1.5,
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: 2,
                                    border: "1px solid #dcfce7",
                                    backgroundColor: "#f0fdf4",
                                    cursor: "pointer",
                                    transition: "all .2s ease",
                                    "&:hover": {
                                        backgroundColor: "#dcfce7",
                                        borderColor: "#86efac"
                                    }
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={isConnected}
                                    sx={{
                                        p: "2px",
                                        color: "#16a34a",
                                        '&.Mui-checked': {
                                            color: "#16a34a",
                                        },
                                    }}
                                />

                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: "#15803d"
                                    }}
                                >
                                    Call Connected
                                </Typography>

                            </Box>

                            <Box
                                onClick={() => {
                                    toggleConnected("not_connected");
                                }}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mt: 1.5,
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: 2,
                                    border: "1px solid #fed7aa",
                                    backgroundColor: "#fff7ed",
                                    cursor: "pointer",
                                    transition: "all .2s ease",
                                    "&:hover": {
                                        backgroundColor: "#ffedd5",
                                        borderColor: "#fdba74"
                                    }
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={isNotConnected}
                                    sx={{
                                        p: "2px",
                                        color: "#ea580c",
                                        '&.Mui-checked': {
                                            color: "#ea580c",
                                        },
                                    }}
                                />

                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: "#c2410c"
                                    }}
                                >
                                    Call Not Connected
                                </Typography>

                            </Box>

                        </Box>
                    </>
                )}

            </div>

            {/* Target (input) */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    background: "#3b82f6",
                    width: 8,
                    height: 8
                }}
            />


            {/* Source: Connected */}
            <Handle
                type="source"
                id="connected"
                position={Position.Right}
                style={{
                    top: "40%",
                    background: "#22c55e",
                    width: 10,
                    height: 10
                }}
            />

            {/* Source: Not Connected */}
            <Handle
                type="source"
                id="not_connected"
                position={Position.Right}
                style={{
                    top: "70%",
                    background: "#f97316",
                    width: 10,
                    height: 10
                }}
            />

        </div >
    );
}