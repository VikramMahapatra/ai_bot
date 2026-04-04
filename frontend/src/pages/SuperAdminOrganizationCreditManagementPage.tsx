import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
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
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import {
  OrganizationCreditAllocation,
  OrganizationCreditProfile,
  OrganizationCreditAllocationSummary,
  PriceMatrixItem,
  SuperAdminOrganization,
} from '../types';

type PaymentStatus = 'pending' | 'paid' | 'partial' | 'failed';

interface AllocationEditorLine {
  id: string;
  priceMatrixItemId: number | '';
  quantity: string;
  creditsPerUnit: string;
  allocatedCredits: string;
}

const createEditorLine = (): AllocationEditorLine => ({
  id: `${Date.now()}-${Math.random()}`,
  priceMatrixItemId: '',
  quantity: '1',
  creditsPerUnit: '',
  allocatedCredits: '',
});

const toNumberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const toIsoDateTimeOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? `${trimmed}T00:00:00Z` : null;
};

const SuperAdminOrganizationCreditManagementPage: React.FC = () => {
  const theme = useTheme();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [matrixRows, setMatrixRows] = useState<PriceMatrixItem[]>([]);
  const [summaries, setSummaries] = useState<OrganizationCreditAllocationSummary[]>([]);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number>(0);
  const [editorLines, setEditorLines] = useState<AllocationEditorLine[]>([createEditorLine()]);
  const [orgBufferPercent, setOrgBufferPercent] = useState('15');
  const [orgDiscountPercent, setOrgDiscountPercent] = useState('0');
  const [orgPaymentStatus, setOrgPaymentStatus] = useState<PaymentStatus>('pending');
  const [orgStartDate, setOrgStartDate] = useState(todayIso);
  const [orgEndDate, setOrgEndDate] = useState('');
  const [orgNotes, setOrgNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOrg, setDetailsOrg] = useState<OrganizationCreditAllocationSummary | null>(null);
  const [detailsRows, setDetailsRows] = useState<OrganizationCreditAllocation[]>([]);

  const [editingAllocation, setEditingAllocation] = useState<OrganizationCreditAllocation | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editCreditsPerUnit, setEditCreditsPerUnit] = useState('');
  const [editAllocatedCredits, setEditAllocatedCredits] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingAllocationId, setDeletingAllocationId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [draftRemoveLineId, setDraftRemoveLineId] = useState<string | null>(null);
  const [deleteAllocationDialogRow, setDeleteAllocationDialogRow] = useState<OrganizationCreditAllocation | null>(null);

  const matrixById = useMemo(() => {
    const map = new Map<number, PriceMatrixItem>();
    matrixRows.forEach((row) => map.set(row.id, row));
    return map;
  }, [matrixRows]);

  const filteredSummaries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return summaries;
    return summaries.filter(
      (row) =>
        row.organization_name.toLowerCase().includes(term) ||
        row.payment_status.toLowerCase().includes(term)
    );
  }, [summaries, searchTerm]);

  const selectedOrganizationName = useMemo(() => {
    const org = organizations.find((item) => item.id === selectedOrganizationId);
    return org?.name || `Organization #${selectedOrganizationId}`;
  }, [organizations, selectedOrganizationId]);

  const subtotalCredits = useMemo(() => {
    return editorLines.reduce((sum, line) => {
      const value = Number(line.allocatedCredits || '0');
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [editorLines]);

  const bufferPercentNumber = useMemo(() => {
    const value = Number(orgBufferPercent || '0');
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [orgBufferPercent]);

  const discountPercentNumber = useMemo(() => {
    const value = Number(orgDiscountPercent || '0');
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [orgDiscountPercent]);

  const calculatedTotals = useMemo(() => {
    const bufferCredits = (subtotalCredits * bufferPercentNumber) / 100;
    const afterBuffer = subtotalCredits + bufferCredits;
    const discountCredits = (afterBuffer * discountPercentNumber) / 100;
    const finalTotal = Math.max(0, afterBuffer - discountCredits);
    return {
      subtotal: Number(subtotalCredits.toFixed(2)),
      bufferCredits: Number(bufferCredits.toFixed(2)),
      discountCredits: Number(discountCredits.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
    };
  }, [subtotalCredits, bufferPercentNumber, discountPercentNumber]);

  const computedExpiryDays = useMemo(() => {
    if (!orgStartDate || !orgEndDate) return null;
    const start = new Date(`${orgStartDate}T00:00:00`);
    const end = new Date(`${orgEndDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end < start) return 0;
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }, [orgStartDate, orgEndDate]);

  const selectedMatrixRowsCount = useMemo(
    () => editorLines.filter((line) => line.priceMatrixItemId !== '').length,
    [editorLines]
  );

  const resetMessages = () => {
    setActionError('');
    setActionSuccess('');
  };

  const resetEditor = () => {
    setEditorLines([createEditorLine()]);
    setOrgBufferPercent('15');
    setOrgDiscountPercent('0');
    setOrgStartDate(todayIso);
    setOrgEndDate('');
    setOrgPaymentStatus('pending');
    setOrgNotes('');
    resetMessages();
  };

  const applyProfileToEditor = (profile: OrganizationCreditProfile) => {
    setOrgBufferPercent(String(profile.buffer_percent ?? 0));
    setOrgDiscountPercent(String(profile.discount_percent ?? 0));
    setOrgPaymentStatus((profile.payment_status as PaymentStatus) || 'pending');
    setOrgStartDate(profile.start_date ? String(profile.start_date).slice(0, 10) : todayIso);
    setOrgEndDate(profile.end_date ? String(profile.end_date).slice(0, 10) : '');
    setOrgNotes(profile.notes || '');
  };

  const loadProfileForOrganization = async (organizationId: number) => {
    if (!organizationId) return;
    const profile = await superadminService.getOrganizationCreditProfile(organizationId);
    applyProfileToEditor(profile);
  };

  const loadAllocationLinesForOrganization = async (organizationId: number) => {
    if (!organizationId) return;
    const rows = await superadminService.listOrganizationCreditAllocations({
      organization_id: organizationId,
      active_only: true,
    });
    if (!rows.length) {
      setEditorLines([createEditorLine()]);
      return;
    }
    setEditorLines(
      rows.map((row) => ({
        id: `${row.id}-${Date.now()}-${Math.random()}`,
        priceMatrixItemId: row.price_matrix_item_id,
        quantity: row.quantity === null || row.quantity === undefined ? '1' : String(row.quantity),
        creditsPerUnit: row.credits_per_unit === null || row.credits_per_unit === undefined ? '' : String(row.credits_per_unit),
        allocatedCredits: row.allocated_credits === null || row.allocated_credits === undefined ? '0' : String(row.allocated_credits),
      }))
    );
  };

  const loadOrganizationIntoEditor = async (organizationId: number, showMessage = true) => {
    if (!organizationId) return;
    try {
      await Promise.all([
        loadProfileForOrganization(organizationId),
        loadAllocationLinesForOrganization(organizationId),
      ]);
      if (showMessage) {
        setActionSuccess('Loaded existing organization subscription for edit.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to load organization data for edit');
    }
  };

  const loadDetailsRows = async (organizationId: number) => {
    const rows = await superadminService.listOrganizationCreditAllocations({
      organization_id: organizationId,
      active_only: true,
    });
    setDetailsRows(rows);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orgs, matrix, summaryRows] = await Promise.all([
        superadminService.listOrganizations(),
        superadminService.listPriceMatrix(true),
        superadminService.summarizeOrganizationCreditAllocations(),
      ]);
      setOrganizations(orgs);
      setMatrixRows(matrix);
      setSummaries(summaryRows);
      if (orgs.length > 0 && selectedOrganizationId === 0) {
        setSelectedOrganizationId(orgs[0].id);
      }
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to load organization credit data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    loadOrganizationIntoEditor(selectedOrganizationId, false).catch(() => {});
  }, [selectedOrganizationId]);

  const refreshSummaries = async () => {
    const rows = await superadminService.summarizeOrganizationCreditAllocations();
    setSummaries(rows);
    if (detailsOrg) {
      const updated = rows.find((row) => row.organization_id === detailsOrg.organization_id) || null;
      setDetailsOrg(updated);
    }
    return rows;
  };

  const handleAddEditorLine = () => {
    setEditorLines((previous) => [...previous, createEditorLine()]);
  };

  const removeEditorLine = (lineId: string) => {
    setEditorLines((previous) => {
      if (previous.length === 1) return previous;
      return previous.filter((line) => line.id !== lineId);
    });
  };

  const requestRemoveEditorLine = (lineId: string) => {
    if (editorLines.length === 1) return;
    setDraftRemoveLineId(lineId);
  };

  const confirmRemoveEditorLine = () => {
    if (!draftRemoveLineId) return;
    removeEditorLine(draftRemoveLineId);
    setDraftRemoveLineId(null);
    setActionSuccess('Usage row removed.');
  };

  const handleEditorLineChange = (lineId: string, patch: Partial<AllocationEditorLine>) => {
    setEditorLines((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) return line;
        const nextLine = { ...line, ...patch };
        const quantity = Number(nextLine.quantity || '0');
        const creditsPerUnit = Number(nextLine.creditsPerUnit || '0');
        if (Number.isFinite(quantity) && Number.isFinite(creditsPerUnit)) {
          nextLine.allocatedCredits = String(Number((quantity * creditsPerUnit).toFixed(2)));
        }
        return nextLine;
      })
    );
  };

  const handleSelectMatrixRow = (lineId: string, matrixIdRaw: string) => {
    const matrixId = matrixIdRaw ? Number(matrixIdRaw) : '';
    const matrix = typeof matrixId === 'number' ? matrixById.get(matrixId) : undefined;
    setEditorLines((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) return line;
        if (
          typeof matrixId === 'number' &&
          previous.some((otherLine) => otherLine.id !== lineId && otherLine.priceMatrixItemId === matrixId)
        ) {
          setActionError('Price matrix row already exists for this organization subscription.');
          return line;
        }
        const quantity = Number(line.quantity || '0');
        const defaultCreditsPerUnit =
          matrix?.credits_per_unit !== null && matrix?.credits_per_unit !== undefined
            ? String(matrix.credits_per_unit)
            : '';
        const allocated = defaultCreditsPerUnit && Number.isFinite(quantity)
          ? Number(defaultCreditsPerUnit) * quantity
          : Number(line.allocatedCredits || '0');
        return {
          ...line,
          priceMatrixItemId: matrixId,
          creditsPerUnit: defaultCreditsPerUnit,
          allocatedCredits: allocated ? String(Number(allocated.toFixed(2))) : line.allocatedCredits,
        };
      })
    );
  };

  const persistOrganizationConfiguration = async () => {
    resetMessages();
    if (!selectedOrganizationId) {
      setActionError('Please select an organization.');
      return;
    }

    const lines = editorLines
      .filter((line) => line.priceMatrixItemId !== '')
      .map((line) => ({
        price_matrix_item_id: Number(line.priceMatrixItemId),
        quantity: toNumberOrUndefined(line.quantity),
        credits_per_unit: toNumberOrUndefined(line.creditsPerUnit),
        allocated_credits: toNumberOrUndefined(line.allocatedCredits),
      }));

    const profilePayload = {
      total_price: calculatedTotals.finalTotal,
      buffer_percent: bufferPercentNumber,
      discount_percent: discountPercentNumber,
      payment_status: orgPaymentStatus,
      start_date: toIsoDateTimeOrNull(orgStartDate),
      end_date: toIsoDateTimeOrNull(orgEndDate),
      expiry_days: computedExpiryDays,
      notes: orgNotes.trim() || null,
    };

    try {
      setIsSaving(true);
      await superadminService.createOrganizationCreditAllocations({
        organization_id: selectedOrganizationId,
        profile: profilePayload,
        lines,
      });
      setActionSuccess('Organization credit configuration saved/modified successfully.');
      await refreshSummaries();
      await loadProfileForOrganization(selectedOrganizationId);
      if (detailsOpen && detailsOrg) {
        await loadDetailsRows(detailsOrg.organization_id);
      }
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to save organization configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const requestSaveOrganizationConfiguration = () => {
    resetMessages();
    if (!selectedOrganizationId) {
      setActionError('Please select an organization.');
      return;
    }
    setSaveConfirmOpen(true);
  };

  const confirmSaveOrganizationConfiguration = async () => {
    setSaveConfirmOpen(false);
    await persistOrganizationConfiguration();
  };

  const cancelSaveOrganizationConfiguration = () => {
    setSaveConfirmOpen(false);
  };

  const openDetails = async (summary: OrganizationCreditAllocationSummary) => {
    setDetailsOrg(summary);
    setDetailsOpen(true);
    try {
      await loadDetailsRows(summary.organization_id);
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to load organization matrix rows');
    }
  };

  const prepareAddForOrganization = async (organizationId: number) => {
    setSelectedOrganizationId(organizationId);
    await loadOrganizationIntoEditor(organizationId, true);
    setActionSuccess('Organization loaded. You can add new matrix rows and save.');
  };

  const prepareEditFromGrid = async (organizationId: number) => {
    setSelectedOrganizationId(organizationId);
    await loadOrganizationIntoEditor(organizationId, true);
    setActionSuccess('Existing subscription data loaded for edit.');
  };

  const openEditDialog = (row: OrganizationCreditAllocation) => {
    setEditingAllocation(row);
    setEditQuantity(row.quantity === null || row.quantity === undefined ? '' : String(row.quantity));
    setEditCreditsPerUnit(row.credits_per_unit === null || row.credits_per_unit === undefined ? '' : String(row.credits_per_unit));
    setEditAllocatedCredits(String(row.allocated_credits ?? ''));
  };

  const handleEditQuantityChange = (value: string) => {
    setEditQuantity(value);
    const quantity = Number(value || '0');
    const cpu = Number(editCreditsPerUnit || '0');
    if (Number.isFinite(quantity) && Number.isFinite(cpu)) {
      setEditAllocatedCredits(String(Number((quantity * cpu).toFixed(2))));
    }
  };

  const handleEditCreditsPerUnitChange = (value: string) => {
    setEditCreditsPerUnit(value);
    const quantity = Number(editQuantity || '0');
    const cpu = Number(value || '0');
    if (Number.isFinite(quantity) && Number.isFinite(cpu)) {
      setEditAllocatedCredits(String(Number((quantity * cpu).toFixed(2))));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAllocation) return;
    resetMessages();
    try {
      setIsSaving(true);
      await superadminService.updateOrganizationCreditAllocation(editingAllocation.id, {
        quantity: toNumberOrUndefined(editQuantity),
        credits_per_unit: toNumberOrUndefined(editCreditsPerUnit),
        allocated_credits: toNumberOrUndefined(editAllocatedCredits),
      });
      setActionSuccess('Allocation row updated successfully.');
      setEditingAllocation(null);
      await refreshSummaries();
      if (detailsOrg) {
        await loadDetailsRows(detailsOrg.organization_id);
      }
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to update allocation');
    } finally {
      setIsSaving(false);
    }
  };

  const requestDeleteAllocation = (row: OrganizationCreditAllocation) => {
    setDeleteAllocationDialogRow(row);
  };

  const confirmDeleteAllocation = async () => {
    const row = deleteAllocationDialogRow;
    if (!row) return;
    resetMessages();
    try {
      setDeletingAllocationId(row.id);
      await superadminService.deleteOrganizationCreditAllocation(row.id);
      setActionSuccess('Allocation row deleted successfully.');
      setDeleteAllocationDialogRow(null);
      await refreshSummaries();
      if (detailsOrg) {
        await loadDetailsRows(detailsOrg.organization_id);
      }
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || 'Failed to delete allocation');
    } finally {
      setDeletingAllocationId(null);
    }
  };

  const cancelDeleteAllocation = () => {
    setDeleteAllocationDialogRow(null);
  };

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, md: 3 },
          mb: 3,
          borderRadius: '22px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(132deg, ${alpha('#cde3ff', 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.84)} 66%, ${alpha('#9fc9f1', 0.92)} 100%)`,
          boxShadow: `0 20px 36px ${alpha(theme.palette.primary.dark, 0.22)}`,
        }}
      >
        <Typography variant="overline" sx={{ letterSpacing: 1.3, fontWeight: 700, color: alpha(theme.palette.primary.dark, 0.76) }}>
          Onboarding Planner
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
          Organization Credit Management
        </Typography>
        <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.9 }}>
          Configure organization subscriptions from price matrix rows, with dates, expiry, price, and payment tracking.
        </Typography>
      </Paper>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionSuccess('')}>
          {actionSuccess}
        </Alert>
      )}

      <Card
        sx={{
          mb: 3,
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.2),
          borderRadius: '18px',
          background: `linear-gradient(145deg, ${alpha('#edf5ff', 0.9)} 0%, rgba(255,255,255,1) 64%)`,
        }}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.6 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Estimator Editor (Organization Allocation)</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={resetEditor}>Reset</Button>
              <Button variant="outlined" onClick={handleAddEditorLine} startIcon={<AddIcon />}>
                Add Matrix Row
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Organization</InputLabel>
                <Select
                  label="Organization"
                  value={selectedOrganizationId || ''}
                  onChange={(e) => setSelectedOrganizationId(Number(e.target.value))}
                >
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Buffer (%)"
                type="number"
                value={orgBufferPercent}
                inputProps={{ min: 0, step: 0.1 }}
                onChange={(e) => setOrgBufferPercent(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Discount (%)"
                type="number"
                value={orgDiscountPercent}
                inputProps={{ min: 0, step: 0.1 }}
                onChange={(e) => setOrgDiscountPercent(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  label="Payment Status"
                  value={orgPaymentStatus}
                  onChange={(e) => setOrgPaymentStatus(e.target.value as PaymentStatus)}
                >
                  <MenuItem value="pending">pending</MenuItem>
                  <MenuItem value="paid">paid</MenuItem>
                  <MenuItem value="partial">partial</MenuItem>
                  <MenuItem value="failed">failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={orgStartDate}
                onChange={(e) => setOrgStartDate(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={orgEndDate}
                onChange={(e) => setOrgEndDate(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Expire (Days)"
                type="number"
                value={computedExpiryDays ?? ''}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={orgNotes}
                onChange={(e) => setOrgNotes(e.target.value)}
              />
            </Grid>
          </Grid>

          {editorLines.map((line) => (
            <Grid
              container
              spacing={1.2}
              key={line.id}
              alignItems="center"
              sx={{
                mb: 1.2,
                p: 1.2,
                borderRadius: '12px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                background: `linear-gradient(145deg, ${alpha('#f4f9ff', 0.8)} 0%, ${alpha('#ffffff', 1)} 100%)`,
              }}
            >
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Price Matrix Row</InputLabel>
                  <Select
                    label="Price Matrix Row"
                    value={line.priceMatrixItemId === '' ? '' : String(line.priceMatrixItemId)}
                    onChange={(e) => handleSelectMatrixRow(line.id, String(e.target.value))}
                  >
                    <MenuItem value=""><em>Select row</em></MenuItem>
                    {matrixRows.map((row) => (
                      <MenuItem key={row.id} value={String(row.id)}>
                        {row.category} | {row.module} | {row.sub_module || '-'} ({row.credits_per_unit ?? '-'} credits/unit)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Quantity" type="number" value={line.quantity} onChange={(e) => handleEditorLineChange(line.id, { quantity: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Credits/Unit" type="number" value={line.creditsPerUnit} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField fullWidth label="Allocated" type="number" value={line.allocatedCredits} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                <IconButton
                  color="error"
                  onClick={() => requestRemoveEditorLine(line.id)}
                  disabled={editorLines.length === 1}
                  title="Remove row"
                  sx={{
                    border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                    backgroundColor: alpha(theme.palette.error.main, 0.08),
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ sm: 'flex-end' }}>
            <Stack direction="row" spacing={1.2}>
              <Button variant="contained" onClick={requestSaveOrganizationConfiguration} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </Stack>
            <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Typography variant="caption" color="text.secondary">Subtotal: {calculatedTotals.subtotal}</Typography>
              <Typography variant="caption" color="text.secondary">Buffer: {calculatedTotals.bufferCredits}</Typography>
              <Typography variant="caption" color="text.secondary">Discount: {calculatedTotals.discountCredits}</Typography>
              <TextField
                size="small"
                label="Total Price"
                value={calculatedTotals.finalTotal}
                InputProps={{ readOnly: true }}
                sx={{ minWidth: 180, mt: 0.6 }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card
        sx={{
          border: '1px solid',
          borderColor: alpha(theme.palette.success.main, 0.2),
          borderRadius: '18px',
          background: `linear-gradient(145deg, ${alpha('#f1fbf4', 0.92)} 0%, rgba(255,255,255,1) 70%)`,
        }}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.6 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Organization Subscription Grid</Typography>
            <TextField size="small" label="Search org/payment" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Matrix Rows</TableCell>
                  <TableCell>Total Credits</TableCell>
                  <TableCell>Total Price</TableCell>
                  <TableCell>Buffer %</TableCell>
                  <TableCell>Discount %</TableCell>
                  <TableCell>Payment Status</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Expire (Days)</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSummaries.map((row) => (
                  <TableRow key={row.organization_id} hover onClick={() => openDetails(row)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{row.organization_name}</TableCell>
                    <TableCell>{row.row_count}</TableCell>
                    <TableCell>{row.total_allocated_credits}</TableCell>
                    <TableCell>{row.total_price}</TableCell>
                    <TableCell>{row.buffer_percent ?? 0}</TableCell>
                    <TableCell>{row.discount_percent ?? 0}</TableCell>
                    <TableCell>{row.payment_status}</TableCell>
                    <TableCell>{row.start_date ? new Date(row.start_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{row.end_date ? new Date(row.end_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{row.expiry_days ?? '-'}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" color="primary" title="View Subscribed Rows" onClick={() => openDetails(row)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="warning" title="Edit Subscription" onClick={() => prepareEditFromGrid(row.organization_id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="success" title="Add Matrix Row" onClick={() => prepareAddForOrganization(row.organization_id)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredSummaries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <Typography variant="body2" sx={{ py: 1 }}>
                        No organization subscriptions found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {detailsOrg?.organization_name || 'Organization'} - Subscribed Matrix Rows
        </DialogTitle>
        <DialogContent>
          {detailsOrg && (
            <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Total Price" value={detailsOrg.total_price} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Buffer %" value={detailsOrg.buffer_percent ?? 0} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Discount %" value={detailsOrg.discount_percent ?? 0} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Payment" value={detailsOrg.payment_status} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Start Date" value={detailsOrg.start_date ? new Date(detailsOrg.start_date).toLocaleDateString() : '-'} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="End Date" value={detailsOrg.end_date ? new Date(detailsOrg.end_date).toLocaleDateString() : '-'} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField fullWidth label="Expiry" value={detailsOrg.expiry_days ?? '-'} InputProps={{ readOnly: true }} size="small" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Notes" value={detailsOrg.notes || '-'} InputProps={{ readOnly: true }} size="small" />
              </Grid>
            </Grid>
          )}
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
            {detailsOrg ? (
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => prepareAddForOrganization(detailsOrg.organization_id)}>
                Add New Matrix Row
              </Button>
            ) : null}
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell>Sub-Module</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Credits/Unit</TableCell>
                  <TableCell>Allocated Credits</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailsRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.module}</TableCell>
                    <TableCell>{row.sub_module || '-'}</TableCell>
                    <TableCell>{row.quantity ?? '-'}</TableCell>
                    <TableCell>{row.credits_per_unit ?? '-'}</TableCell>
                    <TableCell>{row.allocated_credits}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" title="Edit" onClick={() => openEditDialog(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        title="Delete"
                        onClick={() => requestDeleteAllocation(row)}
                        disabled={deletingAllocationId === row.id}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && detailsRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" sx={{ py: 1 }}>
                        No matrix rows subscribed for this organization.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveConfirmOpen} onClose={cancelSaveOrganizationConfiguration} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Save</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 0.8 }}>
            <Typography variant="body2"><strong>Organization:</strong> {selectedOrganizationName}</Typography>
            <Typography variant="body2"><strong>Matrix Rows To Save:</strong> {selectedMatrixRowsCount}</Typography>
            <Typography variant="body2"><strong>Subtotal:</strong> {calculatedTotals.subtotal}</Typography>
            <Typography variant="body2"><strong>Buffer ({bufferPercentNumber}%):</strong> {calculatedTotals.bufferCredits}</Typography>
            <Typography variant="body2"><strong>Discount ({discountPercentNumber}%):</strong> {calculatedTotals.discountCredits}</Typography>
            <Typography variant="body2"><strong>Final Total Price:</strong> {calculatedTotals.finalTotal}</Typography>
            <Typography variant="body2"><strong>Payment Status:</strong> {orgPaymentStatus}</Typography>
            <Typography variant="body2"><strong>Start Date:</strong> {orgStartDate || '-'}</Typography>
            <Typography variant="body2"><strong>End Date:</strong> {orgEndDate || '-'}</Typography>
            <Typography variant="body2"><strong>Expiry Days:</strong> {computedExpiryDays ?? '-'}</Typography>
            <Typography variant="caption" color="text.secondary">
              This will update organization terms and add any selected matrix subscription rows.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelSaveOrganizationConfiguration}>Cancel</Button>
          <Button variant="contained" onClick={confirmSaveOrganizationConfiguration} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Confirm & Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(draftRemoveLineId)} onClose={() => setDraftRemoveLineId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove This Row?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will remove the selected matrix row from the editor. This action is only for the draft and can be re-added.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraftRemoveLineId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmRemoveEditorLine}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteAllocationDialogRow)} onClose={cancelDeleteAllocation} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Subscription Row?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {deleteAllocationDialogRow
              ? `You are deleting "${deleteAllocationDialogRow.category} | ${deleteAllocationDialogRow.module} | ${deleteAllocationDialogRow.sub_module || '-'}" for ${deleteAllocationDialogRow.organization_name}.`
              : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            This will deactivate the row from saved subscriptions.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDeleteAllocation}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteAllocation} disabled={Boolean(deleteAllocationDialogRow && deletingAllocationId === deleteAllocationDialogRow.id)}>
            {deleteAllocationDialogRow && deletingAllocationId === deleteAllocationDialogRow.id ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingAllocation)} onClose={() => setEditingAllocation(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Allocation Row</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.8 }}>
            <TextField label="Quantity" type="number" value={editQuantity} onChange={(e) => handleEditQuantityChange(e.target.value)} />
            <TextField label="Credits Per Unit" type="number" value={editCreditsPerUnit} onChange={(e) => handleEditCreditsPerUnitChange(e.target.value)} />
            <TextField label="Allocated Credits" type="number" value={editAllocatedCredits} InputProps={{ readOnly: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingAllocation(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default SuperAdminOrganizationCreditManagementPage;
