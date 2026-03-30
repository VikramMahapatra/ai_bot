import { useEffect, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
    Box,
    Grid,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    Chip,
    IconButton,
    Typography,
    InputAdornment,
    TextField,
    Stack,
    Alert,
    TablePagination,
    Button,
    CircularProgress,
    LinearProgress,
    MenuItem,
    Collapse,
    Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import PhoneIcon from '@mui/icons-material/Phone';
import VideocamIcon from '@mui/icons-material/Videocam';
import CallDetailDrawer, { formatEndedReason } from './CallDetailDrawer';
import SyncIcon from "@mui/icons-material/Sync";
import CloseIcon from "@mui/icons-material/Close";
import { CallLog, callLogService, FilterLookupResponse, SentimentType, StatusType } from '../../services/callLogService';
import { formatDateTime } from '../../utils/dateUtils';
import FilterListIcon from "@mui/icons-material/FilterList";
import BugReportIcon from "@mui/icons-material/BugReport";
import CallInsightsDrawer from "./CallInsightsDrawer";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DownloadIcon from "@mui/icons-material/Download";
import Menu from "@mui/material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import InsightsIcon from "@mui/icons-material/Insights";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import LayersIcon from '@mui/icons-material/Layers';
import EllipsisCell from '../EllipsisCell';
import { ExportToExcel } from '../../utils/callLogExport';
import { MoveLeadDialog } from './LeadMoveDialog';



const getStatusColor = (status: string) => {
    switch (status) {
        case 'ended': return 'primary';
        case 'queued': return 'warning';
        case 'failed': return 'error';
        default: return 'default';
    }
};

const getTypeIcon = (type: string) => type === 'Outbound' ? <CallMadeIcon fontSize="small" color='primary' /> : <CallReceivedIcon fontSize="small" color='primary' />;
const getModeIcon = (mode: string) => mode === 'Voice' ? <PhoneIcon fontSize="small" /> : <VideocamIcon fontSize="small" />;

export const CallLogsTab = () => {
    const theme = useTheme();
    const [search, setSearch] = useState('');
    const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [callLogTotal, setCallLogTotal] = useState(0);
    const [callLogPage, setCallLogPage] = useState(0);
    const [callLogRowsPerPage, setCallLogRowsPerPage] = useState(10);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [openDetail, setOpenDetail] = useState(false);

    const [showFilters, setShowFilters] = useState(false);
    const [status, setStatus] = useState<string>("All");
    const [agent, setAgent] = useState<string>("All");
    const [campaign, setCampaign] = useState<string>("All");
    const [agents, setAgents] = useState<FilterLookupResponse[]>([]);
    const [campaigns, setCampaigns] = useState<FilterLookupResponse[]>([]);

    const [sentiment, setSentiment] = useState<string>("All");
    const [callEndReason, setCallEndReason] = useState<string>("All");
    const [evaluation, setEvaluation] = useState<string>("All");
    const [leadQuality, setLeadQuality] = useState<string>("All");
    const [leadQualified, setLeadQualified] = useState<string>("All");

    const [actionAnchor, setActionAnchor] = useState(null);
    const [openInsights, setOpenInsights] = useState(false);

    const handleActionOpen = (event: any) => {
        setActionAnchor(event.currentTarget);
    };

    const handleActionClose = () => {
        setActionAnchor(null);
    };


    const [callStats, setCallStats] = useState({
        total: 0,
        campaign: 0,
        test: 0,
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
    const [moveLeadOpen, setMoveLeadOpen] = useState(false);
    const [selectedLeadRow, setSelectedLeadRow] = useState<any>(null);
    const [success, setSuccess] = useState('');


    const openMoveLeadDialog = (row: any) => {
        setSelectedLeadRow(row);
        setMoveLeadOpen(true);
    };

    const handleLeadAction = async (stage: string) => {
        setLoading(true);
        try {
            const response = await callLogService.moveToSalesFunnel(selectedLeadRow.id, stage)
            setMoveLeadOpen(false);
            if (!response.success) {
                showError(response.message)
            }
            else {
                showSuccess(response.message)
                await loadCallLogs();
            }
        }
        catch {
            showError("Failed to move the lead to sales funnel")
        }
        finally {
            setLoading(false);
        }

    };

    const showError = (message: string) => {
        setError(message);
    };

    const showSuccess = (message: string) => {
        setError('');
        setSuccess(message);
    };

    const loadCallLogs = async () => {
        const data = await callLogService.allLogs({
            search: search || undefined,
            skip: callLogPage * callLogRowsPerPage,
            limit: callLogRowsPerPage,
            from_date: fromDate || undefined,
            end_date: endDate || undefined,
            status: status !== "All" ? (status as StatusType) : undefined,
            agent_id: agent !== "All" ? Number(agent) : undefined,
            campaign_id: campaign !== "All" ? Number(campaign) : undefined,
            call_end_reason: callEndReason !== "All" ? (callEndReason) : undefined,
            sentiment: sentiment !== "All" ? (sentiment as SentimentType) : undefined,
            evaluation: evaluation !== "All" ? evaluation === "true" : undefined,
            is_lead_qualified: leadQualified !== "All" ? leadQualified === "true" : undefined,
        });
        setCallLogs(data.items || []);
        setCallLogTotal(data.pagination?.total || 0);
        setCallStats({
            total: data.total_calls || 0,
            campaign: data.campaign_calls || 0,
            test: data.test_calls || 0,
        })
    };

    const handleSyncCalls = async () => {
        setSyncing(true);
        setError('');
        try {
            await callLogService.syncCallLogs({
                from_date: fromDate || undefined,
                end_date: endDate || undefined,
            });
            setLastSynced(new Date());
            loadCallLogs(); // refresh table
        } catch (error) {
            showError("Syncing failed")
        } finally {
            setSyncing(false);
            handleActionClose();
        }
    };

    const handleExport = async () => {
        setLoading(true);
        showError('');
        try {
            const data = await callLogService.allLogs({
                search: search || undefined,
                from_date: fromDate || undefined,
                end_date: endDate || undefined,
                status: status !== "All" ? (status as StatusType) : undefined,
                agent_id: agent !== "All" ? Number(agent) : undefined,
                campaign_id: campaign !== "All" ? Number(campaign) : undefined,
                call_end_reason: callEndReason !== "All" ? (callEndReason) : undefined,
                sentiment: sentiment !== "All" ? (sentiment as SentimentType) : undefined,
                evaluation: evaluation !== "All" ? evaluation === "true" : undefined,
            });
            ExportToExcel(data, "Call_Logs");
        } catch (error) {
            showError("Failed to export the logs.")
        }
        finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        showError('');
        const run = async () => {
            try {
                setLoading(true);
                await loadCallLogs();

            } catch (err: any) {
                showError(err?.response?.data?.detail || 'Failed to load call logs');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [
        search,
        callLogPage,
        callLogRowsPerPage,
        fromDate,
        endDate,
        status,
        agent,
        campaign,
        callEndReason,
        sentiment,
        evaluation,
        leadQuality,
        leadQualified,
    ]);

    useEffect(() => {
        loadFilters();
    }, [])

    const loadFilters = async () => {
        const agentData = await callLogService.allAgentLookup();
        setAgents(agentData || []);

        const campaignData = await callLogService.campaignLookup();
        setCampaigns(campaignData || []);
    }



    return (
        <Box>
            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
                {/* TOP ROW */}
                <Grid container spacing={2} alignItems="center">
                    {/* Search */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search by phone, campaign, agent..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Start Date */}
                    <Grid item xs={6} md={2}>
                        <TextField
                            label="Start Date"
                            type="date"
                            size="small"
                            fullWidth
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    {/* End Date */}
                    <Grid item xs={6} md={2}>
                        <TextField
                            label="End Date"
                            type="date"
                            size="small"
                            fullWidth
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    {/* Filter Button */}
                    <Grid item xs={6} md={2}>
                        <Button
                            fullWidth
                            variant={showFilters ? "contained" : "outlined"}
                            startIcon={<FilterListIcon />}
                            onClick={() => setShowFilters(prev => !prev)}
                        >
                            Filters
                        </Button>
                    </Grid>

                    {/* Sync Button */}
                    {/* <Grid item xs={6} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={
                                syncing ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    <SyncIcon />
                                )   
                            }
                            onClick={handleSyncCalls}
                            disabled={syncing}
                        >
                            {syncing ? "Syncing..." : "Sync"}
                        </Button>
                    </Grid> */}

                    <Grid item xs={6} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<SettingsIcon />}
                            onClick={handleActionOpen}
                        >
                            Options
                        </Button>

                        <Menu
                            anchorEl={actionAnchor}
                            open={Boolean(actionAnchor)}
                            onClose={handleActionClose}
                        >
                            <MenuItem
                                onClick={() => {
                                    handleSyncCalls();
                                }}
                                disabled={syncing}
                            >
                                {syncing ? (
                                    <CircularProgress size={18} sx={{ mr: 1 }} />
                                ) : (
                                    <SyncIcon sx={{ mr: 1 }} />
                                )}
                                Sync Calls
                            </MenuItem>

                            <MenuItem
                                onClick={() => {
                                    handleExport();
                                    handleActionClose();
                                }}
                            >
                                <DownloadIcon sx={{ mr: 1 }} />
                                Export Excel
                            </MenuItem>
                        </Menu>
                    </Grid>
                </Grid>

                {/* ADVANCED FILTERS */}
                <Collapse in={showFilters}>
                    <Grid container spacing={2} mt={1}>
                        {/* Agent */}
                        <Grid item xs={12} md={4}>
                            <TextField
                                select
                                label="Agent"
                                size="small"
                                fullWidth
                                value={agent}
                                onChange={(e) => setAgent(e.target.value)}
                            >
                                <MenuItem value="All">All Agents</MenuItem>
                                {
                                    agents.map((agent) => (
                                        <MenuItem value={agent.id}>{agent.name}</MenuItem>
                                    ))
                                }
                            </TextField>
                        </Grid>

                        {/* Campaign */}
                        <Grid item xs={12} md={4}>
                            <TextField
                                select
                                label="Campaign"
                                size="small"
                                fullWidth
                                value={campaign}
                                onChange={(e) => setCampaign(e.target.value)}
                            >
                                <MenuItem value="All">All Campaigns</MenuItem>
                                {
                                    campaigns.map((campaign) => (
                                        <MenuItem value={campaign.id}>{campaign.name}</MenuItem>
                                    ))
                                }
                            </TextField>
                        </Grid>

                        {/* Status */}
                        <Grid item xs={12} md={4}>
                            <TextField
                                select
                                label="Status"
                                size="small"
                                fullWidth
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="ended">Ended</MenuItem>
                                <MenuItem value="queued">Queued</MenuItem>
                                <MenuItem value="failed">Failed</MenuItem>
                            </TextField>
                        </Grid>
                    </Grid>
                    <Grid container spacing={2} mt={1}>
                        {/* Call End Reason */}
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Call End Reason"
                                value={callEndReason}
                                onChange={(e) => setCallEndReason(e.target.value)}
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="busy">Customer Busy</MenuItem>
                                <MenuItem value="no_answer">No Answer</MenuItem>
                                <MenuItem value="voicemail">Voicemail</MenuItem>
                                <MenuItem value="customer_end">Customer Ended</MenuItem>
                                <MenuItem value="assistant_end">Assistant Ended</MenuItem>
                            </TextField>
                        </Grid>
                        {/* Sentiment */}
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Sentiment"
                                value={sentiment}
                                onChange={(e) => setSentiment(e.target.value)}
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="positive">Positive</MenuItem>
                                <MenuItem value="negative">Negative</MenuItem>
                                <MenuItem value="neutral">Neutral</MenuItem>
                            </TextField>
                        </Grid>

                        {/* Evaluation
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Evaluation"
                                value={evaluation}
                                onChange={(e) => setEvaluation(e.target.value)}
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="true">True</MenuItem>
                                <MenuItem value="false">False</MenuItem>
                            </TextField>
                        </Grid> */}

                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Lead Quality"
                                value={leadQuality}
                                onChange={(e) => setLeadQuality(e.target.value)}
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="High">Hot Lead (80 - 100)</MenuItem>
                                <MenuItem value="Medium">Warm Lead (50 - 79)</MenuItem>
                                <MenuItem value="Low">Cold Lead (20 - 49)</MenuItem>
                                <MenuItem value="Poor">Disqualified (0 - 19)</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Lead Qualified"
                                value={leadQualified}
                                onChange={(e) => setLeadQualified(e.target.value)}
                            >
                                <MenuItem value="All">All</MenuItem>
                                <MenuItem value="true">Yes</MenuItem>
                                <MenuItem value="false">No</MenuItem>
                            </TextField>
                        </Grid>
                    </Grid>
                </Collapse>
            </Paper>

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

            {success && (
                <Stack
                    mb={2}
                >
                    <Alert
                        severity="success"
                        sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}
                        action={
                            <IconButton
                                aria-label="close"
                                color="inherit"
                                size="small"
                                onClick={() => setSuccess("")} // clears the error
                            >
                                <CloseIcon fontSize="inherit" />
                            </IconButton>
                        }
                    >
                        {success}
                    </Alert>
                </Stack>
            )}

            <Grid container spacing={3} mb={3}>

                {/* TOTAL CALLS */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            transition: "0.2s",
                            "&:hover": { boxShadow: 6 }
                        }}
                    >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Total Calls
                                </Typography>
                                <Typography variant="h5" fontWeight={700}>
                                    {callStats.total}
                                </Typography>
                            </Box>

                            <PhoneIcon sx={{ fontSize: 40, color: "primary.main" }} />
                        </Box>
                    </Paper>
                </Grid>

                {/* CAMPAIGN CALLS */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            transition: "0.2s",
                            "&:hover": { boxShadow: 6 }
                        }}
                    >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Campaign Calls
                                </Typography>
                                <Typography variant="h5" fontWeight={700} color="primary.main">
                                    {callStats.campaign}
                                </Typography>
                            </Box>

                            <CallMadeIcon sx={{ fontSize: 40, color: "primary.main" }} />
                        </Box>
                    </Paper>
                </Grid>

                {/* TEST CALLS */}
                <Grid item xs={12} md={4}>
                    <Paper
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            transition: "0.2s",
                            "&:hover": { boxShadow: 6 }
                        }}
                    >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Test Calls
                                </Typography>
                                <Typography variant="h5" fontWeight={700} color="warning.main">
                                    {callStats.test}
                                </Typography>
                            </Box>

                            <BugReportIcon sx={{ fontSize: 40, color: "warning.main" }} />
                        </Box>
                    </Paper>
                </Grid>

            </Grid>
            {/* Table */}
            <Paper>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Phone</TableCell>
                            <TableCell>Contact</TableCell>
                            <TableCell>Agent</TableCell>
                            <TableCell>Campaign</TableCell>

                            {/* <TableCell>Test Call</TableCell> */}
                            <TableCell>Sentiment</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Duration</TableCell>
                            {/* <TableCell>Cost</TableCell> */}
                            <TableCell>Date</TableCell>
                            <TableCell>View</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {callLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} sx={{ py: 8 }}>
                                    <Box
                                        display="flex"
                                        flexDirection="column"
                                        alignItems="center"
                                        justifyContent="center"
                                        textAlign="center"
                                        gap={1}
                                    >
                                        <SearchIcon sx={{ fontSize: 40, color: "text.secondary" }} />

                                        <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
                                            No call logs found
                                        </Typography>

                                        <Typography variant="body2" sx={{ color: "text.disabled" }}>
                                            Try adjusting your search
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>

                        ) : (
                            callLogs.map(log => (
                                <TableRow key={log.id} hover>
                                    <TableCell>{log.phone}</TableCell>
                                    <TableCell>
                                        <EllipsisCell value={log.contact} width={160} />
                                    </TableCell>
                                    <TableCell>
                                        <Box>
                                            <EllipsisCell value={log.agent} />

                                            <Box
                                                display="flex"
                                                alignItems="center"
                                                gap={0.5}
                                                mt={0.3}
                                            >
                                                {getTypeIcon(log.type)}
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {log.type}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>

                                    <TableCell>
                                        <EllipsisCell value={log.campaign} width={160} />
                                    </TableCell>

                                    {/* <TableCell>
                                        {log.testCall ? "Yes" : "No"}
                                    </TableCell> */}
                                    <TableCell>{log.sentiment || "N/A"}</TableCell>
                                    <TableCell>
                                        <Chip label={log.status} color={getStatusColor(log.status) as any} size="small" />
                                    </TableCell>
                                    <TableCell>
                                        {log.duration
                                            ? `${log.duration} sec`
                                            : "N/A"}
                                    </TableCell>
                                    {/* <TableCell>{log.cost || "0.00"}</TableCell> */}
                                    <TableCell>
                                        {log.date ? formatDateTime(log.date) : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            {log.lead_qualified_status === "Pending" && (
                                                <Tooltip title="Move to Sales Funnel">
                                                    <IconButton
                                                        size="small"
                                                        color="secondary"
                                                        onClick={() => openMoveLeadDialog(log)}
                                                    >
                                                        <LayersIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="View Insights">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setSelectedCall(log)
                                                        setOpenInsights(true);
                                                    }}
                                                >
                                                    <InsightsIcon color="primary" />
                                                </IconButton>
                                            </Tooltip>

                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setSelectedCall(log);
                                                    setOpenDetail(true);
                                                }}
                                            >
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )))}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={callLogTotal}
                    page={callLogPage}
                    onPageChange={(_, value) => setCallLogPage(value)}
                    rowsPerPage={callLogRowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setCallLogRowsPerPage(parseInt(event.target.value, 10));
                        setCallLogPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                />
            </Paper>

            {/* Drawer / Detail View */}
            <CallDetailDrawer
                open={openDetail}
                selectedCall={selectedCall}
                onClose={() => setOpenDetail(false)}
            />
            <CallInsightsDrawer
                open={openInsights}
                onClose={() => setOpenInsights(false)}
                data={selectedCall}
            />
            <MoveLeadDialog
                open={moveLeadOpen}
                onClose={() => setMoveLeadOpen(false)}
                leadRow={selectedLeadRow}
                onActionSelected={handleLeadAction}
            />
        </Box>
    );
};