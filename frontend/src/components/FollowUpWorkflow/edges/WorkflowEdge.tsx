import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath
} from "reactflow";

import {
    Select,
    MenuItem,
    Paper,
    IconButton,
    Box
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";

export default function WorkflowEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data
}: any) {

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition
    });

    const handleChange = (event: any) => {
        data?.onChange?.(id, event.target.value);
    };

    const handleDelete = () => {
        data?.onDelete?.(id);
    };

    return (
        <>
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: "#94a3b8",
                    strokeWidth: 1.5
                }}
            />

            <EdgeLabelRenderer>
                <div
                    style={{
                        position: "absolute",
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: "all"
                    }}
                >
                    <Paper
                        elevation={2}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 0.5,
                            py: 0.3,
                            borderRadius: 2
                        }}
                    >

                        <Select
                            size="small"
                            value={data?.condition || ""}
                            onChange={handleChange}
                            displayEmpty
                            sx={{
                                fontSize: 11,
                                height: 24,
                                minWidth: 110,
                                "& fieldset": { border: "none" }
                            }}
                        >
                            <MenuItem value="">
                                Condition
                            </MenuItem>
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

                        <IconButton
                            size="small"
                            onClick={handleDelete}
                            sx={{
                                width: 20,
                                height: 20,
                                "&:hover": {
                                    background: "#fee2e2",
                                    color: "#ef4444"
                                }
                            }}
                        >
                            <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>

                    </Paper>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}