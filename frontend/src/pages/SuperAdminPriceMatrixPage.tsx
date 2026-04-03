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
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import { PriceMatrixEstimateResponse, PriceMatrixItem, PriceMatrixItemPayload } from '../types';

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

interface CalculatorLine {
  id: string;
  priceMatrixItemId: number | '';
  quantity: string;
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

const createCalculatorLine = (): CalculatorLine => ({
  id: `${Date.now()}-${Math.random()}`,
  priceMatrixItemId: '',
  quantity: '1',
});

const toOptionalString = (value?: string | null): string => value ?? '';

const toOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
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
  const [isEstimating, setIsEstimating] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MatrixFormState>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<MatrixFormState>(DEFAULT_FORM);
  const [editingItem, setEditingItem] = useState<PriceMatrixItem | null>(null);

  const [calculatorLines, setCalculatorLines] = useState<CalculatorLine[]>([createCalculatorLine()]);
  const [bufferPercent, setBufferPercent] = useState('15');
  const [estimateResult, setEstimateResult] = useState<PriceMatrixEstimateResponse | null>(null);

  const calculableItems = useMemo(
    () => items.filter((item) => item.is_active && item.credits_per_unit !== null && item.credits_per_unit !== undefined),
    [items]
  );

  const matrixStats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.is_active).length;
    const calculable = calculableItems.length;
    const averageCredits =
      calculable > 0
        ? calculableItems.reduce((sum, item) => sum + Number(item.credits_per_unit || 0), 0) / calculable
        : 0;

    return {
      total,
      active,
      calculable,
      averageCredits: Number(averageCredits.toFixed(2)),
    };
  }, [calculableItems, items]);

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
    if (!editingItem) {
      return;
    }
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
    if (!confirmed) {
      return;
    }

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

  const handleAddCalculatorLine = () => {
    setCalculatorLines((previous) => [...previous, createCalculatorLine()]);
  };

  const handleRemoveCalculatorLine = (lineId: string) => {
    setCalculatorLines((previous) => {
      if (previous.length === 1) {
        return previous;
      }
      return previous.filter((line) => line.id !== lineId);
    });
  };

  const handleCalculatorLineChange = (lineId: string, patch: Partial<CalculatorLine>) => {
    setCalculatorLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    );
  };

  const handleEstimate = async () => {
    resetMessages();
    setEstimateResult(null);

    const validLines = calculatorLines
      .filter((line) => line.priceMatrixItemId !== '')
      .map((line) => ({
        price_matrix_item_id: Number(line.priceMatrixItemId),
        quantity: Number(line.quantity),
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (validLines.length === 0) {
      setErrorMessage('Add at least one valid calculator line with quantity greater than 0.');
      return;
    }

    const bufferValue = Number(bufferPercent);
    const safeBuffer = Number.isFinite(bufferValue) && bufferValue >= 0 ? bufferValue : 0;

    setIsEstimating(true);
    try {
      const result = await superadminService.estimatePriceMatrix({
        lines: validLines,
        buffer_percent: safeBuffer,
      });
      setEstimateResult(result);
      setSuccessMessage('Credit estimate calculated successfully.');
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to calculate estimate');
    } finally {
      setIsEstimating(false);
    }
  };

  const renderMatrixForm = (
    formState: MatrixFormState,
    setFormState: React.Dispatch<React.SetStateAction<MatrixFormState>>
  ) => (
    <Grid container spacing={2} sx={{ mt: 0.5 }}>
      <Grid item xs={12} md={4}>
        <TextField
          label="Category"
          value={formState.category}
          onChange={(event) => setFormState((previous) => ({ ...previous, category: event.target.value }))}
          fullWidth
          required
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Module"
          value={formState.module}
          onChange={(event) => setFormState((previous) => ({ ...previous, module: event.target.value }))}
          fullWidth
          required
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Sub-Module"
          value={formState.sub_module}
          onChange={(event) => setFormState((previous) => ({ ...previous, sub_module: event.target.value }))}
          fullWidth
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Billing Unit"
          value={formState.billing_unit}
          onChange={(event) => setFormState((previous) => ({ ...previous, billing_unit: event.target.value }))}
          fullWidth
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Credits Per Unit"
          value={formState.credits_per_unit}
          onChange={(event) => setFormState((previous) => ({ ...previous, credits_per_unit: event.target.value }))}
          type="number"
          inputProps={{ step: '0.01', min: 0 }}
          fullWidth
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Sort Order"
          value={formState.sort_order}
          onChange={(event) => setFormState((previous) => ({ ...previous, sort_order: event.target.value }))}
          type="number"
          inputProps={{ step: '1' }}
          fullWidth
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Credit Formula / Notes"
          value={formState.credit_formula}
          onChange={(event) => setFormState((previous) => ({ ...previous, credit_formula: event.target.value }))}
          fullWidth
          multiline
          minRows={2}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Definition"
          value={formState.definition}
          onChange={(event) => setFormState((previous) => ({ ...previous, definition: event.target.value }))}
          fullWidth
          multiline
          minRows={2}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Overage Handling"
          value={formState.overage_handling}
          onChange={(event) => setFormState((previous) => ({ ...previous, overage_handling: event.target.value }))}
          fullWidth
        />
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={formState.is_active}
              onChange={(event) => setFormState((previous) => ({ ...previous, is_active: event.target.checked }))}
            />
          }
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
          background: `linear-gradient(132deg, ${alpha('#d5ebcc', 0.95)} 0%, ${alpha(
            theme.palette.background.paper,
            0.84
          )} 66%, ${alpha('#9bcfc0', 0.92)} 100%)`,
          boxShadow: `0 20px 36px ${alpha(theme.palette.success.dark, 0.22)}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 1.3, fontWeight: 700, color: alpha(theme.palette.success.dark, 0.76) }}>
              Costing Control
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              Price Matrix & Credit Estimator
            </Typography>
            <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.9 }}>
              Create reusable pricing rows, then estimate onboarding credits with a configurable execution buffer.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Add Matrix Row
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {errorMessage ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Rows', value: matrixStats.total },
          { label: 'Active Rows', value: matrixStats.active },
          { label: 'Calculable Rows', value: matrixStats.calculable },
          { label: 'Avg Credits/Unit', value: matrixStats.averageCredits },
        ].map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.label}>
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
          mb: 3,
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
                      <Chip
                        size="small"
                        label={item.is_active ? 'Active' : 'Inactive'}
                        color={item.is_active ? 'success' : 'default'}
                      />
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
                {!isLoading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" sx={{ py: 1 }}>
                        No rows yet. Add your first price matrix row to start estimating onboarding credits.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card
        sx={{
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.18),
          borderRadius: '18px',
          background: `linear-gradient(145deg, ${alpha('#edf5ff', 0.9)} 0%, rgba(255,255,255,1) 64%)`,
        }}
      >
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Credit Estimator
            </Typography>
            <Button variant="outlined" onClick={handleAddCalculatorLine} startIcon={<AddIcon />}>
              Add Usage Row
            </Button>
          </Stack>

          {calculatorLines.map((line) => (
            <Grid container spacing={1.2} sx={{ mb: 1.2 }} key={line.id}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Price Matrix Row</InputLabel>
                  <Select
                    label="Price Matrix Row"
                    value={line.priceMatrixItemId === '' ? '' : String(line.priceMatrixItemId)}
                    onChange={(event) => {
                      const value = event.target.value;
                      handleCalculatorLineChange(line.id, {
                        priceMatrixItemId: value === '' ? '' : Number(value),
                      });
                    }}
                  >
                    <MenuItem value="">
                      <em>Select row</em>
                    </MenuItem>
                    {calculableItems.map((item) => (
                      <MenuItem key={item.id} value={String(item.id)}>
                        {item.category} | {item.module} | {item.sub_module || '-'} ({item.credits_per_unit} credits/unit)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Expected Quantity"
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={line.quantity}
                  onChange={(event) => handleCalculatorLineChange(line.id, { quantity: event.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  onClick={() => handleRemoveCalculatorLine(line.id)}
                  disabled={calculatorLines.length === 1}
                  startIcon={<DeleteIcon />}
                  sx={{ height: '100%' }}
                >
                  Remove
                </Button>
              </Grid>
            </Grid>
          ))}

          <Grid container spacing={1.2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Execution Buffer (%)"
                type="number"
                inputProps={{ min: 0, step: '0.1' }}
                value={bufferPercent}
                onChange={(event) => setBufferPercent(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <Button
                variant="contained"
                onClick={handleEstimate}
                disabled={isEstimating || calculableItems.length === 0}
                startIcon={<CalculateIcon />}
                sx={{ height: '100%', minWidth: 220 }}
              >
                {isEstimating ? 'Estimating...' : 'Calculate Recommended Credits'}
              </Button>
            </Grid>
          </Grid>

          {estimateResult ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '14px',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                background: `linear-gradient(145deg, ${alpha('#eaf4ff', 0.9)} 0%, ${alpha('#ffffff', 1)} 95%)`,
              }}
            >
              <Grid container spacing={1.4} sx={{ mb: 1.4 }}>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Subtotal Credits
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {estimateResult.subtotal_credits}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Buffer Credits
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {estimateResult.buffer_credits}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Recommended (Exact)
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {estimateResult.recommended_credits}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Recommended (Rounded Up)
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {estimateResult.recommended_credits_ceiling}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Sub-Module</TableCell>
                      <TableCell>Credits/Unit</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Estimated Credits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {estimateResult.breakdown.map((line, index) => (
                      <TableRow key={`${line.price_matrix_item_id}-${index}`}>
                        <TableCell>{line.category}</TableCell>
                        <TableCell>{line.module}</TableCell>
                        <TableCell>{line.sub_module || '-'}</TableCell>
                        <TableCell>{line.credits_per_unit}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>{line.estimated_credits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : null}
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
