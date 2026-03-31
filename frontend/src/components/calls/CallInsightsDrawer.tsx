import {
    Drawer,
    Box,
    Typography,
    Grid,
    LinearProgress,
    IconButton
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CallLog } from "../../services/callLogService";

interface Props {
    open: boolean;
    onClose: () => void;
    data: CallLog | null;
}

export default function CallInsightsDrawer({ open, onClose, data }: Props) {
    if (!data) return null;
    // ✅ Safe parsing for extract_data
    const extractData =
        data?.extract_data
            ? typeof data.extract_data === "string"
                ? JSON.parse(data.extract_data)
                : data.extract_data
            : {};

    const leadInfo = data?.lead_info || {};
    const steps = data?.follow_up_recommended || [];

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: 600,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#f8fafc"
                }
            }}
        >
            {/* 🔥 Sticky Header */}
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    background: "white",
                    p: 2,
                    borderBottom: "1px solid #e5e7eb"
                }}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
            >
                <Typography variant="h6" fontWeight={700}>
                    AI Insights
                </Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* 🔥 Scrollable Content */}
            <Box sx={{ p: 2, overflowY: "auto" }}>

                {/* ================= Summary ================= */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={700} mb={1}>
                        Summary
                    </Typography>

                    <Box
                        sx={{
                            background: "white",
                            p: 2,
                            borderRadius: 2,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {data?.call_summary || "No summary available"}
                        </Typography>
                    </Box>
                </Box>

                {/* ================= Next Steps ================= */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={700} mb={1}>
                        Recommended Next Steps
                    </Typography>

                    {steps.length ? (
                        steps.map((step: string, i: number) => (
                            <Box
                                key={i}
                                sx={{
                                    background: "white",
                                    p: 2,
                                    borderRadius: 2,
                                    mb: 1.5,
                                    display: "flex",
                                    gap: 1,
                                    alignItems: "flex-start",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontWeight: 700,
                                        color: "primary.main"
                                    }}
                                >
                                    {i + 1}.
                                </Typography>

                                <Typography variant="body2">
                                    {step.replace(/^-\s*/, "")}
                                </Typography>
                            </Box>
                        ))
                    ) : (
                        <Typography variant="body2">No steps available</Typography>
                    )}
                </Box>

                {/* ================= Lead Info ================= */}
                {/* <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={700} mb={2}>
                        Lead Information
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Box
                                sx={{
                                    background: "white",
                                    p: 2,
                                    borderRadius: 2,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    Lead Quality
                                </Typography>

                                <Typography fontWeight={700}>
                                    {leadInfo?.lead_quality?.label || "N/A"}
                                </Typography>

                                <Typography color="success.main" fontWeight={600}>
                                    {leadInfo?.lead_quality?.rate ?? 0}%
                                </Typography>

                                <LinearProgress
                                    variant="determinate"
                                    value={leadInfo?.lead_quality?.rate || 0}
                                    sx={{
                                        mt: 1,
                                        height: 6,
                                        borderRadius: 5
                                    }}
                                />
                            </Box>
                        </Grid>

                        <Grid item xs={6}>
                            <Box
                                sx={{
                                    background: "white",
                                    p: 2,
                                    borderRadius: 2,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    Follow Up
                                </Typography>

                                <Typography fontWeight={700}>
                                    {leadInfo?.follow_up?.label || "N/A"}
                                </Typography>

                                <Typography color="error.main" fontWeight={600}>
                                    {leadInfo?.follow_up?.rate ?? 0}%
                                </Typography>

                                <LinearProgress
                                    variant="determinate"
                                    value={leadInfo?.follow_up?.rate || 0}
                                    color="error"
                                    sx={{
                                        mt: 1,
                                        height: 6,
                                        borderRadius: 5
                                    }}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </Box> */}

                {/* ================= Extracted Data ================= */}
                <Box>
                    <Typography fontWeight={700} mb={2}>
                        Extracted Call Data
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Box
                                sx={{
                                    background: "white",
                                    p: 2,
                                    borderRadius: 2,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    Date
                                </Typography>
                                <Typography fontWeight={600}>
                                    {extractData?.date || "-"}
                                </Typography>
                            </Box>
                        </Grid>

                        <Grid item xs={6}>
                            <Box
                                sx={{
                                    background: "white",
                                    p: 2,
                                    borderRadius: 2,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    Time
                                </Typography>
                                <Typography fontWeight={600}>
                                    {extractData?.time || "-"}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Drawer>
    );
}