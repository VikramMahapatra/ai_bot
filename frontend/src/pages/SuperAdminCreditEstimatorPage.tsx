import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
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
import AddAlarmIcon from '@mui/icons-material/AddAlarm';
import CalculateIcon from '@mui/icons-material/Calculate';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { buildPublicUrl } from '../config/env';
import { superadminService } from '../services/superadminService';
import { CreditEstimatorResultListItem, PriceMatrixEstimateResponse, PriceMatrixItem } from '../types';

interface CalculatorLine {
  id: string;
  priceMatrixItemId: number | '';
  quantity: string;
}

const createCalculatorLine = (): CalculatorLine => ({
  id: `${Date.now()}-${Math.random()}`,
  priceMatrixItemId: '',
  quantity: '1',
});

const SuperAdminCreditEstimatorPage: React.FC = () => {
  const theme = useTheme();
  const [items, setItems] = useState<PriceMatrixItem[]>([]);
  const [results, setResults] = useState<CreditEstimatorResultListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [extendingResultId, setExtendingResultId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [editingResultId, setEditingResultId] = useState<number | null>(null);

  const [calculatorLines, setCalculatorLines] = useState<CalculatorLine[]>([createCalculatorLine()]);
  const [bufferPercent, setBufferPercent] = useState('15');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [estimateResult, setEstimateResult] = useState<PriceMatrixEstimateResponse | null>(null);

  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewResult, setViewResult] = useState<CreditEstimatorResultListItem | null>(null);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTargetResult, setEmailTargetResult] = useState<CreditEstimatorResultListItem | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('Credit Estimate from Zentrixel');
  const [emailBody, setEmailBody] = useState('');

  const calculableItems = useMemo(
    () => items.filter((item) => item.is_active && item.credits_per_unit !== null && item.credits_per_unit !== undefined),
    [items]
  );

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const loadItems = async () => {
    const data = await superadminService.listPriceMatrix(true);
    setItems(data);
  };

  const loadResults = async () => {
    const data = await superadminService.listCreditEstimatorResults({
      company_name: filterCompany.trim() || undefined,
      status_filter: filterStatus,
    });
    setResults(data);
  };

  const loadPageData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadItems(), loadResults()]);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to load estimator data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    loadResults().catch(() => {});
  }, [filterCompany, filterStatus]);

  const getEstimatePayload = () => {
    const validLines = calculatorLines
      .filter((line) => line.priceMatrixItemId !== '')
      .map((line) => ({
        price_matrix_item_id: Number(line.priceMatrixItemId),
        quantity: Number(line.quantity),
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (validLines.length === 0) {
      throw new Error('Add at least one valid usage row with quantity greater than 0.');
    }

    const bufferValue = Number(bufferPercent);
    const discountValue = Number(discountPercent);

    return {
      lines: validLines,
      buffer_percent: Number.isFinite(bufferValue) && bufferValue >= 0 ? bufferValue : 0,
      discount_percent: Number.isFinite(discountValue) && discountValue >= 0 ? discountValue : 0,
    };
  };

  const handleEstimate = async () => {
    resetMessages();
    try {
      const payload = getEstimatePayload();
      setIsEstimating(true);
      const result = await superadminService.estimatePriceMatrix(payload);
      setEstimateResult(result);
      setSuccessMessage('Credit estimate calculated successfully.');
    } catch (error: any) {
      setEstimateResult(null);
      setErrorMessage(error?.response?.data?.detail || error?.message || 'Failed to calculate estimate');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleAddCalculatorLine = () => {
    setCalculatorLines((previous) => [...previous, createCalculatorLine()]);
  };

  const handleRemoveCalculatorLine = (lineId: string) => {
    setCalculatorLines((previous) => {
      if (previous.length === 1) return previous;
      return previous.filter((line) => line.id !== lineId);
    });
  };

  const handleCalculatorLineChange = (lineId: string, patch: Partial<CalculatorLine>) => {
    setCalculatorLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    );
  };

  const resetEditor = () => {
    setCompanyName('');
    setEditingResultId(null);
    setCalculatorLines([createCalculatorLine()]);
    setBufferPercent('15');
    setDiscountPercent('0');
    setEstimateResult(null);
  };

  const loadResultIntoEditor = (row: CreditEstimatorResultListItem) => {
    setCompanyName(row.company_name);
    setEditingResultId(row.id);
    setBufferPercent(String(row.estimator_input.buffer_percent ?? 15));
    setDiscountPercent(String(row.estimator_input.discount_percent ?? 0));
    setCalculatorLines(
      (row.estimator_input.lines || []).map((line) => ({
        id: `${Date.now()}-${Math.random()}`,
        priceMatrixItemId: line.price_matrix_item_id,
        quantity: String(line.quantity),
      }))
    );
    setEstimateResult(row.estimate);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveResult = async () => {
    const safeCompany = companyName.trim();
    if (!safeCompany) {
      setErrorMessage('Company name is required.');
      return;
    }

    resetMessages();
    try {
      const payload = getEstimatePayload();
      setIsSavingResult(true);

      if (editingResultId) {
        const response = await superadminService.updateCreditEstimatorResult(editingResultId, {
          company_name: safeCompany,
          ...payload,
        });
        setEstimateResult(response.estimate);
        setSuccessMessage('Saved estimate updated successfully.');
      } else {
        const response = await superadminService.createCreditEstimatorShare({
          company_name: safeCompany,
          ...payload,
          valid_for_hours: 8,
        });
        setEstimateResult(response.estimate);
        setSuccessMessage('Saved estimate created with 8-hour share link.');
      }

      await loadResults();
      setEditingResultId(null);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || error?.message || 'Failed to save estimator result');
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleExtendResult = async (row: CreditEstimatorResultListItem) => {
    resetMessages();
    try {
      setExtendingResultId(row.id);
      await superadminService.extendCreditEstimatorResult(row.id, { extra_hours: 8 });
      await loadResults();
      setSuccessMessage(`Validity extended by +8 hours for ${row.company_name}.`);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to extend validity');
    } finally {
      setExtendingResultId(null);
    }
  };

  const copyShareLink = async (row: CreditEstimatorResultListItem) => {
    const url = buildPublicUrl(row.share_path);
    await navigator.clipboard.writeText(url);
    setSuccessMessage('Share link copied to clipboard.');
    setErrorMessage('');
  };

  const openViewDialog = (row: CreditEstimatorResultListItem) => {
    setViewResult(row);
    setViewDialogOpen(true);
  };

  const openEmailDialog = (row: CreditEstimatorResultListItem) => {
    const url = buildPublicUrl(row.share_path);
    setEmailTargetResult(row);
    setEmailSubject(`Credit Estimate for ${row.company_name}`);
    setEmailBody(
      [
        'Hello,',
        '',
        `Please review the credit estimate for ${row.company_name}:`,
        url,
        '',
        `This link is valid until ${new Date(row.expires_at).toLocaleString()}.`,
        '',
        'Regards,',
        'Zentrixel Team',
      ].join('\n')
    );
    setEmailDialogOpen(true);
  };

  const sendEmail = async () => {
    const row = emailTargetResult;
    if (!row) return;
    const recipient = emailTo.trim();
    if (!recipient) {
      setErrorMessage('Recipient email is required.');
      return;
    }
    if (!emailBody.trim()) {
      setErrorMessage('Email body is required.');
      return;
    }

    resetMessages();
    try {
      setIsSendingEmail(true);
      await superadminService.sendCreditEstimatorResultEmail(row.id, {
        to_email: recipient,
        subject: emailSubject.trim() || 'Credit Estimate from Zentrixel',
        body: emailBody.trim(),
      });
      setSuccessMessage('Estimate link sent successfully.');
      setEmailDialogOpen(false);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
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
          Credit Estimator
        </Typography>
        <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75), mt: 0.9 }}>
          Save estimates by company, manage validity windows, and share result-only links with complete control.
        </Typography>
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Estimator Editor {editingResultId ? `(Editing #${editingResultId})` : '(New)'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={resetEditor}>Reset</Button>
              <Button variant="outlined" onClick={handleAddCalculatorLine} startIcon={<AddIcon />}>
                Add Usage Row
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={1.2} sx={{ mb: 1.2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Buffer (%)"
                type="number"
                inputProps={{ min: 0, step: '0.1' }}
                value={bufferPercent}
                onChange={(event) => setBufferPercent(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Discount (%)"
                type="number"
                inputProps={{ min: 0, step: '0.1' }}
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
              />
            </Grid>
          </Grid>

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

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mb: 1.2 }}>
            <Button
              variant="outlined"
              onClick={handleEstimate}
              disabled={isEstimating || isLoading || calculableItems.length === 0}
              startIcon={<CalculateIcon />}
            >
              {isEstimating ? 'Estimating...' : 'Calculate'}
            </Button>
            <Button
              variant="contained"
              onClick={saveResult}
              disabled={isSavingResult}
              startIcon={<LinkIcon />}
            >
              {isSavingResult ? 'Saving...' : editingResultId ? 'Update Saved Result' : 'Save Result (8h link)'}
            </Button>
          </Stack>

          {estimateResult && (
            <Grid container spacing={1.4}>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{estimateResult.subtotal_credits}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary">Buffer</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{estimateResult.buffer_credits}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary">After Buffer</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{estimateResult.recommended_credits}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary">Discount</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{estimateResult.discount_credits}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary">Final</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{estimateResult.final_recommended_credits}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary">Final Rounded</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>{estimateResult.final_recommended_credits_ceiling}</Typography>
              </Grid>
            </Grid>
          )}
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
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Saved Estimate Results</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Filter by Company"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Final Credits</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Valid Till</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.company_name}</TableCell>
                    <TableCell>{row.estimate.final_recommended_credits_ceiling}</TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell>{new Date(row.expires_at).toLocaleString()}</TableCell>
                    <TableCell>{row.is_expired ? 'Expired' : 'Active'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" title="View" onClick={() => openViewDialog(row)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="warning" title="Edit" onClick={() => loadResultIntoEditor(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="info"
                        title="Add +8h"
                        onClick={() => handleExtendResult(row)}
                        disabled={extendingResultId === row.id}
                      >
                        <AddAlarmIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="success" title="Copy Link" onClick={() => copyShareLink(row)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="secondary" title="Send Email" onClick={() => openEmailDialog(row)}>
                        <EmailIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" sx={{ py: 1 }}>
                        No saved results found for this filter.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Estimate Details</DialogTitle>
        <DialogContent>
          {viewResult && (
            <Stack spacing={1.2} sx={{ mt: 0.8 }}>
              <Typography><strong>Company:</strong> {viewResult.company_name}</Typography>
              <Typography><strong>Final Recommended Credits:</strong> {viewResult.estimate.final_recommended_credits_ceiling}</Typography>
              <Typography><strong>Share Link:</strong> {buildPublicUrl(viewResult.share_path)}</Typography>
              <Typography><strong>Valid Till:</strong> {new Date(viewResult.expires_at).toLocaleString()}</Typography>
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
                    {viewResult.estimate.breakdown.map((line, idx) => (
                      <TableRow key={`${line.price_matrix_item_id}-${idx}`}>
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
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Saved Estimate Link</DialogTitle>
        <DialogContent>
          <Stack spacing={1.3} sx={{ mt: 0.8 }}>
            <TextField label="Recipient Email" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} fullWidth size="small" />
            <TextField label="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} fullWidth size="small" />
            <TextField label="Message" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} fullWidth multiline minRows={7} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)} disabled={isSendingEmail}>Cancel</Button>
          <Button variant="contained" onClick={sendEmail} disabled={isSendingEmail}>
            {isSendingEmail ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default SuperAdminCreditEstimatorPage;
