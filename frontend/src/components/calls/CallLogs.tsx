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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import PhoneIcon from '@mui/icons-material/Phone';
import VideocamIcon from '@mui/icons-material/Videocam';
import CallDetailDrawer from './CallDetailDrawer';
import { CallLog, callLogService } from '../../services/callLogService';



const mockCallLogs = [
    {
        id: 'CONV-001',
        contact: 'Rohit Patil',
        agent: 'Agent A',
        type: 'Outbound',
        mode: 'Voice',
        status: 'Completed',
        date: '2026-03-11 10:25',
        startTime: '2026-03-11 10:25',
        endTime: '2026-03-11 10:35',
        industry: 'Real Estate',
        audioUrl: '/sample_audio.mp3',
        transcript: [
            { speaker: 'Agent', text: 'Hello, I am calling regarding your property listing.' },
            { speaker: 'Contact', text: 'Yes, I am interested. Could you give me more details?' },
            { speaker: 'Agent', text: 'Sure, here is what we offer...' },
        ]
    },
    // more mock calls...
];

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
    const [fromDate, setFromDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [callLogTotal, setCallLogTotal] = useState(0);
    const [callLogPage, setCallLogPage] = useState(0);
    const [callLogRowsPerPage, setCallLogRowsPerPage] = useState(10);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const showError = (message: string) => {
        setSuccess('');
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
        });
        setCallLogs(data.items || []);
        setCallLogTotal(data.pagination?.total || 0);
    };

    useEffect(() => {
        loadCallLogs();
    }, []);

    useEffect(() => {
        const run = async () => {
            try {
                await loadCallLogs();
            } catch (err: any) {
                showError(err?.response?.data?.detail || 'Failed to load contact lists');
            }
        };
        run();
    }, [search, callLogPage, callLogRowsPerPage, fromDate, endDate]);


    return (
        <Box>
            {/* Filters */}
            <Grid container spacing={2} mb={2} alignItems="center">
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
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        size="small"
                        label="Search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton>
                                        <SearchIcon />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                </Grid>
            </Grid>

            <Stack
                mb={2}
            >
                {error && (
                    <Alert severity="error" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}>
                        {success}
                    </Alert>
                )}
            </Stack>

            {/* Table */}
            <Paper>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Conversation ID</TableCell>
                            <TableCell>Contact Name</TableCell>
                            <TableCell>Agent Name</TableCell>
                            <TableCell>Call Type</TableCell>
                            <TableCell>Mode</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>View</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {callLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} sx={{ py: 8 }}>
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
                                    <TableCell>{log.id}</TableCell>
                                    <TableCell>{log.contact}</TableCell>
                                    <TableCell>{log.agent}</TableCell>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                            {getTypeIcon(log.type)} <Typography variant="body2">{log.type}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                            {getModeIcon(log.mode)} <Typography variant="body2">{log.mode}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={log.status} color={getStatusColor(log.status) as any} size="small" />
                                    </TableCell>
                                    <TableCell>{log.date}</TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => setSelectedCall(log)}>
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
                selectedCall={selectedCall}
                onClose={() => setSelectedCall(null)}
            />
        </Box>
    );
};