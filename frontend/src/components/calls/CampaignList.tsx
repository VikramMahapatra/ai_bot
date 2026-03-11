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
    Grid
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";

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
            return "success";
        case "Paused":
            return "warning";
        case "Completed":
            return "primary";
        default:
            return "default";
    }
};

const CampaignList: React.FC<Props> = ({ onAddCampaign }) => {

    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === "Active").length;
    const pausedCampaigns = campaigns.filter(c => c.status === "Paused").length;
    const completedCampaigns = campaigns.filter(c => c.status === "Completed").length;

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
                                    {totalCampaigns}
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
                                <Typography variant="h5" fontWeight={700} color="success.main">
                                    {activeCampaigns}
                                </Typography>
                            </Box>

                            <PlayCircleIcon sx={{ fontSize: 40, color: "success.main" }} />
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
                                    {pausedCampaigns}
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
                                    {completedCampaigns}
                                </Typography>
                            </Box>

                            <CheckCircleIcon sx={{ fontSize: 40, color: "primary.main" }} />
                        </Box>
                    </Paper>
                </Grid>

            </Grid>

            {/* CAMPAIGN LIST */}

            <Paper sx={{ p: 4 }}>

                {/* HEADER */}

                <Box display="flex" justifyContent="space-between" mb={3}>
                    <Typography variant="h5">
                        Campaigns
                    </Typography>

                    <Button
                        variant="contained"
                        onClick={onAddCampaign}
                    >
                        Create Campaign
                    </Button>
                </Box>

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

                        {campaigns.map((campaign) => (
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
                        ))}

                    </TableBody>

                </Table>

            </Paper>

        </Box>
    );
};

export default CampaignList;