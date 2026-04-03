import React, { useEffect, useMemo, useState } from 'react';
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
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Switch,
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
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import { PriceMatrixItem, PriceMatrixItemPayload } from '../types';

interface MatrixFormState {
  category: string;
  module: string;
  sub_module: string;
  billing_unit: string;
  credits_per_unit: string;
  credit_formula: string;
  definition: string;
  overage_handling: string;
  sort_order: string;
  is_active: boolean;
}

const DEFAULT_FORM: MatrixFormState = {
  category: '',
  module: '',
  sub_module: '',
  billing_unit: '',
  credits_per_unit: '',
  credit_formula: '',
  definition: '',
  overage_handling: '',
  sort_order: '0',
  is_active: true,
};

const toOptionalString = (value?: string | null): string => value ?? '';

const toOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const toPayload = (form: MatrixFormState): PriceMatrixItemPayload => ({
  category: form.category.trim(),
  module: form.module.trim(),
  sub_module: form.sub_module.trim() || null,
  billing_unit: form.billing_unit.trim() || null,
  credits_per_unit: toOptionalNumber(form.credits_per_unit),
  credit_formula: form.credit_formula.trim() || null,
  definition: form.definition.trim() || null,
  overage_handling: form.overage_handling.trim() || null,
  sort_order: Number(form.sort_order) || 0,
  is_active: form.is_active,
});

const itemToForm = (item: PriceMatrixItem): MatrixFormState => ({
  category: item.category,
  module: item.module,
  sub_module: toOptionalString(item.sub_module),
  billing_unit: toOptionalString(item.billing_unit),
  credits_per_unit: item.credits_per_unit === null || item.credits_per_unit === undefined ? '' : String(item.credits_per_unit),
  credit_formula: toOptionalString(item.credit_formula),
  definition: toOptionalString(item.definition),
  overage_handling: toOptionalString(item.overage_handling),
  sort_order: String(item.sort_order ?? 0),
  is_active: item.is_active,
});

const SuperAdminPriceMatrixPage: React.FC = () => {
  const theme = useTheme();
  const [items, setItems] = useState<PriceMatrixItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MatrixFormState>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<MatrixFormState>(DEFAULT_FORM);
  const [editingItem, setEditingItem] = useState<PriceMatrixItem | null>(null);

  const matrixStats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.is_active).length;
    const calculable = items.filter(
      (item) => item.is_active && item.credits_per_unit !== null && item.credits_per_unit !== undefined
    ).length;
    return { total, active, calculable };
  }, [items]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await superadminService.listPriceMatrix();
      setItems(data);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to load price matrix');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCreate = async () => {
    const payload = toPayload(createForm);
    if (!payload.category || !payload.module) {
      setErrorMessage('Category and Module are required.');
      return;
    }

    setIsSaving(true);
    resetMessages();
    try {
      await superadminService.createPriceMatrixItem(payload);
      setSuccessMessage('Price matrix row created successfully.');
      setCreateForm(DEFAULT_FORM);
      setCreateOpen(false);
      await loadItems();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to create price matrix row');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (item: PriceMatrixItem) => {
    setEditingItem(item);
    setEditForm(itemToForm(item));
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const payload = toPayload(editForm);
    if (!payload.category || !payload.module) {
      setErrorMessage('Category and Module are required.');
      return;
    }

    setIsSaving(true);
    resetMessages();
    try {
      await superadminService.updatePriceMatrixItem(editingItem.id, payload);
      setSuccessMessage('Price matrix row updated successfully.');
      setEditOpen(false);
      setEditingItem(null);
      await loadItems();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to update price matrix row');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: PriceMatrixItem) => {
    const confirmed = window.confirm(`Delete "${item.category} / ${item.module}" from price matrix?`);
    if (!confirmed) return;

    setIsSaving(true);
    resetMessages();
    try {
      await superadminService.deletePriceMatrixItem(item.id);
      setSuccessMessage('Price matrix row deleted successfully.');
      await loadItems();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to delete price matrix row');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMatrixForm = (
    formState: MatrixFormState,
    setFormState: React.Dispatch<React.SetStateAction<MatrixFormState>>
  ) => (
    <Grid container spacing={2} sx={{ mt: 0.5 }}>
      <Grid item xs={12} md={4}>
        <TextField label="Category" value={formState.category} onChange={(e) => setFormState((p) => ({ ...p, category: e.target.value }))} fullWidth required />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField label="Module" value={formState.module} onChange={(e) => setFormState((p) => ({ ...p, module: e.target.value }))} fullWidth required />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField label="Sub-Module" value={formState.sub_module} onChange={(e) => setFormState((p) => ({ ...p, sub_module: e.target.value }))} fullWidth />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField label="Billing Unit" value={formState.billing_unit} onChange={(e) => setFormState((p) => ({ ...p, billing_unit: e.target.value }))} fullWidth />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField label="Credits Per Unit" value={formState.credits_per_unit} onChange={(e) => setFormState((p) => ({ ...p, credits_per_unit: e.target.value }))} type="number" inputProps={{ step: '0.01', min: 0 }} fullWidth />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField label="Sort Order" value={formState.sort_order} onChange={(e) => setFormState((p) => ({ ...p, sort_order: e.target.value }))} type="number" inputProps={{ step: '1' }} fullWidth />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Credit Formula / Notes" value={formState.credit_formula} onChange={(e) => setFormState((p) => ({ ...p, credit_formula: e.target.value }))} fullWidth multiline minRows={2} />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Definition" value={formState.definition} onChange={(e) => setFormState((p) => ({ ...p, definition: e.target.value }))} fullWidth multiline minRows={2} />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Overage Handling" value={formState.overage_handling} onChange={(e) => setFormState((p) => ({ ...p, overage_handling: e.target.value }))} fullWidth />
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={<Switch checked={formState.is_active} onChange={(e) => setFormState((p) => ({ ...p, is_active: e.target.checked }))} />}
          label={formState.is_active ? 'Active row' : 'Inactive row'}
        />
      </Grid>
    </Grid>
  );

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, md: 3 },
          mb: 3,
          borderRadius: '22px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(132deg, ${alpha('#d5ebcc', 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.84)} 66%, ${alpha('#9bcfc0', 0.92)} 100%)`,
          boxShadow: `0 20px 36px ${alpha(theme.palette.success.dark, 0.22)}`,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 1.3, fontWeight: 700, color: alpha(theme.palette.success.dark, 0.76) }}>
              Costing Control
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              Price Matrix
            </Typography>
            <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.9 }}>
              Manage reusable pricing rows. Use the dedicated Credit Estimator page to calculate and share results.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Add Matrix Row
          </Button>
        </Stack>
      </Paper>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Rows', value: matrixStats.total },
          { label: 'Active Rows', value: matrixStats.active },
          { label: 'Calculable Rows', value: matrixStats.calculable },
        ].map((stat) => (
          <Grid item xs={12} sm={6} md={4} key={stat.label}>
            <Paper
              elevation={0}
              sx={{
                p: 1.8,
                borderRadius: '16px',
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                background: `linear-gradient(145deg, ${alpha('#effaf2', 0.92)} 0%, ${alpha('#ffffff', 1)} 90%)`,
              }}
            >
              <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.68), fontWeight: 600 }}>
                {stat.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.4 }}>
                {stat.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Card
        sx={{
          border: '1px solid',
          borderColor: alpha(theme.palette.success.main, 0.2),
          borderRadius: '18px',
          background: `linear-gradient(145deg, ${alpha('#f1fbf4', 0.9)} 0%, rgba(255,255,255,1) 64%)`,
        }}
      >
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Matrix Rows
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Add Row
            </Button>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell>Sub-Module</TableCell>
                  <TableCell>Billing Unit</TableCell>
                  <TableCell>Credits / Unit</TableCell>
                  <TableCell>Definition</TableCell>
                  <TableCell>Overage</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.module}</TableCell>
                    <TableCell>{item.sub_module || '-'}</TableCell>
                    <TableCell>{item.billing_unit || '-'}</TableCell>
                    <TableCell>{item.credits_per_unit ?? '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>{item.definition || item.credit_formula || '-'}</TableCell>
                    <TableCell>{item.overage_handling || '-'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={item.is_active ? 'Active' : 'Inactive'} color={item.is_active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton color="primary" onClick={() => openEditDialog(item)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton color="error" onClick={() => handleDelete(item)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" sx={{ py: 1 }}>
                        No rows yet. Add your first price matrix row.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Price Matrix Row</DialogTitle>
        <DialogContent>{renderMatrixForm(createForm, setCreateForm)}</DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Row'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Price Matrix Row</DialogTitle>
        <DialogContent>{renderMatrixForm(editForm, setEditForm)}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Update Row'}
          </Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default SuperAdminPriceMatrixPage;
