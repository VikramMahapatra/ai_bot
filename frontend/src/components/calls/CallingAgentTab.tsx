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
    Select,
    TableContainer,
    Table,
    TableHead,
    TableCell,
    TableRow,
    TableBody,
    TablePagination
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
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
import PendingIcon from "@mui/icons-material/Pending";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
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
import { formatDateTime } from "../../utils/dateUtils";

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
        const run = async () => {
            setLoading(true);
            try {
                await loadCallingAgents();
            } catch (err: any) {
                showError(err?.response?.data?.detail || 'Failed to load agent list');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [search, agentPage, agentRowsPerPage]);

    useEffect(() => {
        if (loading) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [loading]);


    const handleSaveAgent = async (data: FormData) => {
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            let response;
            if (formMode === "create") {
                response = await callingAgentService.createCallingAgent(data);
            } else {
                response = await callingAgentService.updateCallingAgent(data, selectedAgent?.id);
            }

            let message = `Agent ${formMode === "create" ? "created" : "updated"} successfully`;

            if (response.message)
                message = response.message;

            // Success
            setError("");

            showSuccess(message);
            setShowForm(false);
            setSelectedAgent(null);
            loadCallingAgents();

            return response;

        } catch (err: any) {
            console.log(err);

            // Check for network error vs API error
            if (err.detail?.includes("Network Error")) {
                // Network failure: maybe the record is actually created!
                showError("Network error occurred. Data might have been saved. Please verify before retrying.");
            } else {
                // API returned error
                showError(err?.response?.data?.detail || err?.detail || "Failed to save the data");
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (agent: CallingAgent) => {
        setLoading(true);
        showError('');
        showSuccess('');
        try {
            const response = await callingAgentService.publishAgent(agent.id!);
            if (response.success) {
                showSuccess(response.message)
                loadCallingAgents();
            }
            else
                showError(response.message)
        } catch (error: any) {
            showError(error?.response?.data?.detail || error?.detail || 'Failed to publish agent');
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
        const newStatus = agent.status === "paused" ? "active" : "paused";
        try {
            await callingAgentService.updateAgentStatus(agent.id!, newStatus);
            loadCallingAgents();
        } catch (error: any) {
            showError(error?.response?.data?.detail || `Failed to update the status`);
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

    const handleDelete = async (agent: CallingAgent) => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            await callingAgentService.deleteAgent(agent.id!);
            loadCallingAgents();
        } catch (error) {
            showError(`Failed to delete the agent`);
        } finally {
            setLoading(false);
        }
    };

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
                    loading={loading}
                />
            }


            {/* Agent Cards */}
            {
                !showForm && (
                    <>
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Status</TableCell>
                                        {/* <TableCell>Server</TableCell> */}
                                        <TableCell>Campaigns</TableCell>
                                        <TableCell>Created At</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {agents.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">
                                                <Box py={5}>
                                                    <Stack spacing={2} alignItems="center">
                                                        <GroupIcon sx={{ fontSize: 50, color: "text.secondary" }} />

                                                        <Typography variant="h6">
                                                            No Calling Agents Found
                                                        </Typography>

                                                        <Typography variant="body2" color="text.secondary">
                                                            You haven't created any agents yet.
                                                        </Typography>

                                                        <Button
                                                            variant="contained"
                                                            startIcon={<AddIcon />}
                                                            onClick={handleAddAgent}
                                                        >
                                                            Create Agent
                                                        </Button>
                                                    </Stack>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        agents.map((agent) => (
                                            <TableRow key={agent.id} hover>

                                                {/* Type */}
                                                <TableCell>
                                                    <Tooltip
                                                        title={
                                                            agent.type === "outbound"
                                                                ? "Outbound Call"
                                                                : "Inbound Call"
                                                        }
                                                    >
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            {agent.type === "outbound" ? (
                                                                <>
                                                                    <CallMadeIcon color="primary" fontSize="small" />
                                                                    <Typography variant="body2" fontWeight={500}>
                                                                        Outbound
                                                                    </Typography>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CallReceivedIcon color="secondary" fontSize="small" />
                                                                    <Typography variant="body2" fontWeight={500}>
                                                                        Inbound
                                                                    </Typography>
                                                                </>
                                                            )}
                                                        </Box>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* Name */}
                                                <TableCell>
                                                    <Typography fontWeight={600}>
                                                        {agent.name}
                                                    </Typography>
                                                </TableCell>

                                                {/* Status */}
                                                <TableCell>
                                                    <Chip
                                                        label={agent.status}
                                                        size="small"
                                                        sx={{
                                                            color:
                                                                agent.status === "active"
                                                                    ? "green"
                                                                    : agent.status === "paused"
                                                                        ? "orange"
                                                                        : "gray",
                                                            backgroundColor:
                                                                agent.status === "active"
                                                                    ? "rgba(72, 187, 120, 0.15)"
                                                                    : agent.status === "paused"
                                                                        ? "rgba(255, 165, 0, 0.15)"
                                                                        : "rgba(128, 128, 128, 0.15)",
                                                            fontWeight: 600
                                                        }}
                                                    />
                                                </TableCell>

                                                {/* Server */}
                                                {/* <TableCell>
                                                    {
                                                        agent.server_location?.toLowerCase() === "in"
                                                            ? "India"
                                                            : agent.server_location?.toLowerCase() === "us"
                                                                ? "United States"
                                                                : agent.server_location
                                                    }
                                                </TableCell> */}

                                                {/* Campaigns */}
                                                <TableCell>
                                                    <Box display="flex" flexDirection="column" gap={0.8}>

                                                        {/* Pending */}


                                                        {/* Active */}
                                                        <Box
                                                            sx={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                px: 1.2,
                                                                py: 0.3,
                                                                color: "#1d4ed8",
                                                                fontSize: 12,
                                                                fontWeight: 500
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 6,
                                                                    height: 6,
                                                                    borderRadius: "50%",
                                                                    bgcolor: "#3b82f6",
                                                                    mr: 0.8
                                                                }}
                                                            />
                                                            Running {agent.active_campaigns}
                                                        </Box>
                                                        {/* <Box
                                                            sx={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                px: 1.2,
                                                                py: 0.3,
                                                                color: "#1d4ed8", // blue-700
                                                                fontSize: 12,
                                                                fontWeight: 500
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 6,
                                                                    height: 6,
                                                                    borderRadius: "50%",
                                                                    bgcolor: "#3b82f6", // blue-500
                                                                    mr: 0.8
                                                                }}
                                                            />
                                                            Paused {agent.paused_campaigns}
                                                        </Box> */}

                                                        {/* Completed */}
                                                        <Box
                                                            sx={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                px: 1.2,
                                                                py: 0.3,
                                                                color: "#047857", // green-700
                                                                fontSize: 12,
                                                                fontWeight: 500
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 6,
                                                                    height: 6,
                                                                    borderRadius: "50%",
                                                                    bgcolor: "#10b981", // green-500
                                                                    mr: 0.8
                                                                }}
                                                            />
                                                            Completed {agent.completed_campaigns}
                                                        </Box>

                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {formatDateTime(agent.created_at)}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={1} justifyContent="flex-end">

                                                        {agent.status === "testing" && (
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
                                                        {agent.status !== "pending" && (
                                                            <Tooltip title="Test Call">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleTestCall(agent)}
                                                                >
                                                                    <CallIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        {agent.status !== "testing" && (
                                                            <>

                                                                <Tooltip
                                                                    title={
                                                                        agent.status === "active"
                                                                            ? "Pause Agent"
                                                                            : "Resume Agent"
                                                                    }
                                                                >
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handlePause(agent)}
                                                                    >
                                                                        {agent.status === "active" ? (
                                                                            <PauseIcon />
                                                                        ) : (
                                                                            <PlayArrowIcon />
                                                                        )}
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                        {agent.status !== "pending" && (
                                                            <>
                                                                <Tooltip title="Edit">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleEdit(agent)}
                                                                    >
                                                                        <EditIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </>
                                                        )}

                                                        <Tooltip title="Delete">
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleDelete(agent)}
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <TablePagination
                                component="div"
                                count={agentTotal}
                                page={agentPage}
                                onPageChange={(_, value) => setAgentPage(value)}
                                rowsPerPage={agentRowsPerPage}
                                onRowsPerPageChange={(event) => {
                                    setAgentRowsPerPage(parseInt(event.target.value, 10));
                                    setAgentPage(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50]}
                            />
                        </TableContainer>

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
                    onClose={(response) => {
                        setOpenTestDialog(false)
                        if (response.status == "failed")
                            showError(response.message)
                        else
                            showSuccess(response.message)
                    }}
                    agent={selectedAgent}
                />
            )}
        </Box >
    );
};