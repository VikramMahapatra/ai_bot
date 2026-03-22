import { useEffect, useState } from "react";
import { alpha, useTheme } from '@mui/material/styles';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    IconButton,
    Chip,
    LinearProgress,
    Button,
    TextField,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Checkbox,
    TablePagination,
    InputAdornment,
    Paper,
    Drawer,
    Tooltip
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PhoneIcon from "@mui/icons-material/Phone";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from '@mui/icons-material/Visibility';
import { callCampaignService } from "../../services/callCampaignService";
import CallDetailDrawer from "./CallDetailDrawer";
import { CallLog, callLogService } from "../../services/callLogService";
import CallInsightsDrawer from "./CallInsightsDrawer";
import InsightsIcon from "@mui/icons-material/Insights";
import { formatDateTime } from "../../utils/dateUtils";
interface Props {
    campaignId: number;
    onBack: () => void;
    onEdit: (id: number) => void;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'ended': return 'primary';
        case 'queued': return 'error';
        case 'failed': return 'warning';
        default: return 'default';
    }
};

export default function CampaignDetails({ campaignId, onBack, onEdit }: Props) {
    const theme = useTheme();
    const [campaign, setCampaign] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [callLogTotal, setCallLogTotal] = useState(0);
    const [callLogPage, setCallLogPage] = useState(0);
    const [callLogRowsPerPage, setCallLogRowsPerPage] = useState(10);
    const [fromDate, setFromDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [openInsights, setOpenInsights] = useState(false);
    const [openDetail, setOpenDetail] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await callCampaignService.getCampaignDetails(campaignId);
            setCampaign(data);

            loadCallLogs()
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [campaignId]);

    const loadCallLogs = async () => {
        const data = await callLogService.allLogs({
            campaign_id: campaignId,
            search: search || undefined,
            skip: callLogPage * callLogRowsPerPage,
            limit: callLogRowsPerPage,
            from_date: fromDate || undefined,
            end_date: endDate || undefined,
        });
        setCallLogs(data.items || []);
        setCallLogTotal(data.pagination?.total || 0);
    };

    const progress = campaign?.total_calls
        ? (campaign.completed_calls / campaign.total_calls) * 100
        : 0;

    return (
        <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
            {/* LOADING */}
            {loading && <LinearProgress sx={{ mb: 2 }} />}


            {/* HEADER */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center" gap={2}>
                    <IconButton onClick={onBack}>
                        <ArrowBackIcon />
                    </IconButton>

                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: "primary.main",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <PhoneIcon sx={{ color: "#fff" }} />
                    </Box>

                    <Box>
                        <Typography variant="h6" fontWeight="bold">
                            {campaign?.name}
                        </Typography>

                        <Box display="flex" gap={2} mt={1}>
                            <Typography variant="body2">
                                Created {new Date(campaign?.created_at).toLocaleDateString()}
                            </Typography>

                            <Chip
                                label={campaign?.status}
                                color="primary"
                                size="small"
                            />
                        </Box>
                    </Box>
                </Box>

                <Button
                    variant="outlined"
                    onClick={() => onEdit(campaignId)}
                >
                    Edit
                </Button>
            </Box>


            {/* STATS */}
            <Grid container spacing={2} mb={3}>
                <Grid item xs={12} md={2.4}>
                    <Card><CardContent>
                        <Typography variant="body2">Total Contacts</Typography>
                        <Typography variant="h5">{campaign?.total_contacts || 0}</Typography>
                    </CardContent></Card>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Card><CardContent>
                        <Typography variant="body2">Calls Made</Typography>
                        <Typography variant="h5">
                            {campaign?.completed_calls || 0}/{campaign?.total_calls || 0}
                        </Typography>
                    </CardContent></Card>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Card><CardContent>
                        <Typography variant="body2">Scheduled</Typography>
                        <Typography variant="h5">{campaign?.scheduled_calls || 0}</Typography>
                    </CardContent></Card>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Card><CardContent>
                        <Typography variant="body2">Success Rate</Typography>
                        <Typography variant="h5">
                            {campaign?.success_rate || 0}%
                        </Typography>
                    </CardContent></Card>
                </Grid>

                <Grid item xs={12} md={2.4}>
                    <Card><CardContent>
                        <Typography variant="body2">Progress</Typography>
                        <Typography variant="h5">
                            {Math.round(progress)}%
                        </Typography>
                    </CardContent></Card>
                </Grid>
            </Grid>

            {/* PROGRESS */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography fontWeight="bold">Campaign Progress</Typography>
                    <Typography variant="body2" mb={1}>
                        {campaign?.completed_calls || 0} of {campaign?.total_calls || 0} calls completed
                    </Typography>
                    <LinearProgress variant="determinate" value={progress} />
                </CardContent>
            </Card>

            {/* ACTIONS */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>

                        {/* LEFT */}
                        <Box display="flex" flexDirection="column">
                            <Typography variant="h6" fontWeight="bold">
                                Call List
                            </Typography>

                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                Agent:{" "}
                                <Box
                                    component="span"
                                    sx={{
                                        color: "primary.main",
                                        cursor: "pointer",
                                        "&:hover": { textDecoration: "underline" }
                                    }}
                                //onClick={() => onEdit(campaign?.agent_id)}
                                >
                                    {campaign?.agent_name || "N/A"}
                                </Box>
                            </Typography>

                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                From number: {campaign?.calling_no || "-"}
                            </Typography>
                        </Box>

                        {/* RIGHT */}
                        <Box
                            display="flex"
                            gap={2}
                            alignItems="center"
                            mt={3}   // 👈 tweak this value
                        >
                            <Button variant="outlined" startIcon={<DownloadIcon />}>
                                Export
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                onClick={loadCallLogs}
                            >
                                Refresh
                            </Button>
                        </Box>
                    </Box>

                    {/* SEARCH */}
                    <Box mb={2}>
                        <Grid container spacing={2} mb={2} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <SearchIcon />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="From"
                                    type="date"
                                    size="small"
                                    fullWidth
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>

                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="To"
                                    type="date"
                                    size="small"
                                    fullWidth
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>

                        </Grid>
                    </Box>

                    {/* TABLE */}

                    <Card>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Contact</TableCell>
                                    <TableCell>Phone</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Ended Reason</TableCell>
                                    <TableCell>Duration</TableCell>
                                    <TableCell>Sentiment</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {callLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} sx={{ py: 8 }}>
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
                                            <TableCell>{log.contact}</TableCell>
                                            <TableCell>{log.phone}</TableCell>
                                            <TableCell>
                                                <Chip label={log.status} color={getStatusColor(log.status) as any} size="small" />
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={log.ended_reason} color="error" size="small" />
                                            </TableCell>
                                            <TableCell>{log.duration || "N/A"}</TableCell>
                                            <TableCell>{log.sentiment || "-"}</TableCell>

                                            <TableCell>
                                                {log.date ? formatDateTime(log.date) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="View Insights">
                                                    <IconButton onClick={() => {
                                                        setSelectedCall(log)
                                                        setOpenInsights(true);
                                                    }}>
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
                    </Card>
                </CardContent>
            </Card>
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
        </Box>
    );
}