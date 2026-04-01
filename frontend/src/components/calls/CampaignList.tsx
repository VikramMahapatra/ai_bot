import {
    Box,
    Button,
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Chip,
    LinearProgress,
    IconButton,
    Stack,
    Grid,
    TablePagination,
    TextField,
    InputAdornment,
    Tooltip,
    Alert
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PhoneIcon from "@mui/icons-material/Phone";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import GroupIcon from "@mui/icons-material/Group";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from '@mui/icons-material/Visibility';
import InsightsIcon from "@mui/icons-material/Insights";
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Inventory2Icon from '@mui/icons-material/Inventory2';

import { callCampaignService, Campaign, CampaignStats } from "../../services/callCampaignService";
import { useEffect, useState } from "react";
import { formatDateTime } from "../../utils/dateUtils";
import CampaignAnalyticsDrawer from "./CampaignAnalyticsDrawer";
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from "@mui/icons-material/Close";

interface Props {
    onAddCampaign: () => void;
    onEditCampaign: (id?: number) => void;
    onViewCampaign: (id?: number) => void;
    onDeleteCampaign: (id?: number) => void;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case "active":
            return "secondary";
        case "running":
            return "secondary";
        case "scheduled":
            return "secondary";
        case "paused":
            return "warning";
        case "completed":
            return "primary";
        default:
            return "default";
    }
};

const CampaignList: React.FC<Props> = ({ onAddCampaign, onEditCampaign, onViewCampaign, onDeleteCampaign }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignTotal, setCampaignTotal] = useState(0);
    const [campaignPage, setCampaignPage] = useState(0);
    const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(10);
    const [campaignStats, setCampaignStats] = useState<CampaignStats>({
        totalCampaigns: 0,
        activeCampaigns: 0,
        pausedCampaigns: 0,
        completedCampaigns: 0
    });

    const [search, setSearch] = useState("");
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);


    const openDrawer = (campaign: Campaign) => {
        setSelectedCampaign(campaign);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setSelectedCampaign(null);
    };

    const showError = (message: string) => {
        setSuccess('');
        setError(message);
    };

    const showSuccess = (message: string) => {
        setError('');
        setSuccess(message);
    };

    const loadCampaigns = async () => {
        setLoading(true);
        const data = await callCampaignService.allCampaigns({
            search: search || undefined,
            skip: campaignPage * campaignRowsPerPage,
            limit: campaignRowsPerPage,
        });
        setCampaigns(data.items || []);
        setCampaignTotal(data.pagination?.total || 0);
        setLoading(false);
    };

    const loadCampaignStats = async () => {
        const data = await callCampaignService.campaignStats();
        setCampaignStats(data || []);
    };

    useEffect(() => {
        loadCampaignStats();
    }, []);

    useEffect(() => {
        const run = async () => {
            try {
                await loadCampaigns();
            } catch (err: any) {
                showError(err?.response?.data?.detail || 'Failed to load campaigns');
            }
        };
        run();
    }, [search, campaignPage, campaignRowsPerPage]);


    const handlePause = async (campaign: Campaign) => {
        setLoading(true);
        const newStatus = campaign.status === "paused" ? "running" : "paused";
        try {
            const response = await callCampaignService.updateCampaignStatus(campaign.id!, newStatus);

            if (response.success) {
                loadCampaigns();
                showSuccess(response.message)
            }
            else {
                showError(response.message)
            }
        } catch (error: any) {
            showError(error?.response?.data?.detail || `Failed to update the status`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case "active":
                return "#dcfce7";
            case "running":
                return "#dcfce7";
            case "paused":
                return "#fef3c7";
            case "completed":
                return "#dbeafe";
            default:
                return "#f3f4f6";
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "active":
                return "#15803d";
            case "paused":
                return "#b45309";
            case "completed":
                return "#1d4ed8";
            default:
                return "#374151";
        }
    };

    return (
        <Box>

            {/* SUMMARY CARDS */}
            {loading && (
                <Box mb={3}>
                    <LinearProgress sx={{ borderRadius: 1.2 }} />
                </Box>
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

            <Grid container spacing={3} mb={3}>

                {/* TOTAL CAMPAIGNS */}

                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Total Campaigns
                                </Typography>
                                <Typography variant="h5" fontWeight={700}>
                                    {campaignStats.totalCampaigns}
                                </Typography>
                            </Box>

                            <CampaignIcon sx={{ fontSize: 40, color: "primary.main" }} />
                        </Box>
                    </Paper>
                </Grid>

                {/* ACTIVE */}

                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Active Now
                                </Typography>
                                <Typography variant="h5" fontWeight={700} color="secondary.main">
                                    {campaignStats.activeCampaigns}
                                </Typography>
                            </Box>

                            <PlayCircleIcon sx={{ fontSize: 40, color: "secondary.main" }} />
                        </Box>
                    </Paper>
                </Grid>

                {/* PAUSED */}

                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Paused
                                </Typography>
                                <Typography variant="h5" fontWeight={700} color="warning.main">
                                    {campaignStats.pausedCampaigns}
                                </Typography>
                            </Box>

                            <PauseCircleIcon sx={{ fontSize: 40, color: "warning.main" }} />
                        </Box>
                    </Paper>
                </Grid>

                {/* COMPLETED */}

                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Completed
                                </Typography>
                                <Typography variant="h5" fontWeight={700} color="primary.main">
                                    {campaignStats.completedCampaigns}
                                </Typography>
                            </Box>

                            <CheckCircleIcon sx={{ fontSize: 40, color: "primary.main" }} />
                        </Box>
                    </Paper>
                </Grid>

            </Grid>

            {/* CAMPAIGN LIST */}
            <Grid container spacing={2} mb={2} alignItems="center">

                {/* SEARCH */}
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        size="small"
                        label="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
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

                {/* BUTTON */}
                <Grid
                    item
                    xs={12}
                    md={6}
                    display="flex"
                    justifyContent={{ xs: "flex-start", md: "flex-end" }}
                >
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={onAddCampaign}
                    >
                        Create Campaign
                    </Button>
                </Grid>

            </Grid>

            <Paper>

                {/* HEADER */}

                {/* <Box display="flex" justifyContent="space-between" mb={3}>
                    <Typography variant="h5">
                        Campaigns
                    </Typography>

                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={onAddCampaign}
                    >
                        Create Campaign
                    </Button>
                </Box> */}

                {/* TABLE */}

                <Table>

                    <TableHead sx={{ backgroundColor: "#f9fafb" }}>
                        <TableRow>
                            <TableCell>Campaign Name</TableCell>
                            <TableCell>From Number</TableCell>
                            <TableCell>Agent</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {campaigns.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ py: 8, textAlign: "center" }}>
                                    <SearchIcon sx={{ fontSize: 40, color: "text.secondary" }} />
                                    <Typography>No campaigns found</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            campaigns.map((campaign) => (
                                <TableRow key={campaign.id} hover>

                                    {/* CAMPAIGN NAME */}
                                    <TableCell>
                                        <Box display="flex" flexDirection="column" gap={0.5}>
                                            <Typography fontWeight={600}>
                                                {campaign.name}
                                            </Typography>

                                            <Box display="flex" alignItems="center" gap={2}>

                                                {/* Product */}
                                                {campaign.product_name && (
                                                    <Box display="flex" alignItems="center" gap={0.5}>
                                                        <Inventory2Icon
                                                            fontSize="small"
                                                            sx={{ fontSize: 16 }}
                                                            color="action"
                                                        />
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            {campaign.product_name}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Contacts */}
                                                <Box display="flex" alignItems="center" gap={0.5}>
                                                    <GroupIcon
                                                        fontSize="small"
                                                        sx={{ fontSize: 16 }}
                                                        color="action"
                                                    />
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {campaign.contacts} contacts
                                                    </Typography>
                                                </Box>

                                            </Box>
                                        </Box>
                                    </TableCell>

                                    {/* FROM NUMBER */}
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <PhoneIcon fontSize="small" color="primary" />
                                            <Typography variant="body2">
                                                {campaign.calling_no}
                                            </Typography>
                                        </Box>
                                    </TableCell>

                                    {/* AGENT */}
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <SmartToyIcon fontSize="small" color="primary" />
                                            <Typography variant="body2">
                                                {campaign.agent_name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    {/* <TableCell>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {campaign.product_name && <Inventory2Icon fontSize="small" color="primary" />}
                                            <Typography variant="body2">
                                                {campaign.product_name || "-"}
                                            </Typography>
                                        </Box>
                                    </TableCell>

                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <GroupIcon fontSize="small" color="primary" />
                                            <Typography variant="body2">
                                                {campaign.contacts}
                                            </Typography>
                                        </Box>
                                    </TableCell> */}

                                    {/* STATUS */}
                                    <TableCell>
                                        <Chip
                                            label={campaign.status}
                                            size="small"
                                            sx={{
                                                borderRadius: "999px",
                                                fontWeight: 600,
                                                backgroundColor: getStatusBg(campaign.status),
                                                color: getStatusText(campaign.status)
                                            }}
                                            variant="outlined"
                                        />
                                    </TableCell>

                                    {/* CREATED AT */}
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatDateTime(campaign.created_at)}
                                        </Typography>
                                    </TableCell>

                                    {/* ACTIONS */}
                                    <TableCell align="right">

                                        {["running", "paused"].includes(campaign.status) && (
                                            <>

                                                <Tooltip
                                                    title={
                                                        campaign.status === "running"
                                                            ? "Pause Campaign"
                                                            : "Start Campaign"
                                                    }
                                                >
                                                    <IconButton
                                                        size="small"
                                                        color={
                                                            campaign.status === "running"
                                                                ? "warning"
                                                                : "primary"
                                                        }
                                                        onClick={() => handlePause(campaign)}
                                                    >
                                                        {campaign.status === "running" ? (
                                                            <PauseIcon />
                                                        ) : (
                                                            <PlayArrowIcon />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                        <Tooltip title="View Analytics">
                                            <IconButton onClick={() => openDrawer(campaign)}>
                                                <InsightsIcon color="primary" />
                                            </IconButton>
                                        </Tooltip>
                                        <IconButton
                                            size="small"
                                            onClick={() => onViewCampaign(campaign.id)}
                                        >
                                            <VisibilityIcon />
                                        </IconButton>
                                        {["draft"].includes(campaign.status) && (
                                            <IconButton
                                                size="small"
                                                onClick={() => onEditCampaign(campaign.id)}
                                            >
                                                <EditIcon />
                                            </IconButton>
                                        )}
                                        {/* {["completed", "pending"].includes(campaign.status) && (
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => onDeleteCampaign(campaign.id)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        )} */}
                                    </TableCell>

                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={campaignTotal}
                    page={campaignPage}
                    onPageChange={(_, value) => setCampaignPage(value)}
                    rowsPerPage={campaignRowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setCampaignRowsPerPage(parseInt(event.target.value, 10));
                        setCampaignPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                />
            </Paper>
            <CampaignAnalyticsDrawer
                open={drawerOpen}
                onClose={closeDrawer}
                campaign={selectedCampaign}
            />

        </Box>
    );
};

export default CampaignList;