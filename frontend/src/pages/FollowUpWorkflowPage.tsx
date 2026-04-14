import React, { useState } from "react";
import {
    Box,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Typography,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    Chip,
    Divider,
    Paper,
    InputAdornment,
    Stack,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
    Add
} from "@mui/icons-material";
import AdminLayout from "../components/Layout/AdminLayout";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FollowUpWorkflow from "../components/FollowUpWorkflow/FollowUpWorkflow";

export default function FollowUpWorkflowPage() {
    const [view, setView] = useState("list");

    return (
        <AdminLayout>
            <Box sx={{ maxWidth: 1380, mx: 'auto', px: { xs: 0, md: 0.5 }, position: 'relative' }}>
                {view === "list" ? (
                    <WorkflowList onCreate={() => setView("create")} />
                ) : (
                    <FollowUpWorkflow onBack={() => setView("list")} />
                )}
            </Box>
        </AdminLayout>
    );
}

interface WorkflowListProps {
    onCreate: () => void;
}


function WorkflowList({ onCreate }: WorkflowListProps) {
    const theme = useTheme();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const workflows = [
        {
            id: 1,
            name: "Interested Followup",
            trigger: "Interested",
            steps: 3,
            status: "Active",
            created_at: "2024-06-15",
        },
        {
            id: 2,
            name: "No Answer Followup",
            trigger: "No Answer",
            steps: 2,
            status: "Active",
            created_at: "2024-06-18",
        },
    ];

    return (
        <Box>
            <Paper
                sx={{
                    p: { xs: 2, md: 2.4 },
                    borderRadius: "22px",
                    border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
                    background: `linear-gradient(125deg, ${alpha("#deebfb", 0.92)} 0%, ${alpha(
                        theme.palette.background.paper,
                        0.84,
                    )} 72%, ${alpha("#a9bfdc", 0.98)} 100%)`,
                    boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
                    position: "relative",
                    overflow: "hidden",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)",
                        pointerEvents: "none",
                    },
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        top: "-24%",
                        right: "-6%",
                        width: "42%",
                        height: "150%",
                        background:
                            "radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)",
                        pointerEvents: "none",
                    },
                    "& > *": {
                        position: "relative",
                        zIndex: 1,
                    },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                        flexWrap: "wrap",
                    }}
                >
                    <Box>
                        <Typography
                            variant="h4"
                            sx={{ fontWeight: 700, color: "primary.main", mb: 1 }}
                        >
                            Follow-up Workflows
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Create and manage follow-up workflows for your organization
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={onCreate}
                        sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            borderRadius: 2,
                            background:
                                "linear-gradient(135deg, #2f6bff 0%, #2d8ef0 100%)",
                            boxShadow: "0 12px 22px rgba(45,122,240,0.3)",
                        }}
                    >
                        Create Workflow
                    </Button>
                </Box>
            </Paper>
            <Grid container spacing={2} sx={{ mt: 2, mb: 2 }}>
                <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Total Workflows"
                        value={workflows.length}
                        color="#2f6bff"
                    />
                </Grid>

                <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Active"
                        value={workflows.filter(w => w.status === "Active").length}
                        color="#2ecc71"
                    />
                </Grid>

                <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Paused"
                        value={workflows.filter(w => w.status === "Paused").length}
                        color="#f39c12"
                    />
                </Grid>

                <Grid item xs={12} md={3}>
                    <SummaryCard
                        title="Total Followups"
                        value={workflows.reduce((a, b) => a + b.steps, 0)}
                        color="#9b59b6"
                    />
                </Grid>
            </Grid>

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
                        label="Status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        sx={{ flex: 1 }} // take 1/4 of the row
                    >
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="paused">Paused</MenuItem>
                    </TextField>
                </Stack>
            </Stack>

            <TableContainer
                component={Paper}
                sx={{
                    mt: 2,
                    borderRadius: 3,
                    boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
                }}
            >

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Workflow Name</TableCell>
                            <TableCell>Trigger</TableCell>
                            <TableCell>Steps</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {workflows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">
                                    <Typography color="text.secondary">
                                        No workflows created yet
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {workflows.map((workflow) => (
                            <TableRow key={workflow.id} hover>
                                <TableCell>
                                    <Typography fontWeight={600}>
                                        {workflow.name}
                                    </Typography>
                                </TableCell>

                                <TableCell>
                                    <Chip
                                        label={workflow.trigger}
                                        size="small"
                                        variant="outlined"
                                    />
                                </TableCell>

                                <TableCell>
                                    {workflow.steps} followups
                                </TableCell>

                                <TableCell>
                                    <Chip
                                        label={workflow.status}
                                        color={
                                            workflow.status === "Active"
                                                ? "success"
                                                : "default"
                                        }
                                        size="small"
                                    />
                                </TableCell>

                                <TableCell>
                                    {workflow.created_at || "-"}
                                </TableCell>

                                <TableCell align="right">
                                    <IconButton size="small">
                                        <EditIcon />
                                    </IconButton>

                                    <IconButton size="small">
                                        <VisibilityIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}



interface SummaryCardProps {
    title: string;
    value: number;
    color: string;
}

const SummaryCard = ({ title, value, color }: SummaryCardProps) => {
    return (
        <Card
            sx={{
                borderRadius: 3,
                boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
            }}
        >
            <CardContent>
                <Typography
                    variant="body2"
                    color="text.secondary"
                >
                    {title}
                </Typography>

                <Typography
                    variant="h4"
                    fontWeight={700}
                    sx={{ color }}
                >
                    {value}
                </Typography>
            </CardContent>
        </Card>
    );
};