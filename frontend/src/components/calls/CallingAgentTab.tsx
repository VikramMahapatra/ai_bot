import React, { useEffect, useState } from 'react';
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
    Paper,
    Alert,
    CardActionArea,
    LinearProgress,
    Chip,
    Select
} from '@mui/material';
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PublishIcon from "@mui/icons-material/Publish";
import AddIcon from '@mui/icons-material/Add';
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
import GroupIcon from '@mui/icons-material/Group';
import PhoneIcon from "@mui/icons-material/Phone";
import PublicIcon from "@mui/icons-material/Public";
import InputAdornment from "@mui/material/InputAdornment";
import { AddAgentForm } from './AddAgentForm';
import { CallingAgent, callingAgentService } from '../../services/callingAgentService';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from "@mui/material";
import TestCallDialog from './TestCallDialog';

export const CallingAgentTab: React.FC = () => {
    const theme = useTheme();
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
    const [showForm, setShowForm] = useState(false);
    const [agentType, setAgentType] = useState<"inbound" | "outbound">("outbound");
    const [showTypeDialog, setShowTypeDialog] = useState(false);
    const [agents, setAgents] = useState<CallingAgent[]>([]);
    const [agentTotal, setAgentTotal] = useState(0);
    const [agentPage, setAgentPage] = useState(0);
    const [agentRowsPerPage, setAgentRowsPerPage] = useState(10);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">(
        "create",
    );
    const [selectedAgent, setSelectedAgent] = useState<CallingAgent | null>(null);

    // CALL TEST DIALOG
    const [openTestDialog, setOpenTestDialog] = useState(false);

    const showError = (message: string) => {
        setSuccess('');
        setError(message);
    };

    const showSuccess = (message: string) => {
        setError('');
        setSuccess(message);
    };

    const loadCallingAgents = async () => {
        const data = await callingAgentService.allCallingAgents({
            search: search || undefined,
            skip: agentPage * agentRowsPerPage,
            limit: agentRowsPerPage,
            sortBy: sortBy
        });
        setAgents(data.items || []);
        setAgentTotal(data.pagination?.total || 0);
    };

    useEffect(() => {
        loadCallingAgents();
    }, []);

    useEffect(() => {
        const run = async () => {
            try {
                await loadCallingAgents();
            } catch (err: any) {
                showError(err?.response?.data?.detail || 'Failed to load agent list');
            }
        };
        run();
    }, [search, agentPage, agentRowsPerPage]);

    const handleSaveAgent = async (data: FormData) => {
        setLoading(true);
        setError("");
        setSuccess("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        try {
            if (formMode === "create") {
                await callingAgentService.createCallingAgent(data);
            } else {
                await callingAgentService.updateCallingAgent(data, selectedAgent?.id);
            }
            setError("")
            showSuccess(`Agent ${formMode === "create" ? "created" : "updated"} successfully`)
            setShowForm(false);
            loadCallingAgents();

        } catch (err: any) {
            console.log(err)
            showError('Failed to save the data');
        } finally {
            setLoading(false);
        }

    };

    const handlePublish = async (agent: CallingAgent) => {
        setLoading(true);
        try {
            await callingAgentService.publishAgent(agent.id!);
            loadCallingAgents();
            showSuccess(`Agent published successfully`)
        } catch (error) {
            showError(`Failed to publish agent`);
        } finally {
            setLoading(false);
        }
    };

    const handleTestCall = (agent: CallingAgent) => {
        setSelectedAgent(agent);
        setOpenTestDialog(true);
    };

    const handlePause = async (agent: CallingAgent) => {
        setLoading(true);
        const newStatus = agent.status === "Paused" ? "Active" : "Paused";
        try {
            await callingAgentService.updateAgentStatus(agent.id!, newStatus);
            loadCallingAgents();
        } catch (error) {
            showError(`Failed to update the status`);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (agent: CallingAgent) => {
        setSelectedAgent(agent);
        setAgentType(agent.type as any)
        setFormMode("edit");
        setShowForm(true);
        setError('');
        setSuccess('');
    }
    const handleAddAgent = () => {
        setShowTypeDialog(true);
        setFormMode("create");
        setError('');
        setSuccess('');
    }

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
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={handleAddAgent}>
                            Create Agent
                        </Button>
                    </Box>
                </Stack>
            )}

            {(error || success) && (
                <Stack
                    mb={2}
                >
                    {error && (
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
                    )}
                    {success && (
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
                    )}
                </Stack>
            )}

            {loading && (
                <Box mb={3}>
                    <LinearProgress sx={{ borderRadius: 1.2 }} />
                </Box>
            )}


            {/* Inline AddAgentForm */}
            {showForm &&
                <AddAgentForm
                    agent={selectedAgent}
                    mode={formMode}
                    agentType={agentType}
                    onCancel={() => {
                        setShowForm(false);
                        setError("");
                    }}
                    onSave={handleSaveAgent}
                />
            }


            {/* Agent Cards */}
            {
                !showForm && (
                    <>
                        {agents.length === 0 ? (
                            <Paper
                                sx={{
                                    p: 6,
                                    textAlign: "center",
                                    borderRadius: 3,
                                    border: "1px dashed #ccc",
                                    backgroundColor: "#fafafa"
                                }}
                            >
                                <Stack spacing={2} alignItems="center">
                                    <GroupIcon sx={{ fontSize: 60, color: "text.secondary" }} />

                                    <Typography variant="h6">
                                        No Calling Agents Found
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" maxWidth={400}>
                                        You haven't created any calling agents yet. Create an agent to start
                                        running inbound or outbound campaigns.
                                    </Typography>

                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() => setShowForm(true)}
                                    >
                                        Create Agent
                                    </Button>
                                </Stack>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {agents.map((agent) => (
                                    <Grid item xs={12} md={6} key={agent.id}>
                                        <Card sx={{ position: "relative", overflow: "visible" }}>
                                            {/* Header */}
                                            <CardContent
                                                sx={{
                                                    backgroundColor: "#f5f5f5",
                                                    mb: 1,
                                                    borderRadius: 1
                                                }}
                                            >
                                                <Stack
                                                    direction="row"
                                                    alignItems="center"
                                                    justifyContent="space-between"
                                                >
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Tooltip
                                                            title={
                                                                agent.type === "Outbound"
                                                                    ? "Outbound Call"
                                                                    : "Inbound Call"
                                                            }
                                                        >
                                                            {agent.type === "Outbound" ? (
                                                                <CallMadeIcon color="primary" />
                                                            ) : (
                                                                <CallReceivedIcon color="secondary" />
                                                            )}
                                                        </Tooltip>

                                                        <Typography variant="h6">
                                                            {agent.name}
                                                        </Typography>

                                                        <Tooltip title={agent.status}>
                                                            <FiberManualRecordIcon
                                                                sx={{
                                                                    fontSize: 12,
                                                                    color:
                                                                        agent.status === "Active"
                                                                            ? "green"
                                                                            : agent.status === "Paused"
                                                                                ? "orange"
                                                                                : "gray"
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    </Stack>

                                                    <Stack direction="row" spacing={1}>
                                                        {/* Publish button for Draft */}
                                                        {agent.status === "Draft" && (
                                                            <Tooltip title="Publish Agent">
                                                                <IconButton
                                                                    size="small"
                                                                    color="success"
                                                                    onClick={() => handlePublish(agent)}
                                                                >
                                                                    <PublishIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

                                                        {/* Pause / Resume */}
                                                        {agent.status !== "Draft" && (
                                                            <>
                                                                <Tooltip title="Test Call">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleTestCall(agent)}
                                                                    >
                                                                        <CallIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title={agent.status === "Active" ? "Pause Agent" : "Resume Agent"}>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handlePause(agent)}
                                                                    >
                                                                        {agent.status === "Active" ? (
                                                                            <PauseIcon />
                                                                        ) : (
                                                                            <PlayArrowIcon />
                                                                        )}
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </>
                                                        )}

                                                        <Tooltip title="Settings">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleEdit(agent)}
                                                            >
                                                                <EditIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                </Stack>

                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip
                                                        size="small"
                                                        icon={<PhoneIcon color='primary' />}
                                                        label={agent.calling_no || "Not Assigned"}
                                                        color={agent.calling_no ? "success" : "default"}
                                                        variant={agent.calling_no ? "filled" : "outlined"}
                                                    />

                                                    <Chip
                                                        size="small"
                                                        icon={<PublicIcon color="primary" />}
                                                        label={
                                                            agent.server_location === "india"
                                                                ? "India Server"
                                                                : agent.server_location === "us"
                                                                    ? "US Server"
                                                                    : agent.server_location
                                                        }
                                                        variant="outlined"
                                                    />
                                                </Stack>
                                            </CardContent>

                                            {/* Body */}
                                            <CardContent>
                                                <Stack
                                                    direction="row"
                                                    spacing={2}
                                                    alignItems="center"
                                                    mb={1}
                                                >
                                                    <CampaignIcon color="primary" />
                                                    <Typography>
                                                        Active Campaigns: {agent.active_campaigns}
                                                    </Typography>
                                                </Stack>

                                                <Typography variant="subtitle2" mb={1}>
                                                    Credit Summary
                                                </Typography>

                                                <Stack
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    alignItems="center"
                                                >
                                                    <Box textAlign="center" flex={1}>
                                                        <AssignmentIcon
                                                            color="secondary"
                                                            sx={{ fontSize: 28 }}
                                                        />
                                                        <Typography variant="h6">
                                                            {agent.allocated_calls}
                                                        </Typography>
                                                        <Typography variant="caption">
                                                            Allocated
                                                        </Typography>
                                                    </Box>

                                                    <Box textAlign="center" flex={1}>
                                                        <HourglassEmptyIcon
                                                            color="warning"
                                                            sx={{ fontSize: 28 }}
                                                        />
                                                        <Typography variant="h6">
                                                            {agent.pending_calls}
                                                        </Typography>
                                                        <Typography variant="caption">
                                                            Pending
                                                        </Typography>
                                                    </Box>

                                                    <Box textAlign="center" flex={1}>
                                                        <CheckCircleIcon
                                                            color="primary"
                                                            sx={{ fontSize: 28 }}
                                                        />
                                                        <Typography variant="h6">
                                                            {agent.attempted_calls}
                                                        </Typography>
                                                        <Typography variant="caption">
                                                            Attempted
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </>
                )
            }
            <Dialog
                open={showTypeDialog}
                onClose={() => setShowTypeDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Select Agent Type</DialogTitle>

                <DialogContent>
                    <Grid container spacing={2} mt={1} alignItems="stretch">

                        {/* INBOUND */}
                        <Grid item xs={12} md={6} display="flex">
                            <Card
                                sx={{
                                    borderRadius: 2,
                                    width: "100%",
                                    display: "flex"
                                }}
                            >
                                <CardActionArea
                                    sx={{ flex: 1 }}
                                    onClick={() => {
                                        setAgentType("inbound");
                                        setShowTypeDialog(false);
                                        setSelectedAgent(null);
                                        setShowForm(true);
                                    }}
                                >
                                    <CardContent>
                                        <Stack spacing={1} alignItems="center" textAlign="center">
                                            <CallReceivedIcon sx={{ fontSize: 40, color: "success.main" }} />

                                            <Typography variant="h6">
                                                Inbound Agent
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary">
                                                Handles incoming calls from customers
                                            </Typography>
                                        </Stack>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>

                        {/* OUTBOUND */}
                        <Grid item xs={12} md={6} display="flex">
                            <Card
                                sx={{
                                    borderRadius: 2,
                                    width: "100%",
                                    display: "flex"
                                }}
                            >
                                <CardActionArea
                                    sx={{ flex: 1 }}
                                    onClick={() => {
                                        setAgentType("outbound");
                                        setShowTypeDialog(false);
                                        setSelectedAgent(null);
                                        setShowForm(true);
                                    }}
                                >
                                    <CardContent>
                                        <Stack spacing={1} alignItems="center" textAlign="center">
                                            <CallMadeIcon sx={{ fontSize: 40, color: "primary.main" }} />

                                            <Typography variant="h6">
                                                Outbound Agent
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary">
                                                Makes calls to leads or customers
                                            </Typography>
                                        </Stack>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>

                    </Grid>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setShowTypeDialog(false)}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
            {selectedAgent && (
                <TestCallDialog
                    open={openTestDialog}
                    onClose={() => setOpenTestDialog(false)}
                    agent={selectedAgent}
                />
            )}
        </Box >
    );
};