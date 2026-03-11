import React, { useState } from 'react';
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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import PhoneIcon from '@mui/icons-material/Phone';
import VideocamIcon from '@mui/icons-material/Videocam';
import CallDetailDrawer from './CallDetailDrawer';



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
        case 'Completed': return 'success';
        case 'Missed': return 'error';
        case 'Voicemail': return 'warning';
        default: return 'default';
    }
};

const getTypeIcon = (type: string) => type === 'Outbound' ? <CallMadeIcon fontSize="small" /> : <CallReceivedIcon fontSize="small" />;
const getModeIcon = (mode: string) => mode === 'Voice' ? <PhoneIcon fontSize="small" /> : <VideocamIcon fontSize="small" />;

export const CallLogsTab = () => {
    const [search, setSearch] = useState('');
    const [selectedCall, setSelectedCall] = useState<any>(null);

    const filteredLogs = mockCallLogs.filter(
        log =>
            log.contact.toLowerCase().includes(search.toLowerCase()) ||
            log.agent.toLowerCase().includes(search.toLowerCase()) ||
            log.id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Box>
            {/* Filters */}
            <Grid container spacing={2} mb={2} alignItems="center">
                <Grid item xs={12} md={3}>
                    <TextField label="From" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} md={3}>
                    <TextField label="To" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
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
                        {filteredLogs.map(log => (
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
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            {/* Drawer / Detail View */}
            <CallDetailDrawer
                selectedCall={selectedCall}
                onClose={() => setSelectedCall(null)}
            />
        </Box>
    );
};