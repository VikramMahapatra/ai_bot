import { Handle, Position } from "reactflow";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { Box, Chip, Typography } from "@mui/material";

export default function StopNode({ data }: any) {
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
                    label="2"
                    size="medium"
                    color="primary"
                />
            </Box>

            <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>

                {/* BIG ICON */}
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        backgroundColor: "#fee2e2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <StopCircleIcon sx={{ fontSize: 32, color: "#ef4444" }} />
                </Box>

                {/* TEXT */}
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography
                        sx={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#dc2626",
                        }}
                    >
                        Stop
                    </Typography>

                    <Typography
                        sx={{
                            fontSize: 11,
                            color: "#f87171",
                            mt: 0.3,
                        }}
                    >
                        End of workflow
                    </Typography>
                </Box>

            </Box>

            {/* React Flow Handle */}
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    background: "#ef4444",
                    width: 10,
                    height: 10,
                }}
            />
        </div>

    );
}