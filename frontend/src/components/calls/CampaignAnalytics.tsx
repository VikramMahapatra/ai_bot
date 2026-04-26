import { useEffect, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
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
  Alert,
  Paper,
  MenuItem,
  Button,
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
import PeopleIcon from '@mui/icons-material/People';
import {
  CallAnalytics,
  CallAnalyticsFilters,
  callService,
} from "../../services/callService";
import { callCampaignService } from "../../services/callCampaignService";
import {
  callLogService,
  FilterLookupResponse,
} from "../../services/callLogService";

/** Subtitle under each call KPI card (matches default / intended reporting window). */
const CALL_METRICS_SUBTITLE = "Last 30 days";

const CampaignAnalytics = () => {
  const theme = useTheme();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<FilterLookupResponse[]>([]);
  const [analytics, setAnalytics] = useState<CallAnalytics>({
    summary: {
      total_calls: 0,
      attempted_calls: 0,
      successful_calls: 0,
      pickup_rate: 0,
      conversion_rate: 0,
      total_duration: 0,
      active_campaigns: 0,
      recent_calls: [],
    },
    charts: {
      call_volume: [],
      pickup_trend: [],
      call_outcomes: [],
      lead_outcome_data: [],
    },
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
    validateDates();
  }, [fromDate, endDate]);

  useEffect(() => {
    loadCampaignList();
    loadAnalytics();
  }, []);

  const validateDates = () => {
    if (!fromDate || !endDate) {
      setError("Both start and end dates are required");
      return;
    }

    if (new Date(fromDate) > new Date(endDate)) {
      setError("Start date cannot be greater than End date");
      return;
    }

    setError("");
  };

  const loadAnalytics = async (override?: {
    fromDate?: string;
    endDate?: string;
    campaignId?: string;
  }) => {
    setLoading(true);

    const finalFromDate = override?.fromDate ?? fromDate;
    const finalEndDate = override?.endDate ?? endDate;
    const finalCampaignId = override?.campaignId ?? campaignId;

    const filters: CallAnalyticsFilters = {};

    if (finalFromDate) filters.start_date = finalFromDate;
    if (finalEndDate) filters.end_date = finalEndDate;
    if (finalCampaignId && finalCampaignId !== "all") {
      filters.campaign_id = parseInt(finalCampaignId);
    }

    try {
      const response = await callService.callAnalytics(filters);
      setAnalytics(response);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to sync analytics data");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignList = async () => {
    try {
      const campaignData = await callLogService.campaignLookup();
      setCampaigns(campaignData || []);
    } catch (err) {
      console.error("Failed to load campaigns", err);
    }
  };

  const { summary, charts } = analytics;

  const callVolumeData = charts?.call_volume || [];
  const pickupTrendData = charts?.pickup_trend || [];
  const callOutcomesData = charts?.call_outcomes || [];
  const intentData = charts?.lead_outcome_data || [];

  const showError = (message: string) => {
    setError(message);
  };

  const resetFilters = () => {
    const newCampaignId = "all";
    const newFromDate = start;
    const newEndDate = end;

    setCampaignId(newCampaignId);
    setFromDate(newFromDate);
    setEndDate(newEndDate);

    loadAnalytics({
      campaignId: newCampaignId,
      fromDate: newFromDate,
      endDate: newEndDate,
    });
  };

  return (
    <Box>
      {/* HEADER */}
      <Box mb={3}>
        <Paper
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: "background.paper",
          }}
        >
          {/* Filter Header */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6" fontWeight={600}>
              Filters
            </Typography>

            <Button size="small" color="error" onClick={resetFilters}>
              Reset
            </Button>
          </Box>

          {/* Filters */}
          <Box
            display="grid"
            gridTemplateColumns={{
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1.5fr 1fr 1fr auto",
            }}
            gap={2}
          >
            {/* Campaign Filter */}
            <TextField
              select
              size="small"
              label="Campaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              fullWidth
            >
              <MenuItem value="all">All Campaigns</MenuItem>
              {campaigns.map((campaign) => (
                <MenuItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </MenuItem>
              ))}
            </TextField>

            {/* From Date */}
            <TextField
              label="From Date"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            {/* To Date */}
            <TextField
              label="To Date"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            {/* Apply Button */}
            <Button variant="contained" size="small" onClick={loadAnalytics}>
              Apply
            </Button>
          </Box>
        </Paper>
      </Box>
      {loading && (
        <Box mb={3}>
          <LinearProgress sx={{ borderRadius: 1.2 }} />
        </Box>
      )}
      {error && (
        <Stack mb={2}>
          <Alert
            severity="error"
            sx={{
              borderRadius: "14px",
              boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
            }}
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
                <Typography variant="subtitle2">Total Contacts</Typography>
                <PeopleIcon color="primary" />
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
                <Typography variant="subtitle2">Initiated Calls</Typography>
                <CallIcon color="primary" />
              </Box>
              <Typography variant="h5" mt={1}>
                {summary.attempted_calls || 0}
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

        {/* <Grid item xs={12} md={2}>
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
        </Grid> */}

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

        <Grid item xs={12} md={3}>
          <Card sx={{ height: 320 }}>
            <CardContent>
              <Typography fontWeight={600}>Recent Calls</Typography>
              <Box mt={2}>
                <LiveCalls recentCalls={summary.recent_calls || []} />
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
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 280 }}>
            <CardContent>
              <Typography fontWeight={600}>Sentiment Outcomes</Typography>
              <Box height={200}>
                <IntentChart data={intentData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Grid container spacing={3} mt={1}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 350 }}>
            {" "}
            {/* increase card height */}
            <CardContent>
              <Typography fontWeight={600}>Call Outcomes</Typography>
              <Box height={250}>
                {" "}
                {/* increase chart container */}
                <CallOutcomesChart data={callOutcomesData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CampaignAnalytics;
