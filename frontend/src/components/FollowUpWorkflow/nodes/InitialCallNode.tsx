import { Handle, Position } from "reactflow";
import PhoneIcon from "@mui/icons-material/Phone";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Checkbox from "@mui/material/Checkbox";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import React from "react";
import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useFlow } from "../../../context/FlowContext";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

export default function InitialCallNode({ data, id }: any) {
    const { onChangeGlobalWorkflowStop, edges, setNodes, onDeleteEdge } = useFlow();
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
            // 1. remove edge
            onDeleteEdge(existingEdge.id);

            // 2. remove node
            setNodes((nds: any[]) =>
                nds.filter((n) => n.id !== existingEdge.target)
            );

            return;
        }

        // create node + edge
        addStep(branch);
    };

    const addStep = (type: string) => {
        data.onAddStep?.(id, type);
    };

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
                                Initial Call
                            </span>

                            <Chip
                                label="START"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: 9,
                                    backgroundColor: "#dbeafe",
                                    color: "#1d4ed8",
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
                            Starts immediately
                        </Typography>

                    </div>

                </div>

                {data?.globalWorkflowStop && (
                    <Box sx={{ mt: 1.5 }}>
                        <Alert
                            severity="error"
                            variant="outlined"
                            sx={{
                                fontSize: 11,
                                py: 0.3,
                                px: 1,
                                borderRadius: 2,
                                backgroundColor: "#fef2f2",
                                borderColor: "#fecaca",
                                color: "#b91c1c",
                                "& .MuiAlert-icon": {
                                    fontSize: 16,
                                    color: "#ef4444"
                                }
                            }}
                        >
                            Stop If:{" "}
                            <strong style={{ textTransform: "capitalize" }}>
                                {data.globalWorkflowStop}
                            </strong>
                        </Alert>
                    </Box>
                )}

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


                    {/* Connected */}
                    {/* Connected */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mt: 1.5,
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            border: "1px solid #dcfce7",
                            background: "#f0fdf4",
                            cursor: "pointer",
                            transition: "all .2s ease",
                            "&:hover": {
                                background: "#dcfce7",
                                borderColor: "#86efac"
                            }
                        }}
                        onClick={() => toggleConnected("connected")}
                    >
                        <Checkbox
                            size="small"
                            checked={isConnected}
                            sx={{
                                padding: "2px",
                                color: "#16a34a",
                                '&.Mui-checked': {
                                    color: "#16a34a",
                                },
                            }}
                        />

                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "#15803d"
                            }}
                        >
                            Call Connected
                        </span>
                    </Box>



                    {/* Not Connected */}
                    {/* Not Connected */}
                    <Box
                        onClick={() => toggleConnected("not_connected")}

                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mt: 1.5,
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            border: "1px solid #fed7aa",
                            background: "#fff7ed",
                            cursor: "pointer",
                            transition: "all .2s ease",
                            "&:hover": {
                                background: "#ffedd5",
                                borderColor: "#fdba74"
                            }
                        }}
                    >
                        <Checkbox
                            size="small"
                            checked={isNotConnected}
                            sx={{
                                padding: "2px",
                                color: "#ea580c",
                                '&.Mui-checked': {
                                    color: "#ea580c",
                                },
                            }}
                        />

                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "#c2410c"
                            }}
                        >
                            Call Not Connected
                        </span>
                    </Box>

                </Box>

                <div className="nodrag nopan mt-4 border-t pt-3">
                    <FormControl size="small" fullWidth>
                        <label
                            className="
                        text-[10px]
                        font-semibold
                        text-gray-500
                        uppercase
                        tracking-wider
                        "
                        >
                            Global Workflow Stop
                        </label>

                        <Select
                            displayEmpty
                            value={data?.globalWorkflowStop || ""}
                            onChange={(e) =>
                                onChangeGlobalWorkflowStop(id, e.target.value)
                            }
                        >
                            <MenuItem value="">No Exit Condition</MenuItem>
                            <MenuItem value="negative">
                                Negative
                            </MenuItem>

                            <MenuItem value="neutral">
                                Neutral
                            </MenuItem>

                            <MenuItem value="positive">
                                Positive
                            </MenuItem>
                            <MenuItem value="satisfactory">
                                Satisfactory
                            </MenuItem>
                        </Select>
                    </FormControl>
                </div>

            </div>



            {/* Handles */}

            <Handle
                type="source"
                position={Position.Right}
                style={{
                    background: "#3b82f6",
                    width: 8,
                    height: 8
                }}
            />

        </div >
    );
}