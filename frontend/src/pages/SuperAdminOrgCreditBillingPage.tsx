import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BoltIcon from '@mui/icons-material/Bolt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import { orgCreditBillingService } from '../services/orgCreditBillingService';
import { CreditEstimatorResultListItem, SuperAdminOrganization } from '../types';
import {
  OrgCredit,
  OrgCreditAutomationRunResponse,
  OrgCreditBalance,
  OrgCreditInvoice,
  OrgCreditPayment,
  OrgCreditPaymentStatus,
  PartialPaymentStrategy,
} from '../types/orgCreditBilling';

type PageTab = 'credits' | 'invoices' | 'payments' | 'availability';
type ViewMode = 'table' | 'cards';
type OrgFilter = 'all' | number;

const toCurrency = (value: number): string => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const dateLabel = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

const parseError = (error: unknown): string => {
  const maybe = error as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return maybe?.message || 'Something went wrong';
};

const currentMonth = (): string => new Date().toISOString().slice(0, 7);
const currentDate = (): string => new Date().toISOString().slice(0, 10);

const SuperAdminOrgCreditBillingPage: React.FC = () => {
  const theme = useTheme();
  const [tab, setTab] = useState<PageTab>('credits');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [orgFilter, setOrgFilter] = useState<OrgFilter>('all');
  const [searchText, setSearchText] = useState('');

  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [estimators, setEstimators] = useState<CreditEstimatorResultListItem[]>([]);
  const [orgCredits, setOrgCredits] = useState<OrgCredit[]>([]);
  const [invoices, setInvoices] = useState<OrgCreditInvoice[]>([]);
  const [payments, setPayments] = useState<OrgCreditPayment[]>([]);
  const [availability, setAvailability] = useState<OrgCreditBalance | null>(null);
  const [availabilityOrgId, setAvailabilityOrgId] = useState<number | ''>('');
  const [availabilityPeriod, setAvailabilityPeriod] = useState<string>(currentMonth());

  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [automationResult, setAutomationResult] = useState<OrgCreditAutomationRunResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createOrgId, setCreateOrgId] = useState<number | ''>('');
  const [createEstimatorId, setCreateEstimatorId] = useState<number | ''>('');
  const [createPaymentStatus, setCreatePaymentStatus] = useState<OrgCreditPaymentStatus>('unpaid');
  const [createStartDate, setCreateStartDate] = useState<string>('');
  const [createNotes, setCreateNotes] = useState('');

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupTarget, setTopupTarget] = useState<OrgCredit | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupPaymentStatus, setTopupPaymentStatus] = useState<OrgCreditPaymentStatus>('unpaid');
  const [topupNotes, setTopupNotes] = useState('');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<OrgCreditInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCredit, setPaymentCredit] = useState('');
  const [paymentDate, setPaymentDate] = useState(currentDate());
  const [paymentDetails, setPaymentDetails] = useState('');
  const [paymentStrategy, setPaymentStrategy] = useState<PartialPaymentStrategy>('keep_open');

  const [usageOpen, setUsageOpen] = useState(false);
  const [usageOrgId, setUsageOrgId] = useState<number | ''>('');
  const [usageCredit, setUsageCredit] = useState('');
  const [usagePeriod, setUsagePeriod] = useState(currentMonth());

  const orgNameById = useMemo(() => {
    const map = new Map<number, string>();
    organizations.forEach((org) => map.set(org.id, org.name));
    return map;
  }, [organizations]);

  const estimatorLabelById = useMemo(() => {
    const map = new Map<number, string>();
    estimators.forEach((row) => map.set(row.id, `${row.company_name} (${row.estimate.final_recommended_credits_ceiling})`));
    return map;
  }, [estimators]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = orgFilter === 'all' ? undefined : { organization_id: orgFilter };
      const [orgRows, estimatorRows, creditRows, invoiceRows, paymentRows] = await Promise.all([
        superadminService.listOrganizations(),
        superadminService.listCreditEstimatorResults({ status_filter: 'active' }),
        orgCreditBillingService.listOrgCredits(params),
        orgCreditBillingService.listInvoices(params),
        orgCreditBillingService.listPayments(params),
      ]);
      setOrganizations(orgRows);
      setEstimators(estimatorRows);
      setOrgCredits(creditRows);
      setInvoices(invoiceRows);
      setPayments(paymentRows);
    } catch (loadError) {
      setError(parseError(loadError));
    } finally {
      setLoading(false);
    }
  }, [orgFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCredits = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return orgCredits;
    return orgCredits.filter((row) => {
      const orgName = orgNameById.get(row.organization_id) || '';
      const estimatorLabel = estimatorLabelById.get(row.estimator_id) || '';
      return `${orgName} ${estimatorLabel} ${row.billing_month} ${row.payment_status}`.toLowerCase().includes(term);
    });
  }, [orgCredits, searchText, orgNameById, estimatorLabelById]);

  const filteredInvoices = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((row) => {
      const orgName = orgNameById.get(row.organization_id) || '';
      return `${orgName} ${row.billing_month} ${row.id}`.toLowerCase().includes(term);
    });
  }, [invoices, searchText, orgNameById]);

  const filteredPayments = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return payments;
    return payments.filter((row) => {
      const orgName = orgNameById.get(row.organization_id) || '';
      return `${orgName} ${row.full_partial} ${row.payment_date}`.toLowerCase().includes(term);
    });
  }, [payments, searchText, orgNameById]);

  const metrics = useMemo(() => {
    const totalCredit = orgCredits.reduce((sum, row) => sum + (row.total_credit || 0), 0);
    const openInvoices = invoices.filter((row) => !row.payment_done_flag).length;
    const paidInvoices = invoices.length - openInvoices;
    const collected = payments.reduce((sum, row) => sum + (row.actual_payment || 0), 0);
    return { totalCredit, openInvoices, paidInvoices, collected };
  }, [orgCredits, invoices, payments]);

  const resetCreate = () => {
    setCreateOrgId('');
    setCreateEstimatorId('');
    setCreatePaymentStatus('unpaid');
    setCreateStartDate('');
    setCreateNotes('');
  };

  const handleCreateOrgCredit = async () => {
    if (!createOrgId || !createEstimatorId) {
      setError('Please choose organization and estimator');
      return;
    }
    setBusyAction(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        organization_id: createOrgId,
        estimator_id: createEstimatorId,
        billing_cycle: 'monthly' as const,
        payment_status: createPaymentStatus,
        billing_start_date: createStartDate || undefined,
        notes: createNotes || undefined,
      };
      const result = await orgCreditBillingService.createOrgCredit(payload);
      setCreateOpen(false);
      resetCreate();
      setSuccess(`Org credit #${result.org_credit.id} created with invoice #${result.invoice.id}`);
      await loadData();
    } catch (createError) {
      setError(parseError(createError));
    } finally {
      setBusyAction(false);
    }
  };

  const openTopupDialog = (credit: OrgCredit) => {
    setTopupTarget(credit);
    setTopupAmount('');
    setTopupPaymentStatus('unpaid');
    setTopupNotes('');
    setTopupOpen(true);
  };

  const handleAddTopup = async () => {
    if (!topupTarget) return;
    const parsed = Number(topupAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Top-up amount must be greater than zero');
      return;
    }
    setBusyAction(true);
    setError('');
    setSuccess('');
    try {
      const result = await orgCreditBillingService.addTopup(topupTarget.id, {
        topup_credit: parsed,
        payment_status: topupPaymentStatus,
        notes: topupNotes || undefined,
      });
      setTopupOpen(false);
      setSuccess(`Top-up created: credit #${result.org_credit.id}, invoice #${result.invoice.id}`);
      await loadData();
    } catch (topupError) {
      setError(parseError(topupError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleGenerateInvoice = async (orgCreditId: number) => {
    setBusyAction(true);
    setError('');
    setSuccess('');
    try {
      const result = await orgCreditBillingService.generateInvoice({ org_credit_id: orgCreditId });
      setSuccess(`Invoice #${result.id} generated`);
      await loadData();
    } catch (invoiceError) {
      setError(parseError(invoiceError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleInvoiceStatusToggle = async (invoice: OrgCreditInvoice) => {
    setBusyAction(true);
    setError('');
    setSuccess('');
    try {
      const updated = await orgCreditBillingService.markInvoicePaymentStatus(invoice.id, {
        payment_done_flag: !invoice.payment_done_flag,
      });
      setSuccess(`Invoice #${updated.id} marked as ${updated.payment_done_flag ? 'paid' : 'unpaid'}`);
      await loadData();
    } catch (statusError) {
      setError(parseError(statusError));
    } finally {
      setBusyAction(false);
    }
  };

  const openPaymentDialog = (invoice: OrgCreditInvoice) => {
    setPaymentTarget(invoice);
    setPaymentAmount('');
    setPaymentCredit('');
    setPaymentDate(currentDate());
    setPaymentDetails('');
    setPaymentStrategy('keep_open');
    setPaymentOpen(true);
  };

  const handleAddPayment = async () => {
    if (!paymentTarget) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }
    const credit = paymentCredit.trim() ? Number(paymentCredit) : undefined;
    if (credit !== undefined && (!Number.isFinite(credit) || credit <= 0)) {
      setError('Actual credit must be greater than zero when provided');
      return;
    }

    setBusyAction(true);
    setError('');
    setSuccess('');
    try {
      const result = await orgCreditBillingService.addPayment({
        invoice_id: paymentTarget.id,
        actual_payment: amount,
        actual_credit: credit,
        payment_date: paymentDate || undefined,
        payment_details: paymentDetails || undefined,
        partial_strategy: paymentStrategy,
      });
      setPaymentOpen(false);
      const generatedMsg = result.generated_invoice ? ` and generated invoice #${result.generated_invoice.id}` : '';
      setSuccess(`Payment #${result.payment.id} recorded${generatedMsg}`);
      await loadData();
    } catch (paymentError) {
      setError(parseError(paymentError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleRunAutomation = async () => {
    setBusyAction(true);
    setError('');
    setSuccess('');
    try {
      const result = await orgCreditBillingService.runAutomation();
      setAutomationResult(result);
      setSuccess(
        `Automation complete: evaluated ${result.evaluated_entries}, generated ${result.generated_entries} entries, ${result.generated_invoices} invoices`
      );
      await loadData();
    } catch (automationError) {
      setError(parseError(automationError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleFetchAvailability = async () => {
    if (!availabilityOrgId) {
      setError('Select organization to view availability');
      return;
    }
    setBusyAction(true);
    setError('');
    try {
      const data = await orgCreditBillingService.getCreditAvailability({
        organization_id: availabilityOrgId,
        billing_period: availabilityPeriod || undefined,
      });
      setAvailability(data);
      setSuccess(`Loaded credit availability for ${data.billing_period}`);
    } catch (availabilityError) {
      setError(parseError(availabilityError));
    } finally {
      setBusyAction(false);
    }
  };

  const openUsageDialog = () => {
    setUsageOrgId(availabilityOrgId || '');
    setUsagePeriod(availabilityPeriod || currentMonth());
    setUsageCredit('');
    setUsageOpen(true);
  };

  const handleTrackUsage = async () => {
    if (!usageOrgId) {
      setError('Select organization');
      return;
    }
    const used = Number(usageCredit);
    if (!Number.isFinite(used) || used <= 0) {
      setError('Used credit must be greater than zero');
      return;
    }
    setBusyAction(true);
    setError('');
    try {
      const updated = await orgCreditBillingService.trackUsage({
        organization_id: usageOrgId,
        used_credit: used,
        billing_period: usagePeriod || undefined,
      });
      setUsageOpen(false);
      setAvailability(updated);
      setSuccess(`Usage tracked. Remaining credit: ${toCurrency(updated.remaining_credit)}`);
      await loadData();
    } catch (usageError) {
      setError(parseError(usageError));
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, md: 3 },
          borderRadius: '22px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(126deg, ${alpha('#d7f0e9', 0.95)} 0%, ${alpha(
            theme.palette.background.paper,
            0.88
          )} 57%, ${alpha('#b5d7f2', 0.95)} 100%)`,
          boxShadow: `0 20px 42px ${alpha(theme.palette.primary.dark, 0.24)}`,
          mb: 3,
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.4, color: alpha(theme.palette.text.primary, 0.72) }}>
              New Billing System
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.12 }}>
              Org Credit, Invoicing & Payments
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.8, color: alpha(theme.palette.text.primary, 0.76) }}>
              Estimator-driven credits with monthly cycle automation, top-ups, invoices, partial payments, and live credit availability.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setCreateOpen(true)}
              disabled={busyAction}
            >
              Create Org Credit
            </Button>
            <Button variant="outlined" startIcon={<AutorenewIcon />} onClick={loadData} disabled={loading || busyAction}>
              Refresh
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<BoltIcon />} onClick={handleRunAutomation} disabled={busyAction}>
              Run Automation
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      ) : null}
      {automationResult ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setAutomationResult(null)}>
          Evaluated: {automationResult.evaluated_entries}, Entries: {automationResult.generated_entries}, Invoices: {automationResult.generated_invoices}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 2.6 }}>
        {[
          { label: 'Total Credits', value: toCurrency(metrics.totalCredit), icon: <LocalAtmIcon color="primary" /> },
          { label: 'Open Invoices', value: String(metrics.openInvoices), icon: <ReceiptLongIcon color="warning" /> },
          { label: 'Paid Invoices', value: String(metrics.paidInvoices), icon: <ReceiptLongIcon color="success" /> },
          { label: 'Collections', value: toCurrency(metrics.collected), icon: <PaymentsIcon color="secondary" /> },
        ].map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                background: `linear-gradient(145deg, ${alpha('#f0fbf8', 0.92)} 0%, ${alpha('#ffffff', 1)} 84%)`,
              }}
            >
              <CardContent sx={{ py: 1.6 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.7), fontWeight: 600 }}>
                      {card.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.4 }}>
                      {card.value}
                    </Typography>
                  </Box>
                  {card.icon}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 1.6, borderRadius: '16px', mb: 2.2 }}>
        <Grid container spacing={1.3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Organization Filter</InputLabel>
              <Select
                value={orgFilter}
                label="Organization Filter"
                onChange={(event) => {
                  const value = event.target.value;
                  setOrgFilter(value === 'all' ? 'all' : Number(value));
                }}
              >
                <MenuItem value="all">All Organizations</MenuItem>
                {organizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <TextField
              size="small"
              fullWidth
              label="Search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search organization, month, status"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ToggleButtonGroup
              size="small"
              color="primary"
              value={viewMode}
              exclusive
              onChange={(_, value: ViewMode | null) => value && setViewMode(value)}
              fullWidth
            >
              <ToggleButton value="table">
                <TableRowsIcon sx={{ mr: 0.6 }} /> Table
              </ToggleButton>
              <ToggleButton value="cards">
                <ViewModuleIcon sx={{ mr: 0.6 }} /> Cards
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value: PageTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1.2, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
        >
          <Tab value="credits" label={`Org Credits (${filteredCredits.length})`} />
          <Tab value="invoices" label={`Invoices (${filteredInvoices.length})`} />
          <Tab value="payments" label={`Payments (${filteredPayments.length})`} />
          <Tab value="availability" label="Credit Availability" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 'credits' && viewMode === 'cards' ? (
            <Grid container spacing={1.4}>
              {filteredCredits.map((row) => (
                <Grid item xs={12} md={6} xl={4} key={row.id}>
                  <Card variant="outlined" sx={{ borderRadius: '14px' }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          #{row.id}
                        </Typography>
                        <Chip
                          size="small"
                          label={row.is_topup ? 'Top-up' : row.is_auto_generated ? 'Auto Cycle' : 'Base'}
                          color={row.is_topup ? 'secondary' : row.is_auto_generated ? 'warning' : 'primary'}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Organization:</strong> {orgNameById.get(row.organization_id) || `Org #${row.organization_id}`}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Estimator:</strong> {estimatorLabelById.get(row.estimator_id) || `Estimator #${row.estimator_id}`}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Billing:</strong> {row.billing_month} ({dateLabel(row.billing_start_date)} to {dateLabel(row.billing_end_date)})
                      </Typography>
                      <Typography variant="body2">
                        <strong>Total Credit:</strong> {toCurrency(row.total_credit)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Payment:</strong> {row.payment_status}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.4 }}>
                        <Button size="small" variant="outlined" onClick={() => openTopupDialog(row)} disabled={busyAction}>
                          Add Top-up
                        </Button>
                        <Button size="small" variant="text" onClick={() => handleGenerateInvoice(row.id)} disabled={busyAction}>
                          Generate Invoice
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : null}

          {tab === 'credits' && viewMode === 'table' ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Estimator</TableCell>
                    <TableCell>Total Credit</TableCell>
                    <TableCell>Billing Period</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCredits.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>#{row.id}</TableCell>
                      <TableCell>{orgNameById.get(row.organization_id) || `Org #${row.organization_id}`}</TableCell>
                      <TableCell>{estimatorLabelById.get(row.estimator_id) || `Estimator #${row.estimator_id}`}</TableCell>
                      <TableCell>{toCurrency(row.total_credit)}</TableCell>
                      <TableCell>{row.billing_month}</TableCell>
                      <TableCell>{row.is_topup ? 'Top-up' : row.is_auto_generated ? 'Auto' : 'Base'}</TableCell>
                      <TableCell>{row.payment_status}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openTopupDialog(row)} disabled={busyAction}>
                          Top-up
                        </Button>
                        <Button size="small" onClick={() => handleGenerateInvoice(row.id)} disabled={busyAction}>
                          Invoice
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredCredits.length ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" sx={{ py: 1 }}>
                          No org credit entries found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tab === 'invoices' ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice ID</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Org Credit</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Paid</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInvoices.map((row) => {
                    const outstanding = Math.max(0, (row.invoice_amount || 0) - (row.paid_amount || 0));
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>#{row.id}</TableCell>
                        <TableCell>{orgNameById.get(row.organization_id) || `Org #${row.organization_id}`}</TableCell>
                        <TableCell>#{row.org_credit_id}</TableCell>
                        <TableCell>{row.billing_month}</TableCell>
                        <TableCell>{toCurrency(row.invoice_amount)}</TableCell>
                        <TableCell>{toCurrency(row.paid_amount)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.payment_done_flag ? 'Paid' : `Open (${toCurrency(outstanding)})`} color={row.payment_done_flag ? 'success' : 'warning'} />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => handleInvoiceStatusToggle(row)} disabled={busyAction}>
                            {row.payment_done_flag ? 'Mark Unpaid' : 'Mark Paid'}
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => openPaymentDialog(row)} disabled={busyAction}>
                            Add Payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredInvoices.length ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" sx={{ py: 1 }}>
                          No invoices found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tab === 'payments' ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Payment ID</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Invoice ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Actual Payment</TableCell>
                    <TableCell>Actual Credit</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>#{row.id}</TableCell>
                      <TableCell>{orgNameById.get(row.organization_id) || `Org #${row.organization_id}`}</TableCell>
                      <TableCell>#{row.invoice_id}</TableCell>
                      <TableCell>{row.full_partial}</TableCell>
                      <TableCell>{toCurrency(row.actual_payment)}</TableCell>
                      <TableCell>{toCurrency(row.actual_credit)}</TableCell>
                      <TableCell>{dateLabel(row.payment_date)}</TableCell>
                      <TableCell>{row.payment_details || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredPayments.length ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" sx={{ py: 1 }}>
                          No payments found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tab === 'availability' ? (
            <Stack spacing={2}>
              <Grid container spacing={1.2}>
                <Grid item xs={12} md={5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Organization</InputLabel>
                    <Select
                      value={availabilityOrgId}
                      label="Organization"
                      onChange={(event) => setAvailabilityOrgId(Number(event.target.value))}
                    >
                      {organizations.map((org) => (
                        <MenuItem key={org.id} value={org.id}>
                          {org.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    fullWidth
                    type="month"
                    label="Billing Period"
                    InputLabelProps={{ shrink: true }}
                    value={availabilityPeriod}
                    onChange={(event) => setAvailabilityPeriod(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={handleFetchAvailability} disabled={busyAction}>
                      Get Availability
                    </Button>
                    <Button variant="outlined" onClick={openUsageDialog} disabled={!availability || busyAction}>
                      Track Usage
                    </Button>
                  </Stack>
                </Grid>
              </Grid>

              {availability ? (
                <Grid container spacing={1.4}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption">Total Credit</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          {toCurrency(availability.total_credit)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption">Used Credit</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          {toCurrency(availability.used_credit)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption">Remaining Credit</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: availability.remaining_credit < 0 ? 'error.main' : 'success.main' }}>
                          {toCurrency(availability.remaining_credit)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select organization and month, then click "Get Availability".
                </Typography>
              )}
            </Stack>
          ) : null}
        </Box>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Org Credit Entry</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.4} sx={{ mt: 0.1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Organization</InputLabel>
                <Select value={createOrgId} label="Organization" onChange={(event) => setCreateOrgId(Number(event.target.value))}>
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Estimator</InputLabel>
                <Select value={createEstimatorId} label="Estimator" onChange={(event) => setCreateEstimatorId(Number(event.target.value))}>
                  {estimators.map((est) => (
                    <MenuItem key={est.id} value={est.id}>
                      {est.company_name} - Recommended {est.estimate.final_recommended_credits_ceiling}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                fullWidth
                type="date"
                label="Billing Start Date"
                InputLabelProps={{ shrink: true }}
                value={createStartDate}
                onChange={(event) => setCreateStartDate(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select
                  value={createPaymentStatus}
                  label="Payment Status"
                  onChange={(event) => setCreatePaymentStatus(event.target.value as OrgCreditPaymentStatus)}
                >
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Notes"
                value={createNotes}
                onChange={(event) => setCreateNotes(event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateOrgCredit} disabled={busyAction}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={topupOpen} onClose={() => setTopupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Top-up Credit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.2 }}>
            Target: #{topupTarget?.id} ({orgNameById.get(topupTarget?.organization_id || 0) || '-'})
          </Typography>
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Top-up Credit"
            value={topupAmount}
            onChange={(event) => setTopupAmount(event.target.value)}
            sx={{ mb: 1.2 }}
          />
          <FormControl fullWidth size="small" sx={{ mb: 1.2 }}>
            <InputLabel>Payment Status</InputLabel>
            <Select
              value={topupPaymentStatus}
              label="Payment Status"
              onChange={(event) => setTopupPaymentStatus(event.target.value as OrgCreditPaymentStatus)}
            >
              <MenuItem value="unpaid">Unpaid</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            fullWidth
            label="Notes"
            value={topupNotes}
            onChange={(event) => setTopupNotes(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTopupOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTopup} disabled={busyAction}>
            Add Top-up
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentOpen} onClose={() => setPaymentOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Register Invoice Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.3 }}>
            Invoice #{paymentTarget?.id} | Amount {paymentTarget ? toCurrency(paymentTarget.invoice_amount) : '-'} | Outstanding{' '}
            {paymentTarget ? toCurrency(Math.max(0, paymentTarget.invoice_amount - paymentTarget.paid_amount)) : '-'}
          </Typography>
          <Grid container spacing={1.2}>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Actual Payment"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Actual Credit (optional)"
                value={paymentCredit}
                onChange={(event) => setPaymentCredit(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                fullWidth
                type="date"
                label="Payment Date"
                InputLabelProps={{ shrink: true }}
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Partial Strategy</InputLabel>
                <Select
                  value={paymentStrategy}
                  label="Partial Strategy"
                  onChange={(event) => setPaymentStrategy(event.target.value as PartialPaymentStrategy)}
                >
                  <MenuItem value="keep_open">Keep Invoice Open</MenuItem>
                  <MenuItem value="create_invoice">Create New Remaining Invoice</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Payment Details"
                value={paymentDetails}
                onChange={(event) => setPaymentDetails(event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPayment} disabled={busyAction}>
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={usageOpen} onClose={() => setUsageOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Track Credit Usage</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.2} sx={{ mt: 0.1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Organization</InputLabel>
                <Select value={usageOrgId} label="Organization" onChange={(event) => setUsageOrgId(Number(event.target.value))}>
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                type="month"
                label="Billing Period"
                InputLabelProps={{ shrink: true }}
                value={usagePeriod}
                onChange={(event) => setUsagePeriod(event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Used Credit"
                value={usageCredit}
                onChange={(event) => setUsageCredit(event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsageOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTrackUsage} disabled={busyAction}>
            Track
          </Button>
        </DialogActions>
      </Dialog>

      {loading ? (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading data...
        </Typography>
      ) : null}
    </SuperAdminLayout>
  );
};

export default SuperAdminOrgCreditBillingPage;
