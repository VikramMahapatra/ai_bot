import {
    Grid,
    Card,
    CardContent,
    Typography,
    Box,
    TextField
} from "@mui/material";

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

const CampaignAnalytics = () => {
    return (
        <Box>

            {/* HEADER */}

            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
            >

                <Typography variant="h5" fontWeight={700}>
                    Analytics
                </Typography>

                <Box display="flex" gap={2}>

                    <TextField
                        label="From"
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        label="To"
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                    />

                </Box>

            </Box>

            {/* ANALYTICS CARDS */}

            <Grid container spacing={3} mb={3}>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">
                                    Total Calls
                                </Typography>
                                <CallIcon color="primary" />
                            </Box>

                            <Typography variant="h5" mt={1}>
                                3,210
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">
                                    Successful Calls
                                </Typography>
                                <CheckCircleIcon color="primary" />
                            </Box>

                            <Typography variant="h5" mt={1}>
                                1,870
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">
                                    Pickup Rate
                                </Typography>
                                <PhoneInTalkIcon color="secondary" />
                            </Box>

                            <Typography variant="h5" mt={1}>
                                58%
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">
                                    Conversion Rate
                                </Typography>
                                <TrendingUpIcon color="primary" />
                            </Box>

                            <Typography variant="h5" mt={1}>
                                7.6%
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">
                                    Active Campaigns
                                </Typography>
                                <CampaignIcon color="primary" />
                            </Box>

                            <Typography variant="h5" mt={1}>
                                5
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="subtitle2">
                                    Duration
                                </Typography>
                                <AccessTimeIcon color="primary" />
                            </Box>

                            <Typography variant="h5" mt={1}>
                                12h 20m
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

                            <Typography fontWeight={600}>
                                Call Volume Timeline
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                mb={2}
                            >
                                Hourly call distribution for today
                            </Typography>

                            {/* Chart Placeholder */}

                            <Box height={220}>
                                <CallVolumeChart />
                            </Box>

                        </CardContent>
                    </Card>
                </Grid>

                {/* LIVE CALLS */}

                <Grid item xs={12} md={3}>
                    <Card sx={{ height: 320 }}>
                        <CardContent>

                            <Typography fontWeight={600}>
                                Live Calls
                            </Typography>

                            <Box mt={2}>
                                <LiveCalls />
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

                            <Typography fontWeight={600}>
                                Pickup Trend
                            </Typography>

                            <Box height={200}>
                                <PickupTrendChart />
                            </Box>

                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ height: 280 }}>
                        <CardContent>

                            <Typography fontWeight={600}>
                                Call Outcomes
                            </Typography>

                            <Box height={200}>
                                <CallOutcomesChart />
                            </Box>

                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ height: 280 }}>
                        <CardContent>

                            <Typography fontWeight={600}>
                                Intent Distribution
                            </Typography>

                            <Box height={200}>
                                <IntentChart />
                            </Box>

                        </CardContent>
                    </Card>
                </Grid>

            </Grid>

        </Box>
    );
};

export default CampaignAnalytics;