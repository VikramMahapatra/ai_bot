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
    InputAdornment
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AddIcon from "@mui/icons-material/Add";

import { callCampaignService, Campaign, CampaignStats } from "../../services/callCampaignService";
import { useEffect, useState } from "react";

interface Props {
    onAddCampaign: () => void;
}

const campaigns = [
    {
        id: 1,
        name: "Real Estate Leads",
        category: "Sales",
        status: "Active",
        contacts: 120,
        progress: 65
    },
    {
        id: 2,
        name: "Loan Follow-up",
        category: "Paused",
        contacts: 50,
        status: "Paused",
        progress: 20
    },
    {
        id: 3,
        name: "Insurance Renewal",
        category: "Reminder",
        status: "Completed",
        contacts: 200,
        progress: 100
    }
];

const getStatusColor = (status: string) => {
    switch (status) {
        case "Active":
            return "secondary";
        case "Paused":
            return "warning";
        case "Completed":
            return "primary";
        default:
            return "default";
    }
};

const CampaignList: React.FC<Props> = ({ onAddCampaign }) => {

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

    const showError = (message: string) => {
        setSuccess('');
        setError(message);
    };

    const showSuccess = (message: string) => {
        setError('');
        setSuccess(message);
    };

    const loadCampaigns = async () => {
        const data = await callCampaignService.allCampaigns({
            search: search || undefined,
            skip: campaignPage * campaignRowsPerPage,
            limit: campaignRowsPerPage,
        });
        setCampaigns(data.items || []);
        setCampaignTotal(data.pagination?.total || 0);
    };

    const loadCampaignStats = async () => {
        const data = await callCampaignService.campaignStats();
        setCampaignStats(data || []);
    };

    useEffect(() => {
        loadCampaigns();
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


    return (
        <Box>

            {/* SUMMARY CARDS */}

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

                    <TableHead>
                        <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Contacts</TableCell>
                            <TableCell>Progress</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {campaigns.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} sx={{ py: 8 }}>
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
                                            No campaigns found
                                        </Typography>

                                        <Typography variant="body2" sx={{ color: "text.disabled" }}>
                                            Try adjusting your search or add a new campaign
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>

                        ) : (
                            campaigns.map((campaign) => (
                                <TableRow key={campaign.id} hover>

                                    {/* CAMPAIGN */}

                                    <TableCell>
                                        <Box>
                                            <Typography fontWeight={600}>
                                                {campaign.name}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {campaign.category}
                                            </Typography>
                                        </Box>
                                    </TableCell>

                                    {/* STATUS */}

                                    <TableCell>
                                        <Chip
                                            label={campaign.status}
                                            color={getStatusColor(campaign.status) as any}
                                            size="small"
                                        />
                                    </TableCell>

                                    {/* CONTACTS */}

                                    <TableCell>
                                        {campaign.contacts}
                                    </TableCell>

                                    {/* PROGRESS */}

                                    <TableCell width={200}>
                                        <Stack spacing={1}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={campaign.progress}
                                            />
                                            <Typography variant="caption">
                                                {campaign.progress}% completed
                                            </Typography>
                                        </Stack>
                                    </TableCell>

                                    {/* ACTIONS */}

                                    <TableCell align="right">

                                        <IconButton size="small">
                                            <VisibilityIcon />
                                        </IconButton>

                                        <IconButton size="small">
                                            <EditIcon />
                                        </IconButton>

                                        <IconButton size="small" color="error">
                                            <DeleteIcon />
                                        </IconButton>

                                    </TableCell>

                                </TableRow>
                            )))}

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

        </Box>
    );
};

export default CampaignList;