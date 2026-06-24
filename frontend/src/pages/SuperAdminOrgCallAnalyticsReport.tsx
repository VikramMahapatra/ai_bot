import React, { useEffect, useState } from "react";

import {
    Box,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Collapse,
    IconButton,
    Paper,
    Chip,
    CircularProgress,
    TablePagination,
    TextField,
    InputAdornment,
    Snackbar,
    Alert,
    Button
} from "@mui/material";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { OrganizationReport, SuperAdminOrganization } from "../types";
import { superadminService } from "../services/superadminService";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { alpha, useTheme } from '@mui/material/styles';
import SearchIcon from "@mui/icons-material/Search";
import RepublishAgentDialog, { RepublishPayload } from "../components/SuperAdmin/RepublishAgentDialog";


export default function SuperAdminOrgCallAnalyticsReport() {
    const theme = useTheme();
    const [data, setData] = useState<OrganizationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [openRow, setOpenRow] = useState<number | null>(null);

    const [search, setSearch] = useState("");
    const [organizationTotal, setOrganizationTotal] = useState(0);
    const [organizationPage, setOrganizationPage] = useState(0);
    const [organizationRowsPerPage, setOrganizationRowsPerPage] = useState(10);
    const [republishOpen, setRepublishOpen] = useState(false);
    const [republishLoading, setRepublishLoading] = useState(false);
    const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([],);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadData = async () => {
        try {
            const res = await superadminService.getOrganizationReport({
                search: search || undefined,
                skip: organizationPage * organizationRowsPerPage,
                limit: organizationRowsPerPage
            });
            setData(res.items || []);
            setOrganizationTotal(res.total || 0);
        } finally {
            setLoading(false);
        }
    };

    const loadOrganizations = async () => {
        setLoading(true);
        setError("");
        try {
            const orgRows = await superadminService.listOrganizations();
            setOrganizations(orgRows);
        } catch (err: any) {
            setError("Failed to load the organizations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [search, organizationPage, organizationRowsPerPage]);

    useEffect(() => {
        loadOrganizations();
    }, [])

    const handleRepublish = async (payload: RepublishPayload) => {
        try {

            setRepublishLoading(true);
            const response = await superadminService.republishAgent(payload);
            setSuccess(`Successfully republished ${response.success_count} agent(s)`);

        } catch (error: any) {
            setError(error?.response?.data?.message || error?.detail || "Failed to republish agents");
        } finally {
            setRepublishLoading(false);
        }
    };

    if (loading)
        return (
            <Box textAlign="center" mt={5}>
                <CircularProgress />
            </Box>
        );


    return (
        <SuperAdminLayout>
            <Snackbar
                open={Boolean(success || error)}
                autoHideDuration={4000}
                onClose={() => {
                    setError("");
                    setSuccess("");
                }}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                sx={{
                    zIndex: 999999999,
                }}
            >
                <Alert
                    severity={error ? "error" : "success"}
                    onClose={() => {
                        setError("");
                        setSuccess("");
                    }}
                    sx={{
                        borderRadius: "14px",
                        boxShadow: (theme) =>
                            `0 10px 18px ${error ? theme.palette.error.dark : theme.palette.success.dark
                            }20`,
                        zIndex: 999999999,
                    }}
                >
                    {error || success}
                </Alert>
            </Snackbar>
            <Box>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2, md: 2.6 },
                        mb: 3,
                        borderRadius: '22px',
                        border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
                        background: `linear-gradient(125deg, ${alpha('#deebfb', 0.92)} 0%, ${alpha(
                            theme.palette.background.paper,
                            0.84
                        )} 72%, ${alpha('#a9bfdc', 0.98)} 100%)`,
                        boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >

                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        flexWrap="wrap"
                        gap={2}
                    >

                        <Typography
                            variant="h4"
                            sx={{ fontWeight: 800, color: 'primary.main' }}
                        >
                            Call Analytics (All Organizations)
                        </Typography>

                        <Box display="flex" gap={2}>
                            <TextField
                                size="small"
                                label="Search Organization"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                sx={{ width: 260, background: "white", borderRadius: 2 }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => setRepublishOpen(true)}
                            >
                                Republish Agents
                            </Button>
                        </Box>
                    </Box>

                </Paper>
                <Paper>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell />
                                <TableCell>Organization</TableCell>
                                <TableCell>Agents</TableCell>
                                <TableCell>Campaigns</TableCell>
                                <TableCell>Calls</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {data.map((row) => (
                                <React.Fragment key={row.organization_id}>

                                    <TableRow>

                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    setOpenRow(
                                                        openRow === row.organization_id
                                                            ? null
                                                            : row.organization_id
                                                    )
                                                }
                                            >
                                                {openRow === row.organization_id ? (
                                                    <KeyboardArrowUpIcon />
                                                ) : (
                                                    <KeyboardArrowDownIcon />
                                                )}
                                            </IconButton>
                                        </TableCell>

                                        <TableCell>
                                            {row.organization_name}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={row.agents_created}
                                                color="primary"
                                            />
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={row.campaign_created}
                                                color="secondary"
                                            />
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={row.calls_done}
                                                color="success"
                                            />
                                        </TableCell>

                                    </TableRow>


                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Collapse
                                                in={openRow === row.organization_id}
                                                timeout="auto"
                                                unmountOnExit
                                            >

                                                <Box p={3}>

                                                    <Typography fontWeight={600} mb={2}>
                                                        Agents
                                                    </Typography>

                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Name</TableCell>
                                                                <TableCell>External Name</TableCell>
                                                                <TableCell>External ID</TableCell>
                                                            </TableRow>
                                                        </TableHead>

                                                        <TableBody>
                                                            {row.agents.map((a, i) => (
                                                                <TableRow key={i}>
                                                                    <TableCell>{a.name}</TableCell>
                                                                    <TableCell>{a.external_agent_name}</TableCell>
                                                                    <TableCell>{a.external_agent_id}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>


                                                    <Box mt={4}>
                                                        <Typography fontWeight={600} mb={2}>
                                                            Campaigns
                                                        </Typography>

                                                        <Table size="small">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell>Name</TableCell>
                                                                    <TableCell>External Name</TableCell>
                                                                    <TableCell>External ID</TableCell>
                                                                </TableRow>
                                                            </TableHead>

                                                            <TableBody>
                                                                {row.campaigns.map((c, i) => (
                                                                    <TableRow key={i}>
                                                                        <TableCell>{c.name}</TableCell>
                                                                        <TableCell>{c.external_campaign_name}</TableCell>
                                                                        <TableCell>{c.external_campaign_id}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>

                                                    </Box>

                                                </Box>

                                            </Collapse>
                                        </TableCell>
                                    </TableRow>

                                </React.Fragment>
                            ))}
                        </TableBody>

                    </Table>
                    <TablePagination
                        component="div"
                        count={organizationTotal}
                        page={organizationPage}
                        onPageChange={(_, value) => setOrganizationPage(value)}
                        rowsPerPage={organizationRowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setOrganizationRowsPerPage(parseInt(event.target.value, 10));
                            setOrganizationPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50]}
                    />
                </Paper>

            </Box>
            <RepublishAgentDialog
                open={republishOpen}
                onClose={() => setRepublishOpen(false)}
                organizations={organizations}
                loading={republishLoading}
                onPublish={handleRepublish}
            />
        </SuperAdminLayout>
    );
}
