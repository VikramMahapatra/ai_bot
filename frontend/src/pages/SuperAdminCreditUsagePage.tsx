import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { alpha, useTheme } from "@mui/material/styles";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { OrgCreditAdminMonthSummary } from "../types/orgCreditBilling";
import { SuperAdminOrganization } from "../types";

const toCurrency = (value: number): string =>
  value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Static mock orgs — replace with API when ready */
const MOCK_ORGANIZATIONS: SuperAdminOrganization[] = [
  { id: 101, name: "Acme Corp " },
  { id: 102, name: "Globex Industries" },
  { id: 103, name: "Initech" },
];

function buildMockSummary(
  org: SuperAdminOrganization,
  billingPeriodLabel: string,
): OrgCreditAdminMonthSummary {
  const seed = org.id % 7;
  const total = 50000 + seed * 2500;
  const used = 12000 + seed * 1800;
  const remaining = Math.max(0, total - used);
  return {
    organization_id: org.id,
    organization_name: org.name,
    billing_period: billingPeriodLabel,
    total_credit: total,
    used_credit: used,
    remaining_credit: remaining,
    lapsed_previous_month: 3200 + seed * 100,
    invoices_count: 2 + (seed % 3),
    paid_invoices_count: 1 + (seed % 2),
    open_invoices_count: 1,
    payments_collected: 45000 + seed * 500,
    no_rollover_policy: true,
    generated_at: new Date().toISOString(),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const SuperAdminCreditUsagePage: React.FC = () => {
  const theme = useTheme();
  const [organizations] =
    useState<SuperAdminOrganization[]>(MOCK_ORGANIZATIONS);
  const [selectedOrgId, setSelectedOrgId] = useState<number | "">(
    MOCK_ORGANIZATIONS[0]?.id ?? "",
  );
  const [billingPeriod, setBillingPeriod] = useState("");
  const [summary, setSummary] = useState<OrgCreditAdminMonthSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const billingPeriodLabel = useMemo(() => {
    const t = billingPeriod.trim();
    if (t) return t;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [billingPeriod]);

  const fetchSummary = useCallback(async () => {
    if (selectedOrgId === "") {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await delay(400);
      const org = organizations.find((o) => o.id === selectedOrgId);
      if (!org) {
        setError("Organization not found");
        setSummary(null);
        return;
      }
      setSummary(buildMockSummary(org, billingPeriodLabel));
    } catch {
      setError("Failed to load credit summary");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, billingPeriodLabel, organizations]);

  useEffect(() => {
    if (selectedOrgId === "") return;
    fetchSummary();
  }, [selectedOrgId, billingPeriodLabel, fetchSummary]);

  const usagePercent = useMemo(() => {
    if (!summary || summary.total_credit <= 0) return 0;
    return Math.min(
      100,
      Math.max(0, (summary.used_credit / summary.total_credit) * 100),
    );
  }, [summary]);

  const handleOrgChange = (e: SelectChangeEvent<number | "">) => {
    const v = e.target.value;
    setSelectedOrgId(v === "" ? "" : Number(v));
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
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ minWidth: { md: 360 } }}
          >
            <FormControl size="small" fullWidth sx={{ minWidth: { sm: 200 } }}>
              <InputLabel id="superadmin-credit-org-label">
                Organization
              </InputLabel>
              <Select<number | "">
                labelId="superadmin-credit-org-label"
                label="Organization"
                value={selectedOrgId}
                onChange={handleOrgChange}
                disabled={organizations.length === 0}
              >
                {organizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name} (#{org.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Billing period (optional)"
              placeholder="YYYY-MM"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              helperText="Leave blank for current month"
              sx={{ minWidth: { sm: 160 } }}
            />
            <Button
              variant="contained"
              onClick={fetchSummary}
              disabled={loading || selectedOrgId === ""}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      {summary ? (
        <>
          <Grid container spacing={1.4} sx={{ mb: 1.2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: "14px" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Total Credit
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {toCurrency(summary.total_credit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: "14px" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Used Credit
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {toCurrency(summary.used_credit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: "14px" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Remaining Credit
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      color:
                        summary.remaining_credit > 0
                          ? "success.main"
                          : "error.main",
                    }}
                  >
                    {toCurrency(summary.remaining_credit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: "14px" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Previous Month Lapsed
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 800, color: "warning.main" }}
                  >
                    {toCurrency(summary.lapsed_previous_month)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ borderRadius: "14px" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.6 }}>
                {summary.organization_name} | {summary.billing_period}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Usage: {usagePercent.toFixed(2)}%
              </Typography>
              <Typography variant="body2">
                Invoices: {summary.invoices_count} | Paid:{" "}
                {summary.paid_invoices_count} | Open:{" "}
                {summary.open_invoices_count}
              </Typography>
              <Typography variant="body2">
                Payments Collected: {toCurrency(summary.payments_collected)}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1.1, color: "text.secondary" }}
              >
                No rollover policy is active. Any unused monthly credit expires
                automatically after month close.
              </Typography>
            </CardContent>
          </Card>
        </>
      ) : null}
    </SuperAdminLayout>
  );
};

export default SuperAdminCreditUsagePage;
