import React from "react";
import {
    Drawer,
    Box,
    Typography,
    Grid,
    Divider,
    Button,
    LinearProgress,
} from "@mui/material";
import { Campaign } from "../../services/callCampaignService";



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


    const dummyCampaign: Campaign = {
        name: "Zen Campaign For Demo",
        description: "Demo campaign analytics",
        total_calls: 10,
        completed_calls: 7,
        avg_duration: "01:05",
        response_rate: "85%",
        sentiment: { positive: 60, neutral: 25, negative: 15 },
        timeline: {
            created_at: "3/17/2026, 7:02:57 PM",
            updated_at: "3/17/2026, 7:04:23 PM",
        },
        key_insights: [
            {
                title: "Response Rate",
                value: "100%",
                change: "+1%",
                description:
                    "The meaningful conversation rate of 100% in the last 30 minutes indicates high engagement.",
                color: "blue",
            },
            {
                title: "Lead Quality",
                value: "100%",
                change: "0%",
                description: "Lead quality rate is 100%, indicating high engagement.",
                color: "purple",
            },
        ],
        ai_recommendations: [
            {
                title: "Increase morning calls",
                impact: "LOW IMPACT",
            },
            {
                title: "Follow-up with leads in afternoon",
                impact: "MEDIUM IMPACT",
            },
        ],
        engagement: {
            engagement_rate: 0,
            conversion: 100,
            avg_call_time: "01:05"


        },
        status: "completed",
    };

    campaign = dummyCampaign;

    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box
                sx={{
                    width: { xs: "95vw", sm: 600 },
                    p: 3,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                }}
            >
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
                        <Typography variant="h6">{campaign.name}</Typography>
                        <Typography variant="caption">{campaign.description}</Typography>
                    </Box>
                    <Button onClick={onClose}>Close</Button>
                </Box>

                {/* Metrics */}
                <Grid container spacing={2} mb={2}>
                    <Grid item xs={6}>
                        <Box sx={{ p: 2, bgcolor: "#e0f2fe", borderRadius: 2 }}>
                            <Typography variant="caption">Total Calls</Typography>
                            <Typography variant="h6">{campaign.total_calls}</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Box sx={{ p: 2, bgcolor: "#dcfce7", borderRadius: 2 }}>
                            <Typography variant="caption">Completed Calls</Typography>
                            <Typography variant="h6">{campaign.completed_calls}</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Box sx={{ p: 2, bgcolor: "#cffafe", borderRadius: 2 }}>
                            <Typography variant="caption">Avg Duration</Typography>
                            <Typography variant="h6">{campaign.avg_duration}</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Box sx={{ p: 2, bgcolor: "#fff7ed", borderRadius: 2 }}>
                            <Typography variant="caption">Response Rate</Typography>
                            <Typography variant="h6">{campaign.response_rate}</Typography>
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
                        { label: "Positive", value: campaign.sentiment.positive, color: "green" },
                        { label: "Neutral", value: campaign.sentiment.neutral, color: "yellow" },
                        { label: "Negative", value: campaign.sentiment.negative, color: "red" },
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
                <Grid container spacing={2} mb={2}>
                    {campaign.key_insights.map((insight, idx) => (
                        <Grid item xs={12} sm={6} key={idx}>
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
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
                                }}
                            >
                                <Typography variant="body2" fontWeight={600}>
                                    {insight.title}
                                </Typography>
                                <Typography variant="h6">{insight.value}</Typography>
                                {insight.change && (
                                    <Typography variant="caption" color="text.secondary">
                                        {insight.change}
                                    </Typography>
                                )}
                                <Typography variant="caption">{insight.description}</Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>

                {/* AI Recommendations */}
                <Typography variant="subtitle1" mb={1}>
                    AI Recommendations
                </Typography>
                <Grid container spacing={2} mb={2}>
                    {campaign.ai_recommendations.map((rec, idx) => (
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
                                        {campaign.status}
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
                                        {campaign.total_calls}
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
                                        {campaign.completed_calls}
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
                                        {campaign.response_rate}
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
                                        {campaign.response_rate}
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
                                        {campaign.engagement.engagement_rate}
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
                                        {campaign.engagement.conversion}
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
                                        {campaign.engagement.avg_call_time}
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
                <Box mb={2}>
                    <Typography variant="caption">
                        Created: {campaign.timeline.created_at}
                    </Typography>
                    <br />
                    <Typography variant="caption">
                        Last Updated: {campaign.timeline.updated_at}
                    </Typography>
                </Box>

                <Button variant="contained" onClick={onClose}>
                    Close Analytics
                </Button>
            </Box>
        </Drawer>
    );
};

export default CampaignAnalyticsDrawer;