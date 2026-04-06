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

const dateOnly = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
const dateToIsoAtMidnight = (value: string) => (value ? `${value}T00:00:00Z` : null);
const fmt = (v: number | undefined | null) => (v != null ? `₹ ${Number(v).toFixed(2)}` : '—');
const fmtINR = (v: number | undefined | null): string => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(v));
};

/** Company identity read from env vars (set in .env) */
const COMPANY = {
  name:    (import.meta.env.VITE_COMPANY_NAME    || 'Zentrixel Pvt Ltd').trim(),
  gstin:   (import.meta.env.VITE_COMPANY_GSTIN   || '').trim(),
  pan:     (import.meta.env.VITE_COMPANY_PAN     || '').trim(),
  cin:     (import.meta.env.VITE_COMPANY_CIN     || '').trim(),
  address: (import.meta.env.VITE_COMPANY_ADDRESS || '').trim(),
  city:    (import.meta.env.VITE_COMPANY_CITY    || '').trim(),
  phone:   (import.meta.env.VITE_COMPANY_PHONE   || '').trim(),
  email:   (import.meta.env.VITE_COMPANY_EMAIL   || '').trim(),
  website: (import.meta.env.VITE_COMPANY_WEBSITE || 'zentrixel.com').trim(),
};

/** Shared footer printed on every PDF page */
const addDocFooter = (doc: jsPDF, genAt: string) => {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(245, 247, 252);
  doc.rect(0, ph - 16, pw, 16, 'F');
  doc.setDrawColor(210, 218, 235);
  doc.line(0, ph - 16, pw, ph - 16);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 140, 160);
  doc.text('This is a computer-generated document. No signature required.', 14, ph - 9);
  doc.text(genAt, pw / 2, ph - 9, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 52, 96);
  doc.text('Powered by Zentrixel', pw - 14, ph - 9, { align: 'right' });
};

/** Shared professional header band */
const addDocHeader = (doc: jsPDF, docTitle: string, accentRGB: [number, number, number]) => {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, pw, 46, 'F');
  // Company name
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY.name, 14, 15);
  // Document title (right)
  doc.setFontSize(20);
  doc.setTextColor(...accentRGB);
  doc.text(docTitle, pw - 14, 17, { align: 'right' });
  // Address row
  const addrParts = [COMPANY.address, COMPANY.city].filter(Boolean).join(', ');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 205, 240);
  if (addrParts) doc.text(addrParts, 14, 25);
  // Tax / contact row
  const taxParts = [
    COMPANY.gstin  ? `GSTIN: ${COMPANY.gstin}`  : '',
    COMPANY.pan    ? `PAN: ${COMPANY.pan}`       : '',
    COMPANY.cin    ? `CIN: ${COMPANY.cin}`       : '',
    COMPANY.phone  ? `Tel: ${COMPANY.phone}`     : '',
    COMPANY.email  ? COMPANY.email               : '',
    COMPANY.website? COMPANY.website             : '',
  ].filter(Boolean).join('   |   ');
  if (taxParts) doc.text(taxParts, 14, 33);
  // Website (right side of tax row)
  // Accent line
  doc.setFillColor(...accentRGB);
  doc.rect(0, 46, pw, 2, 'F');
};

const generateInvoicePDF = (payload: any) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const inv = payload.invoice;
  const status = (inv.status || 'pending').toLowerCase();

  addDocHeader(doc, 'AIBOT Platform Invoice', [41, 182, 246]);

  let y = 54;

  // ── BILL TO (left) + INVOICE META (right) ──────────────────────────────────
  doc.setFillColor(244, 247, 255);
  doc.setDrawColor(210, 220, 240);
  doc.rect(14, y, 88, 42, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(90, 110, 155);
  doc.text('BILL TO', 19, y + 7);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 30, 65);
  doc.text(inv.organization_name || 'N/A', 19, y + 16);

  // Status badge inside bill-to box
  const statusColors: Record<string, [number, number, number]> = { paid: [22, 163, 74], partial: [234, 88, 12], pending: [202, 138, 4], overdue: [220, 38, 38] };
  const sc = statusColors[status] || [100, 100, 100];
  doc.setFillColor(...sc);
  doc.roundedRect(19, y + 20, 28, 6, 1.2, 1.2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(status.toUpperCase(), 33, y + 24.3, { align: 'center' });

  // Right: Invoice meta box
  const rx = 110;
  doc.setFillColor(15, 52, 96);
  doc.rect(rx, y, pw - rx - 14, 42, 'F');
  const metaRows = [
    ['Invoice Number', inv.invoice_number],
    ['Issue Date',     dateOnly(inv.issue_date)],
    ['Due Date',       inv.due_date ? dateOnly(inv.due_date) : 'N/A'],
    ['Billing Period', inv.billing_start_date && inv.billing_end_date
      ? `${dateOnly(inv.billing_start_date)} – ${dateOnly(inv.billing_end_date)}` : 'N/A'],
  ];
  let ry = y + 8;
  metaRows.forEach(([label, value]) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(160, 195, 235);
    doc.text(label + ':', rx + 4, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(String(value), rx + 4, ry + 4.5);
    ry += 10;
  });

  y += 50;

  // ── SUBSCRIBED SERVICES TABLE ──────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 52, 96);
  doc.text('SUBSCRIBED SERVICES', 14, y);
  y += 3;

  const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [];
  autoTable(doc, {
    startY: y,
    head: [['#', 'Category', 'Module', 'Sub-Module', 'Billing Unit', 'Qty', 'Credits/Unit', 'Allocated Credits']],
    body: items.length > 0 ? items.map((item: any, idx: number) => [
      idx + 1, item.category || '—', item.module || '—', item.sub_module || '—',
      item.billing_unit || '—', item.quantity ?? '—', item.credits_per_unit ?? '—',
      item.allocated_credits ?? '—',
    ]) : [['', 'No line items recorded for this invoice.', '', '', '', '', '', '']],
    styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 228, 245] },
    headStyles: { fillColor: [15, 52, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 7: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── FINANCIAL SUMMARY (right-aligned block) ────────────────────────────────
  const outstanding = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0));
  const bx = pw - 14 - 78;
  doc.setFillColor(244, 247, 255);
  doc.setDrawColor(210, 220, 240);
  doc.rect(bx, y, 78, 33, 'FD');
  const sumRows: [string, string, boolean][] = [
    ['Invoice Total',      fmtINR(inv.amount),      false],
    ['Amount Paid',        fmtINR(inv.paid_amount),  false],
    ['Outstanding Balance', fmtINR(outstanding),     outstanding > 0],
  ];
  let sy = y + 9;
  sumRows.forEach(([label, value, hi]) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', hi ? 'bold' : 'normal');
    doc.setTextColor(hi ? 180 : 80, hi ? 30 : 90, hi ? 30 : 130);
    doc.text(label + ':', bx + 4, sy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(hi ? 190 : 15, hi ? 40 : 52, hi ? 40 : 96);
    doc.text(value, pw - 18, sy, { align: 'right' });
    sy += 9;
  });
  y = sy + 6;

  // ── TERMS & NOTES ──────────────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 100, 140);
  doc.text('TERMS & CONDITIONS', 14, y); y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 130, 150);
  const terms = 'Payment is due within 7 days from the date of invoice. Please include the invoice number in your payment reference. Zentrixel Pvt Ltd reserves the right to suspend services on non-payment.';
  const splitT = doc.splitTextToSize(terms, pw - 28);
  doc.text(splitT, 14, y); y += splitT.length * 4 + 5;

  if (inv.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 100, 140);
    doc.text('NOTES', 14, y); y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 115, 135);
    doc.text(doc.splitTextToSize(inv.notes, pw - 28), 14, y);
  }

  // ── STATUS WATERMARK ───────────────────────────────────────────────────────
  doc.setFontSize(status === 'partial' ? 58 : 72);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(status === 'paid' ? 200 : status === 'partial' ? 252 : 252, status === 'paid' ? 235 : status === 'partial' ? 215 : 220, status === 'paid' ? 205 : status === 'partial' ? 185 : 185);
  doc.text(status.toUpperCase(), pw / 2, ph / 2 + 10, { align: 'center', angle: 45 });

  addDocFooter(doc, `Generated: ${new Date(payload.generated_at).toLocaleString('en-IN')}`);
  doc.save(`AIBOT-Invoice-${inv.invoice_number}.pdf`);
};

const generateReceiptPDF = (payload: any) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const bill = payload.bill;
  const inv = payload.invoice;

  addDocHeader(doc, 'AIBOT Platform Receipt', [46, 213, 115]);

  let y = 54;

  // ── RECEIPT DETAILS (left) + RECEIVED FROM (right) ────────────────────────
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(180, 230, 200);
  doc.rect(14, y, 88, 46, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('RECEIPT DETAILS', 19, y + 7);
  const rDetails = [
    ['Receipt Number', bill.bill_number],
    ['Receipt Date',   dateOnly(bill.issued_date)],
    ['Payment Method', bill.payment_method || '—'],
    ['Reference',      bill.payment_reference || '—'],
  ];
  let rd = y + 14;
  rDetails.forEach(([lbl, val]) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 120, 90);
    doc.text(lbl + ':', 19, rd);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 50, 30);
    doc.text(String(val), 19, rd + 4.5);
    rd += 10;
  });

  // Right: Received from
  const rx = 110;
  doc.setFillColor(15, 52, 96);
  doc.rect(rx, y, pw - rx - 14, 46, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(160, 195, 235);
  doc.text('RECEIVED FROM', rx + 4, y + 8);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(bill.organization_name || '—', rx + 4, y + 18);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 205, 240);
  doc.text(`Against Invoice: ${bill.invoice_number}`, rx + 4, y + 28);
  doc.text(`Invoice Date: ${dateOnly(inv?.issue_date)}`, rx + 4, y + 36);
  doc.text(`Invoice Status: ${(inv?.status || '').toUpperCase()}`, rx + 4, y + 44);

  y += 54;

  // ── PAYMENT TABLE ──────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('PAYMENT DETAILS', 14, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Invoice #', 'Invoice Date', 'Payment Mode', 'Amount Paid']],
    body: [[
      'Payment received for services rendered — ' + COMPANY.name,
      bill.invoice_number,
      dateOnly(inv?.issue_date),
      bill.payment_method || '—',
      fmtINR(bill.amount),
    ]],
    styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 230, 210] },
    headStyles: { fillColor: [21, 94, 54], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── AMOUNT PAID HIGHLIGHT ──────────────────────────────────────────────────
  const bx = pw - 14 - 82;
  doc.setFillColor(21, 94, 54);
  doc.rect(bx, y, 82, 12, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Amount Paid:', bx + 5, y + 7.8);
  doc.text(fmtINR(bill.amount), pw - 18, y + 7.8, { align: 'right' });
  y += 18;

  // ── INVOICE SUMMARY ────────────────────────────────────────────────────────
  const outstanding = Math.max(0, (inv?.amount || 0) - (inv?.paid_amount || 0));
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('INVOICE SUMMARY', 14, y); y += 4;
  const sumRows: [string, string][] = [
    ['Invoice Total',       fmtINR(inv?.amount)],
    ['This Payment',        fmtINR(bill.amount)],
    ['Total Paid to Date',  fmtINR(inv?.paid_amount)],
    ['Outstanding Balance', fmtINR(outstanding)],
  ];
  sumRows.forEach(([label, value]) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 100, 90);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 52, 96);
    doc.text(value, 14 + 70, y, { align: 'right' });
    y += 7;
  });
  y += 6;

  if (bill.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('NOTES', 14, y); y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(90, 110, 100);
    doc.text(doc.splitTextToSize(bill.notes, pw - 28), 14, y); y += 8;
  }

  // ── PAID WATERMARK ─────────────────────────────────────────────────────────
  doc.setFontSize(72);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 240, 215);
  doc.text('PAID', pw / 2, ph / 2 + 10, { align: 'center', angle: 45 });

  // ── NOTICE ─────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(130, 145, 135);
  doc.text('This is a computer-generated receipt and does not require a physical signature.', 14, ph - 22);

  addDocFooter(doc, `Generated: ${new Date(payload.generated_at).toLocaleString('en-IN')}`);
  doc.save(`AIBOT-Receipt-${bill.bill_number}.pdf`);
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
  // View Invoice as Document
  const [invoiceDocOpen, setInvoiceDocOpen] = useState(false);
  const [invoiceDocPayload, setInvoiceDocPayload] = useState<any | null>(null);
  const [isLoadingInvoiceDoc, setIsLoadingInvoiceDoc] = useState(false);
  // View Receipt as Document
  const [receiptDocOpen, setReceiptDocOpen] = useState(false);
  const [receiptDocPayload, setReceiptDocPayload] = useState<any | null>(null);
  const [isLoadingReceiptDoc, setIsLoadingReceiptDoc] = useState(false);

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
      setSuccessMessage(`Invoice ${invoice.invoice_number} downloaded as PDF.`);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to export invoice');
    }
  };

  const exportReceipt = async (bill: BillingBill) => {
    resetMessages();
    try {
      const payload = await superadminService.exportBillingBill(bill.id);
      generateReceiptPDF(payload);
      setSuccessMessage(`Receipt ${bill.bill_number} downloaded as PDF.`);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to export receipt');
    }
  };

  const openInvoiceDoc = async (invoiceId: number) => {
    resetMessages();
    try {
      setIsLoadingInvoiceDoc(true);
      const payload = await superadminService.exportBillingInvoice(invoiceId);
      setInvoiceDocPayload(payload);
      setInvoiceDocOpen(true);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to load invoice document');
    } finally {
      setIsLoadingInvoiceDoc(false);
    }
  };

  const openReceiptDoc = async (bill: BillingBill) => {
    resetMessages();
    try {
      setIsLoadingReceiptDoc(true);
      const payload = await superadminService.exportBillingBill(bill.id);
      setReceiptDocPayload(payload);
      setReceiptDocOpen(true);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Failed to load receipt document');
    } finally {
      setIsLoadingReceiptDoc(false);
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
                          <IconButton size="small" title="View Details (Matrix)" onClick={() => openInvoiceView(invoice.id)} disabled={isLoadingInvoiceDetail}><VisibilityIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="info" title="View Invoice Document" onClick={() => openInvoiceDoc(invoice.id)} disabled={isLoadingInvoiceDoc}><ReceiptLongIcon fontSize="small" /></IconButton>
                          <IconButton size="small" title="Download Invoice PDF" onClick={() => exportInvoice(invoice)}><DownloadIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="success" title="Register Payment Received" onClick={() => openMarkPaidDialog(invoice)} disabled={invoice.status === 'paid'}><PaymentsIcon fontSize="small" /></IconButton>
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
                        <IconButton size="small" title="View Invoice Details" onClick={() => openInvoiceView(bill.invoice_id)} disabled={isLoadingInvoiceDetail}><VisibilityIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="success" title="View Receipt Document" onClick={() => openReceiptDoc(bill)} disabled={isLoadingReceiptDoc}><ReceiptLongIcon fontSize="small" /></IconButton>
                        <IconButton size="small" title="Download Receipt PDF" onClick={() => exportReceipt(bill)}><DownloadIcon fontSize="small" /></IconButton>
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
          {invoiceDetail ? <Button onClick={() => exportInvoice(invoiceDetail)} startIcon={<DownloadIcon />}>Download Invoice PDF</Button> : null}
          {invoiceDetail ? <Button color="info" onClick={() => { setInvoiceViewOpen(false); openInvoiceDoc(invoiceDetail.id); }} startIcon={<ReceiptLongIcon />}>View as Document</Button> : null}
          <Button onClick={() => setInvoiceViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── VIEW INVOICE DOCUMENT ─────────────────────────────────────────── */}
      <Dialog open={invoiceDocOpen} onClose={() => setInvoiceDocOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'rgb(15,52,96)', color: '#fff', fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon sx={{ color: 'rgb(41,182,246)' }} /> AIBOT Platform Invoice
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f4f6fb' }}>
          {invoiceDocPayload ? (() => {
            const inv = invoiceDocPayload.invoice;
            const outstanding = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0));
            const statusColor: Record<string, string> = { paid: '#16a34a', partial: '#ea580c', pending: '#ca8a04', overdue: '#dc2626' };
            const sc = statusColor[(inv.status || 'pending').toLowerCase()] || '#666';
            return (
              <Stack sx={{ p: 0 }}>
                {/* Company Header */}
                <Stack sx={{ bgcolor: 'rgb(15,52,96)', px: 3, pt: 2, pb: 1.5, gap: 0.3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.2 }}>{COMPANY.name}</Typography>
                    <Typography sx={{ color: 'rgb(41,182,246)', fontWeight: 800, fontSize: 22 }}>AIBOT Platform Invoice</Typography>
                  </Stack>
                  {(COMPANY.address || COMPANY.city) && <Typography variant="caption" sx={{ color: 'rgb(180,205,240)' }}>{[COMPANY.address, COMPANY.city].filter(Boolean).join(', ')}</Typography>}
                  <Typography variant="caption" sx={{ color: 'rgb(180,205,240)' }}>
                    {[COMPANY.gstin && `GSTIN: ${COMPANY.gstin}`, COMPANY.pan && `PAN: ${COMPANY.pan}`, COMPANY.phone && `Tel: ${COMPANY.phone}`, COMPANY.email, COMPANY.website].filter(Boolean).join('   |   ')}
                  </Typography>
                </Stack>
                <Stack sx={{ height: 3, bgcolor: 'rgb(41,182,246)' }} />
                {/* Bill To + Invoice Meta */}
                <Grid container sx={{ px: 3, pt: 2, pb: 1 }} spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#eef2ff', border: '1px solid #c7d2f0', borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" sx={{ color: '#5a6e9b', fontWeight: 700, letterSpacing: 1 }}>BILL TO</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f1e41', mt: 0.5 }}>{inv.organization_name}</Typography>
                      <Stack direction="row" alignItems="center" gap={1} mt={1}>
                        <Typography variant="caption" sx={{ bgcolor: sc, color: '#fff', px: 1.2, py: 0.3, borderRadius: 1, fontWeight: 700 }}>{(inv.status || '').toUpperCase()}</Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(15,52,96)', border: 0, borderRadius: 2, height: '100%' }}>
                      {[['Invoice Number', inv.invoice_number], ['Issue Date', dateOnly(inv.issue_date)], ['Due Date', inv.due_date ? dateOnly(inv.due_date) : 'N/A'], ['Billing Period', inv.billing_start_date && inv.billing_end_date ? `${dateOnly(inv.billing_start_date)} – ${dateOnly(inv.billing_end_date)}` : 'N/A']].map(([l, v]) => (
                        <Stack key={l} direction="row" justifyContent="space-between" mb={0.4}>
                          <Typography variant="caption" sx={{ color: 'rgb(160,195,235)', fontWeight: 700 }}>{l}:</Typography>
                          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>{v}</Typography>
                        </Stack>
                      ))}
                    </Paper>
                  </Grid>
                </Grid>
                {/* Items Table */}
                <Stack sx={{ px: 3, pb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'rgb(15,52,96)', mb: 0.5, letterSpacing: 0.5 }}>SUBSCRIBED SERVICES</Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #d0d8ee', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'rgb(15,52,96)' }}>
                        <TableRow>{['#', 'Category', 'Module', 'Sub-Module', 'Billing Unit', 'Qty', 'Credits/Unit', 'Allocated Credits'].map((h) => (<TableCell key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>{h}</TableCell>))}</TableRow>
                      </TableHead>
                      <TableBody>
                        {(inv.items || []).length > 0 ? (inv.items || []).map((item: any, i: number) => (
                          <TableRow key={item.id || i} sx={{ bgcolor: i % 2 === 0 ? '#f5f8ff' : '#fff' }}>
                            <TableCell sx={{ fontSize: 12 }}>{i + 1}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{item.category || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{item.module || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{item.sub_module || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{item.billing_unit || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{item.quantity ?? '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{item.credits_per_unit ?? '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{item.allocated_credits ?? '—'}</TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', color: '#888', fontSize: 12 }}>No line items recorded.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
                {/* Financial Summary */}
                <Stack direction="row" justifyContent="flex-end" sx={{ px: 3, pb: 1 }}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: '#eef2ff', border: '1px solid #c7d2f0', borderRadius: 2, minWidth: 240 }}>
                    {[['Invoice Total', fmtINR(inv.amount), false], ['Amount Paid', fmtINR(inv.paid_amount), false], ['Outstanding Balance', fmtINR(outstanding), outstanding > 0]].map(([l, v, hi]) => (
                      <Stack key={String(l)} direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" sx={{ color: hi ? '#b91c1c' : '#506080', fontWeight: hi ? 700 : 400 }}>{l}:</Typography>
                        <Typography variant="caption" sx={{ color: hi ? '#b91c1c' : 'rgb(15,52,96)', fontWeight: 700 }}>{v as string}</Typography>
                      </Stack>
                    ))}
                  </Paper>
                </Stack>
                {inv.notes && <Typography variant="caption" sx={{ px: 3, pb: 1, color: '#666', fontStyle: 'italic' }}><strong>Notes:</strong> {inv.notes}</Typography>}
                {/* Footer */}
                <Stack sx={{ bgcolor: '#f4f6fb', borderTop: '1px solid #d0d8ee', px: 3, py: 1 }} direction="row" justifyContent="space-between">
                  <Typography variant="caption" sx={{ color: '#999' }}>This is a computer-generated document. No signature required.</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(15,52,96)', fontWeight: 800 }}>Powered by Zentrixel</Typography>
                </Stack>
              </Stack>
            );
          })() : <Typography sx={{ p: 3 }}>Loading...</Typography>}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#f4f6fb' }}>
          {invoiceDocPayload ? <Button variant="contained" onClick={() => generateInvoicePDF(invoiceDocPayload)} startIcon={<DownloadIcon />}>Download PDF</Button> : null}
          <Button onClick={() => setInvoiceDocOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── VIEW RECEIPT DOCUMENT ────────────────────────────────────────── */}
      <Dialog open={receiptDocOpen} onClose={() => setReceiptDocOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'rgb(21,94,54)', color: '#fff', fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon sx={{ color: 'rgb(46,213,115)' }} /> AIBOT Platform Receipt
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f0fdf4' }}>
          {receiptDocPayload ? (() => {
            const bill = receiptDocPayload.bill;
            const inv  = receiptDocPayload.invoice;
            const outstanding = Math.max(0, (inv?.amount || 0) - (inv?.paid_amount || 0));
            return (
              <Stack>
                {/* Company Header */}
                <Stack sx={{ bgcolor: 'rgb(15,52,96)', px: 3, pt: 2, pb: 1.5, gap: 0.3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.2 }}>{COMPANY.name}</Typography>
                    <Typography sx={{ color: 'rgb(46,213,115)', fontWeight: 800, fontSize: 22 }}>AIBOT Platform Receipt</Typography>
                  </Stack>
                  {(COMPANY.address || COMPANY.city) && <Typography variant="caption" sx={{ color: 'rgb(180,205,240)' }}>{[COMPANY.address, COMPANY.city].filter(Boolean).join(', ')}</Typography>}
                  <Typography variant="caption" sx={{ color: 'rgb(180,205,240)' }}>
                    {[COMPANY.gstin && `GSTIN: ${COMPANY.gstin}`, COMPANY.pan && `PAN: ${COMPANY.pan}`, COMPANY.phone && `Tel: ${COMPANY.phone}`, COMPANY.email, COMPANY.website].filter(Boolean).join('   |   ')}
                  </Typography>
                </Stack>
                <Stack sx={{ height: 3, bgcolor: 'rgb(46,213,115)' }} />
                {/* Receipt Details + Received From */}
                <Grid container sx={{ px: 3, pt: 2, pb: 1 }} spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, letterSpacing: 1 }}>RECEIPT DETAILS</Typography>
                      {[['Receipt Number', bill.bill_number], ['Receipt Date', dateOnly(bill.issued_date)], ['Payment Method', bill.payment_method || '—'], ['Reference', bill.payment_reference || '—']].map(([l, v]) => (
                        <Stack key={l} direction="row" justifyContent="space-between" mt={0.8}>
                          <Typography variant="caption" sx={{ color: '#506070', fontWeight: 700 }}>{l}:</Typography>
                          <Typography variant="caption" sx={{ color: '#14321e', fontWeight: 600 }}>{v}</Typography>
                        </Stack>
                      ))}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(15,52,96)', border: 0, borderRadius: 2, height: '100%' }}>
                      <Typography variant="caption" sx={{ color: 'rgb(160,195,235)', fontWeight: 700, letterSpacing: 1 }}>RECEIVED FROM</Typography>
                      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, mt: 0.5 }}>{bill.organization_name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgb(180,205,240)' }}>Against Invoice: {bill.invoice_number}</Typography><br />
                      <Typography variant="caption" sx={{ color: 'rgb(180,205,240)' }}>Invoice Date: {dateOnly(inv?.issue_date)}</Typography><br />
                      <Typography variant="caption" sx={{ color: 'rgb(46,213,115)', fontWeight: 700 }}>Status: {(inv?.status || '').toUpperCase()}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
                {/* Amount Paid highlight */}
                <Stack sx={{ px: 3, pb: 1 }}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(21,94,54)', borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>Amount Paid</Typography>
                      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900 }}>{fmtINR(bill.amount)}</Typography>
                    </Stack>
                  </Paper>
                </Stack>
                {/* Payment description row */}
                <Stack sx={{ px: 3, pb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'rgb(21,94,54)', mb: 0.5, letterSpacing: 0.5 }}>PAYMENT DETAILS</Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'rgb(21,94,54)' }}>
                        <TableRow>{['Description', 'Invoice #', 'Invoice Date', 'Mode', 'Amount Paid'].map((h) => (<TableCell key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>{h}</TableCell>))}</TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow sx={{ bgcolor: '#f0fdf4' }}>
                          <TableCell sx={{ fontSize: 12 }}>Payment received for services rendered — {COMPANY.name}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{bill.invoice_number}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{dateOnly(inv?.issue_date)}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{bill.payment_method || '—'}</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{fmtINR(bill.amount)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
                {/* Invoice Summary */}
                <Stack direction="row" justifyContent="flex-end" sx={{ px: 3, pb: 1 }}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, minWidth: 260 }}>
                    <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, letterSpacing: 0.5 }}>INVOICE SUMMARY</Typography>
                    {[['Invoice Total', fmtINR(inv?.amount)], ['This Payment', fmtINR(bill.amount)], ['Total Paid to Date', fmtINR(inv?.paid_amount)], ['Outstanding Balance', fmtINR(outstanding)]].map(([l, v]) => (
                      <Stack key={String(l)} direction="row" justifyContent="space-between" mt={0.5}>
                        <Typography variant="caption" sx={{ color: '#506070', fontWeight: 600 }}>{l}:</Typography>
                        <Typography variant="caption" sx={{ color: 'rgb(15,52,96)', fontWeight: 700 }}>{v as string}</Typography>
                      </Stack>
                    ))}
                  </Paper>
                </Stack>
                {bill.notes && <Typography variant="caption" sx={{ px: 3, pb: 1, color: '#555', fontStyle: 'italic' }}><strong>Notes:</strong> {bill.notes}</Typography>}
                <Typography variant="caption" sx={{ px: 3, pb: 1, color: '#888', fontStyle: 'italic' }}>This is a computer-generated receipt and does not require a physical signature.</Typography>
                {/* Footer */}
                <Stack sx={{ bgcolor: '#dcfce7', borderTop: '1px solid #bbf7d0', px: 3, py: 1 }} direction="row" justifyContent="space-between">
                  <Typography variant="caption" sx={{ color: '#999' }}>Generated: {new Date(receiptDocPayload.generated_at).toLocaleString('en-IN')}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(15,52,96)', fontWeight: 800 }}>Powered by Zentrixel</Typography>
                </Stack>
              </Stack>
            );
          })() : <Typography sx={{ p: 3 }}>Loading...</Typography>}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#f0fdf4' }}>
          {receiptDocPayload ? <Button variant="contained" color="success" onClick={() => generateReceiptPDF(receiptDocPayload)} startIcon={<DownloadIcon />}>Download PDF</Button> : null}
          <Button onClick={() => setReceiptDocOpen(false)}>Close</Button>
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
