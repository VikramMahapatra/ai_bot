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
  Tab,
  Tabs,
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
import DownloadIcon from '@mui/icons-material/Download';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SuperAdminLayout from '../components/Layout/SuperAdminLayout';
import { superadminService } from '../services/superadminService';
import {
  BillingBill,
  BillingInvoice,
  BillingInvoiceDetail,
  BillingInvoiceMarkPaidRequest,
  BillingPayment,
  SuperAdminOrganization,
} from '../types';

type InvoiceFilterStatus = 'all' | 'pending' | 'partial' | 'paid';
type PaymentFilterStatus = 'all' | 'completed' | 'pending' | 'failed';

const dateOnly = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '-');
const dateToIsoAtMidnight = (value: string) => (value ? `${value}T00:00:00Z` : null);
const fmt = (v: number | undefined | null) => (v != null ? `₹ ${Number(v).toFixed(2)}` : '-');

const generateInvoicePDF = (payload: any) => {
  const doc = new jsPDF();
  const inv = payload.invoice;
  const margin = 14;
  let y = 18;

  doc.setFontSize(20);
  doc.setTextColor(0, 51, 153);
  doc.text('INVOICE', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Invoice #: ${inv.invoice_number}`, margin, y); y += 6;
  doc.text(`Organization: ${inv.organization_name}`, margin, y); y += 6;
  doc.text(`Issue Date: ${dateOnly(inv.issue_date)}`, margin, y); y += 6;
  doc.text(`Due Date: ${dateOnly(inv.due_date)}`, margin, y); y += 6;
  doc.text(`Status: ${(inv.status || '').toUpperCase()}`, margin, y); y += 6;
  doc.text(`Total Amount: ${fmt(inv.amount)}`, margin, y); y += 6;
  doc.text(`Amount Paid: ${fmt(inv.paid_amount)}`, margin, y); y += 6;
  doc.text(`Outstanding: ${fmt(Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0)))}`, margin, y); y += 10;

  if (inv.notes) { doc.text(`Notes: ${inv.notes}`, margin, y); y += 8; }

  if (inv.items && inv.items.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 153);
    doc.text('Subscribed Services', margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Module', 'Sub-Module', 'Billing Unit', 'Qty', 'Credits/Unit', 'Allocated Credits']],
      body: inv.items.map((item: any) => [
        item.category || '-', item.module || '-', item.sub_module || '-',
        item.billing_unit || '-', item.quantity ?? '-', item.credits_per_unit ?? '-',
        item.allocated_credits ?? '-',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 51, 153] },
      margin: { left: margin, right: margin },
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(`Generated at: ${new Date(payload.generated_at).toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 10);
  doc.save(`invoice-${inv.invoice_number}.pdf`);
};

const generateReceiptPDF = (payload: any) => {
  const doc = new jsPDF();
  const bill = payload.bill;
  const inv = payload.invoice;
  const margin = 14;
  let y = 18;

  doc.setFontSize(20);
  doc.setTextColor(0, 120, 60);
  doc.text('PAYMENT RECEIPT', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Receipt #: ${bill.bill_number}`, margin, y); y += 6;
  doc.text(`Organization: ${bill.organization_name}`, margin, y); y += 6;
  doc.text(`Linked Invoice #: ${bill.invoice_number}`, margin, y); y += 6;
  doc.text(`Receipt Date: ${dateOnly(bill.issued_date)}`, margin, y); y += 6;

  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, 200 - margin, y); y += 6;

  doc.setFontSize(12);
  doc.setTextColor(0, 120, 60);
  doc.text('Payment Details', margin, y); y += 7;

  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`Amount Paid: ${fmt(bill.amount)}`, margin, y); y += 6;
  if (bill.payment_method) { doc.text(`Payment Method: ${bill.payment_method}`, margin, y); y += 6; }
  if (bill.payment_reference) { doc.text(`Reference: ${bill.payment_reference}`, margin, y); y += 6; }
  if (bill.notes) { doc.text(`Notes: ${bill.notes}`, margin, y); y += 6; }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, 200 - margin, y); y += 6;

  doc.setFontSize(12);
  doc.setTextColor(0, 51, 153);
  doc.text('Invoice Summary', margin, y); y += 7;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Invoice Total: ${fmt(inv?.amount)}`, margin, y); y += 6;
  doc.text(`Total Paid: ${fmt(inv?.paid_amount)}`, margin, y); y += 6;
  const outstanding = Math.max(0, (inv?.amount || 0) - (inv?.paid_amount || 0));
  doc.text(`Outstanding Balance: ${fmt(outstanding)}`, margin, y); y += 6;
  doc.text(`Invoice Status: ${(inv?.status || '').toUpperCase()}`, margin, y); y += 8;

  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(`Generated at: ${new Date(payload.generated_at).toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 10);
  doc.save(`receipt-${bill.bill_number}.pdf`);
};

const SuperAdminBillingPage: React.FC = () => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [bills, setBills] = useState<BillingBill[]>([]);

  const [selectedOrganizationFilter, setSelectedOrganizationFilter] = useState<number | 'all'>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceFilterStatus>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentFilterStatus>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isLoadingInvoiceDetail, setIsLoadingInvoiceDetail] = useState(false);
  const [isMarkingInvoicePaid, setIsMarkingInvoicePaid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [invoiceViewOpen, setInvoiceViewOpen] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<BillingInvoiceDetail | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<BillingInvoice | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [markPaidMethod, setMarkPaidMethod] = useState('bank_transfer');
  const [markPaidReference, setMarkPaidReference] = useState('');
  const [markPaidNotes, setMarkPaidNotes] = useState('');
  const [markPaidAmount, setMarkPaidAmount] = useState<string>('');

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const loadOrganizations = async () => setOrganizations(await superadminService.listOrganizations());
  const loadInvoices = async () =>
    setInvoices(
      await superadminService.listBillingInvoices({
        organization_id: selectedOrganizationFilter === 'all' ? undefined : selectedOrganizationFilter,
        status_filter: invoiceStatusFilter,
      })
    );
  const loadPayments = async () =>
    setPayments(
      await superadminService.listBillingPayments({
        organization_id: selectedOrganizationFilter === 'all' ? undefined : selectedOrganizationFilter,
        status_filter: paymentStatusFilter,
      })
    );
  const loadBills = async () =>
    setBills(
      await superadminService.listBillingBills({
        organization_id: selectedOrganizationFilter === 'all' ? undefined : selectedOrganizationFilter,
      })
    );

  const loadPageData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadOrganizations(), loadInvoices(), loadPayments(), loadBills()]);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    Promise.all([loadInvoices(), loadPayments(), loadBills()]).catch(() => {});
  }, [selectedOrganizationFilter, invoiceStatusFilter, paymentStatusFilter]);

  const billsByInvoiceId = useMemo(() => {
    const map = new Map<number, BillingBill[]>();
    bills.forEach((bill) => {
      const existing = map.get(bill.invoice_id) || [];
      existing.push(bill);
      map.set(bill.invoice_id, existing);
    });
    return map;
  }, [bills]);

  const openInvoiceView = async (invoiceId: number) => {
    resetMessages();
    try {
      setIsLoadingInvoiceDetail(true);
      setInvoiceDetail(await superadminService.getBillingInvoiceDetail(invoiceId));
      setInvoiceViewOpen(true);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to load invoice details');
    } finally {
      setIsLoadingInvoiceDetail(false);
    }
  };

  const handleBackfillExistingBills = async () => {
    resetMessages();
    try {
      setIsBackfilling(true);
      const response = await superadminService.backfillBillingInvoices(false);
      setSuccessMessage(`Backfill completed. Created ${response.invoices_created_count} invoice(s).`);
      await Promise.all([loadInvoices(), loadPayments(), loadBills()]);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to backfill existing invoices');
    } finally {
      setIsBackfilling(false);
    }
  };

  const exportInvoice = async (invoice: BillingInvoice) => {
    resetMessages();
    try {
      const payload = await superadminService.exportBillingInvoice(invoice.id);
      generateInvoicePDF(payload);
      setSuccessMessage(`Invoice ${invoice.invoice_number} exported as PDF.`);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to export invoice');
    }
  };

  const exportReceipt = async (bill: BillingBill) => {
    resetMessages();
    try {
      const payload = await superadminService.exportBillingBill(bill.id);
      generateReceiptPDF(payload);
      setSuccessMessage(`Receipt ${bill.bill_number} exported as PDF.`);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to export receipt');
    }
  };

  const openMarkPaidDialog = (invoice: BillingInvoice) => {
    setTargetInvoice(invoice);
    setMarkPaidDate(new Date().toISOString().slice(0, 10));
    setMarkPaidMethod('bank_transfer');
    setMarkPaidReference('');
    setMarkPaidNotes('');
    const outstanding = Math.max(0, Number((invoice.amount - invoice.paid_amount).toFixed(2)));
    setMarkPaidAmount(String(outstanding));
    setMarkPaidOpen(true);
  };

  const submitMarkInvoicePaid = async () => {
    if (!targetInvoice) return;
    resetMessages();
    try {
      setIsMarkingInvoicePaid(true);
      const amountPaidNum = markPaidAmount.trim() !== '' ? parseFloat(markPaidAmount) : null;
      const payload: BillingInvoiceMarkPaidRequest = {
        payment_date: dateToIsoAtMidnight(markPaidDate),
        method: markPaidMethod,
        reference: markPaidReference.trim() || null,
        notes: markPaidNotes.trim() || null,
        amount_paid: amountPaidNum != null && !isNaN(amountPaidNum) ? amountPaidNum : null,
      };
      const result = await superadminService.markBillingInvoicePaid(targetInvoice.id, payload);
      const parts: string[] = [`Receipt generated: ${result.bill.bill_number}`];
      if (result.credit_applied && result.credit_applied > 0) {
        parts.push(`Credit applied: ₹${result.credit_applied.toFixed(2)}`);
      }
      if (result.partial_invoice) {
        parts.push(`Partial invoice created for remaining balance: ${result.partial_invoice.invoice_number}`);
      }
      if (result.credit_note && result.credit_note > 0) {
        parts.push(`Overpayment of ₹${result.credit_note.toFixed(2)} saved as credit for next billing cycle`);
      }
      setSuccessMessage(parts.join(' | '));
      setMarkPaidOpen(false);
      await Promise.all([loadInvoices(), loadPayments(), loadBills()]);
      if (invoiceViewOpen && invoiceDetail?.id === targetInvoice.id) {
        await openInvoiceView(targetInvoice.id);
      }
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to mark invoice paid');
    } finally {
      setIsMarkingInvoicePaid(false);
    }
  };

  return (
    <SuperAdminLayout>
      <Paper elevation={0} sx={{ p: { xs: 2.2, md: 3 }, mb: 3, borderRadius: '22px', border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`, background: `linear-gradient(132deg, ${alpha('#cde3ff', 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.84)} 66%, ${alpha('#9fc9f1', 0.92)} 100%)`, boxShadow: `0 20px 36px ${alpha(theme.palette.primary.dark, 0.22)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack spacing={0.6}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.16em', fontWeight: 700 }}>Super Admin</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Billing Module</Typography>
            <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.74), maxWidth: 740 }}>
              View invoices with subscribed matrix rows, register payment received from invoice actions, and export PDF invoice/receipt.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={handleBackfillExistingBills} disabled={isLoading || isBackfilling}>
              {isBackfilling ? 'Backfilling...' : 'Backfill Existing Bills'}
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadPageData} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert> : null}

      <Card sx={{ borderRadius: '18px', mb: 2 }}>
        <CardContent>
          <Grid container spacing={1.2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Organization Filter</InputLabel>
                <Select label="Organization Filter" value={selectedOrganizationFilter === 'all' ? 'all' : String(selectedOrganizationFilter)} onChange={(event) => { const value = String(event.target.value); setSelectedOrganizationFilter(value === 'all' ? 'all' : Number(value)); }}>
                  <MenuItem value="all">All Organizations</MenuItem>
                  {organizations.map((org) => (<MenuItem key={org.id} value={String(org.id)}>{org.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Invoice Status</InputLabel>
                <Select label="Invoice Status" value={invoiceStatusFilter} onChange={(event) => setInvoiceStatusFilter(event.target.value as InvoiceFilterStatus)}>
                  <MenuItem value="all">all</MenuItem>
                  <MenuItem value="pending">pending</MenuItem>
                  <MenuItem value="partial">partial</MenuItem>
                  <MenuItem value="paid">paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select label="Payment Status" value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value as PaymentFilterStatus)}>
                  <MenuItem value="all">all</MenuItem>
                  <MenuItem value="completed">completed</MenuItem>
                  <MenuItem value="pending">pending</MenuItem>
                  <MenuItem value="failed">failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`, borderRadius: '18px', background: `linear-gradient(145deg, ${alpha('#eff6ff', 0.94)} 0%, rgba(255,255,255,1) 70%)` }}>
        <CardContent>
          <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)} sx={{ mb: 1.8 }}>
            <Tab icon={<ReceiptLongIcon />} iconPosition="start" label="Invoices" />
            <Tab icon={<PaymentsIcon />} iconPosition="start" label="Payments" />
            <Tab icon={<DownloadIcon />} iconPosition="start" label="Receipts" />
          </Tabs>

          {tabIndex === 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Issue</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Paid</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => {
                    const invoiceBills = billsByInvoiceId.get(invoice.id) || [];
                    return (
                      <TableRow key={invoice.id} hover>
                        <TableCell>{invoice.organization_name}</TableCell>
                        <TableCell>{invoice.invoice_number}</TableCell>
                        <TableCell>{dateOnly(invoice.issue_date)}</TableCell>
                        <TableCell>{dateOnly(invoice.due_date)}</TableCell>
                        <TableCell>{invoice.amount}</TableCell>
                        <TableCell>{invoice.paid_amount}</TableCell>
                        <TableCell>{invoice.status}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" title="View Invoice" onClick={() => openInvoiceView(invoice.id)}><VisibilityIcon fontSize="small" /></IconButton>
                          <IconButton size="small" title="Export Invoice PDF" onClick={() => exportInvoice(invoice)}><DownloadIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="success" title="Register Payment Received" onClick={() => openMarkPaidDialog(invoice)} disabled={invoice.status === 'paid'}><PaymentsIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="primary" title="Export Receipt PDF" onClick={() => { const latest = invoiceBills[0]; if (latest) exportReceipt(latest); }} disabled={!invoiceBills.length}><ReceiptLongIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!isLoading && invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={8}><Typography variant="body2" sx={{ py: 1 }}>No invoices found.</Typography></TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tabIndex === 1 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>{payment.organization_name}</TableCell>
                      <TableCell>{payment.invoice_number || '-'}</TableCell>
                      <TableCell>{payment.amount}</TableCell>
                      <TableCell>{dateOnly(payment.payment_date)}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>{payment.status}</TableCell>
                      <TableCell>{payment.reference || '-'}</TableCell>
                      <TableCell>{payment.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && payments.length === 0 ? (
                    <TableRow><TableCell colSpan={8}><Typography variant="body2" sx={{ py: 1 }}>No payments found.</Typography></TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tabIndex === 2 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Receipt #</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Issued</TableCell>
                    <TableCell>Amount Paid</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bills.map((bill) => (
                    <TableRow key={bill.id} hover>
                      <TableCell>{bill.organization_name}</TableCell>
                      <TableCell>{bill.bill_number}</TableCell>
                      <TableCell>{bill.invoice_number}</TableCell>
                      <TableCell>{dateOnly(bill.issued_date)}</TableCell>
                      <TableCell>{fmt(bill.amount)}</TableCell>
                      <TableCell>{bill.payment_method || '-'}</TableCell>
                      <TableCell>{bill.payment_reference || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" title="View Invoice" onClick={() => openInvoiceView(bill.invoice_id)}><VisibilityIcon fontSize="small" /></IconButton>
                        <IconButton size="small" title="Export Receipt PDF" onClick={() => exportReceipt(bill)}><DownloadIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && bills.length === 0 ? (
                    <TableRow><TableCell colSpan={8}><Typography variant="body2" sx={{ py: 1 }}>No receipts found.</Typography></TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={invoiceViewOpen} onClose={() => setInvoiceViewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Invoice View</DialogTitle>
        <DialogContent>
          {isLoadingInvoiceDetail ? <Typography variant="body2">Loading invoice details...</Typography> : null}
          {!isLoadingInvoiceDetail && invoiceDetail ? (
            <Stack spacing={1.2}>
              <Grid container spacing={1.2}>
                <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Organization" value={invoiceDetail.organization_name} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Invoice #" value={invoiceDetail.invoice_number} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={2}><TextField size="small" fullWidth label="Issue Date" value={dateOnly(invoiceDetail.issue_date)} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={2}><TextField size="small" fullWidth label="Due Date" value={dateOnly(invoiceDetail.due_date)} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={2}><TextField size="small" fullWidth label="Status" value={invoiceDetail.status} InputProps={{ readOnly: true }} /></Grid>
              </Grid>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Subscribed Matrix Rows</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Sub-Module</TableCell>
                      <TableCell>Billing Unit</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Credits/Unit</TableCell>
                      <TableCell>Allocated Credits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoiceDetail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.module}</TableCell>
                        <TableCell>{item.sub_module || '-'}</TableCell>
                        <TableCell>{item.billing_unit || '-'}</TableCell>
                        <TableCell>{item.quantity ?? '-'}</TableCell>
                        <TableCell>{item.credits_per_unit ?? '-'}</TableCell>
                        <TableCell>{item.allocated_credits}</TableCell>
                      </TableRow>
                    ))}
                    {invoiceDetail.items.length === 0 ? (
                      <TableRow><TableCell colSpan={7}><Typography variant="body2" sx={{ py: 1 }}>No matrix rows found for this invoice.</Typography></TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          {invoiceDetail ? <Button onClick={() => exportInvoice(invoiceDetail)} startIcon={<DownloadIcon />}>Export Invoice PDF</Button> : null}
          <Button onClick={() => setInvoiceViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={markPaidOpen} onClose={() => setMarkPaidOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Payment Received</DialogTitle>
        <DialogContent>
          {targetInvoice ? (
            <Stack spacing={1.2} sx={{ mt: 0.8 }}>
              <Typography variant="body2">
                <strong>Invoice:</strong> {targetInvoice.invoice_number} &nbsp;|&nbsp;
                <strong>Invoice Total:</strong> {fmt(targetInvoice.amount)} &nbsp;|&nbsp;
                <strong>Outstanding:</strong> {fmt(Math.max(0, Number((targetInvoice.amount - targetInvoice.paid_amount).toFixed(2))))}
              </Typography>
              <TextField
                fullWidth
                label="Amount Paid"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={markPaidAmount}
                onChange={(event) => setMarkPaidAmount(event.target.value)}
                helperText="Enter the amount received. Leave blank to pay full outstanding. Less = partial invoice created; More = credit for next cycle."
              />
              <TextField fullWidth label="Payment Date" type="date" InputLabelProps={{ shrink: true }} value={markPaidDate} onChange={(event) => setMarkPaidDate(event.target.value)} />
              <TextField fullWidth label="Payment Method" value={markPaidMethod} onChange={(event) => setMarkPaidMethod(event.target.value)} />
              <TextField fullWidth label="Reference" value={markPaidReference} onChange={(event) => setMarkPaidReference(event.target.value)} />
              <TextField fullWidth label="Notes" value={markPaidNotes} onChange={(event) => setMarkPaidNotes(event.target.value)} />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkPaidOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitMarkInvoicePaid} disabled={isMarkingInvoicePaid}>
            {isMarkingInvoicePaid ? 'Saving...' : 'Mark Paid & Generate Receipt'}
          </Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default SuperAdminBillingPage;
