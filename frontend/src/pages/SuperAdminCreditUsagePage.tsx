import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { OrgCreditAdminMonthSummary } from "../types/orgCreditBilling";
import { SuperAdminOrganization } from "../types";
import { superadminService } from "../services/superadminService";
import OrganizationCard from "../components/CreditUsageOrgCard";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";

const toCurrency = (value: number): string =>
  value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

type OrgFilter = "all" | string;

const parseError = (error: unknown): string => {
  const maybe = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return maybe?.message || "Something went wrong";
};

const SuperAdminCreditUsagePage: React.FC = () => {
  const theme = useTheme();

  const [billingPeriod, setBillingPeriod] = useState("");
  const [orgCreditUsage, setOrgCreditUsage] = useState<
    OrgCreditAdminMonthSummary[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>(
    [],
  );
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("all");
  const [organizationTotal, setOrganizationTotal] = useState(0);
  const [organizationPage, setOrganizationPage] = useState(0);
  const [organizationRowsPerPage, setOrganizationRowsPerPage] = useState(8);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const billingPeriodLabel = useMemo(() => {
    const t = billingPeriod.trim();
    if (t) return t;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [billingPeriod]);

  const loadOrganizations = async () => {
    setLoading(true);
    setError("");
    try {
      const orgRows = await superadminService.listOrganizations();
      setOrganizations(orgRows);
    } catch (loadError) {
      setError(parseError(loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        organization_id: orgFilter === "all" ? undefined : Number(orgFilter),
        search: search || undefined,
        skip: organizationPage * organizationRowsPerPage,
        limit: organizationRowsPerPage,
        billing_period: billingPeriod,
      };
      const usageCredits = await superadminService.listCreditUsage(params);
      setOrgCreditUsage(usageCredits.items);
      setOrganizationTotal(usageCredits.pagination?.total || 0);
    } catch (loadError) {
      setError(parseError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadData();
  }, [orgFilter, search, organizationPage, organizationRowsPerPage]);

  useEffect(() => {
    setOrganizationPage(0);
  }, [search, organizationRowsPerPage, viewMode]);

  const metrics = useMemo(() => {
    const totalCredit = orgCreditUsage.reduce(
      (sum, row) => sum + (row.total_credit || 0),
      0,
    );
    const totalUsedCredit = orgCreditUsage.reduce(
      (sum, row) => sum + (row.used_credit || 0),
      0,
    );
    const totalRemainingCredit = orgCreditUsage.reduce(
      (sum, row) => sum + (row.remaining_credit || 0),
      0,
    );
    const prevMonthLapsed = orgCreditUsage.reduce(
      (sum, row) => sum + (row.lapsed_previous_month || 0),
      0,
    );
    return {
      totalCredit,
      totalUsedCredit,
      totalRemainingCredit,
      prevMonthLapsed,
    };
  }, [orgCreditUsage]);

  const getUsagePercentage = (summary: {
    used_credit?: number;
    total_credit?: number;
  }): number => {
    const used = summary?.used_credit ?? 0;
    const total = summary?.total_credit ?? 0;
    if (total === 0) return 0;
    const percentage = (used / total) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  const formatBillingPeriod = (value: string) => {
  if (!value) return "";

  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1);

  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.6 },
          mb: 2,
          borderRadius: "18px",
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(125deg, ${alpha("#d7f0e9", 0.95)} 0%, ${alpha(
            theme.palette.background.paper,
            0.88,
          )} 58%, ${alpha("#b5d7f2", 0.95)} 100%)`,
          boxShadow: `0 20px 42px ${alpha(theme.palette.primary.dark, 0.2)}`,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-start" }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{ fontWeight: 700, letterSpacing: 1.3 }}
            >
              Org Credit
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Monthly Credit & Usage
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.4, color: "text.secondary" }}
            >
              Credits are strictly month-based. Unused credits expire at month
              end and do not roll over.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 2.6 }}>
        {[
          {
            label: "Total Credit",
            value: toCurrency(metrics.totalCredit),
            color: "text.secondary",
          },
          {
            label: "Used Credit",
            value: String(metrics.totalUsedCredit),
            color: "text.secondary",
          },
          {
            label: "Remaining Credit",
            value: String(metrics.totalRemainingCredit),
            color: "success.main",
          },
          {
            label: "Previous Month Lapsed",
            value: String(metrics.prevMonthLapsed),
            color: "warning.main",
          },
        ].map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            <Card
              elevation={0}
              sx={{
                borderRadius: "16px",
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                background: `linear-gradient(145deg, ${alpha("#f0fbf8", 0.92)} 0%, ${alpha("#ffffff", 1)} 84%)`,
              }}
            >
              <CardContent sx={{ py: 1.6 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {card.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 800, color: card.color }}
                    >
                      {card.value}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", mb: 2.2 }}>
        <Grid container spacing={1.3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Organization Filter</InputLabel>
              <Select
                value={orgFilter}
                label="Organization Filter"
                onChange={(event) => {
                  setOrgFilter(event.target.value);
                }}
              >
                <MenuItem value="all">All Organizations</MenuItem>
                {organizations.map((org) => (
                  <MenuItem key={org.id} value={String(org.id)}>
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {/* <Grid item xs={12} md={2}>
            <TextField
              size="small"
              fullWidth
              label="Search organization"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search organization"
            />
          </Grid> */}
          <Grid item xs={12} md={2.5}>
            <TextField
              size="small"
              label="Billing Month (YYYY-MM)"
              placeholder="YYYY-MM"
              value={billingPeriodLabel}
              onChange={(e) => setBillingPeriod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  loadData();
                }
              }}
              sx={{ minWidth: { sm: 200 } }}
            />
          </Grid>
          <Grid item xs={8} md={3}>
            <Button
              variant="contained"
              onClick={loadData}
              disabled={loading || orgFilter === undefined}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </Grid>
          <Grid item xs={4} md={1}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, value) => value && setViewMode(value)}
            >
              <ToggleButton value="cards">
                <ViewModuleIcon fontSize="small" sx={{ mr: 0.7 }} />
                Cards
              </ToggleButton>
              <ToggleButton value="table">
                <ViewListIcon fontSize="small" sx={{ mr: 0.7 }} />
                Table
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {viewMode == "cards" ? (
        <Grid container spacing={3}>
          {orgCreditUsage.map((org) => (
            <Grid item xs={12} md={6}>
              <OrganizationCard
                name={org.organization_name}
                date={formatBillingPeriod(org.billing_period)}
                usage={getUsagePercentage(org).toFixed(2)}
                invoice={org.invoices_count}
                credits={{
                  allocated: org.total_credit,
                  used: org.used_credit,
                  remaining: org.remaining_credit,
                }}
              />
            </Grid>
          ))}
          {orgCreditUsage.length === 0 && (
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "14px",
                  border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  No organizations match your filter.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try another search term or clear the filter.
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: "16px",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          }}
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Billing Period</TableCell>
                  <TableCell>Usage %</TableCell>
                  <TableCell>Invoices</TableCell>
                  <TableCell>Total Credit</TableCell>
                  <TableCell>Used Credit</TableCell>
                  <TableCell>Remaining Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orgCreditUsage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No organizations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  orgCreditUsage.map((org) => (
                    <TableRow key={`org-table-${org.organization_id}`} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {org.organization_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatBillingPeriod(org.billing_period)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getUsagePercentage(org).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {org.invoices_count}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {org.total_credit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {org.used_credit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {org.remaining_credit}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      <TablePagination
        component="div"
        count={organizationTotal}
        page={organizationPage}
        onPageChange={(_, nextPage) => setOrganizationPage(nextPage)}
        rowsPerPage={organizationRowsPerPage}
        onRowsPerPageChange={(event) => {
          setOrganizationRowsPerPage(parseInt(event.target.value, 10));
          setOrganizationPage(0);
        }}
        rowsPerPageOptions={[8, 16, 24, 48]}
      />
    </SuperAdminLayout>
  );
};

export default SuperAdminCreditUsagePage;
