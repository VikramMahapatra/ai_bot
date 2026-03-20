import { useEffect, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import PhoneIcon from '@mui/icons-material/Phone';
import VideocamIcon from '@mui/icons-material/Videocam';
import CallDetailDrawer from './CallDetailDrawer';
import SyncIcon from "@mui/icons-material/Sync";
import CloseIcon from "@mui/icons-material/Close";
import { CallLog, callLogService } from '../../services/callLogService';


const getStatusColor = (status: string) => {
    switch (status) {
        case 'Completed': return 'primary';
        case 'Missed': return 'error';
        case 'Voicemail': return 'warning';
        default: return 'default';
    }
};

const getTypeIcon = (type: string) => type === 'Outbound' ? <CallMadeIcon fontSize="small" /> : <CallReceivedIcon fontSize="small" />;
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

    const showError = (message: string) => {
        setError(message);
    };

    const loadCallLogs = async () => {
        const data = await callLogService.allLogs({
            search: search || undefined,
            skip: callLogPage * callLogRowsPerPage,
            limit: callLogRowsPerPage,
            from_date: fromDate || undefined,
            end_date: endDate || undefined,
        });
        setCallLogs(data.items || []);
        setCallLogTotal(data.pagination?.total || 0);
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
    }, [search, callLogPage, callLogRowsPerPage, fromDate, endDate]);


    return (
        <Box>
            {/* Filters */}
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



                <Grid item xs={12} md={2}>
                    <Stack
                        spacing={0.5}
                        justifyContent="center"
                        alignItems="flex-start"
                        height="100%"
                    >
                        <Button
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
                            {syncing ? "Syncing..." : "Sync Logs"}
                        </Button>
                        {/* 
                        {lastSynced && (
                            <Typography variant="caption" color="text.secondary">
                                Last synced: {lastSynced.toLocaleTimeString()}
                            </Typography>
                        )} */}
                    </Stack>
                </Grid>

            </Grid>

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

            {/* Table */}
            <Paper>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Phone</TableCell>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Agent</TableCell>
                            <TableCell>Call Type</TableCell>
                            <TableCell>Test Call</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Cost</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>View</TableCell>
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
                                    <TableCell>{log.phone}</TableCell>
                                    <TableCell>{log.campaign || "-"}</TableCell>
                                    <TableCell>{log.agent || "-"}</TableCell>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                            {getTypeIcon(log.type)} <Typography variant="body2">{log.type}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {log.testCall ? "Yes" : "No"}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={log.status} color={getStatusColor(log.status) as any} size="small" />
                                    </TableCell>
                                    <TableCell>{log.duration || "N/A"}</TableCell>
                                    <TableCell>{log.cost || "0.00"}</TableCell>
                                    <TableCell>
                                        {log.date ? new Date(log.date).toLocaleString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        }) : "-"}
                                    </TableCell>
                                    <TableCell>
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
            </Paper>

            {/* Drawer / Detail View */}
            <CallDetailDrawer
                open={openDetail}
                selectedCall={selectedCall}
                onClose={() => setOpenDetail(false)}
            />
        </Box>
    );
};