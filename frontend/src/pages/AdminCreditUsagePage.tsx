import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AdminLayout from '../components/Layout/AdminLayout';
import { adminOrgCreditService } from '../services/adminOrgCreditService';
import { OrgCreditAdminMonthSummary } from '../types/orgCreditBilling';

const toCurrency = (value: number): string => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const AdminCreditUsagePage: React.FC = () => {
  const theme = useTheme();
  const [summary, setSummary] = useState<OrgCreditAdminMonthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminOrgCreditService.getCurrentMonthSummary();
      setSummary(data);
    } catch (summaryError) {
      const maybe = summaryError as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = maybe?.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : maybe?.message || 'Failed to load credit summary';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const usagePercent = useMemo(() => {
    if (!summary || summary.total_credit <= 0) return 0;
    return Math.min(100, Math.max(0, (summary.used_credit / summary.total_credit) * 100));
  }, [summary]);

  return (
    <AdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.6 },
          mb: 2,
          borderRadius: '18px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(125deg, ${alpha('#d7f0e9', 0.95)} 0%, ${alpha(
            theme.palette.background.paper,
            0.88
          )} 58%, ${alpha('#b5d7f2', 0.95)} 100%)`,
          boxShadow: `0 20px 42px ${alpha(theme.palette.primary.dark, 0.2)}`,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.3 }}>
              Org Credit
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Monthly Credit & Usage
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.4, color: 'text.secondary' }}>
              Credits are strictly month-based. Unused credits expire at month end and do not roll over.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={fetchSummary} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      {summary ? (
        <>
          <Grid container spacing={1.4} sx={{ mb: 1.2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: '14px' }}>
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
              <Card variant="outlined" sx={{ borderRadius: '14px' }}>
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
              <Card variant="outlined" sx={{ borderRadius: '14px' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Remaining Credit
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: summary.remaining_credit > 0 ? 'success.main' : 'error.main' }}>
                    {toCurrency(summary.remaining_credit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: '14px' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Previous Month Lapsed
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.main' }}>
                    {toCurrency(summary.lapsed_previous_month)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ borderRadius: '14px' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.6 }}>
                {summary.organization_name} | {summary.billing_period}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Usage: {usagePercent.toFixed(2)}%
              </Typography>
              <Typography variant="body2">
                Invoices: {summary.invoices_count} | Paid: {summary.paid_invoices_count} | Open: {summary.open_invoices_count}
              </Typography>
              <Typography variant="body2">Payments Collected: {toCurrency(summary.payments_collected)}</Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1.1, color: 'text.secondary' }}>
                No rollover policy is active. Any unused monthly credit expires automatically after month close.
              </Typography>
            </CardContent>
          </Card>
        </>
      ) : null}
    </AdminLayout>
  );
};

export default AdminCreditUsagePage;
