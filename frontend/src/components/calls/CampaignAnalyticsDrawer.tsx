import React, { useEffect, useState } from "react";
import {
    Drawer,
    Box,
    Typography,
    Grid,
    Divider,
    Button,
    LinearProgress,
    CircularProgress,
    Tooltip,
} from "@mui/material";
import { callCampaignService, Campaign } from "../../services/callCampaignService";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import UpdateIcon from "@mui/icons-material/Update";
import CallIcon from "@mui/icons-material/Call";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";


interface Props {
    open: boolean;
    onClose: () => void;
    campaign: Campaign | null;
}

const CampaignAnalyticsDrawer: React.FC<Props> = ({
    open,
    onClose,
    campaign,
}) => {
    if (campaign == null)
        return;
    const [campaignAnalytics, setCampaignAnalytics] = useState<Campaign | null>(null)
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && campaign?.id) {
            loadAnalytics();
        }
    }, [open, campaign]);


    const loadAnalytics = async () => {
        try {
            setLoading(true);
            if (campaign?.id) {
                const data = await callCampaignService.getCampaignAnalytics(
                    campaign?.id
                );
                setCampaignAnalytics(data);
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box
                sx={{
                    width: { xs: "95vw", sm: 700 },
                    p: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                }}
            >

                {loading ? (
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : campaignAnalytics ? (
                    <>
                        {/* Header */}
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="h6">{campaignAnalytics.name}</Typography>
                                <Typography variant="caption">{campaignAnalytics.description}</Typography>
                            </Box>
                            <Button variant="outlined" color="error" onClick={onClose}>Close</Button>
                        </Box>

                        {/* Metrics */}
                        <Grid container spacing={2} mb={2}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: "#e0f2fe",
                                        borderRadius: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5
                                    }}
                                >
                                    <CallIcon sx={{ color: "#0284c7" }} />

                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Total Calls
                                        </Typography>
                                        <Typography variant="h6">
                                            {campaignAnalytics.total_calls}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: "#dcfce7",
                                        borderRadius: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5
                                    }}
                                >
                                    <CheckCircleIcon sx={{ color: "#16a34a" }} />

                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Completed
                                        </Typography>
                                        <Typography variant="h6">
                                            {campaignAnalytics.completed_calls}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: "#cffafe",
                                        borderRadius: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5
                                    }}
                                >
                                    <AccessTimeIcon sx={{ color: "#0891b2" }} />

                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Avg Duration
                                        </Typography>
                                        <Typography variant="h6">
                                            {campaignAnalytics.avg_duration}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: "#fff7ed",
                                        borderRadius: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5
                                    }}
                                >
                                    <TrendingUpIcon sx={{ color: "#ea580c" }} />

                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Response Rate
                                        </Typography>
                                        <Typography variant="h6">
                                            {campaignAnalytics.response_rate}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 2 }} />

                        {/* Sentiment Distribution */}
                        <Typography variant="subtitle1" mb={1}>
                            Sentiment Distribution
                        </Typography>
                        <Box mb={2}>
                            {[
                                { label: "Positive", value: campaignAnalytics.sentiment.positive, color: "green" },
                                { label: "Neutral", value: campaignAnalytics.sentiment.neutral, color: "yellow" },
                                { label: "Negative", value: campaignAnalytics.sentiment.negative, color: "red" },
                            ].map((item) => (
                                <Box key={item.label} sx={{ mb: 1 }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                        <Typography variant="body2">{item.label}</Typography>
                                        <Typography variant="body2">{item.value}%</Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={item.value}
                                        sx={{
                                            height: 8,
                                            borderRadius: 2,
                                            "& .MuiLinearProgress-bar": {
                                                backgroundColor:
                                                    item.color === "green"
                                                        ? "#22c55e"
                                                        : item.color === "yellow"
                                                            ? "#eab308"
                                                            : "#ef4444",
                                            },
                                        }}
                                    />
                                </Box>
                            ))}
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        {/* Key Insights */}
                        <Typography variant="subtitle1" mb={1}>
                            Key Insights
                        </Typography>

                        {campaignAnalytics?.key_insights?.length === 0 ? (
                            <Box
                                sx={{
                                    bgcolor: "#f9fafb",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 2,
                                    p: 3,
                                    textAlign: "center",
                                    mb: 2
                                }}
                            >
                                <InfoOutlinedIcon
                                    sx={{
                                        fontSize: 40,
                                        color: "#9ca3af",
                                        mb: 1
                                    }}
                                />

                                <Typography variant="body2" color="text.secondary">
                                    No insights available yet.
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Insights will appear after campaign activity.
                                </Typography>
                            </Box>
                        ) : (
                            <Grid container spacing={2} mb={2}>
                                {campaignAnalytics.key_insights.map((insight, idx) => (
                                    <Grid item xs={12} sm={6} key={idx}>
                                        <Box
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                height: 150,
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "space-between",
                                                bgcolor:
                                                    insight.color === "blue"
                                                        ? "#e0f2fe"
                                                        : insight.color === "purple"
                                                            ? "#ede9fe"
                                                            : insight.color === "green"
                                                                ? "#dcfce7"
                                                                : "#fff7ed",
                                                border: "1px solid",
                                                borderColor:
                                                    insight.color === "blue"
                                                        ? "#bae6fd"
                                                        : insight.color === "purple"
                                                            ? "#c4b5fd"
                                                            : insight.color === "green"
                                                                ? "#bbf7d0"
                                                                : "#fed7aa",
                                                transition: "0.2s",
                                                "&:hover": {
                                                    transform: "translateY(-2px)",
                                                    boxShadow: 2
                                                }
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {insight.title}
                                                </Typography>

                                                <Typography variant="h6">
                                                    {insight.value}
                                                </Typography>

                                                {insight.change && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color:
                                                                parseFloat(insight.change) > 0
                                                                    ? "#16a34a"
                                                                    : parseFloat(insight.change) < 0
                                                                        ? "#dc2626"
                                                                        : "text.secondary"
                                                        }}
                                                    >
                                                        {parseFloat(insight.change) > 0 ? "+" : ""}
                                                        {insight.change}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Tooltip title={insight.description} arrow>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        cursor: "pointer"
                                                    }}
                                                >
                                                    {insight.description}
                                                </Typography>
                                            </Tooltip>

                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        )}

                        {/* AI Recommendations */}
                        <Typography variant="subtitle1" mb={1}>
                            AI Recommendations
                        </Typography>

                        {campaignAnalytics?.ai_recommendations?.length === 0 ? (
                            <Box
                                sx={{
                                    bgcolor: "#f9fafb",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 2,
                                    p: 3,
                                    textAlign: "center",
                                    mb: 2
                                }}
                            >
                                <InfoOutlinedIcon
                                    sx={{
                                        fontSize: 40,
                                        color: "#9ca3af",
                                        mb: 1
                                    }}
                                />

                                <Typography variant="body2" color="text.secondary">
                                    No AI recommendations available yet.
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Recommendations will appear after analyzing call data.
                                </Typography>
                            </Box>
                        ) : (
                            <Grid container spacing={2} mb={2}>
                                {campaignAnalytics.ai_recommendations.map((rec, idx) => (
                                    <Grid item xs={12} key={idx}>
                                        <Box
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: "1px solid #c7d2fe",
                                                bgcolor: "#f3f4f6",
                                            }}
                                        >
                                            <Typography variant="body2">{rec.title}</Typography>
                                            <Typography variant="caption" fontWeight={600}>
                                                {rec.impact}
                                            </Typography>
                                        </Box>
                                    </Grid>

                                ))}
                            </Grid>
                        )}

                        {/* Campaign Status & Engagement Metrics */}
                        <Divider sx={{ mb: 2 }} />
                        {/* Campaign Status & Engagement Metrics Grid */}
                        <Grid container spacing={2} mb={2}>
                            {/* Campaign Status Card */}
                            <Grid item xs={12} md={6}>
                                <Box
                                    sx={{
                                        bgcolor: "white",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 2,
                                        p: 3,
                                    }}
                                >
                                    <Typography variant="subtitle1" fontWeight={700} mb={1}>
                                        Campaign Status
                                    </Typography>
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Status
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    px: 1.5,
                                                    py: 0.5,
                                                    borderRadius: 1,
                                                    fontWeight: 600,
                                                    bgcolor: "#dcfce7",
                                                    color: "#16a34a",
                                                }}
                                            >
                                                {campaignAnalytics.status}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Total Calls
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.total_calls}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Completed
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.completed_calls}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Success Rate
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.response_rate}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Grid>

                            {/* Engagement Metrics Card */}
                            <Grid item xs={12} md={6}>
                                <Box
                                    sx={{
                                        bgcolor: "white",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 2,
                                        p: 3,
                                    }}
                                >
                                    <Typography variant="subtitle1" fontWeight={700} mb={1}>
                                        Engagement Metrics
                                    </Typography>
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Response Rate
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.response_rate}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Engagement
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.engagement.engagement_rate}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Conversion
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.engagement.conversion}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                bgcolor: "#f9fafb",
                                                borderRadius: 1,
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                Avg Call Time
                                            </Typography>
                                            <Typography variant="body2" fontWeight={600}>
                                                {campaignAnalytics.engagement.avg_call_time}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Grid>
                        </Grid>



                        {/* Timeline */}
                        <Typography variant="subtitle1" mb={1}>
                            Campaign Timeline
                        </Typography>

                        <Box
                            sx={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 2,
                                p: 2,
                                bgcolor: "#fafafa",
                                mb: 2
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    mb: 1.5
                                }}
                            >
                                <AccessTimeIcon
                                    sx={{
                                        fontSize: 20,
                                        color: "#6366f1"
                                    }}
                                />

                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Created
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {campaignAnalytics.timeline.created_at}
                                    </Typography>
                                </Box>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5
                                }}
                            >
                                <UpdateIcon
                                    sx={{
                                        fontSize: 20,
                                        color: "#10b981"
                                    }}
                                />

                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Last Updated
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {campaignAnalytics.timeline.updated_at}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Button
                            variant="contained"
                            onClick={onClose}
                            sx={{ alignSelf: "center" }}
                        >
                            Close Analytics
                        </Button>
                    </>
                ) : null}
            </Box>
        </Drawer >
    );
};

export default CampaignAnalyticsDrawer;