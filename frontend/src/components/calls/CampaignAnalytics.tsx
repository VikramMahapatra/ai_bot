import { useEffect, useState } from "react";
import { alpha, useTheme } from '@mui/material/styles';
import {
    Grid,
    Card,
    CardContent,
    Typography,
    Box,
    TextField,
    LinearProgress,
    Stack,
    IconButton,
    Alert
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CallIcon from "@mui/icons-material/Call";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CampaignIcon from "@mui/icons-material/Campaign";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import CallVolumeChart from "./charts/CallVolumeChart";
import PickupTrendChart from "./charts/PickupTrendChart";
import CallOutcomesChart from "./charts/CallOutcomesChart";
import IntentChart from "./charts/IntentChart";
import LiveCalls from "./charts/LiveCalls";
import { CallAnalytics, CallAnalyticsFilters, callService } from "../../services/callService";

const CampaignAnalytics = () => {
    const theme = useTheme();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [analytics, setAnalytics] = useState<CallAnalytics>({
        summary: {
            total_calls: 0,
            successful_calls: 0,
            pickup_rate: 0,
            conversion_rate: 0,
            total_duration: 0,
            active_campaigns: 0,
            live_calls: []
        },
        charts: {
            call_volume: [],
            pickup_trend: [],
            call_outcomes: [],
            intent_distribution: []
        }
    });

    const getDefaultDates = () => {
        const today = new Date();
        const end = today.toISOString().split("T")[0]; // YYYY-MM-DD
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);
        const start = oneMonthAgo.toISOString().split("T")[0];
        return { start, end };
    };

    const { start, end } = getDefaultDates();
    const [fromDate, setFromDate] = useState<string>(start);
    const [endDate, setEndDate] = useState<string>(end);

    useEffect(() => {
        loadAnalytics()
    }, [fromDate, endDate]);

    const loadAnalytics = async () => {
        setLoading(true);
        const filters: CallAnalyticsFilters = {};
        if (fromDate) filters.start_date = fromDate;
        if (endDate) filters.end_date = endDate;

        try {
            const response = await callService.callAnalytics(filters);
            setAnalytics(response);
        }
        catch (err: any) {
            showError(err?.response?.data?.detail || 'Failed to sync analytics data');
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        finally {
            setLoading(false);
        }
    }

    const { summary, charts } = analytics;

    const callVolumeData = charts?.call_volume || [];
    const pickupTrendData = charts?.pickup_trend || [];
    const callOutcomesData = charts?.call_outcomes || [];
    const intentData = charts?.intent_distribution || [];

    const showError = (message: string) => {
        setError(message);
    };

    return (
        <Box>
            {/* HEADER */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={700}>
                    Analytics
                </Typography>

                <Box display="flex" gap={2}>
                    <TextField
                        label="From"
                        type="date"
                        size="small"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="To"
                        type="date"
                        size="small"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                </Box>
            </Box>

            {loading && (
                <Box mb={3}>
                    <LinearProgress sx={{ borderRadius: 1.2 }} />
                </Box>
            )}
            {error && (
                <Stack
                    mb={2}
                >

                    <Alert
                        severity="error"
                        sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}
                        action={
                            <IconButton
                                aria-label="close"
                                color="inherit"
                                size="small"
                                onClick={() => setError("")} // clears the error
                            >
                                <CloseIcon fontSize="inherit" />
                            </IconButton>
                        }
                    >
                        {error}
                    </Alert>
                </Stack>
            )}

            {/* ANALYTICS CARDS */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">Total Calls</Typography>
                                <CallIcon color="primary" />
                            </Box>
                            <Typography variant="h5" mt={1}>
                                {summary.total_calls || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">Successful Calls</Typography>
                                <CheckCircleIcon color="primary" />
                            </Box>
                            <Typography variant="h5" mt={1}>
                                {summary.successful_calls || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">Pickup Rate</Typography>
                                <PhoneInTalkIcon color="secondary" />
                            </Box>
                            <Typography variant="h5" mt={1}>
                                {summary.pickup_rate ? `${summary.pickup_rate}%` : "0%"}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">Conversion Rate</Typography>
                                <TrendingUpIcon color="primary" />
                            </Box>
                            <Typography variant="h5" mt={1}>
                                {summary.conversion_rate ? `${summary.conversion_rate}%` : "0%"}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">Active Campaigns</Typography>
                                <CampaignIcon color="primary" />
                            </Box>
                            <Typography variant="h5" mt={1}>
                                {summary.active_campaigns || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">Duration</Typography>
                                <AccessTimeIcon color="primary" />
                            </Box>
                            <Typography variant="h5" mt={1}>
                                {summary.total_duration
                                    ? `${Math.floor(summary.total_duration / 60)}h ${summary.total_duration % 60}m`
                                    : "0h 0m"}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* SECOND ROW PANELS */}
            <Grid container spacing={3} mb={3}>
                {/* CALL VOLUME */}
                <Grid item xs={12} md={9}>
                    <Card sx={{ height: 320 }}>
                        <CardContent>
                            <Typography fontWeight={600}>Call Volume Timeline</Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Hourly call distribution
                            </Typography>
                            <Box height={220}>
                                <CallVolumeChart data={callVolumeData} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* LIVE CALLS */}
                <Grid item xs={12} md={3}>
                    <Card sx={{ height: 320 }}>
                        <CardContent>
                            <Typography fontWeight={600}>Live Calls</Typography>
                            <Box mt={2}>
                                <LiveCalls liveCalls={summary.live_calls || 0} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* THIRD ROW PANELS */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Card sx={{ height: 280 }}>
                        <CardContent>
                            <Typography fontWeight={600}>Pickup Trend</Typography>
                            <Box height={200}>
                                <PickupTrendChart data={pickupTrendData} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ height: 280 }}>
                        <CardContent>
                            <Typography fontWeight={600}>Call Outcomes</Typography>
                            <Box height={200}>
                                <CallOutcomesChart data={callOutcomesData} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ height: 280 }}>
                        <CardContent>
                            <Typography fontWeight={600}>Intent Distribution</Typography>
                            <Box height={200}>
                                <IntentChart data={intentData} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CampaignAnalytics;