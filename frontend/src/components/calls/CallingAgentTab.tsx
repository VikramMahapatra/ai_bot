import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Stack,
    IconButton,
    Grid,
    Tooltip,
    TextField,
    MenuItem,
    Button,
} from '@mui/material';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import PauseIcon from '@mui/icons-material/Pause';
import EditIcon from '@mui/icons-material/Edit';
import CallIcon from '@mui/icons-material/Call';
import CampaignIcon from '@mui/icons-material/Campaign';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { AddAgentForm } from './AddAgentForm';

interface Agent {
    id: number;
    type: 'Inbound' | 'Outbound';
    name: string;
    callingNo: string;
    status: 'Active' | 'Paused';
    destination: string;
    activeCampaigns: number;
    allocatedCalls: number;
    pendingCalls: number;
    attemptedCalls: number;
    createdAt: Date; // for sorting
}

const mockAgents: Agent[] = [
    {
        id: 1,
        type: 'Outbound',
        name: 'Agent A',
        callingNo: '+919800000001',
        status: 'Active',
        destination: 'India',
        activeCampaigns: 3,
        allocatedCalls: 150,
        pendingCalls: 50,
        attemptedCalls: 100,
        createdAt: new Date('2026-03-01T10:00:00'),
    },
    {
        id: 2,
        type: 'Inbound',
        name: 'Agent B',
        callingNo: '+919800000002',
        status: 'Paused',
        destination: 'USA',
        activeCampaigns: 1,
        allocatedCalls: 50,
        pendingCalls: 20,
        attemptedCalls: 30,
        createdAt: new Date('2026-03-10T12:00:00'),
    },
];

export const CallingAgentTab: React.FC = () => {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
    const [showForm, setShowForm] = useState(false);

    const handleSaveAgent = (data: any) => {
        console.log('New Agent Data:', data);
        setShowForm(false);
    };

    const handleTestCall = (agent: Agent) => alert(`Test call: ${agent.name}`);
    const handlePause = (agent: Agent) => alert(`Pause/Resume: ${agent.name}`);
    const handleEdit = (agent: Agent) => alert(`Edit settings: ${agent.name}`);
    const handleAddAgent = () => setShowForm(true);

    // Filter + sort agents
    const filteredAgents = mockAgents
        .filter(
            (agent) =>
                agent.name.toLowerCase().includes(search.toLowerCase()) ||
                agent.callingNo.includes(search)
        )
        .sort((a, b) => {
            if (sortBy === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

    return (
        <Box>
            {/* Full-width Filters Row */}
            {!showForm && (
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    mb={2}
                    width="100%"
                >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flex={1}>
                        {/* Search box bigger */}
                        <TextField
                            fullWidth
                            size="small"
                            label="Search"
                            variant="outlined"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ flex: 3 }} // take 3/4 of the row
                        />

                        {/* Sorting smaller */}
                        <TextField
                            size="small"
                            select
                            label="Sort By"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            sx={{ flex: 1 }} // take 1/4 of the row
                        >
                            <MenuItem value="newest">Newest</MenuItem>
                            <MenuItem value="oldest">Oldest</MenuItem>
                        </TextField>
                    </Stack>

                    <Box mt={{ xs: 1, sm: 0 }}>
                        <Button variant="contained" color="primary" onClick={handleAddAgent}>
                            Add New Agent
                        </Button>
                    </Box>
                </Stack>
            )}
            {/* Inline AddAgentForm */}
            {showForm && <AddAgentForm onCancel={() => setShowForm(false)} onSave={handleSaveAgent} />}

            {/* Agent Cards */}
            <Grid container spacing={3}>
                {filteredAgents.map((agent) => (
                    <Grid item xs={12} md={6} key={agent.id}>
                        <Card sx={{ position: 'relative', overflow: 'visible' }}>
                            {/* Header */}
                            <CardContent sx={{ backgroundColor: '#f5f5f5', mb: 1, borderRadius: 1 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Tooltip title={agent.type === 'Outbound' ? 'Outbound Call' : 'Inbound Call'}>
                                            {agent.type === 'Outbound' ? (
                                                <CallMadeIcon color="primary" />
                                            ) : (
                                                <CallReceivedIcon color="secondary" />
                                            )}
                                        </Tooltip>

                                        <Typography variant="h6">{agent.name}</Typography>

                                        <Tooltip title={agent.status}>
                                            <FiberManualRecordIcon
                                                sx={{
                                                    fontSize: 12,
                                                    color: agent.status === 'Active' ? 'green' : 'orange',
                                                }}
                                            />
                                        </Tooltip>
                                    </Stack>

                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="Test Call">
                                            <IconButton size="small" onClick={() => handleTestCall(agent)}>
                                                <CallIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Pause / Resume">
                                            <IconButton size="small" onClick={() => handlePause(agent)}>
                                                <PauseIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Settings">
                                            <IconButton size="small" onClick={() => handleEdit(agent)}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                    {agent.callingNo} | {agent.destination}
                                </Typography>
                            </CardContent>

                            {/* Body: Active Campaigns */}
                            <CardContent>
                                <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                                    <CampaignIcon color="primary" />
                                    <Typography>Active Campaigns: {agent.activeCampaigns}</Typography>
                                </Stack>

                                {/* Credit Summary */}
                                <Typography variant="subtitle2" mb={1}>
                                    Credit Summary
                                </Typography>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box textAlign="center" flex={1}>
                                        <AssignmentIcon color="action" sx={{ fontSize: 28 }} />
                                        <Typography variant="h6">{agent.allocatedCalls}</Typography>
                                        <Typography variant="caption">Allocated</Typography>
                                    </Box>
                                    <Box textAlign="center" flex={1}>
                                        <HourglassEmptyIcon color="warning" sx={{ fontSize: 28 }} />
                                        <Typography variant="h6">{agent.pendingCalls}</Typography>
                                        <Typography variant="caption">Pending</Typography>
                                    </Box>
                                    <Box textAlign="center" flex={1}>
                                        <CheckCircleIcon color="success" sx={{ fontSize: 28 }} />
                                        <Typography variant="h6">{agent.attemptedCalls}</Typography>
                                        <Typography variant="caption">Attempted</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};