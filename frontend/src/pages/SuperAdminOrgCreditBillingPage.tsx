import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  ListItemIcon,
  ListItemText,
  Menu,
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
  //ToggleButton,
  ToggleButtonGroup,
  Typography,
  Snackbar,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import BoltIcon from "@mui/icons-material/Bolt";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PaymentsIcon from "@mui/icons-material/Payments";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
//import TableRowsIcon from "@mui/icons-material/TableRows";
//import ViewModuleIcon from "@mui/icons-material/ViewModule";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import UndoIcon from "@mui/icons-material/Undo";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import SuperAdminLayout from "../components/Layout/SuperAdminLayout";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import { superadminService } from "../services/superadminService";
import { orgCreditBillingService } from "../services/orgCreditBillingService";
import {
  CreditEstimatorResultListItem,
  SuperAdminOrganization,
} from "../types";
import {
  OrgCredit,
  OrgCreditAutomationRunResponse,
  OrgCreditBalance,
  OrgCreditInvoice,
  OrgCreditInvoiceDocument,
  OrgCreditLapseReport,
  OrgCreditPayment,
  OrgCreditPaymentReceipt,
  OrgCreditPaymentStatus,
  PartialPaymentStrategy,
} from "../types/orgCreditBilling";

type PageTab = "credits" | "invoices" | "payments" | "availability" | "lapse";
type ViewMode = "table" | "cards";
type OrgFilter = "all" | number;
type CreditRowActionsVariant = "card" | "table";

type RowActionsMenuState =
  | {
    kind: "credit";
    variant: CreditRowActionsVariant;
    anchor: HTMLElement;
    row: OrgCredit;
  }
  | {
    kind: "invoice";
    anchor: HTMLElement;
    row: OrgCreditInvoice;
  }
  | {
    kind: "payment";
    anchor: HTMLElement;
    row: OrgCreditPayment;
  };

const toCurrency = (value: number): string =>
  value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const dateLabel = (value?: string | null): string => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

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

const currentMonth = (): string => new Date().toISOString().slice(0, 7);
const currentDate = (): string => new Date().toISOString().slice(0, 10);
const paymentModeOptions = [
  "bank_transfer",
  "upi",
  "cash",
  "card",
  "cheque",
  "wallet",
] as const;

const SuperAdminOrgCreditBillingPage: React.FC = () => {
  const theme = useTheme();
  const [tab, setTab] = useState<PageTab>("credits");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [rowActionsMenu, setRowActionsMenu] =
    useState<RowActionsMenuState | null>(null);

  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>(
    [],
  );
  const [estimators, setEstimators] = useState<CreditEstimatorResultListItem[]>(
    [],
  );
  const [orgCredits, setOrgCredits] = useState<OrgCredit[]>([]);
  const [invoices, setInvoices] = useState<OrgCreditInvoice[]>([]);
  const [payments, setPayments] = useState<OrgCreditPayment[]>([]);
  const [availability, setAvailability] = useState<OrgCreditBalance | null>(
    null,
  );
  const [availabilityOrgId, setAvailabilityOrgId] = useState<number | "">("");
  const [availabilityPeriod, setAvailabilityPeriod] =
    useState<string>(currentMonth());
  const [lapsePeriod, setLapsePeriod] = useState<string>(currentMonth());
  const [lapseMonths, setLapseMonths] = useState<number>(6);
  const [lapseReport, setLapseReport] = useState<OrgCreditLapseReport | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creditError, setCreditError] = useState("");
  const [commitPopupOpen, setCommitPopupOpen] = useState(false);
  const [commitPopupMessage, setCommitPopupMessage] = useState("");
  const [automationResult, setAutomationResult] =
    useState<OrgCreditAutomationRunResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgCredit | null>(null);
  const [createOrgId, setCreateOrgId] = useState<number | "">("");
  const [createEstimatorId, setCreateEstimatorId] = useState<number | null>(null);
  const [createPaymentStatus, setCreatePaymentStatus] =
    useState<OrgCreditPaymentStatus>("unpaid");
  const [createStartDate, setCreateStartDate] = useState<string>("");
  const [createNotes, setCreateNotes] = useState("");
  const [createCustomCredits, setCreateCustomCredits] = useState("");

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupTarget, setTopupTarget] = useState<OrgCredit | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPaymentStatus, setTopupPaymentStatus] =
    useState<OrgCreditPaymentStatus>("unpaid");
  const [topupNotes, setTopupNotes] = useState("");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<OrgCreditInvoice | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCredit, setPaymentCredit] = useState("");
  const [paymentDate, setPaymentDate] = useState(currentDate());
  const [paymentMode, setPaymentMode] =
    useState<(typeof paymentModeOptions)[number]>("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentOtherDetails, setPaymentOtherDetails] = useState("");
  const [paymentStrategy, setPaymentStrategy] =
    useState<PartialPaymentStrategy>("keep_open");
  const [markPaidConfirmOpen, setMarkPaidConfirmOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<OrgCreditInvoice | null>(
    null,
  );
  const [markPaidMode, setMarkPaidMode] =
    useState<(typeof paymentModeOptions)[number]>("bank_transfer");
  const [markPaidReference, setMarkPaidReference] = useState("");
  const [markPaidOtherDetails, setMarkPaidOtherDetails] = useState("");
  const [markPaidDate, setMarkPaidDate] = useState(currentDate());

  const [usageOpen, setUsageOpen] = useState(false);
  const [usageOrgId, setUsageOrgId] = useState<number | "">("");
  const [usageCredit, setUsageCredit] = useState("");
  const [usagePeriod, setUsagePeriod] = useState(currentMonth());

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "credit"; row: OrgCredit }
    | { type: "invoice"; row: OrgCreditInvoice }
    | { type: "payment"; row: OrgCreditPayment }
    | null
  >(null);

  const [invoiceDocumentOpen, setInvoiceDocumentOpen] = useState(false);
  const [invoiceDocument, setInvoiceDocument] =
    useState<OrgCreditInvoiceDocument | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptDocument, setReceiptDocument] =
    useState<OrgCreditPaymentReceipt | null>(null);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<
    { type: "invoice"; id: number } | { type: "receipt"; id: number } | null
  >(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const orgNameById = useMemo(() => {
    const map = new Map<number, string>();
    organizations.forEach((org) => map.set(org.id, org.name));
    return map;
  }, [organizations]);
  const orgById = useMemo(() => {
    const map = new Map<number, SuperAdminOrganization>();
    organizations.forEach((org) => map.set(org.id, org));
    return map;
  }, [organizations]);

  const estimatorLabelById = useMemo(() => {
    const map = new Map<number, string>();
    estimators.forEach((row) =>
      map.set(
        row.id,
        `${row.company_name} | After Buffer: ${row.estimate.recommended_credits} | Payable: ${row.estimate.final_recommended_credits}`,
      ),
    );
    return map;
  }, [estimators]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params =
        orgFilter === "all" ? undefined : { organization_id: orgFilter };
      const [orgRows, estimatorRows, creditRows, invoiceRows, paymentRows] =
        await Promise.all([
          superadminService.listOrganizations(),
          superadminService.listCreditEstimatorResults({
            status_filter: "active",
          }),
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

  useEffect(() => {
    if (tab === "lapse") {
      handleLoadLapseReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, orgFilter]);

  const filteredCredits = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return orgCredits;
    return orgCredits.filter((row) => {
      const orgName = orgNameById.get(row.organization_id) || "";
      const estimatorLabel = estimatorLabelById.get(row.estimator_id) || "";
      return `${orgName} ${estimatorLabel} ${row.billing_month} ${row.payment_status}`
        .toLowerCase()
        .includes(term);
    });
  }, [orgCredits, searchText, orgNameById, estimatorLabelById]);

  const filteredInvoices = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((row) => {
      const orgName = orgNameById.get(row.organization_id) || "";
      return `${orgName} ${row.billing_month} ${row.id}`
        .toLowerCase()
        .includes(term);
    });
  }, [invoices, searchText, orgNameById]);

  const filteredPayments = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return payments;
    return payments.filter((row) => {
      const orgName = orgNameById.get(row.organization_id) || "";
      return `${orgName} ${row.full_partial} ${row.payment_date}`
        .toLowerCase()
        .includes(term);
    });
  }, [payments, searchText, orgNameById]);

  const metrics = useMemo(() => {
    const totalCredit = orgCredits.reduce(
      (sum, row) => sum + (row.total_credit || 0),
      0,
    );
    const openInvoices = invoices.filter(
      (row) => !row.payment_done_flag,
    ).length;
    const paidInvoices = invoices.length - openInvoices;
    const collected = payments.reduce(
      (sum, row) => sum + (row.actual_payment || 0),
      0,
    );
    return { totalCredit, openInvoices, paidInvoices, collected };
  }, [orgCredits, invoices, payments]);

  const resetCreate = () => {
    setEditTarget(null);
    setCreateOrgId("");
    setCreateEstimatorId(null);
    setCreatePaymentStatus("unpaid");
    setCreateStartDate("");
    setCreateNotes("");
    setCreateCustomCredits("");
  };

  const showCommitPopup = (message: string) => {
    setCommitPopupMessage(message);
    setCommitPopupOpen(true);
  };

  const markCommitSuccess = (message: string) => {
    setSuccess(message);
    showCommitPopup(message);
  };

  const handleCreateOrgCredit = async () => {
    if (!createOrgId) {
      setCreditError("Please choose organization");
      return;
    }
    if (createPaymentStatus === "paid" && !createNotes.trim()) {
      setCreditError("Notes are required when payment status is Paid.");
      return;
    }
    const customTrim = createCustomCredits.trim();
    if (customTrim !== "") {
      const customNum = Number(customTrim);
      if (!Number.isFinite(customNum) || customNum <= 0) {
        setCreditError("Customize credits must be a positive number.");
        return;
      }
    }

    if (!createCustomCredits && !createEstimatorId) {
      setCreditError("Either select an estimator or enter custom credits");
      return;
    }

    const savedEditId = editTarget?.id;
    let createdCreditId: number | undefined;
    const customCreditsSnapshot = createCustomCredits.trim();

    setBusyAction(true);
    setCreditError("");
    setSuccess("");
    try {
      const payload = {
        organization_id: createOrgId,
        estimator_id: createEstimatorId,
        total_credits: createCustomCredits.trim() ? Number(createCustomCredits) : undefined,
        billing_cycle: "monthly" as const,
        payment_status: createPaymentStatus,
        billing_start_date: createStartDate || undefined,
        notes: createNotes || undefined,
      };

      if (editTarget) {
        await orgCreditBillingService.editorg(editTarget.id, payload);
        markCommitSuccess(`Org credit #${editTarget.id} updated`);
      } else {
        const result = await orgCreditBillingService.createOrgCredit(payload);
        createdCreditId = result.org_credit.id;
        markCommitSuccess(
          `Org credit #${result.org_credit.id} created with invoice #${result.invoice.id}`,
        );
      }
      setCreateOpen(false);
      resetCreate();
      await loadData();

      const targetId = savedEditId ?? createdCreditId;
      if (targetId != null && customCreditsSnapshot !== "") {
        const n = Number(customCreditsSnapshot);
        if (Number.isFinite(n) && n > 0) {
          setOrgCredits((prev) =>
            prev.map((c) =>
              c.id === targetId ? { ...c, total_credit: n } : c,
            ),
          );
          setSuccess((prev) =>
            prev
              ? `${prev} Customize credits applied in this view only (refresh restores server values).`
              : "Customize credits applied in this view only (refresh restores server values).",
          );
        }
      }
    } catch (createError) {
      setCreditError(parseError(createError));
    } finally {
      setBusyAction(false);
    }
  };

  const openEditDialog = (credit: OrgCredit) => {
    setEditTarget(credit);
    setCreateOrgId(credit.organization_id);
    setCreateEstimatorId(credit.estimator_id);
    setCreatePaymentStatus(credit.payment_status as OrgCreditPaymentStatus);
    setCreateStartDate(credit.billing_start_date);
    setCreateNotes(credit.notes || "");
    setCreateCustomCredits(String(credit.total_credit ?? ""));
    setCreateOpen(true);
  };

  const openTopupDialog = (credit: OrgCredit) => {
    setTopupTarget(credit);
    setTopupAmount("");
    setTopupPaymentStatus("unpaid");
    setTopupNotes("");
    setTopupOpen(true);
  };

  const handleAddTopup = async () => {
    if (!topupTarget) return;
    if (topupPaymentStatus === "paid" && !topupNotes.trim()) {
      setError("Notes are required when payment status is Paid.");
      return;
    }
    const parsed = Number(topupAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Top-up amount must be greater than zero");
      return;
    }
    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      const result = await orgCreditBillingService.addTopup(topupTarget.id, {
        topup_credit: parsed,
        payment_status: topupPaymentStatus,
        notes: topupNotes || undefined,
      });
      setTopupOpen(false);
      markCommitSuccess(
        `Top-up created: credit #${result.org_credit.id}, invoice #${result.invoice.id}`,
      );
      await loadData();
    } catch (topupError) {
      setError(parseError(topupError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleGenerateInvoice = async (orgCreditId: number) => {
    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      const result = await orgCreditBillingService.generateInvoice({
        org_credit_id: orgCreditId,
      });
      markCommitSuccess(`Invoice #${result.id} generated`);
      await loadData();
    } catch (invoiceError) {
      setError(parseError(invoiceError));
    } finally {
      setBusyAction(false);
    }
  };

  const getInvoiceOutstanding = (invoice?: OrgCreditInvoice | null): number => {
    if (!invoice) return 0;
    return Math.max(
      0,
      (invoice.invoice_amount || 0) - (invoice.paid_amount || 0),
    );
  };

  const openMarkPaidFlow = (invoice: OrgCreditInvoice) => {
    setMarkPaidTarget(invoice);
    setMarkPaidMode("bank_transfer");
    setMarkPaidReference("");
    setMarkPaidOtherDetails("");
    setMarkPaidDate(currentDate());
    setMarkPaidConfirmOpen(true);
  };

  const handleInvoiceStatusToggle = async (invoice: OrgCreditInvoice) => {
    if (!invoice.payment_done_flag) {
      openMarkPaidFlow(invoice);
      return;
    }

    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      const updated = await orgCreditBillingService.markInvoicePaymentStatus(
        invoice.id,
        {
          payment_done_flag: false,
        },
      );
      markCommitSuccess(`Invoice #${updated.id} marked as unpaid`);
      await loadData();
    } catch (statusError) {
      setError(parseError(statusError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmMarkPaid = () => {
    if (!markPaidTarget) return;
    setMarkPaidConfirmOpen(false);
    setMarkPaidOpen(true);
  };

  const handleSubmitMarkPaid = async () => {
    if (!markPaidTarget) return;
    const outstanding = getInvoiceOutstanding(markPaidTarget);
    if (outstanding <= 0) {
      setError("This invoice is already fully paid.");
      return;
    }
    if (!markPaidMode) {
      setError("Payment type is required");
      return;
    }
    if (!markPaidReference.trim()) {
      setError("Payment reference number is required");
      return;
    }

    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      const updated = await orgCreditBillingService.markInvoicePaymentStatus(
        markPaidTarget.id,
        {
          payment_done_flag: true,
          payment_date: markPaidDate || undefined,
          payment_mode: markPaidMode,
          payment_reference: markPaidReference.trim(),
          payment_other_details: markPaidOtherDetails || undefined,
        },
      );
      setMarkPaidOpen(false);
      setMarkPaidTarget(null);
      markCommitSuccess(
        `Invoice #${updated.id} marked as paid with full payment (${toCurrency(outstanding)})`,
      );
      await loadData();
    } catch (statusError) {
      setError(parseError(statusError));
    } finally {
      setBusyAction(false);
    }
  };

  const openPaymentDialog = (invoice: OrgCreditInvoice) => {
    setPaymentTarget(invoice);
    setPaymentAmount("");
    setPaymentCredit("");
    setPaymentDate(currentDate());
    setPaymentMode("bank_transfer");
    setPaymentReference("");
    setPaymentOtherDetails("");
    setPaymentStrategy("keep_open");
    setPaymentOpen(true);
  };

  const handlePaymentStrategyChange = (strategy: PartialPaymentStrategy) => {
    setPaymentStrategy(strategy);
    if (strategy === "full_payment" && paymentTarget) {
      const fullAmount = Number(paymentTarget.invoice_amount || 0);
      setPaymentAmount(fullAmount > 0 ? String(fullAmount) : "");
    }
  };

  const handleAddPayment = async () => {
    if (!paymentTarget) return;
    const outstanding = getInvoiceOutstanding(paymentTarget);
    const amount =
      paymentStrategy === "full_payment" ? outstanding : Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Payment amount must be greater than zero");
      return;
    }
    if (!paymentMode) {
      setError("Mode of payment is required");
      return;
    }
    if (!paymentReference.trim()) {
      setError("Reference transaction number is required");
      return;
    }
    const credit = paymentCredit.trim() ? Number(paymentCredit) : undefined;
    if (credit !== undefined && (!Number.isFinite(credit) || credit <= 0)) {
      setError("Actual credit must be greater than zero when provided");
      return;
    }

    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      const result = await orgCreditBillingService.addPayment({
        invoice_id: paymentTarget.id,
        actual_payment: amount,
        actual_credit: credit,
        payment_date: paymentDate || undefined,
        payment_mode: paymentMode,
        payment_reference: paymentReference.trim(),
        payment_other_details: paymentOtherDetails || undefined,
        payment_details: paymentOtherDetails || undefined,
        partial_strategy: paymentStrategy,
      });
      setPaymentOpen(false);
      const generatedMsg = result.generated_invoice
        ? ` and generated invoice #${result.generated_invoice.id}`
        : "";
      markCommitSuccess(
        `Payment #${result.payment.id} recorded${generatedMsg}`,
      );
      await loadData();
    } catch (paymentError) {
      setError(parseError(paymentError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleRunAutomation = async () => {
    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      const result = await orgCreditBillingService.runAutomation();
      setAutomationResult(result);
      markCommitSuccess(
        `Automation complete: evaluated ${result.evaluated_entries}, generated ${result.generated_entries} entries, ${result.generated_invoices} invoices`,
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
      setError("Select organization to view availability");
      return;
    }
    setBusyAction(true);
    setError("");
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

  const handleLoadLapseReport = async () => {
    setBusyAction(true);
    setError("");
    try {
      const report = await orgCreditBillingService.getLapseReport({
        billing_period: lapsePeriod || undefined,
        months: lapseMonths,
        organization_id: orgFilter === "all" ? undefined : orgFilter,
      });
      setLapseReport(report);
      setSuccess(`Loaded lapse report with ${report.rows.length} row(s)`);
    } catch (reportError) {
      setError(parseError(reportError));
    } finally {
      setBusyAction(false);
    }
  };

  const openUsageDialog = () => {
    setUsageOrgId(availabilityOrgId || "");
    setUsagePeriod(availabilityPeriod || currentMonth());
    setUsageCredit("");
    setUsageOpen(true);
  };

  const handleTrackUsage = async () => {
    if (!usageOrgId) {
      setError("Select organization");
      return;
    }
    const used = Number(usageCredit);
    if (!Number.isFinite(used) || used <= 0) {
      setError("Used credit must be greater than zero");
      return;
    }
    setBusyAction(true);
    setError("");
    try {
      const updated = await orgCreditBillingService.trackUsage({
        organization_id: usageOrgId,
        used_credit: used,
        billing_period: usagePeriod || undefined,
      });
      setUsageOpen(false);
      setAvailability(updated);
      markCommitSuccess(
        `Usage tracked. Remaining credit: ${toCurrency(updated.remaining_credit)}`,
      );
      await loadData();
    } catch (usageError) {
      setError(parseError(usageError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      if (deleteTarget.type === "credit") {
        await orgCreditBillingService.deleteOrgCredit(deleteTarget.row.id);
        markCommitSuccess(`Org credit #${deleteTarget.row.id} deleted`);
      } else if (deleteTarget.type === "invoice") {
        await orgCreditBillingService.deleteInvoice(deleteTarget.row.id);
        markCommitSuccess(`Invoice #${deleteTarget.row.id} deleted`);
      } else {
        await orgCreditBillingService.deletePayment(deleteTarget.row.id);
        markCommitSuccess(`Payment #${deleteTarget.row.id} deleted`);
      }
      setDeleteTarget(null);
      await loadData();
    } catch (deleteError) {
      setError(parseError(deleteError));
    } finally {
      setBusyAction(false);
    }
  };

  const openInvoiceDocument = async (invoiceId: number) => {
    setBusyAction(true);
    setError("");
    try {
      const data = await orgCreditBillingService.getInvoiceDocument(invoiceId);
      setInvoiceDocument(data);
      setInvoiceDocumentOpen(true);
    } catch (viewError) {
      setError(parseError(viewError));
    } finally {
      setBusyAction(false);
    }
  };

  const openPaymentReceipt = async (paymentId: number) => {
    setBusyAction(true);
    setError("");
    try {
      const data = await orgCreditBillingService.getPaymentReceipt(paymentId);
      setReceiptDocument(data);
      setReceiptOpen(true);
    } catch (viewError) {
      setError(parseError(viewError));
    } finally {
      setBusyAction(false);
    }
  };

  const openEmailDialog = async (
    target: { type: "invoice"; id: number } | { type: "receipt"; id: number },
  ) => {
    setBusyAction(true);
    setError("");
    try {
      if (target.type === "invoice") {
        const doc = await orgCreditBillingService.getInvoiceDocument(target.id);
        const invoice = doc.invoice;
        const orgEmail =
          doc.organization_admin_email ||
          orgById.get(invoice.organization_id)?.admin_email ||
          "";
        const outstanding = Math.max(
          0,
          doc.outstanding_amount ?? getInvoiceOutstanding(invoice),
        );

        setEmailTo(orgEmail || "");
        setEmailSubject(`Invoice #${invoice.id} - ${doc.organization_name}`);
        setEmailBody(
          [
            `Hello ${doc.organization_name} Team,`,
            "",
            "Please find your invoice details below:",
            `Invoice ID: #${invoice.id}`,
            `Billing Month: ${invoice.billing_month}`,
            `Billing Cycle: ${dateLabel(doc.billing_start_date)} to ${dateLabel(doc.billing_end_date)}`,
            `Amount Payable: ${toCurrency(invoice.invoice_amount)}`,
            `Paid Amount: ${toCurrency(invoice.paid_amount)}`,
            `Outstanding: ${toCurrency(outstanding)}`,
            `Status: ${invoice.payment_done_flag ? "Paid" : "Unpaid"}`,
            "",
            "Regards,",
            "Billing Team",
          ].join("\n"),
        );
      } else {
        const receipt = await orgCreditBillingService.getPaymentReceipt(
          target.id,
        );
        const payment = receipt.payment;
        const invoice = receipt.invoice;
        const orgEmail =
          receipt.organization_admin_email ||
          orgById.get(invoice.organization_id)?.admin_email ||
          "";

        setEmailTo(orgEmail || "");
        setEmailSubject(`Receipt #${payment.id} for Invoice #${invoice.id}`);
        setEmailBody(
          [
            `Hello ${receipt.organization_name} Team,`,
            "",
            "Payment receipt details:",
            `Receipt ID: #${payment.id}`,
            `Invoice ID: #${invoice.id}`,
            `Payment Date: ${dateLabel(payment.payment_date)}`,
            `Payment Type: ${payment.full_partial}`,
            `Mode of Payment: ${payment.payment_mode || "-"}`,
            `Reference Number: ${payment.payment_reference || "-"}`,
            `Amount Paid: ${toCurrency(payment.actual_payment)}`,
            `Credit Applied: ${toCurrency(payment.actual_credit)}`,
            `Other Details: ${payment.payment_other_details || payment.payment_details || "-"}`,
            "",
            "Regards,",
            "Billing Team",
          ].join("\n"),
        );
      }
      setEmailTarget(target);
      setEmailDialogOpen(true);
    } catch (mailError) {
      setError(parseError(mailError));
    } finally {
      setBusyAction(false);
    }
  };

  const handleSendDocumentEmail = async () => {
    if (!emailTarget) return;
    if (!emailTo.trim()) {
      setError("Recipient email is required");
      return;
    }
    setBusyAction(true);
    setError("");
    setSuccess("");
    try {
      if (emailTarget.type === "invoice") {
        const response = await orgCreditBillingService.sendInvoiceEmail(
          emailTarget.id,
          {
            to_email: emailTo.trim(),
            subject: emailSubject || undefined,
            body: emailBody || undefined,
          },
        );
        markCommitSuccess(response.message);
      } else {
        const response = await orgCreditBillingService.sendPaymentReceiptEmail(
          emailTarget.id,
          {
            to_email: emailTo.trim(),
            subject: emailSubject || undefined,
            body: emailBody || undefined,
          },
        );
        markCommitSuccess(response.message);
      }
      setEmailDialogOpen(false);
    } catch (mailError) {
      setError(parseError(mailError));
    } finally {
      setBusyAction(false);
    }
  };

  const currentMonthString = new Date().toISOString().slice(0, 7);

  const closeRowActionsMenu = () => setRowActionsMenu(null);

  return (
    <SuperAdminLayout>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, md: 3 },
          borderRadius: "22px",
          border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          background: `linear-gradient(126deg, ${alpha("#d7f0e9", 0.95)} 0%, ${alpha(
            theme.palette.background.paper,
            0.88,
          )} 57%, ${alpha("#b5d7f2", 0.95)} 100%)`,
          boxShadow: `0 20px 42px ${alpha(theme.palette.primary.dark, 0.24)}`,
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{
                fontWeight: 700,
                letterSpacing: 1.4,
                color: alpha(theme.palette.text.primary, 0.72),
              }}
            >
              New Billing System
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.12 }}>
              Org Credit, Invoicing & Payments
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.8, color: alpha(theme.palette.text.primary, 0.76) }}
            >
              Estimator-driven credits with monthly cycle automation, top-ups,
              invoices, partial payments, and live credit availability.
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.1}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => {
                resetCreate();
                setCreateOpen(true);
              }}
              disabled={busyAction}
            >
              Create Org Credit
            </Button>
            {/* <Button
              variant="outlined"
              startIcon={<AutorenewIcon />}
              onClick={loadData}
              disabled={loading || busyAction}
            >
              Refresh
            </Button> */}
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<BoltIcon />}
              onClick={handleRunAutomation}
              disabled={busyAction}
            >
              Run Automation
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Snackbar
        open={Boolean(success || error)}
        autoHideDuration={4000}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{
          zIndex: 999999999,
        }}
      >
        <Alert
          severity={error ? "error" : "success"}
          onClose={() => {
            setError("");
            setSuccess("");
          }}
          sx={{
            borderRadius: "14px",
            boxShadow: (theme) =>
              `0 10px 18px ${error ? theme.palette.error.dark : theme.palette.success.dark
              }20`,
            zIndex: 999999999,
          }}
        >
          {error || success}
        </Alert>
      </Snackbar>
      {automationResult ? (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          onClose={() => setAutomationResult(null)}
        >
          Evaluated: {automationResult.evaluated_entries}, Entries:{" "}
          {automationResult.generated_entries}, Invoices:{" "}
          {automationResult.generated_invoices}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 2.6 }}>
        {[
          {
            label: "Total Credits",
            value: toCurrency(metrics.totalCredit),
            icon: <LocalAtmIcon color="primary" />,
          },
          {
            label: "Open Invoices",
            value: String(metrics.openInvoices),
            icon: <ReceiptLongIcon color="warning" />,
          },
          {
            label: "Paid Invoices",
            value: String(metrics.paidInvoices),
            icon: <ReceiptLongIcon color="success" />,
          },
          {
            label: "Collections",
            value: toCurrency(metrics.collected),
            icon: <PaymentsIcon color="secondary" />,
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
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha(theme.palette.text.primary, 0.7),
                        fontWeight: 600,
                      }}
                    >
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

      <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", mb: 2.2 }}>
        <Grid container spacing={1.3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Organization Filter</InputLabel>
              <Select
                value={orgFilter}
                label="Organization Filter"
                onChange={(event) => {
                  const value = event.target.value;
                  setOrgFilter(value === "all" ? "all" : Number(value));
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
              onChange={(_, value: ViewMode | null) =>
                value && setViewMode(value)
              }
              fullWidth
            >
              {/* <ToggleButton value="table">
                <TableRowsIcon sx={{ mr: 0.6 }} /> Table
              </ToggleButton>
              <ToggleButton value="cards">
                <ViewModuleIcon sx={{ mr: 0.6 }} /> Cards
              </ToggleButton> */}
              <Button
                variant="outlined"
                startIcon={<AutorenewIcon />}
                onClick={loadData}
                disabled={loading || busyAction}
                sx={{
                  ml: "auto",
                  px: 2.5,
                  py: 1,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  width: ["100px", "120px"],
                }}
              >
                Refresh
              </Button>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: "16px", overflow: "hidden" }}>
        <Tabs
          value={tab}
          onChange={(_, value: PageTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1.2,
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          }}
        >
          <Tab
            value="credits"
            label={`Org Credits (${filteredCredits.length})`}
          />
          <Tab
            value="invoices"
            label={`Invoices (${filteredInvoices.length})`}
          />
          <Tab
            value="payments"
            label={`Payments (${filteredPayments.length})`}
          />
          <Tab value="availability" label="Credit Availability" />
          <Tab
            value="lapse"
            label={`Lapse (${lapseReport?.rows.length || 0})`}
          />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === "credits" && viewMode === "cards" ? (
            <Grid container spacing={1.4}>
              {filteredCredits.map((row) => (
                <Grid item xs={12} md={6} xl={4} key={row.id}>
                  <Card variant="outlined" sx={{ borderRadius: "14px" }}>
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          #{row.id}
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            row.is_topup
                              ? "Top-up"
                              : row.is_auto_generated
                                ? "Auto Cycle"
                                : "Base"
                          }
                          color={
                            row.is_topup
                              ? "secondary"
                              : row.is_auto_generated
                                ? "warning"
                                : "primary"
                          }
                          variant="outlined"
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Organization:</strong>{" "}
                        {orgNameById.get(row.organization_id) ||
                          `Org #${row.organization_id}`}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Estimator:</strong>{" "}
                        {row.estimator_id ? (
                          estimatorLabelById.get(row.estimator_id) ||
                          `Estimator #${row.estimator_id}`) : "N/A"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Billing:</strong> {row.billing_month} (
                        {dateLabel(row.billing_start_date)} to{" "}
                        {dateLabel(row.billing_end_date)})
                      </Typography>
                      <Typography variant="body2">
                        <strong>Total Credit:</strong>{" "}
                        {toCurrency(row.total_credit)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Payment:</strong> {row.payment_status}
                      </Typography>
                      <Box
                        sx={{
                          mt: 1.4,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.75,
                        }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SettingsIcon fontSize="small" />}
                          onClick={(event) =>
                            setRowActionsMenu({
                              kind: "credit",
                              variant: "card",
                              anchor: event.currentTarget,
                              row,
                            })
                          }
                          disabled={busyAction}
                          sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                          Actions
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : null}

          {tab === "credits" && viewMode === "table" ? (
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
                      <TableCell>
                        {orgNameById.get(row.organization_id) ||
                          `Org #${row.organization_id}`}
                      </TableCell>
                      <TableCell>
                        {row.estimator_id ? (
                          estimatorLabelById.get(row.estimator_id) ||
                          `Estimator #${row.estimator_id}`
                        ) : "N/A"}
                      </TableCell>
                      <TableCell>{toCurrency(row.total_credit)}</TableCell>
                      <TableCell>{row.billing_month}</TableCell>
                      <TableCell>
                        {row.is_topup
                          ? "Top-up"
                          : row.is_auto_generated
                            ? "Auto"
                            : "Base"}
                      </TableCell>
                      <TableCell>{row.payment_status}</TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            py: 0.25,
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon fontSize="small" />}
                            onClick={(event) =>
                              setRowActionsMenu({
                                kind: "credit",
                                variant: "table",
                                anchor: event.currentTarget,
                                row,
                              })
                            }
                            disabled={busyAction}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                          >
                            Actions
                          </Button>
                        </Box>
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

          {tab === "invoices" ? (
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
                    const outstanding = Math.max(
                      0,
                      (row.invoice_amount || 0) - (row.paid_amount || 0),
                    );
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>#{row.id}</TableCell>
                        <TableCell>
                          {orgNameById.get(row.organization_id) ||
                            `Org #${row.organization_id}`}
                        </TableCell>
                        <TableCell>#{row.org_credit_id}</TableCell>
                        <TableCell>{row.billing_month}</TableCell>
                        <TableCell>{toCurrency(row.invoice_amount)}</TableCell>
                        <TableCell>{toCurrency(row.paid_amount)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              row.payment_done_flag
                                ? "Paid"
                                : `Open (${toCurrency(outstanding)})`
                            }
                            color={
                              row.payment_done_flag ? "success" : "warning"
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              py: 0.25,
                            }}
                          >
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<SettingsIcon fontSize="small" />}
                              onClick={(event) =>
                                setRowActionsMenu({
                                  kind: "invoice",
                                  anchor: event.currentTarget,
                                  row,
                                })
                              }
                              disabled={busyAction}
                              sx={{ textTransform: "none", fontWeight: 600 }}
                            >
                              Actions
                            </Button>
                          </Box>
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

          {tab === "payments" ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Payment ID</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Invoice ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Actual Payment</TableCell>
                    <TableCell>Actual Credit</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>#{row.id}</TableCell>
                      <TableCell>
                        {orgNameById.get(row.organization_id) ||
                          `Org #${row.organization_id}`}
                      </TableCell>
                      <TableCell>#{row.invoice_id}</TableCell>
                      <TableCell>{row.full_partial}</TableCell>
                      <TableCell>{row.payment_mode || "-"}</TableCell>
                      <TableCell>{row.payment_reference || "-"}</TableCell>
                      <TableCell>{toCurrency(row.actual_payment)}</TableCell>
                      <TableCell>{toCurrency(row.actual_credit)}</TableCell>
                      <TableCell>{dateLabel(row.payment_date)}</TableCell>
                      <TableCell>
                        {row.payment_other_details ||
                          row.payment_details ||
                          "-"}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            py: 0.25,
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon fontSize="small" />}
                            onClick={(event) =>
                              setRowActionsMenu({
                                kind: "payment",
                                anchor: event.currentTarget,
                                row,
                              })
                            }
                            disabled={busyAction}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                          >
                            Actions
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredPayments.length ? (
                    <TableRow>
                      <TableCell colSpan={11}>
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

          {tab === "availability" ? (
            <Stack spacing={2}>
              <Grid container spacing={1.2}>
                <Grid item xs={12} md={5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Organization</InputLabel>
                    <Select
                      value={availabilityOrgId}
                      label="Organization"
                      onChange={(event) =>
                        setAvailabilityOrgId(Number(event.target.value))
                      }
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
                    onChange={(event) =>
                      setAvailabilityPeriod(event.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      onClick={handleFetchAvailability}
                      disabled={busyAction}
                    >
                      Get Availability
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={openUsageDialog}
                      disabled={!availability || busyAction}
                    >
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
                        <Typography variant="caption">
                          Remaining Credit
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 800,
                            color:
                              availability.remaining_credit < 0
                                ? "error.main"
                                : "success.main",
                          }}
                        >
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

          {tab === "lapse" ? (
            <Stack spacing={2}>
              <Grid container spacing={1.2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    fullWidth
                    type="month"
                    label="End Period"
                    InputLabelProps={{ shrink: true }}
                    value={lapsePeriod}
                    onChange={(event) => setLapsePeriod(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Months"
                    inputProps={{ min: 1, max: 24 }}
                    value={lapseMonths}
                    onChange={(event) =>
                      setLapseMonths(
                        Math.max(
                          1,
                          Math.min(24, Number(event.target.value) || 1),
                        ),
                      )
                    }
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      onClick={handleLoadLapseReport}
                      disabled={busyAction}
                    >
                      Load Lapse Report
                    </Button>
                  </Stack>
                </Grid>
              </Grid>

              <Typography variant="body2" color="text.secondary">
                Unused credit is treated as lapsed after month end. No rollover
                is applied to next month.
              </Typography>

              {lapseReport ? (
                <>
                  <Grid container spacing={1.2}>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="caption">
                            Total Lapsed Credit
                          </Typography>
                          <Typography
                            variant="h5"
                            sx={{ fontWeight: 800, color: "warning.main" }}
                          >
                            {toCurrency(lapseReport.total_lapsed_credit)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="caption">
                            Periods Covered
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {lapseReport.months}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="caption">End Period</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {lapseReport.end_period}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Organization</TableCell>
                          <TableCell>Period</TableCell>
                          <TableCell>Total Credit</TableCell>
                          <TableCell>Used Credit</TableCell>
                          <TableCell>Remaining</TableCell>
                          <TableCell>Lapsed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lapseReport.rows.map((row, idx) => (
                          <TableRow
                            key={`${row.organization_id}-${row.billing_period}-${idx}`}
                          >
                            <TableCell>
                              {row.organization_name ||
                                `Org #${row.organization_id}`}
                            </TableCell>
                            <TableCell>{row.billing_period}</TableCell>
                            <TableCell>
                              {toCurrency(row.total_credit)}
                            </TableCell>
                            <TableCell>{toCurrency(row.used_credit)}</TableCell>
                            <TableCell>
                              {toCurrency(row.remaining_credit)}
                            </TableCell>
                            <TableCell>
                              <Typography
                                component="span"
                                sx={{
                                  color:
                                    row.lapsed_credit > 0
                                      ? "warning.main"
                                      : "text.primary",
                                  fontWeight: 700,
                                }}
                              >
                                {toCurrency(row.lapsed_credit)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!lapseReport.rows.length ? (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Typography variant="body2" sx={{ py: 1 }}>
                                No lapse data found for selected period range.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Click "Load Lapse Report" to view organization-wise monthly
                  credit lapse.
                </Typography>
              )}
            </Stack>
          ) : null}
        </Box>
      </Paper>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editTarget ? "Edit Org Credit Entry" : "Create Org Credit Entry"}
        </DialogTitle>
        <DialogContent>
          {creditError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {creditError}
            </Alert>
          )}
          <Grid container spacing={1.4} sx={{ mt: 0.1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Organization</InputLabel>
                <Select
                  value={createOrgId}
                  label="Organization"
                  onChange={(event) =>
                    setCreateOrgId(Number(event.target.value))
                  }
                >
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
                <Select
                  value={createEstimatorId}
                  label="Estimator"
                  onChange={(event) => {
                    setCreateEstimatorId(Number(event.target.value));

                    // Clear custom credits when estimator selected
                    setCreateCustomCredits("");
                  }}
                >
                  {estimators.map((est) => (
                    <MenuItem key={est.id} value={est.id}>
                      {est.company_name} - After Buffer{" "}
                      {est.estimate.recommended_credits} - Payable{" "}
                      {est.estimate.final_recommended_credits}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="body2"
                align="center"
                sx={{
                  color: "text.secondary",
                  fontWeight: 700,
                  letterSpacing: 2,
                  py: 0.35,
                }}
              >
                OR
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Credits"
                value={createCustomCredits}
                onChange={(event) => {
                  setCreateCustomCredits(event.target.value);

                  // Clear estimator when custom credits entered
                  if (event.target.value !== "") {
                    setCreateEstimatorId(null);
                  }
                }}
                inputProps={{ min: 0, step: "any" }}
              />
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
                  onChange={(event) =>
                    setCreatePaymentStatus(
                      event.target.value as OrgCreditPaymentStatus,
                    )
                  }
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
                required={createPaymentStatus === "paid"}
                value={createNotes}
                onChange={(event) => setCreateNotes(event.target.value)}
                error={createPaymentStatus === "paid" && !createNotes.trim()}
                helperText={
                  createPaymentStatus === "paid"
                    ? "Notes are required."
                    : undefined
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateOrgCredit}
            disabled={busyAction}
          >
            {editTarget ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add Top-up Credit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.2 }}>
            Target: #{topupTarget?.id} (
            {orgNameById.get(topupTarget?.organization_id || 0) || "-"})
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
              onChange={(event) =>
                setTopupPaymentStatus(
                  event.target.value as OrgCreditPaymentStatus,
                )
              }
            >
              <MenuItem value="unpaid">Unpaid</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            fullWidth
            label="Notes"
            required={topupPaymentStatus === "paid"}
            value={topupNotes}
            onChange={(event) => setTopupNotes(event.target.value)}
            error={topupPaymentStatus === "paid" && !topupNotes.trim()}
            helperText={
              topupPaymentStatus === "paid" ? "Notes are required." : undefined
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTopupOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddTopup}
            disabled={busyAction}
          >
            Add Top-up
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Register Invoice Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.3 }}>
            Invoice #{paymentTarget?.id} | Amount{" "}
            {paymentTarget ? toCurrency(paymentTarget.invoice_amount) : "-"} |
            Outstanding{" "}
            {paymentTarget
              ? toCurrency(getInvoiceOutstanding(paymentTarget))
              : "-"}
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
                disabled={paymentStrategy === "full_payment"}
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
                <InputLabel>Payment Strategy</InputLabel>
                <Select
                  value={paymentStrategy}
                  label="Payment Strategy"
                  onChange={(event) =>
                    handlePaymentStrategyChange(
                      event.target.value as PartialPaymentStrategy,
                    )
                  }
                >
                  <MenuItem value="full_payment">Full Payment</MenuItem>
                  <MenuItem value="keep_open">Keep Invoice Open</MenuItem>
                  <MenuItem value="create_invoice">
                    Create New Remaining Invoice
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Mode of Payment</InputLabel>
                <Select
                  value={paymentMode}
                  label="Mode of Payment"
                  onChange={(event) =>
                    setPaymentMode(
                      event.target.value as (typeof paymentModeOptions)[number],
                    )
                  }
                >
                  {paymentModeOptions.map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {mode.replace("_", " ").toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Reference Transaction Number"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Other Details"
                value={paymentOtherDetails}
                onChange={(event) => setPaymentOtherDetails(event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddPayment}
            disabled={busyAction}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={markPaidConfirmOpen}
        onClose={() => {
          setMarkPaidConfirmOpen(false);
          setMarkPaidTarget(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Confirm Full Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 0.8 }}>
            This option only work for full payment of invoice, are you sure full
            payment of invoice is done?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMarkPaidConfirmOpen(false);
              setMarkPaidTarget(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmMarkPaid}
            disabled={busyAction}
          >
            Yes, Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={markPaidOpen}
        onClose={() => {
          setMarkPaidOpen(false);
          setMarkPaidTarget(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Mark Invoice Paid</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.3 }}>
            Invoice #{markPaidTarget?.id} | Full payment amount{" "}
            {toCurrency(getInvoiceOutstanding(markPaidTarget))}
          </Typography>
          <Grid container spacing={1.2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Type</InputLabel>
                <Select
                  value={markPaidMode}
                  label="Payment Type"
                  onChange={(event) =>
                    setMarkPaidMode(
                      event.target.value as (typeof paymentModeOptions)[number],
                    )
                  }
                >
                  {paymentModeOptions.map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {mode.replace("_", " ").toUpperCase()}
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
                label="Payment Date"
                InputLabelProps={{ shrink: true }}
                value={markPaidDate}
                onChange={(event) => setMarkPaidDate(event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Payment Reference Number"
                value={markPaidReference}
                onChange={(event) => setMarkPaidReference(event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                size="small"
                fullWidth
                label="Other Details"
                value={markPaidOtherDetails}
                onChange={(event) =>
                  setMarkPaidOtherDetails(event.target.value)
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMarkPaidOpen(false);
              setMarkPaidTarget(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitMarkPaid}
            disabled={busyAction}
          >
            Mark Paid
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Track Credit Usage</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.2} sx={{ mt: 0.1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Organization</InputLabel>
                <Select
                  value={usageOrgId}
                  label="Organization"
                  onChange={(event) =>
                    setUsageOrgId(Number(event.target.value))
                  }
                >
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
          <Button
            variant="contained"
            onClick={handleTrackUsage}
            disabled={busyAction}
          >
            Track
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={invoiceDocumentOpen}
        onClose={() => setInvoiceDocumentOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Invoice Document</DialogTitle>
        <DialogContent>
          {invoiceDocument ? (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.6, md: 2.4 },
                borderRadius: "14px",
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                background: "#fff",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={1.5}
                sx={{
                  pb: 1.8,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    TAX INVOICE
                  </Typography>
                  <Typography variant="body2">
                    Invoice #{invoiceDocument.invoice.id}
                  </Typography>
                  <Typography variant="body2">
                    Date: {dateLabel(invoiceDocument.invoice.invoice_date)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Zentrixel Billing
                  </Typography>
                  <Typography variant="body2">
                    {invoiceDocument.organization_name}
                  </Typography>
                  <Typography variant="body2">
                    {invoiceDocument.organization_admin_email || "-"}
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.6} sx={{ mt: 0.8 }}>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.4 }}
                  >
                    Bill To
                  </Typography>
                  <Typography variant="body2">
                    {invoiceDocument.organization_name}
                  </Typography>
                  <Typography variant="body2">
                    Estimator: {invoiceDocument.estimator_name || "-"}
                  </Typography>
                  <Typography variant="body2">
                    Billing Month: {invoiceDocument.invoice.billing_month}
                  </Typography>
                  <Typography variant="body2">
                    Cycle: {dateLabel(invoiceDocument.billing_start_date)} to{" "}
                    {dateLabel(invoiceDocument.billing_end_date)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.4 }}
                  >
                    Payment Summary
                  </Typography>
                  <Typography variant="body2">
                    Status:{" "}
                    {invoiceDocument.invoice.payment_done_flag
                      ? "Paid"
                      : "Unpaid"}
                  </Typography>
                  <Typography variant="body2">
                    Total Credit (After Buffer):{" "}
                    {toCurrency(invoiceDocument.invoice.total_credit)}
                  </Typography>
                  <Typography variant="body2">
                    Amount Payable:{" "}
                    {toCurrency(invoiceDocument.invoice.invoice_amount)}
                  </Typography>
                  <Typography variant="body2">
                    Paid Amount:{" "}
                    {toCurrency(invoiceDocument.invoice.paid_amount)}
                  </Typography>
                  <Typography variant="body2">
                    Outstanding:{" "}
                    {toCurrency(invoiceDocument.outstanding_amount)}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer
                sx={{
                  mt: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                  borderRadius: "10px",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Payment #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoiceDocument.payments.map((paymentRow) => (
                      <TableRow key={paymentRow.id}>
                        <TableCell>#{paymentRow.id}</TableCell>
                        <TableCell>
                          {dateLabel(paymentRow.payment_date)}
                        </TableCell>
                        <TableCell>{paymentRow.payment_mode || "-"}</TableCell>
                        <TableCell>
                          {paymentRow.payment_reference || "-"}
                        </TableCell>
                        <TableCell align="right">
                          {toCurrency(paymentRow.actual_payment)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!invoiceDocument.payments.length ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" sx={{ py: 0.6 }}>
                            No payments recorded for this invoice.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1.4, color: "text.secondary" }}
              >
                Generated:{" "}
                {new Date(invoiceDocument.generated_at).toLocaleString()}
              </Typography>
            </Paper>
          ) : (
            <Typography variant="body2">No invoice data.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoiceDocumentOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Payment Receipt</DialogTitle>
        <DialogContent>
          {receiptDocument ? (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.6, md: 2.4 },
                borderRadius: "14px",
                border: `1px solid ${alpha(theme.palette.success.main, 0.28)}`,
                background: "#fff",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={1.5}
                sx={{
                  pb: 1.8,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    PAYMENT RECEIPT
                  </Typography>
                  <Typography variant="body2">
                    Receipt #{receiptDocument.payment.id}
                  </Typography>
                  <Typography variant="body2">
                    Date: {dateLabel(receiptDocument.payment.payment_date)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Zentrixel Billing
                  </Typography>
                  <Typography variant="body2">
                    Reference Invoice #{receiptDocument.invoice.id}
                  </Typography>
                  <Typography variant="body2">
                    {receiptDocument.organization_admin_email || "-"}
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.6} sx={{ mt: 0.8 }}>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.4 }}
                  >
                    Received From
                  </Typography>
                  <Typography variant="body2">
                    {receiptDocument.organization_name}
                  </Typography>
                  <Typography variant="body2">
                    Estimator: {receiptDocument.estimator_name || "-"}
                  </Typography>
                  <Typography variant="body2">
                    Billing Cycle:{" "}
                    {dateLabel(receiptDocument.billing_start_date)} to{" "}
                    {dateLabel(receiptDocument.billing_end_date)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.4 }}
                  >
                    Payment Method
                  </Typography>
                  <Typography variant="body2">
                    Type: {receiptDocument.payment.full_partial}
                  </Typography>
                  <Typography variant="body2">
                    Mode: {receiptDocument.payment.payment_mode || "-"}
                  </Typography>
                  <Typography variant="body2">
                    Reference:{" "}
                    {receiptDocument.payment.payment_reference || "-"}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer
                sx={{
                  mt: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                  borderRadius: "10px",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        Invoice Amount (Invoice #{receiptDocument.invoice.id})
                      </TableCell>
                      <TableCell align="right">
                        {toCurrency(receiptDocument.invoice.invoice_amount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Actual Payment Received</TableCell>
                      <TableCell align="right">
                        {toCurrency(receiptDocument.payment.actual_payment)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Actual Credit Applied</TableCell>
                      <TableCell align="right">
                        {toCurrency(receiptDocument.payment.actual_credit)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>
                        Outstanding After Receipt
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {toCurrency(
                          Math.max(
                            0,
                            receiptDocument.invoice.invoice_amount -
                            receiptDocument.invoice.paid_amount,
                          ),
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Box
                sx={{
                  mt: 1.5,
                  p: 1.2,
                  borderRadius: "10px",
                  backgroundColor: alpha(theme.palette.success.light, 0.12),
                }}
              >
                <Typography variant="body2">
                  <strong>Other Details:</strong>{" "}
                  {receiptDocument.payment.payment_other_details ||
                    receiptDocument.payment.payment_details ||
                    "-"}
                </Typography>
              </Box>

              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                sx={{ mt: 2 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Generated:{" "}
                  {new Date(receiptDocument.generated_at).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Authorized Billing Receipt
                </Typography>
              </Stack>
            </Paper>
          ) : (
            <Typography variant="body2">No receipt data.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Send Document by Email</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="To Email"
            value={emailTo}
            onChange={(event) => setEmailTo(event.target.value)}
            sx={{ mt: 1, mb: 1.3 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Subject (optional)"
            value={emailSubject}
            onChange={(event) => setEmailSubject(event.target.value)}
            sx={{ mb: 1.3 }}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={3}
            label="Message (optional)"
            value={emailBody}
            onChange={(event) => setEmailBody(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendDocumentEmail}
            disabled={busyAction}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={commitPopupOpen}
        onClose={() => setCommitPopupOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Commit Successful</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 0.8 }}>
            {commitPopupMessage}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCommitPopupOpen(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={rowActionsMenu?.anchor ?? null}
        open={Boolean(rowActionsMenu)}
        onClose={closeRowActionsMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {rowActionsMenu?.kind === "credit" &&
          rowActionsMenu.variant === "card" ? (
          <>
            {rowActionsMenu.row.payment_status === "unpaid" ? (
              <MenuItem
                onClick={() => {
                  openTopupDialog(rowActionsMenu.row);
                  closeRowActionsMenu();
                }}
                disabled={
                  busyAction ||
                  rowActionsMenu.row.billing_month !== currentMonthString
                }
              >
                <ListItemIcon>
                  <TrendingUpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Add Top-up</ListItemText>
              </MenuItem>
            ) : null}
            {rowActionsMenu.row.payment_status === "paid" ? (
              <MenuItem
                onClick={() => {
                  handleGenerateInvoice(rowActionsMenu.row.id);
                  closeRowActionsMenu();
                }}
                disabled={
                  busyAction ||
                  rowActionsMenu.row.billing_month !== currentMonthString
                }
              >
                <ListItemIcon>
                  <ReceiptLongIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Generate Invoice</ListItemText>
              </MenuItem>
            ) : null}
            <MenuItem
              onClick={() => {
                openEditDialog(rowActionsMenu.row);
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>

            {rowActionsMenu.row.payment_status !== "paid" ? (
              <MenuItem
                onClick={() => {
                  setDeleteTarget({ type: "credit", row: rowActionsMenu.row });
                  closeRowActionsMenu();
                }}
                disabled={busyAction}
                sx={{ color: "error.main" }}
              >
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            ) : null}
          </>
        ) : null}

        {rowActionsMenu?.kind === "credit" &&
          rowActionsMenu.variant === "table" ? (
          <>
            {rowActionsMenu.row.payment_status === "paid" &&
              !rowActionsMenu.row.is_topup ? (
              <MenuItem
                onClick={() => {
                  openTopupDialog(rowActionsMenu.row);
                  closeRowActionsMenu();
                }}
                disabled={
                  busyAction ||
                  rowActionsMenu.row.billing_month !== currentMonthString
                }
              >
                <ListItemIcon>
                  <TrendingUpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Top-up</ListItemText>
              </MenuItem>
            ) : null}
            {rowActionsMenu.row.payment_status === "unpaid" ? (
              <MenuItem
                onClick={() => {
                  handleGenerateInvoice(rowActionsMenu.row.id);
                  closeRowActionsMenu();
                }}
                disabled={
                  busyAction ||
                  rowActionsMenu.row.billing_month !== currentMonthString
                }
              >
                <ListItemIcon>
                  <ReceiptLongIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Invoice</ListItemText>
              </MenuItem>
            ) : null}
            {rowActionsMenu.row.payment_status === "unpaid" ? (
              <MenuItem
                onClick={() => {
                  openEditDialog(rowActionsMenu.row);
                  closeRowActionsMenu();
                }}
                disabled={busyAction}
              >
                <ListItemIcon>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            ) : null}
            {rowActionsMenu.row.payment_status !== "paid" ? (
              <MenuItem
                onClick={() => {
                  setDeleteTarget({ type: "credit", row: rowActionsMenu.row });
                  closeRowActionsMenu();
                }}
                disabled={busyAction}
                sx={{ color: "error.main" }}
              >
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            ) : null}
          </>
        ) : null}

        {rowActionsMenu?.kind === "invoice" ? (
          <>
            <MenuItem
              onClick={() => {
                handleInvoiceStatusToggle(rowActionsMenu.row);
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                {rowActionsMenu.row.payment_done_flag ? (
                  <UndoIcon fontSize="small" />
                ) : (
                  <CheckCircleOutlineIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {rowActionsMenu.row.payment_done_flag
                  ? "Mark Unpaid"
                  : "Mark Paid"}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                openPaymentDialog(rowActionsMenu.row);
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                <PaymentsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Add Payment</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                openInvoiceDocument(rowActionsMenu.row.id);
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                <VisibilityIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                openEmailDialog({ type: "invoice", id: rowActionsMenu.row.id });
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                <EmailOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Email</ListItemText>
            </MenuItem>

            {!rowActionsMenu.row.payment_done_flag ? (
              <MenuItem
                onClick={() => {
                  setDeleteTarget({ type: "invoice", row: rowActionsMenu.row });
                  closeRowActionsMenu();
                }}
                disabled={busyAction}
                sx={{ color: "error.main" }}
              >
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            ) : null}
          </>
        ) : null}

        {rowActionsMenu?.kind === "payment" ? (
          <>
            <MenuItem
              onClick={() => {
                openPaymentReceipt(rowActionsMenu.row.id);
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                <VisibilityIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                openEmailDialog({
                  type: "receipt",
                  id: rowActionsMenu.row.id,
                });
                closeRowActionsMenu();
              }}
              disabled={busyAction}
            >
              <ListItemIcon>
                <EmailOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Email</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setDeleteTarget({ type: "payment", row: rowActionsMenu.row });
                closeRowActionsMenu();
              }}
              disabled={busyAction}
              sx={{ color: "error.main" }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </>
        ) : null}
      </Menu>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === "credit"
            ? "Delete org credit entry?"
            : deleteTarget?.type === "invoice"
              ? "Delete invoice?"
              : "Delete payment?"
        }
        description={
          deleteTarget?.type === "credit"
            ? `This will delete org credit #${deleteTarget.row.id} and related invoices/payments.`
            : deleteTarget?.type === "invoice"
              ? `This will delete invoice #${deleteTarget.row.id} and related payments.`
              : deleteTarget
                ? `This will delete payment #${deleteTarget.row.id}.`
                : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={busyAction}
        onCancel={() => !busyAction && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {loading ? (
        <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
          Loading data...
        </Typography>
      ) : null}
    </SuperAdminLayout>
  );
};

export default SuperAdminOrgCreditBillingPage;
