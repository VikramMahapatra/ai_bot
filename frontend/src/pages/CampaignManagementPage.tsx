import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  LinearProgress,
  InputAdornment,
  Drawer,
  IconButton,
  Card,
  CardContent,
  Menu,
  ListItemIcon,
  Tooltip,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  FormHelperText,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import { alpha, useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VisibilityIcon from "@mui/icons-material/Visibility";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CampaignIcon from "@mui/icons-material/Campaign";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CodeIcon from "@mui/icons-material/Code";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import KeyboardDoubleArrowUpIcon from "@mui/icons-material/KeyboardDoubleArrowUp";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AdminLayout from "../components/Layout/AdminLayout";
import {
  campaignService,
  CampaignItem,
  CampaignToLeadRule,
  CampaignToLeadRunResult,
  ContactItem,
  ContactListItem,
  CampaignReportsSummary,
  DashboardStats,
  CreateCampaignPayload,
  CampaignSequence,
} from "../services/campaignService";
import { Product, productService } from "../services/productService";
import { FEATURE_CODES, CREDIT_ERRORS } from "../types/creditModules";
import { useCredits } from "../context/CreditsContext";
import { useDateFormatter } from "../hooks/useDateFormatter";
import {
  messageTemplateService,
  Template,
} from "../services/messageTemplateService";
import { generatePreview } from "./TemplatePage";
import EmailIcon from "@mui/icons-material/Email";
import CallIcon from "@mui/icons-material/Call";
import SearchIcon from "@mui/icons-material/Search";
import { formatDate } from "../utils/dateUtils";
import Field from "../components/Common/Field";
import CloseIcon from "@mui/icons-material/Close";
import { useAuth } from "../context/AuthContext";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import { ConfirmDialog } from "../components/Common/ConfirmDialog";
import { EmailSetting } from "./SettingsPage";
import { organizationService } from "../services/organizationService";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import TableRowsIcon from "@mui/icons-material/TableRows";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { SourceChip } from "../components/Common/StatusChips";
import { callCampaignService } from "../services/callCampaignService";
import RefreshIcon from "@mui/icons-material/Refresh";

const IST_TIME_ZONE = "Asia/Kolkata";


const parseApiDate = (value?: string): Date | null => {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  let normalized = raw.replace(" ", "T");
  const hasExplicitTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized);
  if (!hasExplicitTimezone) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const convertIstLocalInputToUtcIso = (value?: string): string | undefined => {
  if (!value) return undefined;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  // datetime-local has no timezone; we interpret it as IST and convert to UTC.
  const utcMillis = Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0);
  return new Date(utcMillis).toISOString();
};

const statusColor = (status: string) => {
  if (status === "completed") return "success";
  if (status === "running") return "primary";
  if (status === "scheduled") return "warning";
  if (status === "failed") return "error";
  if (status === "paused") return "default";
  return "default";
};

const isPlayDisabled = (status: string) => {
  return status === "completed" || status === "running" || status === "pending_execution";
};

const isDeleteDisabled = (status?: string) => {
  return status === "running" || status === "completed";
};

const isPauseDisabled = (status: string) => {
  return (
    status === "draft" ||
    status === "completed" ||
    status === "paused" ||
    status === "scheduled" ||
    status === "failed"
  );
};

const logStatusColor = (
  status: string,
): "default" | "success" | "error" | "warning" | "info" => {
  if (status === "failed" || status === "bounced" || status === "complained")
    return "error";
  if (status === "unsubscribed") return "warning";
  if (status === "opened" || status === "read" || status === "clicked")
    return "info";
  if (status === "sent" || status === "delivered") return "success";
  return "default";
};

const looksLikeHtml = (value: string) => /<\s*[a-zA-Z][^>]*>/.test(value || "");

const buildEmailStarterTemplate = (campaignName?: string) =>
  `
<h2 style="margin:0 0 12px; color:#183153;">${campaignName?.trim() || "Special Offer Just For You"}</h2>
<p style="margin:0 0 12px;">Hi {{first_name}},</p>
<p style="margin:0 0 14px;">We are excited to share this update from <strong>{{campaign_name}}</strong>.</p>

<div style="background:#f5f9ff; border:1px solid #d7e5fb; border-radius:10px; padding:14px; margin:0 0 14px;">
  <p style="margin:0 0 8px;"><strong>What you get:</strong></p>
  <ul style="margin:0; padding-left:20px;">
    <li>Priority support and faster onboarding</li>
    <li>Campaign setup guidance from our team</li>
    <li>Special promotional pricing this week</li>
  </ul>
</div>

<p style="margin:0 0 16px;">Reply to this email and our team will help you get started.</p>

<a href="https://example.com" style="display:inline-block; padding:10px 18px; border-radius:8px; text-decoration:none; background:#3b7ddd; color:#ffffff; font-weight:600;">
  Get Started
</a>

<p style="margin:16px 0 0; font-size:13px; color:#5d7194;">You are receiving this message because you are part of our outreach list.</p>
`.trim();

const CAMPAIGN_EMAIL_MERGE_TAG_HELP =
  "Merge tags: {{name}}, {{first_name}}, {{campaign_name}}";

const ensureFive = (items: string[]) => {
  const next = [...items];
  while (next.length < 5) next.push("");
  return next.slice(0, 5);
};

const getContactListLabel = (list: ContactListItem) => {
  const autoTag = list.is_agent_auto_list ? " • Auto" : "";
  return `${list.list_name}${autoTag} (${list.contact_count})`;
};

const getContactListDescription = (list: ContactListItem) => {
  if (list.description) return list.description;
  if (list.is_agent_auto_list) {
    const widgetSuffix = list.agent_widget_id
      ? ` for agent ${list.agent_widget_id}`
      : "";
    return `Auto-created from appointment bookings${widgetSuffix}`;
  }
  return "-";
};

type CreateCampaignFieldErrors = {
  campaignName: boolean;
  emailSubject: boolean;
  emailBody: boolean;
  promptContext: boolean;
  contactList: boolean;
  activeDays: boolean;
  startTime: boolean;
  endTime: boolean;
  sequences: boolean;
  scheduleDate: boolean;
};

const EMPTY_CREATE_CAMPAIGN_ERRORS: CreateCampaignFieldErrors = {
  campaignName: false,
  emailSubject: false,
  emailBody: false,
  promptContext: false,
  contactList: false,
  activeDays: false,
  startTime: false,
  endTime: false,
  sequences: false,
  scheduleDate: false
};

const DEFAULT_SCHEDULE_DETAILS = {
  "active_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "start_time": "09:00",
  "end_time": "18:00"
}

const CampaignManagementPage: React.FC = () => {
  const theme = useTheme();
  const { getRequiredCredits, totalCredits, refreshCredits } = useCredits();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dashboard, setDashboard] = useState<DashboardStats>({
    campaign_count: 0,
    total_sent: 0,
    total_failed: 0,
    status_counts: {},
    recent_campaigns: [],
  });

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<CampaignItem[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(10);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignTypeFilter, setCampaignTypeFilter] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("");
  const [campaignProductFilter, setCampaignProductFilter] = useState<
    number | ""
  >("");

  const [contactLists, setContactLists] = useState<ContactListItem[]>([]);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactPage, setContactPage] = useState(0);
  const [contactRowsPerPage, setContactRowsPerPage] = useState(10);
  const [contactSearch, setContactSearch] = useState("");

  const [createCampaignName, setCreateCampaignName] = useState("");
  const [createCampaignType, setCreateCampaignType] = useState<
    "email" | "whatsapp" | "sms"
  >("email");
  const [products, setProducts] = useState<Product[]>([]);
  const [createProductId, setCreateProductId] = useState<number | "">("");
  const [createCategory, setCreateCategory] = useState<string | "">("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCode, setNewProductCode] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [emailContentMode, setEmailContentMode] = useState<"manual" | "prompt">(
    "manual",
  );
  const [emailSubject, setEmailSubject] = useState("");
  const [emailPromptContext, setEmailPromptContext] = useState("");
  const [generatedSubjects, setGeneratedSubjects] = useState<string[]>([]);
  const [generatedBodies, setGeneratedBodies] = useState<string[]>([]);
  const [generatingEmailVariants, setGeneratingEmailVariants] = useState(false);
  const [spamScoreLoading, setSpamScoreLoading] = useState(false);
  const [spamScoreResult, setSpamScoreResult] = useState<{
    overall: {
      average_spam_score: number;
      highest_spam_score: number;
      high_risk_count: number;
    };
    combinations: Array<{
      combo_index: number;
      subject_index: number;
      body_index: number;
      spam_score: number;
      risk_level: "low" | "medium" | "high";
      reasons: string[];
      suggestions: string[];
    }>;
    fallback_used?: boolean;
  } | null>(null);
  const [createMessageTemplate, setCreateMessageTemplate] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [openTrackingEnabled, setOpenTrackingEnabled] = useState(false);
  const [clickTrackingEnabled, setClickTrackingEnabled] = useState(false);
  const [footerDisplayEnabled, setFooterDisplayEnabled] = useState(false);
  const [selectedSmtpProfileIds, setSelectedSmtpProfileIds] = useState<number[]>([]);
  const [activeDays, setActiveDays] = useState<string[]>(DEFAULT_SCHEDULE_DETAILS.active_days);
  const [startTime, setStartTime] = useState(DEFAULT_SCHEDULE_DETAILS.start_time);
  const [endTime, setEndTime] = useState(DEFAULT_SCHEDULE_DETAILS.end_time);

  const [campaignSequences, setCampaignSequences] = useState<CampaignSequence[]>([
    {
      sequence_order: 1,
      gap_days: 0,
      template_id: null,
    },
  ]);

  const [emailEditorMode, setEmailEditorMode] = useState<"plain" | "html">(
    "plain",
  );
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [createScheduledTime, setCreateScheduledTime] = useState("");
  const [createContactListId, setCreateContactListId] = useState<number | null>(null);
  const [previewContactListId, setPreviewContactListId] = useState<number | null>(null);
  const [createCampaignErrors, setCreateCampaignErrors] =
    useState<CreateCampaignFieldErrors>(EMPTY_CREATE_CAMPAIGN_ERRORS);
  const spamTableContainerRef = useRef<HTMLDivElement | null>(null);
  const [spamVisibleStart, setSpamVisibleStart] = useState(0);
  const spamRowsPerView = 7;

  const [previewContacts, setPreviewContacts] = useState<ContactItem[]>([]);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewContactTotal, setPreviewContactTotal] = useState(0);
  const [previewContactPage, setPreviewContactPage] = useState(0);
  const [previewContactRowsPerPage, setPreviewContactRowsPerPage] = useState(10);
  const secondSectionRef = useRef<HTMLDivElement | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "">("");
  const [runConfirmCampaign, setRunConfirmCampaign] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState("");
  const [logRunSequence, setLogRunSequence] = useState<number | "">("");
  const [logs, setLogs] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [logRowsPerPage, setLogRowsPerPage] = useState(10);

  const [reportDays, setReportDays] = useState(30);
  const [reportData, setReportData] = useState<CampaignReportsSummary | null>(
    null,
  );

  const [c2lTab, setC2lTab] = useState(0);
  const [c2lRule, setC2lRule] = useState<CampaignToLeadRule | null>(null);
  const [c2lSaving, setC2lSaving] = useState(false);
  const [c2lDryRun, setC2lDryRun] = useState(true);
  const [c2lRunCampaignId, setC2lRunCampaignId] = useState<number | "">("");
  const [c2lRunLimit, setC2lRunLimit] = useState(500);
  const [c2lRunResult, setC2lRunResult] =
    useState<CampaignToLeadRunResult | null>(null);
  const [c2lConversions, setC2lConversions] = useState<any[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const formatDisplayDate = useDateFormatter();
  const { featureFlags } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [editingCampaignId, setEditingCampaignId] =
    useState<number | null>(null);
  const [logSearchText, setLogSearchText] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [smtpProfiles, setSmtpProfiles] = useState<EmailSetting[]>([]);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState<any>(null);
  const [campaignView, setCampaignView] = useState<"table" | "calendar">("table");
  const [eventMenu, setEventMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    campaign: any;
  }>({
    open: false,
    x: 0,
    y: 0,
    campaign: null,
  });
  const [menuType, setMenuType] = useState<"calendar" | "table" | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const isEditMode = editingCampaignId !== null;

  const handleActionClick = (event: any, item: any) => {
    setAnchorEl(event.currentTarget);
    setMenuType("table");
    setSelectedCampaign(item);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedCampaign(null);
    setEventMenu((prev) => ({
      ...prev,
      open: false,
    }));
  };


  const statusSummary = useMemo(() => {
    const ordered = [
      "draft",
      "scheduled",
      "running",
      "completed",
      "failed",
      "paused",
    ];
    return ordered.map((key) => ({
      key,
      value: dashboard.status_counts?.[key] || 0,
    }));
  }, [dashboard.status_counts]);

  const totalStatusCount = useMemo(
    () => statusSummary.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [statusSummary],
  );

  const dashboardHealth = useMemo(() => {
    const sent = Number(dashboard.total_sent || 0);
    const failed = Number(dashboard.total_failed || 0);
    const attempts = sent + failed;

    const completed = Number(dashboard.status_counts?.completed || 0);
    const running = Number(dashboard.status_counts?.running || 0);
    const scheduled = Number(dashboard.status_counts?.scheduled || 0);

    return {
      deliveryRate: attempts > 0 ? (sent * 100) / attempts : 0,
      failureRate: attempts > 0 ? (failed * 100) / attempts : 0,
      completionShare:
        totalStatusCount > 0 ? (completed * 100) / totalStatusCount : 0,
      pipelineLoad:
        totalStatusCount > 0
          ? ((running + scheduled) * 100) / totalStatusCount
          : 0,
    };
  }, [
    dashboard.total_sent,
    dashboard.total_failed,
    dashboard.status_counts,
    totalStatusCount,
  ]);

  const pageContainerSx = {
    maxWidth: 1380,
    mx: "auto",
    px: { xs: 0, md: 0.5 },
    position: "relative",
  } as const;

  const sectionPanelSx = {
    borderRadius: "18px",
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82,
    )} 68%, ${alpha("#dce8f8", 0.78)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)",
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  } as const;

  const compactInputSx = {
    "& .MuiInputBase-root": {
      minHeight: 40,
    },
  } as const;

  const compactButtonSx = {
    minHeight: 40,
    px: 1.8,
    whiteSpace: "nowrap",
  } as const;

  const campaignKpis = [
    {
      label: "Total Campaigns",
      value: dashboard.campaign_count.toLocaleString(),
      hint: "All created campaigns",
      icon: <ListAltIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha("#9cc3f3", 0.64)} 0%, ${alpha("#dce9ff", 0.76)} 100%)`,
      wave: theme.palette.primary.main,
    },
    {
      label: "Messages Sent",
      value: dashboard.total_sent.toLocaleString(),
      hint: "Delivered across runs",
      icon: <SendRoundedIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha("#9fcbf6", 0.64)} 0%, ${alpha("#deedff", 0.76)} 100%)`,
      wave: theme.palette.success.main,
    },
    {
      label: "Messages Failed",
      value: dashboard.total_failed.toLocaleString(),
      hint: "Needs retry or review",
      icon: <ErrorOutlineIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha("#a9d2fb", 0.64)} 0%, ${alpha("#e3f0ff", 0.78)} 100%)`,
      wave: theme.palette.error.main,
    },
  ];

  const showError = (message: string) => {
    setSuccess("");
    setError(message);
  };

  const showSuccess = (message: string) => {
    setError("");
    setSuccess(message);
  };

  const loadDashboard = async () => {
    const data = await campaignService.getDashboardStats();
    setDashboard(data);
  };

  const loadCampaigns = async () => {
    const data = await campaignService.listCampaigns({
      search: campaignSearch || undefined,
      campaign_type: (campaignTypeFilter || undefined) as any,
      status: (campaignStatusFilter || undefined) as any,
      product_id: campaignProductFilter
        ? Number(campaignProductFilter)
        : undefined,
      skip: campaignPage * campaignRowsPerPage,
      limit: campaignRowsPerPage,
    });
    setCampaigns(data.items || []);
    setCampaignTotal(data.pagination?.total || 0);
  };

  useEffect(() => {
    if (campaignView === "table") {
      loadCampaigns();
    }
  }, [campaignView]);

  const fetchCalendarCampaigns = async (
    from: Date,
    to: Date
  ) => {
    const response = await campaignService.listCampaignsForCalendar({
      from_date: from.toISOString(),
      to_date: to.toISOString(),
      search: campaignSearch || undefined,
      campaign_type: (campaignTypeFilter || undefined) as any,
      status: (campaignStatusFilter || undefined) as any,
      product_id: campaignProductFilter
        ? Number(campaignProductFilter)
        : undefined
    });
    setCampaigns(response.items);
  };

  const loadCampaignLookup = async () => {
    const data = await campaignService.getCampaignLookup();
    setAllCampaigns(data || []);
  };

  const loadContactLists = async () => {
    const data = await callCampaignService.getContactLists();
    setContactLists(data || []);
  };

  const loadProducts = async () => {
    const data = await productService.productLookup();
    setProducts(data || []);
  };

  const loadTemplateLookup = async () => {
    const data = await messageTemplateService.templateLookup();
    console.log("Loaded templates:", data);
    setMessageTemplates(data || []);
  };

  const loadOrgSmtpProfiles = async () => {
    const data = await organizationService.getOrgEmailSettings();
    setSmtpProfiles(data);
  };

  const loadContacts = async (contactListId: number) => {
    const data = await campaignService.listContacts(contactListId, {
      search: contactSearch || undefined,
      skip: contactPage * contactRowsPerPage,
      limit: contactRowsPerPage,
    });
    setContacts(data.items || []);
    setContactTotal(data.pagination?.total || 0);
  };

  const loadPreviewContacts = async (contactListId: number) => {
    const data = await campaignService.listContacts(contactListId, {
      search: previewSearch || undefined,
      skip: previewContactPage * previewContactRowsPerPage,
      limit: previewContactRowsPerPage,
    });
    setPreviewContacts(data.items || []);
    setPreviewContactTotal(data.pagination?.total || 0);
  };

  const handlePreviewTemplate = (templateId: number | null) => {
    if (!templateId) return;

    const template = messageTemplates?.find(
      (template) => Number(template.id) === Number(templateId)
    );

    if (!template) return;

    setSelectedPreviewTemplate(template);
    setTemplatePreviewOpen(true);
  };

  const loadLogs = async (campaignId: number) => {
    const data = await campaignService.listCampaignLogs(campaignId, {
      status: logStatusFilter || undefined,
      run_sequence: logRunSequence === "" ? undefined : Number(logRunSequence),
      search: logSearchText,
      skip: logPage * logRowsPerPage,
      limit: logRowsPerPage,
    });
    setLogs(data.items || []);
    setLogTotal(data.pagination?.total || 0);
  };

  const loadReports = async () => {
    const data = await campaignService.getCampaignReportsSummary({
      days: reportDays,
    });
    setReportData(data);
  };

  const loadC2LRule = async () => {
    const data = await campaignService.getCampaignToLeadRule();
    setC2lRule(data);
  };

  const loadC2LConversions = async () => {
    const data = await campaignService.listCampaignToLeadConversions({
      campaign_id:
        c2lRunCampaignId === "" ? undefined : Number(c2lRunCampaignId),
      skip: 0,
      limit: 50,
    });
    setC2lConversions(data.items || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadDashboard(),
        loadCampaigns(),
        loadCampaignLookup(),
        loadContactLists(),
        loadProducts(),
        loadTemplateLookup(),
        loadOrgSmtpProfiles()
      ]);
    } catch (err: any) {
      showError(
        err?.response?.data?.detail || "Failed to load campaign module data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await loadCampaigns();
      } catch (err: any) {
        showError(err?.response?.data?.detail || "Failed to load campaigns");
      }
    };
    run();
  }, [campaignPage, campaignRowsPerPage]);


  useEffect(() => {
    if (!selectedListId) return;
    const run = async () => {
      try {
        await loadContacts(Number(selectedListId));
      } catch (err: any) {
        showError(err?.response?.data?.detail || "Failed to load contacts");
      }
    };
    run();
  }, [selectedListId, contactPage, contactRowsPerPage]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const run = async () => {
      try {
        await loadLogs(Number(selectedCampaignId));
      } catch (err: any) {
        showError(
          err?.response?.data?.detail || "Failed to load campaign logs",
        );
      }
    };
    run();
  }, [selectedCampaignId, logPage, logRowsPerPage]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const run = async () => {
      try {
        await loadLogs(Number(selectedCampaignId));
      } catch (err: any) {
        showError(
          err?.response?.data?.detail || "Failed to load campaign logs",
        );
      }
    };
    run();
  }, [selectedCampaignId, logPage, logRowsPerPage]);

  useEffect(() => {
    if (tab !== 4) return;
    const run = async () => {
      try {
        await loadReports();
      } catch (err: any) {
        showError(
          err?.response?.data?.detail || "Failed to load campaign reports",
        );
      }
    };
    run();
  }, [tab, reportDays]);

  useEffect(() => {
    if (tab !== 5) return;
    const run = async () => {
      try {
        await Promise.all([loadC2LRule(), loadC2LConversions()]);
      } catch (err: any) {
        showError(
          err?.response?.data?.detail ||
          "Failed to load Campaign to Lead module",
        );
      }
    };
    run();
  }, [tab]);

  useEffect(() => {
    if (!createContactListId) {
      setPreviewContacts([]);
      return;
    }

    const run = async () => {
      try {
        await loadPreviewContacts(Number(createContactListId));
      } catch {
        setPreviewContacts([]);
      }
    };
    run();
  }, [previewSearch, previewContactPage, previewContactRowsPerPage]);

  const handleRefresh = async () => {
    try {
      setLoading(true);

      if (campaignView === "calendar") {
        const calendarApi = calendarRef.current?.getApi();

        if (calendarApi) {
          const currentStart = calendarApi.view.currentStart;
          const currentEnd = calendarApi.view.currentEnd;

          await fetchCalendarCampaigns(currentStart, currentEnd);
        }
      } else {
        await loadCampaigns();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCampaignFilters = async () => {
    setCampaignPage(0);
    setLoading(true);
    try {
      await loadCampaigns();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to filter campaigns");
    } finally {
      setLoading(false);
    }
  };

  const getSequenceCampaignName = (index: number) => {
    const sequenceName = `Sequence ${index + 1}`;

    return createCampaignName?.trim()
      ? `${createCampaignName.trim()} - ${sequenceName}`
      : sequenceName;
  };

  const downloadTextFile = (
    filename: string,
    content: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsvValue = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportRowsToCsv = (
    filename: string,
    headers: string[],
    rows: unknown[][],
  ) => {
    const csv = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    downloadTextFile(filename, csv, "text/csv");
  };

  const handleCreateProductFromCampaign = async () => {
    if (!newProductName.trim()) {
      showError("Product name is required");
      return;
    }
    if (!newProductCode.trim()) {
      showError("Product code is required");
      return;
    }

    setCreatingProduct(true);
    try {
      const response = await productService.createProduct({
        name: newProductName.trim(),
        code: newProductCode.trim(),
        description: newProductDescription.trim(),
      });

      if (!response.success) {
        showError(response.message || "Failed to create product");
        return;
      }

      const refreshed = await productService.productLookup();
      setProducts(refreshed || []);

      const selected = (refreshed || []).find(
        (item) =>
          item.code.toLowerCase() === newProductCode.trim().toLowerCase(),
      );
      if (selected?.id) {
        setCreateProductId(selected.id);
      }

      setNewProductName("");
      setNewProductCode("");
      setNewProductDescription("");
      setProductDialogOpen(false);
      showSuccess("Product added successfully");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to create product");
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleTemplateFileUpload = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setCreateMessageTemplate(content);
      if (looksLikeHtml(content)) {
        setEmailEditorMode("html");
      }
      showSuccess("Template loaded from file");
    };
    reader.readAsText(file);
  };

  const handleLoadHtmlStarter = () => {
    setEmailEditorMode("html");
    setCreateMessageTemplate(buildEmailStarterTemplate(createCampaignName));
    setShowEmailPreview(true);
    setSuccess("HTML starter template loaded");
  };

  const validateCreditsForGeneration = (
    featureCode: string,
    quantity?: number,
  ): boolean => {
    const credits = getRequiredCredits(featureCode) * (quantity || 1);
    if (totalCredits < credits) {
      setError(CREDIT_ERRORS.INSUFFICIENT_CREDITS);
      return false;
    }
    return true;
  };

  const handleGeneratePromptEmailVariants = async () => {
    if (!emailPromptContext.trim()) {
      showError("Prompt context is required to generate email variants");
      return;
    }

    setGeneratingEmailVariants(true);
    setError("");

    if (!validateCreditsForGeneration(FEATURE_CODES.CMP_AI_CONTENT_GEN)) {
      return;
    }

    try {
      const result = await campaignService.generateEmailVariants({
        campaign_name: createCampaignName || "Campaign",
        prompt_context: emailPromptContext,
      });

      setGeneratedSubjects(result.subjects || []);
      setGeneratedBodies(result.bodies || []);
      setSpamScoreResult(null);
      setSpamVisibleStart(0);
      setCreateCampaignErrors((prev) => ({
        ...prev,
        promptContext: false,
        emailSubject: false,
      }));

      if ((result.bodies || []).length > 0) {
        setCreateMessageTemplate(result.bodies[0]);
      }
      if ((result.subjects || []).length > 0) {
        setEmailSubject(result.subjects[0]);
      }

      setShowEmailPreview(true);
      showSuccess(
        `Generated ${result.subjects?.length || 0} subjects and ${result.bodies?.length || 0} bodies.`,
      );
    } catch (err: any) {
      showError(
        err?.response?.data?.detail ||
        "Failed to generate prompt-based email content",
      );
    } finally {
      setGeneratingEmailVariants(false);
    }
  };

  const handleScorePromptEmailSpam = async () => {
    if (!emailPromptContext.trim()) {
      setCreateCampaignErrors((prev) => ({ ...prev, promptContext: true }));
      showError("Prompt context is required before spam scoring");
      return;
    }

    const subjects = ensureFive(generatedSubjects)
      .map((item) => item.trim())
      .filter(Boolean);
    const bodies = ensureFive(generatedBodies)
      .map((item) => item.trim())
      .filter(Boolean);

    if (subjects.length < 5 || bodies.length < 5) {
      showError("Generate 5x5 variants first, then run spam score");
      return;
    }

    setSpamScoreLoading(true);
    setError("");

    if (!validateCreditsForGeneration(FEATURE_CODES.CMP_AI_SPAM_CHECK)) {
      return;
    }

    try {
      const result = await campaignService.scoreEmailSpamRisk({
        campaign_name: createCampaignName || "Campaign",
        prompt_context: emailPromptContext,
        subjects: ensureFive(generatedSubjects),
        bodies: ensureFive(generatedBodies),
      });
      setSpamScoreResult(result);
      setSpamVisibleStart(0);
      showSuccess(
        `Spam score complete. Avg: ${result.overall.average_spam_score}, Highest: ${result.overall.highest_spam_score}, High risk combos: ${result.overall.high_risk_count}.`,
      );
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to evaluate spam score");
    } finally {
      setSpamScoreLoading(false);
    }
  };

  const handleScrollSpamTable = (
    direction: "up" | "down" | "top" | "bottom",
  ) => {
    const total = spamScoreResult?.combinations?.length || 0;
    const maxStart = Math.max(0, total - spamRowsPerView);

    if (direction === "top") {
      setSpamVisibleStart(0);
      return;
    }
    if (direction === "bottom") {
      setSpamVisibleStart(maxStart);
      return;
    }
    if (direction === "up") {
      setSpamVisibleStart((prev) => Math.max(0, prev - spamRowsPerView));
      return;
    }
    setSpamVisibleStart((prev) => Math.min(maxStart, prev + spamRowsPerView));
  };

  const handleEditGeneratedSubject = (index: number, value: string) => {
    setGeneratedSubjects((prev) => {
      const next = ensureFive(prev);
      next[index] = value;
      if (index === 0) {
        setEmailSubject(value);
      }
      return next;
    });
  };

  const handleEditGeneratedBody = (index: number, value: string) => {
    setGeneratedBodies((prev) => {
      const next = ensureFive(prev);
      next[index] = value;
      if (index === 0) {
        setCreateMessageTemplate(value);
      }
      return next;
    });
  };

  const getFeatureCodeForCampaignType = (type: string): string => {
    switch (type) {
      case "email":
        return "CMP_EMAIL_SEND";
      case "whatsapp":
        return "CMP_WA_CONVERSATION";
      case "sms":
        return "CMP_SMS_SEGMENT";
      default:
        return "CMP_EMAIL_SEND";
    }
  };

  const getCampaignPayload = (): CreateCampaignPayload => {
    const configuredSequences = campaignSequences.filter(
      (sequence) =>
        Number(sequence.gap_days) > 0 || (sequence.template_id !== null &&
          sequence.template_id !== undefined &&
          Number(sequence.template_id) > 0)
    );

    return {
      campaign_name: createCampaignName,
      campaign_type: createCampaignType,
      message_template_id: selectedTemplate
        ? Number(selectedTemplate.id)
        : undefined,

      message_template:
        createCampaignType === "email"
          ? emailContentMode === "prompt"
            ? generatedBodies[0] ||
            createMessageTemplate ||
            "Generated campaign body"
            : createMessageTemplate
          : createMessageTemplate,

      scheduled_time: convertIstLocalInputToUtcIso(createScheduledTime),

      contact_list_id: Number(createContactListId),

      product_id: createProductId
        ? Number(createProductId)
        : undefined,

      category: createCategory || undefined,

      open_tracking_enabled: openTrackingEnabled,
      click_tracking_enabled: clickTrackingEnabled,
      footer_display_enabled: footerDisplayEnabled,

      selected_smtp_profile_ids:
        createCampaignType === "email" && selectedSmtpProfileIds.length > 0
          ? selectedSmtpProfileIds
          : undefined,
      active_days: activeDays ?? undefined,
      start_time: startTime ?? undefined,
      end_time: endTime ?? undefined,

      status: createScheduledTime
        ? "scheduled"
        : "draft",

      email_content_mode:
        createCampaignType === "email"
          ? emailContentMode
          : undefined,

      email_subject:
        createCampaignType === "email"
          ? emailSubject || createCampaignName
          : undefined,

      email_prompt_context:
        createCampaignType === "email" &&
          emailContentMode === "prompt"
          ? emailPromptContext
          : undefined,

      email_subject_variants:
        createCampaignType === "email" &&
          emailContentMode === "prompt"
          ? generatedSubjects
          : undefined,

      email_body_variants:
        createCampaignType === "email" &&
          emailContentMode === "prompt"
          ? generatedBodies
          : undefined,
      sequences:
        !isEditMode && configuredSequences.length > 0
          ? configuredSequences.map((sequence) => ({
            sequence_order: Number(sequence.sequence_order),
            gap_days: Number(sequence.gap_days),
            template_id: Number(sequence.template_id),
          }))
          : undefined,
    }
  };

  const validateCampaign = () => {
    const configuredSequences = campaignSequences.filter(
      (sequence) =>
        Number(sequence.gap_days) > 0 || (sequence.template_id !== null &&
          sequence.template_id !== undefined &&
          Number(sequence.template_id) > 0)
    );

    const hasSequences = !isEditMode && configuredSequences.length > 0;

    const nextErrors: CreateCampaignFieldErrors = {
      campaignName: !createCampaignName.trim(),
      emailSubject:
        createCampaignType === "email"
          ? !emailSubject.trim()
          : false,

      emailBody:
        createCampaignType === "email" &&
          emailContentMode === "manual"
          ? !createMessageTemplate.trim()
          : createCampaignType !== "email"
            ? !createMessageTemplate.trim()
            : false,

      promptContext:
        createCampaignType === "email" &&
          emailContentMode === "prompt"
          ? !emailPromptContext.trim()
          : false,

      contactList: !createContactListId,

      activeDays: activeDays.length === 0,
      startTime: !startTime,
      endTime: !endTime,
      sequences: false,
      scheduleDate: hasSequences
        ? !createScheduledTime
        : false,
    };


    if (startTime && endTime) {
      if (startTime >= endTime) {
        nextErrors.startTime = true;
        nextErrors.endTime = true;
      }
    }


    if (configuredSequences.length > 0 && !isEditMode) {
      const sequenceOrders = new Set<number>();

      for (const sequence of configuredSequences) {

        // sequence order
        if (
          !Number.isInteger(sequence.sequence_order) ||
          sequence.sequence_order <= 0
        ) {
          nextErrors.sequences = true;
          break;
        }

        // duplicate sequence order
        if (sequenceOrders.has(sequence.sequence_order)) {
          nextErrors.sequences = true;
          break;
        }

        sequenceOrders.add(sequence.sequence_order);

        // gap days
        if (
          !Number.isInteger(sequence.gap_days) ||
          sequence.gap_days <= 0
        ) {
          nextErrors.sequences = true;
          break;
        }

        if (
          !Number.isInteger(Number(sequence.template_id)) ||
          Number(sequence.template_id) <= 0
        ) {
          nextErrors.sequences = true;
          break;
        }
      }
    }

    setCreateCampaignErrors(nextErrors);

    console.log("Validation errors:", nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  const handleCreateCampaign = async () => {
    if (!validateCampaign()) {
      return;
    }

    setLoading(true);

    try {
      await campaignService.createCampaign(
        getCampaignPayload()
      );

      resetCampaignForm();

      showSuccess("Campaign created");

      await Promise.all([
        loadCampaigns(),
        loadCampaignLookup(),
        loadDashboard(),
      ]);

      setTab(2);
    } catch (err: any) {
      showError(
        err?.response?.data?.detail ||
        "Failed to create campaign"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaignId) {
      return;
    }

    if (!validateCampaign()) {
      return;
    }

    setLoading(true);

    try {
      await campaignService.updateCampaign(
        editingCampaignId,
        getCampaignPayload()
      );

      setEditingCampaignId(null);

      resetCampaignForm();

      showSuccess("Campaign updated");

      await Promise.all([
        loadCampaigns(),
        loadCampaignLookup(),
        loadDashboard(),
      ]);

      setTab(2);
    } catch (err: any) {
      showError(
        err?.response?.data?.detail ||
        "Failed to update campaign"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCampaignId(null);
    resetCampaignForm();
    setTab(2);
  };

  const handleRunCampaign = async (campaignId: number) => {
    setLoading(true);
    try {
      const result = await campaignService.runCampaign(campaignId);
      showSuccess(result.message);
      await Promise.all([loadCampaigns(), loadDashboard()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to run campaign");
    } finally {
      setLoading(false);
    }
  };

  const confirmRunCampaign = async () => {
    if (!runConfirmCampaign) return;
    const { id } = runConfirmCampaign;
    setRunConfirmCampaign(null);
    await handleRunCampaign(id);
  };

  const handlePauseCampaign = async (campaignId: number) => {
    setLoading(true);
    try {
      await campaignService.pauseCampaign(campaignId);
      showSuccess("Campaign paused");
      await Promise.all([loadCampaigns(), loadDashboard()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to pause campaign");
    } finally {
      setLoading(false);
    }
  };

  const resetCampaignForm = () => {
    setEditingCampaignId(null);

    // Reset form
    setCreateCampaignName("");
    setCreateMessageTemplate("");
    setEmailSubject("");
    setEmailPromptContext("");
    setGeneratedSubjects([]);
    setGeneratedBodies([]);
    setEmailContentMode("manual");
    setCreateScheduledTime("");
    setCreateProductId("");
    setCreateCategory("");
    setCreateContactListId(null);
    setSpamScoreResult(null);
    setSelectedTemplateId("");
    setOpenTrackingEnabled(false);
    setClickTrackingEnabled(false);
    setFooterDisplayEnabled(false);
    setCreateCampaignErrors(EMPTY_CREATE_CAMPAIGN_ERRORS);

    setActiveDays(DEFAULT_SCHEDULE_DETAILS.active_days);
    setStartTime(DEFAULT_SCHEDULE_DETAILS.start_time);
    setEndTime(DEFAULT_SCHEDULE_DETAILS.end_time);
    setSelectedSmtpProfileIds([]);

    setCampaignSequences([
      {
        sequence_order: 1,
        gap_days: 0,
        template_id: null,
      },
    ]);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditCampaign = async (id: number) => {
    const response = await campaignService.getCampaign(id);

    const campaign = response;

    setEditingCampaignId(campaign.id);

    setCreateCampaignName(campaign.campaign_name);
    setCreateCampaignType(campaign.campaign_type);

    setCreateContactListId(campaign.contact_list_id);
    setCreateProductId(campaign.product_id || "");
    setCreateCategory(campaign.category || "");

    setCreateScheduledTime(
      campaign.scheduled_time
        ? dayjs(campaign.scheduled_time).format("YYYY-MM-DDTHH:mm")
        : ""
    );

    // Template
    setSelectedTemplateId(campaign.message_template_id || "");

    setActiveDays(campaign.active_days ?? DEFAULT_SCHEDULE_DETAILS.active_days);
    setStartTime(campaign.start_time ?? DEFAULT_SCHEDULE_DETAILS.start_time);
    setEndTime(campaign.end_time ?? DEFAULT_SCHEDULE_DETAILS.end_time);

    if (campaign.campaign_type === "email") {

      setOpenTrackingEnabled(campaign.open_tracking_enabled);
      setClickTrackingEnabled(campaign.click_tracking_enabled);
      setFooterDisplayEnabled(campaign.footer_display_enabled);
      setSelectedSmtpProfileIds(campaign.selected_smtp_profile_ids || []);

      const template =
        typeof campaign.message_template === "string"
          ? JSON.parse(campaign.message_template)
          : campaign.message_template;

      setEmailContentMode(template.mode ?? "manual");

      setEmailSubject(template.default_subject ?? "");

      if (template.mode === "manual") {
        setCreateMessageTemplate(template.default_body ?? "");
        setEmailPromptContext("");
        setGeneratedSubjects([]);
        setGeneratedBodies([]);
      } else {
        setEmailPromptContext(template.prompt_context ?? "");
        setGeneratedSubjects(template.subjects ?? []);
        setGeneratedBodies(template.bodies ?? []);
        setCreateMessageTemplate(template.default_body ?? "");
      }
    }

    // Switch to Create/Edit tab
    setTab(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRunDueCampaigns = async () => {
    setLoading(true);
    try {
      const result = await campaignService.runDueCampaigns();
      showSuccess(
        `Due scheduler run complete: ${result.executed_count} executed, ${result.skipped_count} skipped, failed ${result.failed_count}`,
      );
      await Promise.all([loadCampaigns(), loadDashboard()]);
    } catch (err: any) {
      showError(
        err?.response?.data?.detail || "Failed to run scheduled campaigns",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewContacts = async (contactListId?: number | null) => {
    if (!contactListId || contactListId <= 0) {
      return;
    }

    setPreviewContactListId(contactListId);
    setPreviewContactPage(0);
    setPreviewSearch("");
    setLoading(true);
    try {
      await loadPreviewContacts(Number(contactListId));

      // scroll to below section
      setTimeout(() => {
        secondSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async (campaignId: number) => {
    setSelectedCampaignId(campaignId);
    setLogPage(0);
    setTab(3);
    setLoading(true);
    try {
      await loadLogs(campaignId);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete?.id) return;
    setDeleteSubmitting(true);
    setLoading(true);
    try {
      await campaignService.deleteCampaign(campaignToDelete.id);
      showSuccess("Campaign deleted");
      setCampaignToDelete(null);
      await Promise.all([loadCampaigns(), loadCampaignLookup()]);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to delete the campaign");
    } finally {
      setLoading(false);
      setDeleteSubmitting(false);
    }

  };


  const handleApplyLogsFilter = async () => {
    if (!selectedCampaignId) {
      showError("Select a campaign to view logs");
      return;
    }

    setLogPage(0);
    setLoading(true);
    try {
      await loadLogs(Number(selectedCampaignId));
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to filter logs");
    } finally {
      setLoading(false);
    }
  };

  const campaignOptions = useMemo(
    () =>
      allCampaigns.map((item) => ({
        id: item.id,
        label: `${item.campaign_name} (#${item.id})`,
      })),
    [allCampaigns],
  );

  useEffect(() => {
    if (createCampaignType !== "email") {
      setEmailEditorMode("plain");
      setShowEmailPreview(false);
      setEmailContentMode("manual");
      setEmailSubject("");
      setEmailPromptContext("");
      setGeneratedSubjects([]);
      setGeneratedBodies([]);
      setSpamScoreResult(null);
      setSpamVisibleStart(0);
    }
  }, [createCampaignType]);

  const handleView = (contact: any) => {
    setSelectedContact(contact);
    setDrawerOpen(true);
  };


  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedContact(null);
  };

  const formatEmailPreview = (content: string) =>
    content
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

  const hasAnyCampaignType =
    featureFlags?.email_campaign_enabled ||
    featureFlags?.whatsapp_campaign_enabled ||
    featureFlags?.sms_campaign_enabled;

  const handleTabChange = (_: React.SyntheticEvent, value: number) => {
    // Leaving Edit Campaign tab
    if (isEditMode && value !== 1) {
      setEditingCampaignId(null);

      // Reset form if needed
      resetCampaignForm(); // or setForm(initialFormState)
    }

    setTab(value);
  };

  const calendarEvents: EventInput[] = campaigns
    .filter((campaign) => campaign.scheduled_time || campaign.created_at)
    .map((campaign) => ({
      id: String(campaign.id),
      title: campaign.campaign_name,
      start: campaign.scheduled_time || campaign.created_at,

      backgroundColor: "#EAF4FF",
      borderColor: "transparent",
      textColor: "#1F2937",

      extendedProps: {
        campaign,
        isInstant: !campaign.scheduled_time,
      },
    }));

  console.log(calendarEvents);
  const statusConfig: Record<
    string,
    {
      label: string;
      color: "success" | "primary" | "error" | "warning" | "default";
    }
  > = {
    completed: {
      label: "Completed",
      color: "success",
    },
    running: {
      label: "Running",
      color: "primary",
    },
    failed: {
      label: "Failed",
      color: "error",
    },
    paused: {
      label: "Paused",
      color: "warning",
    },
    scheduled: {
      label: "Scheduled",
      color: "primary",
    },
    pending_execution: {
      label: "In Progress",
      color: "warning",
    },
  };

  const getStatusConfig = (status?: string) => {
    return (
      statusConfig[status ?? ""] ?? {
        label: status || "Unknown",
        color: "default" as const,
      }
    );
  };

  const statusBorderColors: Record<
    "success" | "primary" | "error" | "warning" | "default",
    string
  > = {
    success: theme.palette.success.main,
    primary: theme.palette.primary.main,
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
    default: theme.palette.grey[400],
  };

  return (
    <AdminLayout>
      <Box sx={pageContainerSx}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            background:
              "linear-gradient(132deg, transparent 16%, rgba(132,172,228,0.2) 17%, transparent 34%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.16) 53%, transparent 72%)",
          }}
        />

        <Stack spacing={3} sx={{ position: "relative", zIndex: 1 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 2.6 },
              borderRadius: "24px",
              border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
              background: `linear-gradient(125deg, ${alpha("#deebfb", 0.92)} 0%, ${alpha(
                theme.palette.background.paper,
                0.84,
              )} 72%, ${alpha("#a9bfdc", 0.98)} 100%)`,
              boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)",
                pointerEvents: "none",
              },
              "&::after": {
                content: '""',
                position: "absolute",
                top: "-24%",
                right: "-6%",
                width: "42%",
                height: "150%",
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)",
                pointerEvents: "none",
              },
              "& > *": {
                position: "relative",
                zIndex: 1,
              },
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 800,
                    color: "text.primary",
                    mb: 0.8,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Campaign Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Run non-AI promotional campaigns via Email, WhatsApp, or SMS.
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 1.4 }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    size="small"
                    icon={<ListAltIcon />}
                    label="Build Audience"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    icon={<CampaignIcon />}
                    label="Create Campaigns"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    icon={<PlayArrowIcon />}
                    label="Launch Campaigns"
                    variant="outlined"
                  />
                </Stack>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  size="small"
                  sx={compactButtonSx}
                  variant="contained"
                  onClick={() => {
                    resetCampaignForm();
                    setTab(1);
                  }}
                  startIcon={<AddIcon />}
                >
                  New Campaign
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
              zIndex: (theme) => theme.zIndex.modal + 9999,
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
              }}
            >
              {error || success}
            </Alert>
          </Snackbar>

          {/* {error && (
            <Alert
              severity="error"
              onClose={() => setError("")}
              sx={{
                borderRadius: "14px",
                boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
              }}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert
              severity="success"
              onClose={() => setSuccess("")}
              sx={{
                borderRadius: "14px",
                boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}`,
              }}
            >
              {success}
            </Alert>
          )} */}

          <Paper sx={{ ...sectionPanelSx, borderRadius: "16px" }}>
            <Tabs
              value={tab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
              }}
            >
              <Tab
                label="Dashboard"
                icon={<ListAltIcon />}
                iconPosition="start"
              />
              <Tab
                label={isEditMode ? "Edit Campaign" : "Create Campaign"}
                icon={isEditMode ? <EditIcon /> : <AddIcon />}
                iconPosition="start"
              />
              <Tab
                label="Run Campaign"
                icon={<PlayArrowIcon />}
                iconPosition="start"
              />
              <Tab
                label="Campaign Logs"
                icon={<VisibilityIcon />}
                iconPosition="start"
              />
              <Tab
                label="Reports"
                icon={<ListAltIcon />}
                iconPosition="start"
              />
              <Tab
                label="C2L"
                icon={<AutoAwesomeIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Paper>

          {loading && <LinearProgress sx={{ borderRadius: 1.2 }} />}

          {tab === 0 && (
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2.5,
                }}
              >
                {campaignKpis.map((kpi) => (
                  <Box key={kpi.label}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: "18px",
                        background: kpi.gradient,
                        minHeight: 142,
                        border: `1px solid ${alpha(theme.palette.common.white, 0.6)}`,
                        boxShadow: `0 12px 26px ${alpha(theme.palette.primary.dark, 0.16)}`,
                        position: "relative",
                        overflow: "hidden",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          background:
                            "linear-gradient(140deg, rgba(255,255,255,0.18) 6%, transparent 22%), linear-gradient(28deg, transparent 58%, rgba(74,137,213,0.14) 59%, transparent 82%)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700, color: "text.primary" }}
                          >
                            {kpi.label}
                          </Typography>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 800,
                              mt: 0.35,
                              color: "text.primary",
                            }}
                          >
                            {kpi.value}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary", mt: 0.2 }}
                          >
                            {kpi.hint}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: alpha(theme.palette.primary.main, 0.14),
                            border: `1px solid ${alpha(theme.palette.common.white, 0.48)}`,
                          }}
                        >
                          {kpi.icon}
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          position: "absolute",
                          left: 14,
                          right: 14,
                          bottom: 12,
                          height: 30,
                          opacity: 0.95,
                        }}
                      >
                        <svg
                          width="100%"
                          height="100%"
                          viewBox="0 0 220 30"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M0,22 C18,8 34,28 52,18 C70,8 86,28 104,16 C124,4 142,28 160,14 C178,3 196,20 220,10"
                            fill="none"
                            stroke={alpha(kpi.wave, 0.9)}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                      </Box>
                    </Paper>
                  </Box>
                ))}
              </Box>

              <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                  Status Overview
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {statusSummary.map((item) => (
                    <Chip
                      key={item.key}
                      label={`${item.key}: ${item.value}`}
                      color={statusColor(item.key) as any}
                      variant="outlined"
                    />
                  ))}
                </Stack>
                <Stack spacing={1.1} sx={{ mt: 2 }}>
                  {statusSummary.map((item) => {
                    const percent =
                      totalStatusCount > 0
                        ? (Number(item.value || 0) * 100) / totalStatusCount
                        : 0;
                    return (
                      <Box key={`status-progress-${item.key}`}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mb: 0.45 }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              textTransform: "capitalize",
                              fontWeight: 600,
                            }}
                          >
                            {item.key}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Number(item.value || 0)} ({percent.toFixed(1)}%)
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, Math.max(0, percent))}
                          sx={{ height: 8, borderRadius: 999 }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={5}>
                  <Paper sx={{ ...sectionPanelSx, p: 2.5, height: "100%" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.6 }}>
                      Campaign Health Snapshot
                    </Typography>
                    <Stack spacing={1.6}>
                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 0.5 }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Delivery Efficiency
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dashboardHealth.deliveryRate.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, dashboardHealth.deliveryRate)}
                          sx={{ height: 9, borderRadius: 999 }}
                        />
                      </Box>

                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 0.5 }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Failure Exposure
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dashboardHealth.failureRate.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, dashboardHealth.failureRate)}
                          color="error"
                          sx={{ height: 9, borderRadius: 999 }}
                        />
                      </Box>

                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 0.5 }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Completed Campaign Share
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dashboardHealth.completionShare.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, dashboardHealth.completionShare)}
                          color="success"
                          sx={{ height: 9, borderRadius: 999 }}
                        />
                      </Box>

                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 0.5 }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Active Pipeline (Running + Scheduled)
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dashboardHealth.pipelineLoad.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, dashboardHealth.pipelineLoad)}
                          color="warning"
                          sx={{ height: 9, borderRadius: 999 }}
                        />
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} lg={7}>
                  <Paper sx={{ ...sectionPanelSx, p: 2.5, height: "100%" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.6 }}>
                      Recent Campaign Performance
                    </Typography>
                    <TableContainer
                      sx={{
                        borderRadius: "12px",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Sent</TableCell>
                            <TableCell>Failed</TableCell>
                            <TableCell>Success %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(dashboard.recent_campaigns || []).length > 0 ? (
                            (dashboard.recent_campaigns || []).map((item) => {
                              const sent = Number(item.number_sent || 0);
                              const failed = Number(item.number_failed || 0);
                              const total = sent + failed;
                              const successPct =
                                total > 0 ? (sent * 100) / total : 0;

                              return (
                                <TableRow key={`recent-campaign-${item.id}`}>
                                  <TableCell>
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {item.campaign_name}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {formatDisplayDate(item.created_at)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell
                                    sx={{ textTransform: "uppercase" }}
                                  >
                                    {item.campaign_type}
                                  </TableCell>
                                  <TableCell>{sent}</TableCell>
                                  <TableCell>{failed}</TableCell>
                                  <TableCell>
                                    {successPct.toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} align="center">
                                No recent campaign performance data yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={2.5}>
              <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mb: 2 }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    size="small"
                    label="1. Configure Basics"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label="2. Choose Audience"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label="3. Write Template"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label="4. Launch or Schedule"
                    variant="outlined"
                  />
                </Stack>
                {!hasAnyCampaignType &&
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    No campaign channels are enabled for your organization.
                  </Alert>
                }
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Campaign Type</InputLabel>
                      <Select
                        value={createCampaignType}
                        label="Campaign Type"
                        onChange={(e) => {
                          const type = e.target.value as
                            | "email"
                            | "whatsapp"
                            | "sms";

                          setCreateCampaignType(type);

                          // reset template state when switching type
                          setSelectedTemplateId("");
                          setSelectedTemplate(null);
                          setCreateMessageTemplate("");
                        }}
                      >
                        {featureFlags?.email_campaign_enabled && (
                          <MenuItem value="email">Email</MenuItem>
                        )}

                        {featureFlags?.whatsapp_campaign_enabled && (
                          <MenuItem value="whatsapp">WhatsApp</MenuItem>
                        )}

                        {featureFlags?.sms_campaign_enabled && (
                          <MenuItem value="sms">SMS</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={9}>
                    <TextField
                      required
                      size="small"
                      sx={compactInputSx}
                      fullWidth
                      label="Campaign Name"
                      value={createCampaignName}
                      onChange={(e) => {
                        setCreateCampaignName(e.target.value);
                        if (createCampaignErrors.campaignName) {
                          setCreateCampaignErrors((prev) => ({
                            ...prev,
                            campaignName: false,
                          }));
                        }
                      }}
                      error={createCampaignErrors.campaignName}
                      helperText={
                        createCampaignErrors.campaignName
                          ? "Campaign name is required"
                          : " "
                      }
                    />
                  </Grid>

                </Grid>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {/* Contact List Dropdown */}
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Contact List</InputLabel>
                      <Select
                        value={createContactListId}
                        label="Contact List"
                        onChange={(e) => {
                          setCreateContactListId(
                            e.target.value === "" ? null : Number(e.target.value),
                          );
                          if (createCampaignErrors.contactList) {
                            setCreateCampaignErrors((prev) => ({
                              ...prev,
                              contactList: false,
                            }));
                          }
                        }}
                        error={createCampaignErrors.contactList}
                      >
                        <MenuItem value="">
                          <em>Select Contact List</em>
                        </MenuItem>
                        {contactLists.map((list) => (
                          <MenuItem key={list.id} value={list.id}>
                            {getContactListLabel(list)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Preview Contacts Button */}
                  <Grid item xs={12} md={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => {
                        handlePreviewContacts(createContactListId);
                      }}
                      sx={{
                        height: "40px",
                        borderRadius: "12px",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "14px",
                        borderColor: "#7BAAF7",
                        color: "#3B82F6",
                        whiteSpace: "nowrap",
                        "&:hover": {
                          borderColor: "#3B82F6",
                          backgroundColor: "#F5F9FF",
                        },
                      }}
                      disabled={!createContactListId}
                    >
                      View Contacts
                    </Button>
                  </Grid>

                  {/* Product Dropdown */}
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Product</InputLabel>
                      <Select
                        value={createProductId}
                        label="Product"
                        onChange={(e) => {
                          setCreateProductId(
                            e.target.value === "" ? "" : Number(e.target.value),
                          );
                        }}
                      >
                        <MenuItem value="">
                          <em>Select Product</em>
                        </MenuItem>
                        {products.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.name} ({item.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={createCategory}
                        label="Category"
                        onChange={(e) => {
                          setCreateCategory(
                            e.target.value === "" ? "" : e.target.value,
                          );
                        }}
                      >
                        <MenuItem value="">
                          <em>Select Category</em>
                        </MenuItem>
                        <MenuItem value="sales">Sales Outreach</MenuItem>
                        <MenuItem value="support">Support</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    {createCampaignType === "email" && (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.8,
                          mb: 1.2,
                          borderRadius: "12px",
                          borderColor: alpha(theme.palette.primary.main, 0.2),
                          background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.72)} 0%, ${alpha("#deebfb", 0.6)} 100%)`,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1.2}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", md: "center" }}
                          >
                            <Box>
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 700 }}
                              >
                                Email Content Setup
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {CAMPAIGN_EMAIL_MERGE_TAG_HELP}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                startIcon={<TextFieldsIcon />}
                                variant={
                                  emailContentMode === "manual"
                                    ? "contained"
                                    : "outlined"
                                }
                                onClick={() => setEmailContentMode("manual")}
                              >
                                Manual
                              </Button>
                              <Button
                                size="small"
                                startIcon={<AutoAwesomeIcon />}
                                variant={
                                  emailContentMode === "prompt"
                                    ? "contained"
                                    : "outlined"
                                }
                                onClick={() => setEmailContentMode("prompt")}
                              >
                                Prompt + AI Variants
                              </Button>
                            </Stack>
                          </Stack>
                          <Grid container>
                            {emailContentMode === "manual" && (
                              <Grid item xs={12} md={5} >
                                <FormControl fullWidth size="small" sx={compactInputSx}>
                                  <InputLabel>Message Template</InputLabel>

                                  <Select
                                    value={selectedTemplateId}
                                    label="Message Template"
                                    onChange={(e) => {
                                      const id = e.target.value as string;

                                      setSelectedTemplateId(id);

                                      const template =
                                        messageTemplates.find((t) => t.id === id) ||
                                        null;

                                      setSelectedTemplate(template);
                                      setCreateMessageTemplate(template?.content || "");
                                      setEmailSubject(template?.subject || "");

                                      console.log(template?.content);
                                    }}
                                    error={createCampaignErrors.emailBody}
                                  >
                                    <MenuItem value="">
                                      <em>Select Template</em>
                                    </MenuItem>

                                    {messageTemplates
                                      ?.filter((t) => t.type === createCampaignType)
                                      .map((template) => (
                                        <MenuItem key={template.id} value={template.id}>
                                          {template.name}
                                        </MenuItem>
                                      ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                            )}
                            <Grid
                              item
                              xs={12}
                              md={emailContentMode === "manual" ? 7 : 12}
                              sx={emailContentMode === "manual" ? { pl: { md: 2 } } : {}}
                            >
                              <TextField
                                required
                                size="small"
                                sx={compactInputSx}
                                fullWidth
                                label="Email Subject"
                                value={emailSubject}
                                onChange={(e) => {
                                  setEmailSubject(e.target.value);
                                  if (createCampaignErrors.emailSubject) {
                                    setCreateCampaignErrors((prev) => ({
                                      ...prev,
                                      emailSubject: false,
                                    }));
                                  }
                                }}
                                error={createCampaignErrors.emailSubject}
                                helperText={
                                  createCampaignErrors.emailSubject
                                    ? "Email subject is required"
                                    : " "
                                }
                                placeholder="Leave blank to use campaign name"
                              />
                            </Grid>

                          </Grid>
                          <Card variant="outlined" sx={{ mt: 2 }}>
                            <CardContent>
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 700, mb: 2 }}
                              >
                                Email Configurations
                              </Typography>
                              {smtpProfiles?.length > 1 && (
                                <>
                                  <Box sx={{ mb: 2 }}>
                                    <Autocomplete
                                      multiple
                                      options={smtpProfiles}
                                      value={smtpProfiles.filter((profile) =>
                                        profile.id !== undefined &&
                                        selectedSmtpProfileIds.includes(profile.id)
                                      )}
                                      onChange={(_, newValue) => {
                                        setSelectedSmtpProfileIds(
                                          newValue.map((profile) => profile.id).filter((id): id is number => id !== undefined)
                                        );
                                      }}
                                      getOptionLabel={(option) => option.name}
                                      isOptionEqualToValue={(option, value) =>
                                        option.id === value.id
                                      }
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          label="SMTP Profiles"
                                          placeholder="Select SMTP profiles"
                                          size="small"
                                        />
                                      )}
                                      renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                          <Chip
                                            {...getTagProps({ index })}
                                            key={option.id}
                                            label={option.name}
                                            size="small"
                                          />
                                        ))
                                      }
                                    />

                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: "block", mt: 0.75 }}
                                    >
                                      Select the SMTP profiles that can be used for this campaign.
                                    </Typography>
                                  </Box>

                                  <Divider sx={{ mb: 2 }} />
                                </>
                              )}

                              <Stack spacing={2}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                      Open Tracking
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Track when recipients open or read the email. Open rates
                                      will be available in campaign analytics.
                                    </Typography>
                                  </Box>

                                  <Switch
                                    checked={openTrackingEnabled}
                                    onChange={(e) =>
                                      setOpenTrackingEnabled(e.target.checked)
                                    }
                                  />
                                </Box>

                                <Divider />

                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                      Click Tracking
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Track clicks on links within the email and measure
                                      engagement for each recipient.
                                    </Typography>
                                  </Box>

                                  <Switch
                                    checked={clickTrackingEnabled}
                                    onChange={(e) =>
                                      setClickTrackingEnabled(e.target.checked)
                                    }
                                  />
                                </Box>

                                <Divider />

                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                      Footer Display
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Include company branding, contact information, and
                                      unsubscribe links in the email footer.
                                    </Typography>
                                  </Box>

                                  <Switch
                                    checked={footerDisplayEnabled}
                                    onChange={(e) =>
                                      setFooterDisplayEnabled(e.target.checked)
                                    }
                                  />
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                          {emailContentMode === "manual" ? (
                            <>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                              >
                                <Button
                                  size="small"
                                  startIcon={<TextFieldsIcon />}
                                  variant={
                                    emailEditorMode === "plain"
                                      ? "contained"
                                      : "outlined"
                                  }
                                  onClick={() => setEmailEditorMode("plain")}
                                >
                                  Plain Text
                                </Button>
                                <Button
                                  size="small"
                                  startIcon={<CodeIcon />}
                                  variant={
                                    emailEditorMode === "html"
                                      ? "contained"
                                      : "outlined"
                                  }
                                  onClick={() => setEmailEditorMode("html")}
                                >
                                  HTML
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={handleLoadHtmlStarter}
                                >
                                  Load HTML Starter
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setShowEmailPreview((prev) => !prev)
                                  }
                                >
                                  {showEmailPreview
                                    ? "Hide Preview"
                                    : "Show Preview"}
                                </Button>
                              </Stack>
                            </>
                          ) : (
                            <>
                              <TextField
                                size="small"
                                sx={compactInputSx}
                                fullWidth
                                multiline
                                minRows={4}
                                label="Prompt Context"
                                value={emailPromptContext}
                                onChange={(e) => {
                                  setEmailPromptContext(e.target.value);
                                  if (createCampaignErrors.promptContext) {
                                    setCreateCampaignErrors((prev) => ({
                                      ...prev,
                                      promptContext: false,
                                    }));
                                  }
                                }}
                                error={createCampaignErrors.promptContext}
                                helperText={
                                  createCampaignErrors.promptContext
                                    ? "Prompt context is required for prompt mode"
                                    : " "
                                }
                                placeholder="Describe campaign intent, audience, offer, tone, CTA, and constraints..."
                              />
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                alignItems={{ xs: "stretch", sm: "center" }}
                              >
                                <Button
                                  variant="contained"
                                  startIcon={<AutoAwesomeIcon />}
                                  onClick={handleGeneratePromptEmailVariants}
                                  disabled={generatingEmailVariants}
                                >
                                  {generatingEmailVariants
                                    ? "Generating..."
                                    : "Generate 5x5 Variants"}
                                </Button>
                                <Chip
                                  variant="outlined"
                                  label={`Subjects: ${generatedSubjects.length} | Bodies: ${generatedBodies.length} | Combos: ${generatedSubjects.length * generatedBodies.length}`}
                                />
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setShowEmailPreview((prev) => !prev)
                                  }
                                >
                                  {showEmailPreview
                                    ? "Hide Preview"
                                    : "Show Preview"}
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<ErrorOutlineIcon />}
                                  onClick={handleScorePromptEmailSpam}
                                  disabled={
                                    spamScoreLoading ||
                                    generatedSubjects.length < 5 ||
                                    generatedBodies.length < 5
                                  }
                                >
                                  {spamScoreLoading
                                    ? "Scoring..."
                                    : "Spam Score (5x5)"}
                                </Button>
                              </Stack>

                              {(generatingEmailVariants || spamScoreLoading) && (
                                <Box sx={{ mt: 0.5 }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block", mb: 0.6 }}
                                  >
                                    {generatingEmailVariants
                                      ? "Generating 5x5 variants. Please wait..."
                                      : "Running spam score across 25 combinations. Please wait..."}
                                  </Typography>
                                  <LinearProgress sx={{ borderRadius: 999 }} />
                                </Box>
                              )}

                              {spamScoreResult && (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 1.2,
                                    borderRadius: "10px",
                                    borderColor: alpha(
                                      theme.palette.warning.main,
                                      0.36,
                                    ),
                                  }}
                                >
                                  {(() => {
                                    const total =
                                      spamScoreResult.combinations.length;
                                    const fromRow =
                                      total > 0 ? spamVisibleStart + 1 : 0;
                                    const toRow = Math.min(
                                      total,
                                      spamVisibleStart + spamRowsPerView,
                                    );
                                    const maxStart = Math.max(
                                      0,
                                      total - spamRowsPerView,
                                    );
                                    const canUp = spamVisibleStart > 0;
                                    const canDown = spamVisibleStart < maxStart;
                                    return (
                                      <>
                                        {spamScoreResult.fallback_used && (
                                          <Alert severity="info" sx={{ mb: 1 }}>
                                            Spam score used fallback heuristic due
                                            to model timeout/availability. You can
                                            retry for model-based scoring.
                                          </Alert>
                                        )}
                                        <Stack
                                          direction={{ xs: "column", sm: "row" }}
                                          spacing={1}
                                          sx={{ mb: 1 }}
                                        >
                                          <Chip
                                            color="warning"
                                            variant="outlined"
                                            label={`Avg Spam Score: ${spamScoreResult.overall.average_spam_score}`}
                                          />
                                          <Chip
                                            color="warning"
                                            variant="outlined"
                                            label={`Highest: ${spamScoreResult.overall.highest_spam_score}`}
                                          />
                                          <Chip
                                            color={
                                              spamScoreResult.overall
                                                .high_risk_count > 0
                                                ? "error"
                                                : "success"
                                            }
                                            variant="outlined"
                                            label={`High Risk Combos: ${spamScoreResult.overall.high_risk_count}`}
                                          />
                                        </Stack>
                                        <Stack
                                          direction={{ xs: "column", sm: "row" }}
                                          spacing={1}
                                          sx={{ mb: 1 }}
                                        >
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={
                                              <KeyboardDoubleArrowUpIcon />
                                            }
                                            onClick={() =>
                                              handleScrollSpamTable("top")
                                            }
                                            disabled={!canUp}
                                          >
                                            Top
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<ArrowUpwardIcon />}
                                            onClick={() =>
                                              handleScrollSpamTable("up")
                                            }
                                            disabled={!canUp}
                                          >
                                            Up
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<ArrowDownwardIcon />}
                                            onClick={() =>
                                              handleScrollSpamTable("down")
                                            }
                                            disabled={!canDown}
                                          >
                                            Down
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={
                                              <KeyboardDoubleArrowDownIcon />
                                            }
                                            onClick={() =>
                                              handleScrollSpamTable("bottom")
                                            }
                                            disabled={!canDown}
                                          >
                                            Bottom
                                          </Button>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ alignSelf: "center" }}
                                          >
                                            Showing {fromRow}-{toRow} of {total}{" "}
                                            combinations
                                          </Typography>
                                        </Stack>
                                        <TableContainer
                                          id="spam-score-table-scroll"
                                          ref={spamTableContainerRef}
                                          sx={{
                                            maxHeight: 280,
                                            overflowY: "auto",
                                            overflowX: "auto",
                                          }}
                                        >
                                          <Table size="small" stickyHeader>
                                            <TableHead>
                                              <TableRow>
                                                <TableCell>Combo</TableCell>
                                                <TableCell>Subject</TableCell>
                                                <TableCell>Body</TableCell>
                                                <TableCell>Score</TableCell>
                                                <TableCell>Risk</TableCell>
                                                <TableCell>Notes</TableCell>
                                              </TableRow>
                                            </TableHead>
                                            <TableBody>
                                              {spamScoreResult.combinations
                                                .slice(
                                                  spamVisibleStart,
                                                  spamVisibleStart +
                                                  spamRowsPerView,
                                                )
                                                .map((row) => (
                                                  <TableRow
                                                    key={`spam-score-${row.combo_index}`}
                                                  >
                                                    <TableCell>
                                                      {row.combo_index}
                                                    </TableCell>
                                                    <TableCell>
                                                      {row.subject_index}
                                                    </TableCell>
                                                    <TableCell>
                                                      {row.body_index}
                                                    </TableCell>
                                                    <TableCell>
                                                      {row.spam_score}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Chip
                                                        size="small"
                                                        label={row.risk_level}
                                                        color={
                                                          row.risk_level ===
                                                            "high"
                                                            ? "error"
                                                            : row.risk_level ===
                                                              "medium"
                                                              ? "warning"
                                                              : "success"
                                                        }
                                                        variant="outlined"
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      {(row.reasons || [])
                                                        .slice(0, 1)
                                                        .join("; ") || "-"}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                            </TableBody>
                                          </Table>
                                        </TableContainer>
                                      </>
                                    );
                                  })()}
                                </Paper>
                              )}

                              {(generatedSubjects.length > 0 ||
                                generatedBodies.length > 0) && (
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 1.2,
                                      borderRadius: "10px",
                                      borderColor: alpha(
                                        theme.palette.primary.main,
                                        0.2,
                                      ),
                                    }}
                                  >
                                    <Grid container spacing={1.5}>
                                      <Grid item xs={12} md={6}>
                                        <Accordion
                                          disableGutters
                                          sx={{
                                            borderRadius: "8px",
                                            border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                            boxShadow: "none",
                                            "&:before": { display: "none" },
                                          }}
                                        >
                                          <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 600 }}
                                            >
                                              Generated Subjects (Editable)
                                            </Typography>
                                          </AccordionSummary>
                                          <AccordionDetails sx={{ pt: 0.4 }}>
                                            <Stack spacing={0.9}>
                                              {ensureFive(generatedSubjects).map(
                                                (subject, idx) => (
                                                  <TextField
                                                    key={`subject-edit-${idx}`}
                                                    size="small"
                                                    label={`Subject ${idx + 1}`}
                                                    value={subject}
                                                    onChange={(event) =>
                                                      handleEditGeneratedSubject(
                                                        idx,
                                                        event.target.value,
                                                      )
                                                    }
                                                  />
                                                ),
                                              )}
                                            </Stack>
                                          </AccordionDetails>
                                        </Accordion>
                                      </Grid>
                                      <Grid item xs={12} md={6}>
                                        <Accordion
                                          disableGutters
                                          sx={{
                                            borderRadius: "8px",
                                            border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                            boxShadow: "none",
                                            "&:before": { display: "none" },
                                          }}
                                        >
                                          <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 600 }}
                                            >
                                              Generated Bodies (Editable)
                                            </Typography>
                                          </AccordionSummary>
                                          <AccordionDetails sx={{ pt: 0.4 }}>
                                            <Stack spacing={0.9}>
                                              {ensureFive(generatedBodies).map(
                                                (body, idx) => (
                                                  <Accordion
                                                    key={`body-edit-${idx}`}
                                                    disableGutters
                                                    sx={{
                                                      borderRadius: "8px",
                                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                                      boxShadow: "none",
                                                      "&:before": {
                                                        display: "none",
                                                      },
                                                    }}
                                                  >
                                                    <AccordionSummary
                                                      expandIcon={
                                                        <ExpandMoreIcon />
                                                      }
                                                    >
                                                      <Typography
                                                        variant="body2"
                                                        sx={{ fontWeight: 600 }}
                                                      >
                                                        {`Body ${idx + 1}`}
                                                      </Typography>
                                                      <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ ml: 1 }}
                                                      >
                                                        {(body || "").slice(0, 70)}
                                                        {(body || "").length > 70
                                                          ? "..."
                                                          : ""}
                                                      </Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails
                                                      sx={{ pt: 0.5 }}
                                                    >
                                                      <TextField
                                                        fullWidth
                                                        size="small"
                                                        multiline
                                                        minRows={4}
                                                        value={body}
                                                        onChange={(event) =>
                                                          handleEditGeneratedBody(
                                                            idx,
                                                            event.target.value,
                                                          )
                                                        }
                                                      />
                                                    </AccordionDetails>
                                                  </Accordion>
                                                ),
                                              )}
                                            </Stack>
                                          </AccordionDetails>
                                        </Accordion>
                                      </Grid>
                                    </Grid>
                                  </Paper>
                                )}
                            </>
                          )}
                        </Stack>
                      </Paper>
                    )}

                    {createCampaignType === "email" ? (
                      emailContentMode === "manual" && (
                        <TextField
                          required
                          size="small"
                          sx={{
                            ...compactInputSx,
                            ...(emailEditorMode === "html"
                              ? {
                                "& .MuiInputBase-input": {
                                  fontFamily: "Consolas, Menlo, monospace",
                                },
                              }
                              : {}),
                          }}
                          fullWidth
                          multiline
                          minRows={emailEditorMode === "html" ? 9 : 6}
                          label={`Email Template (${emailEditorMode.toUpperCase()})`}
                          value={createMessageTemplate}
                          error={createCampaignErrors.emailBody}
                          helperText={
                            createCampaignErrors.emailBody
                              ? "Email body is required"
                              : " "
                          }
                          onChange={(e) =>
                            setCreateMessageTemplate(e.target.value)
                          }
                        />
                      )
                    ) : (
                      <Grid container spacing={1.5} alignItems="flex-start">
                        {/* LEFT: Template Selector */}
                        <Grid item xs={12} md={5}>
                          <FormControl fullWidth size="small" sx={compactInputSx}>
                            <InputLabel>Message Template</InputLabel>

                            <Select
                              value={selectedTemplateId}
                              label="Message Template"
                              onChange={(e) => {
                                const id = e.target.value as string;

                                setSelectedTemplateId(id);

                                const template =
                                  messageTemplates.find((t) => t.id === id) ||
                                  null;

                                setSelectedTemplate(template);
                                setCreateMessageTemplate(template?.content || "");
                              }}
                              error={createCampaignErrors.emailBody}
                            >
                              <MenuItem value="">
                                <em>Select Template</em>
                              </MenuItem>

                              {messageTemplates
                                ?.filter((t) => t.type === createCampaignType)
                                .filter((t) => {
                                  if (createCampaignType !== "whatsapp") {
                                    return t.type === createCampaignType;
                                  }
                                  return (
                                    t.type === "whatsapp" &&
                                    ["MARKETING", "UTILITY"].includes(t.category)
                                  );
                                })
                                .map((template) => (
                                  <MenuItem key={template.id} value={template.id}>
                                    {template.name}
                                  </MenuItem>
                                ))}
                            </Select>
                          </FormControl>
                          {createCampaignType === "whatsapp" && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                              Only <b>MARKETING</b> and <b>UTILITY</b> WhatsApp templates can be used
                              for sending test messages.
                            </Alert>
                          )}
                        </Grid>

                        {/* RIGHT: Preview */}
                        <Grid item xs={12} md={7}>
                          {selectedTemplate ? (
                            <Box
                              sx={{
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                overflow: "hidden",
                                height: "100%",
                              }}
                            >
                              {/* Header */}
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 1,
                                  bgcolor: "grey.100",
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Typography variant="subtitle2" fontWeight={600}>
                                  Preview
                                </Typography>

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {selectedTemplate.name}
                                </Typography>
                              </Box>

                              {/* Body */}
                              <Box
                                sx={{
                                  p: 1.5,
                                  bgcolor: "#ece5dd", // WhatsApp chat background
                                  minHeight: 140,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 1,
                                }}
                              >
                                {/* incoming message bubble */}
                                <Box
                                  sx={{
                                    alignSelf: "flex-start",
                                    maxWidth: "85%",
                                    bgcolor: "#ffffff",
                                    p: 1.2,
                                    borderRadius: "12px",
                                    borderTopLeftRadius: 4,
                                    boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
                                    whiteSpace: "pre-wrap",
                                    fontSize: "0.85rem",
                                    lineHeight: 1.4,
                                    position: "relative",
                                  }}
                                >
                                  {/* sender label */}
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      display: "block",
                                      mb: 0.5,
                                      color: "text.secondary",
                                    }}
                                  >
                                    Campaign Message
                                  </Typography>

                                  {generatePreview(
                                    selectedTemplate.content,
                                    selectedTemplate.variable_mappings || {},
                                  )}

                                  {/* optional timestamp */}
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: "block",
                                      mt: 0.5,
                                      textAlign: "right",
                                      color: "text.disabled",
                                      fontSize: "0.7rem",
                                    }}
                                  >
                                    just now
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                height: "100%",
                                minHeight: 80,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "1px dashed",
                                borderColor: "divider",
                                borderRadius: 2,
                                color: "text.secondary",
                              }}
                            >
                              Select a template to preview
                            </Box>
                          )}
                        </Grid>
                      </Grid>
                    )}

                    {/* {createCampaignErrors.contactList && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {"Contact List is required."}
                      </Alert>
                    )} */}

                    {createCampaignType === "email" &&
                      emailContentMode === "prompt" && (
                        <Alert severity="info" sx={{ mt: 1 }}>
                          Prompt mode sends using permutation and combination of
                          generated variants across recipients (5 subjects x 5
                          bodies = 25 combinations).
                        </Alert>
                      )}
                  </Grid>

                  {createCampaignType === "email" && showEmailPreview && (
                    <Grid item xs={12}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.6,
                          borderRadius: "12px",
                          borderColor: alpha(theme.palette.primary.main, 0.2),
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700, mb: 1 }}
                        >
                          Email Body Preview
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mb: 1.2, color: "text.secondary" }}
                        >
                          <strong>Subject:</strong>{" "}
                          {emailSubject ||
                            createCampaignName ||
                            "Campaign Update"}
                        </Typography>
                        <Divider sx={{ mb: 1.4 }} />
                        <Box
                          sx={{
                            borderRadius: "10px",
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            p: 1.8,
                            bgcolor: alpha(theme.palette.common.white, 0.82),
                          }}
                        >
                          {emailEditorMode === "html" ||
                            looksLikeHtml(createMessageTemplate) ? (
                            <Box
                              sx={{
                                "& h1, & h2, & h3": { mt: 0 },
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.7
                              }}
                              dangerouslySetInnerHTML={{
                                __html: formatEmailPreview(
                                  (emailContentMode === "prompt"
                                    ? generatedBodies[0]
                                    : createMessageTemplate)) ||
                                  '<p style="color:#64748b;">No HTML content yet.</p>',
                              }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: "pre-wrap",
                                color: "text.primary",
                              }}
                            >
                              {(emailContentMode === "prompt"
                                ? generatedBodies[0]
                                : createMessageTemplate) ||
                                "No message content yet."}
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    </Grid>
                  )}


                  <Grid item xs={12}>
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        p: 2,
                        backgroundColor: "background.paper",
                      }}
                    >
                      {/* Section Header */}
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                        >
                          Campaign Schedule
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Configure when this campaign should run.
                        </Typography>
                      </Box>

                      {/* Active Days */}
                      <Box sx={{ mb: 2.5 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ mb: 0.5 }}
                        >
                          Active Days
                          <Box
                            component="span"
                            sx={{ color: "error.main", ml: 0.3 }}
                          >
                            *
                          </Box>
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Campaign will run only on the selected days.
                        </Typography>

                        <ToggleButtonGroup
                          value={activeDays}
                          onChange={(_, newDays) => {
                            setActiveDays(newDays);
                          }}
                          sx={{
                            width: "100%",
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "repeat(4, 1fr)",
                              sm: "repeat(7, 1fr)",
                            },
                            gap: 1,
                            mt: 1.5,

                            "& .MuiToggleButtonGroup-grouped": {
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: "8px !important",
                              margin: 0,
                            },
                          }}
                        >
                          {[
                            { label: "Mon", value: "Monday" },
                            { label: "Tue", value: "Tuesday" },
                            { label: "Wed", value: "Wednesday" },
                            { label: "Thu", value: "Thursday" },
                            { label: "Fri", value: "Friday" },
                            { label: "Sat", value: "Saturday" },
                            { label: "Sun", value: "Sunday" },
                          ].map((day) => (
                            <ToggleButton
                              key={day.value}
                              value={day.value}
                              sx={{
                                height: 40,
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "0.8rem",

                                "&.Mui-selected": {
                                  backgroundColor: "primary.main",
                                  color: "white",
                                  borderColor: "primary.main",

                                  "&:hover": {
                                    backgroundColor: "primary.dark",
                                  },
                                },
                              }}
                            >
                              {day.label}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                        {/* Active Days Error */}
                        {createCampaignErrors.activeDays && (
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{
                              display: "block",
                              mt: 1,
                            }}
                          >
                            Please select at least one active day.
                          </Typography>
                        )}
                      </Box>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* Time Configuration */}
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ mb: 1.5 }}
                      >
                        Sending Window
                      </Typography>

                      <Grid container spacing={2}>
                        {/* Optional Schedule */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            size="small"
                            sx={compactInputSx}
                            fullWidth
                            type="datetime-local"
                            label={
                              !isEditMode && campaignSequences.some(
                                (sequence) =>
                                  sequence.template_id !== null &&
                                  sequence.template_id !== undefined &&
                                  Number(sequence.template_id) > 0
                              )
                                ? "Campaign Start Date"
                                : "Campaign Start Date (Optional)"
                            }
                            value={createScheduledTime}
                            onChange={(e) => setCreateScheduledTime(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            error={createCampaignErrors.scheduleDate}
                            helperText={
                              createCampaignErrors.scheduleDate
                                ? "Campaign start date is required when a sequence is added."
                                : "Campaign will not run before this date and time."
                            }
                          />
                        </Grid>

                        {/* Start Time */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            size="small"
                            sx={compactInputSx}
                            fullWidth
                            type="time"
                            required
                            label="Start Time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            error={createCampaignErrors.startTime}
                            helperText={
                              createCampaignErrors.startTime
                                ? "Start time must be before end time."
                                : "Campaign can start sending from this time."
                            }
                          />
                        </Grid>

                        {/* End Time */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            size="small"
                            sx={compactInputSx}
                            fullWidth
                            type="time"
                            required
                            label="End Time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            error={createCampaignErrors.endTime}
                            helperText={
                              createCampaignErrors.endTime
                                ? "End time must be after start time."
                                : "Campaign will stop sending after this time."
                            }
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                  {!isEditMode && (
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          p: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            mb: 2,
                          }}
                        >
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Campaign Sequence
                            </Typography>

                            <Typography variant="caption" color="text.secondary">
                              Create follow-up sequences using different contact lists
                              and configurable day gaps.
                            </Typography>
                          </Box>

                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => {
                              setCampaignSequences((prev) => [
                                ...prev,
                                {
                                  sequence_order: prev.length + 1,
                                  gap_days: 0,
                                  template_id: null,
                                },
                              ]);
                            }}
                          >
                            Add Sequence
                          </Button>
                        </Box>

                        <Stack spacing={1.5}>
                          {campaignSequences.map((sequence, index) => (
                            <Box
                              key={sequence.id ?? index}
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 2,
                                p: 1.5,
                              }}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                mb={1.5}
                              >
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                >
                                  {getSequenceCampaignName(index)}
                                </Typography>

                                {campaignSequences.length > 1 && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setCampaignSequences((prev) =>
                                        prev
                                          .filter((_, i) => i !== index)
                                          .map((item, i) => ({
                                            ...item,
                                            sequence_order: i + 1,
                                          }))
                                      );
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Stack>

                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    size="small"
                                    fullWidth
                                    type="number"
                                    label="Gap (Days)"
                                    value={sequence.gap_days}
                                    inputProps={{ min: 0 }}
                                    error={
                                      createCampaignErrors.sequences &&
                                      Number(sequence.gap_days) <= 0
                                    }
                                    helperText={
                                      createCampaignErrors.sequences &&
                                        Number(sequence.gap_days) <= 0
                                        ? "Gap must be greater than 0."
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const value = Math.max(
                                        0,
                                        Number(e.target.value)
                                      );

                                      setCampaignSequences((prev) =>
                                        prev.map((item, i) =>
                                          i === index
                                            ? {
                                              ...item,
                                              gap_days: value,
                                            }
                                            : item
                                        )
                                      );
                                    }}
                                  />
                                </Grid>

                                <Grid item xs={12} sm={8}>
                                  <Stack direction="row" spacing={2} alignItems="center">
                                    <FormControl
                                      fullWidth
                                      size="small"
                                      error={
                                        createCampaignErrors.sequences &&
                                        !sequence.template_id
                                      }
                                    >
                                      <InputLabel>Template</InputLabel>

                                      <Select
                                        value={sequence.template_id ?? ""}
                                        label="Template"
                                        onChange={(e) => {
                                          const value = e.target.value;

                                          setCampaignSequences((prev) =>
                                            prev.map((item, i) =>
                                              i === index
                                                ? {
                                                  ...item,
                                                  template_id:
                                                    value === "" ? null : Number(value),
                                                }
                                                : item
                                            )
                                          );
                                        }}
                                      >

                                        {messageTemplates
                                          ?.filter((t) => t.type === createCampaignType)
                                          .map((template) => (
                                            <MenuItem key={template.id} value={template.id}>
                                              {template.name}
                                            </MenuItem>
                                          ))}
                                      </Select>
                                      {createCampaignErrors.sequences &&
                                        !sequence.template_id && (
                                          <FormHelperText>
                                            Template is required.
                                          </FormHelperText>
                                        )}
                                    </FormControl>

                                    <Button
                                      variant="outlined"
                                      startIcon={<VisibilityIcon />}
                                      onClick={() => handlePreviewTemplate(sequence.template_id)}
                                      disabled={!sequence.template_id}
                                      sx={{
                                        height: "40px",
                                        minWidth: "140px",
                                        borderRadius: "12px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        fontSize: "14px",
                                        borderColor: "#7BAAF7",
                                        color: "#3B82F6",
                                        whiteSpace: "nowrap",
                                        "&:hover": {
                                          borderColor: "#3B82F6",
                                          backgroundColor: "#F5F9FF",
                                        },
                                      }}
                                    >
                                      Preview
                                    </Button>
                                  </Stack>
                                </Grid>
                              </Grid>
                            </Box>
                          ))}
                        </Stack>
                        {createCampaignErrors.sequences && (
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{
                              display: "block",
                              mt: 1.5,
                              fontWeight: 500,
                            }}
                          >
                            Please correct the sequence details before continuing.
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  )}
                  {/* Actions */}
                  <Grid item xs={12}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <Button
                        size="small"
                        sx={compactButtonSx}
                        variant="contained"
                        onClick={
                          isEditMode
                            ? handleUpdateCampaign
                            : handleCreateCampaign
                        }
                        startIcon={
                          isEditMode ? <SaveIcon /> : <AddIcon />
                        }
                      >
                        {isEditMode
                          ? "Update Campaign"
                          : "Create Campaign"}
                      </Button>

                      {isEditMode && (
                        <Button
                          size="small"
                          sx={compactButtonSx}
                          variant="outlined"
                          color="error"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      )}
                    </Stack>
                  </Grid>

                  {/* <Grid item xs={12} md={4}>
                    <TextField
                      size="small"
                      sx={compactInputSx}
                      fullWidth
                      type="datetime-local"
                      label="Schedule Time (IST, optional)"
                      value={createScheduledTime}
                      onChange={(e) => setCreateScheduledTime(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText="All campaign times are shown and interpreted in IST."
                    />
                  </Grid>

                  <Grid item xs={12} md={8}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        size="small"
                        sx={compactButtonSx}
                        variant="contained"
                        onClick={isEditMode ? handleUpdateCampaign : handleCreateCampaign}
                        startIcon={isEditMode ? <SaveIcon /> : <AddIcon />}
                      >
                        {isEditMode ? "Update Campaign" : "Create Campaign"}
                      </Button>
                      {isEditMode && (
                        <Button
                          size="small"
                          sx={compactButtonSx}
                          variant="outlined"
                          color="error"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      )}
                    </Stack>
                  </Grid> */}

                  {/* <Grid item xs={12}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      Recipient Preview
                    </Typography>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ mb: 1.5 }}
                    >
                      <TextField
                        size="small"
                        sx={compactInputSx}
                        label="Filter Contacts"
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                      />
                      <Button
                        size="small"
                        sx={compactButtonSx}
                        variant="outlined"
                        onClick={() =>
                          createContactListId &&
                          loadPreviewContacts(Number(createContactListId))
                        }
                      >
                        Apply
                      </Button>
                    </Stack>
                    {previewContacts.length ? (
                      <Stack spacing={0.75}>
                        {previewContacts.map((contact) => (
                          <Typography key={contact.id} variant="body2">
                            {contact.name || "Unnamed"} - {contact.email || "-"}{" "}
                            {contact.phone ? `| ${contact.phone}` : ""}{" "}
                            {contact.company ? `| ${contact.company}` : ""}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No contacts to preview.
                      </Typography>
                    )}
                  </Paper>
                </Grid> */}
                </Grid>
              </Paper>

              {previewContactListId && (
                <div ref={secondSectionRef}>
                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                      Recipient Preview List
                    </Typography>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ mb: 2 }}
                    >
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Search Contacts"
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <SearchIcon />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Stack>
                    <TableContainer
                      sx={{
                        borderRadius: "12px",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      }}
                    >
                      <Table>
                        <TableHead>
                          <TableRow
                            sx={{
                              background: `linear-gradient(110deg, ${alpha("#e7f0ff", 0.8)} 0%, ${alpha("#d8e9ff", 0.68)} 100%)`,
                            }}
                          >
                            <TableCell>Contact</TableCell>
                            <TableCell>Company</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewContacts.length ? (
                            previewContacts.map((contact) => (
                              <TableRow
                                key={contact.id}
                                hover
                                sx={{
                                  "&:hover": {
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.05,
                                    ),
                                  },
                                }}
                              >
                                <TableCell
                                  sx={{
                                    minWidth: 200,
                                    maxWidth: 300,
                                    verticalAlign: "top",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600, lineHeight: 1.35 }}
                                  >
                                    {contact.name?.trim() || "—"}
                                  </Typography>
                                  <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                                    {contact.email?.trim() ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                          lineHeight: 1.35,
                                          fontSize: "0.7rem",
                                        }}
                                      >
                                        <EmailIcon
                                          sx={{
                                            fontSize: 13,
                                            flexShrink: 0,
                                            opacity: 0.85,
                                          }}
                                        />
                                        <Box
                                          component="span"
                                          sx={{ wordBreak: "break-word" }}
                                        >
                                          {contact.email}
                                        </Box>
                                      </Typography>
                                    ) : null}
                                    {contact.phone?.trim() ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                          lineHeight: 1.35,
                                          fontSize: "0.7rem",
                                        }}
                                      >
                                        <CallIcon
                                          sx={{
                                            fontSize: 13,
                                            flexShrink: 0,
                                            opacity: 0.85,
                                          }}
                                        />
                                        <Box
                                          component="span"
                                          sx={{ wordBreak: "break-word" }}
                                        >
                                          {contact.phone}
                                        </Box>
                                      </Typography>
                                    ) : null}
                                    {!contact.email?.trim() &&
                                      !contact.phone?.trim() ? (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ fontSize: "0.7rem" }}
                                      >
                                        No email or phone on file
                                      </Typography>
                                    ) : null}
                                  </Stack>
                                </TableCell>
                                <TableCell>{contact.company || "-"}</TableCell>
                                <TableCell>
                                  {formatDate(contact.created_at)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    color="info"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() => handleView(contact)}
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} align="center">
                                No contacts found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <TablePagination
                      component="div"
                      count={previewContactTotal}
                      page={previewContactPage}
                      onPageChange={(_, value) => setPreviewContactPage(value)}
                      rowsPerPage={previewContactRowsPerPage}
                      onRowsPerPageChange={(event) => {
                        setPreviewContactRowsPerPage(parseInt(event.target.value, 10));
                        setPreviewContactPage(0);
                      }}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  </Paper>
                </div>
              )}

              <Dialog
                open={templatePreviewOpen}
                onClose={() => setTemplatePreviewOpen(false)}
                fullWidth
                maxWidth="md"
              >
                <DialogTitle
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Template Preview
                    </Typography>

                    {selectedPreviewTemplate?.name && (
                      <Typography variant="caption" color="text.secondary">
                        {selectedPreviewTemplate.name}
                      </Typography>
                    )}
                  </Box>

                  <IconButton onClick={() => setTemplatePreviewOpen(false)}>
                    <CloseIcon />
                  </IconButton>
                </DialogTitle>

                <DialogContent dividers>
                  {/* EMAIL */}
                  {createCampaignType === "email" && (
                    <Box>
                      {/* Subject */}
                      <Box
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          pb: 2,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={600}
                        >
                          Subject
                        </Typography>

                        <Typography variant="body1" sx={{ mt: 0.5 }}>
                          {selectedPreviewTemplate?.subject || "No subject"}
                        </Typography>
                      </Box>

                      {/* Email body */}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                      >
                        Email Content
                      </Typography>
                      <Box
                        sx={{
                          "& h1, & h2, & h3": { mt: 0 },
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.7
                        }}
                        dangerouslySetInnerHTML={{
                          __html: formatEmailPreview(
                            (selectedPreviewTemplate?.content ||
                              selectedPreviewTemplate?.message_template || "")) ||
                            '<p style="color:#64748b;">No HTML content yet.</p>',
                        }}
                      />

                    </Box>
                  )}

                  {/* SMS */}
                  {createCampaignType === "sms" && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                      >
                        SMS Preview
                      </Typography>

                      <Box
                        sx={{
                          mt: 2,
                          display: "flex",
                          justifyContent: "flex-start",
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: "75%",
                            backgroundColor: "#f1f1f1",
                            borderRadius: "16px",
                            borderBottomLeftRadius: "4px",
                            px: 2,
                            py: 1.5,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {selectedPreviewTemplate?.content ||
                              selectedPreviewTemplate?.message_template ||
                              ""}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {/* WHATSAPP */}
                  {createCampaignType === "whatsapp" && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                      >
                        WhatsApp Preview
                      </Typography>

                      <Box
                        sx={{
                          mt: 2,
                          borderRadius: 2,
                          p: 3,
                          backgroundColor: "#e5ddd5",
                          minHeight: 350,
                          display: "flex",
                          alignItems: "flex-end",
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: "75%",
                            backgroundColor: "#ffffff",
                            borderRadius: "8px",
                            borderTopLeftRadius: "2px",
                            px: 2,
                            py: 1.5,
                            boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {selectedPreviewTemplate?.content ||
                              selectedPreviewTemplate?.message_template ||
                              ""}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              textAlign: "right",
                              mt: 0.5,
                            }}
                          >
                            12:00 PM
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </DialogContent>

                <DialogActions>
                  <Button
                    variant="outlined"
                    onClick={() => setTemplatePreviewOpen(false)}
                  >
                    Close
                  </Button>
                </DialogActions>
              </Dialog>
            </Stack>

          )}

          {tab === 2 && (
            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Run Campaign
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Filter, run, pause, and inspect campaign executions.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    sx={compactButtonSx}
                    variant="outlined"
                    onClick={handleRefresh}
                    startIcon={<RefreshIcon />}
                  >
                    Refresh
                  </Button>

                  <Button
                    size="small"
                    sx={compactButtonSx}
                    variant="contained"
                    onClick={handleRunDueCampaigns}
                    startIcon={<PlayArrowIcon />}
                  >
                    Run Due Scheduled
                  </Button>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      p: "3px",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: "8px",
                      backgroundColor: "background.paper",
                      gap: "2px",
                    }}
                  >
                    <Button
                      size="small"
                      onClick={() => setCampaignView("table")}
                      startIcon={<TableRowsIcon sx={{ fontSize: 18 }} />}
                      sx={{
                        minWidth: 90,
                        height: 34,
                        px: 1.5,
                        borderRadius: "6px",
                        textTransform: "none",
                        fontWeight: 600,
                        color: campaignView === "table" ? "primary.main" : "text.secondary",
                        backgroundColor:
                          campaignView === "table" ? "primary.50" : "transparent",
                        "&:hover": {
                          backgroundColor:
                            campaignView === "table" ? "primary.100" : "action.hover",
                        },
                      }}
                    >
                      Table
                    </Button>

                    <Button
                      size="small"
                      onClick={() => setCampaignView("calendar")}
                      startIcon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
                      sx={{
                        minWidth: 100,
                        height: 34,
                        px: 1.5,
                        borderRadius: "6px",
                        textTransform: "none",
                        fontWeight: 600,
                        color:
                          campaignView === "calendar" ? "primary.main" : "text.secondary",
                        backgroundColor:
                          campaignView === "calendar" ? "primary.50" : "transparent",
                        "&:hover": {
                          backgroundColor:
                            campaignView === "calendar" ? "primary.100" : "action.hover",
                        },
                      }}
                    >
                      Calendar
                    </Button>
                  </Box>
                </Stack>
              </Stack>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Search Campaign"
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={campaignTypeFilter}
                      label="Type"
                      onChange={(e) => setCampaignTypeFilter(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="email">Email</MenuItem>
                      <MenuItem value="whatsapp">WhatsApp</MenuItem>
                      <MenuItem value="sms">SMS</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={campaignStatusFilter}
                      label="Status"
                      onChange={(e) => setCampaignStatusFilter(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="draft">Draft</MenuItem>
                      <MenuItem value="scheduled">Scheduled</MenuItem>
                      <MenuItem value="running">Running</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="failed">Failed</MenuItem>
                      <MenuItem value="paused">Paused</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Product</InputLabel>
                    <Select
                      value={campaignProductFilter}
                      label="Product"
                      onChange={(e) =>
                        setCampaignProductFilter(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    >
                      <MenuItem value="">All</MenuItem>
                      {products.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name} ({item.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      sx={compactButtonSx}
                      fullWidth
                      variant="outlined"
                      onClick={handleApplyCampaignFilters}
                    >
                      Apply
                    </Button>
                  </Stack>
                </Grid>
              </Grid>

              {campaignView === "calendar" ? (
                <Box
                  sx={{
                    borderRadius: "12px",
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    p: 2,
                    backgroundColor: "#fff",
                  }}
                >
                  {/* Custom Calendar Header */}
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    sx={{ mb: 1.5 }}
                  >
                    {/* Calendar Legend */}
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        backgroundColor: "background.paper",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "text.secondary",
                          mr: 0.5,
                        }}
                      >
                        Status
                      </Typography>

                      {Object.entries(statusConfig).map(([status, config]) => {
                        const borderColor = statusBorderColors[config.color];

                        return (
                          <Stack
                            key={status}
                            direction="row"
                            alignItems="center"
                            spacing={0.6}
                            sx={{
                              px: 1,
                              py: 0.35,
                              borderRadius: 1.5,
                              border: "1px solid",
                              borderColor: `${borderColor}40`,
                              backgroundColor: `${borderColor}08`,
                            }}
                          >
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                backgroundColor: borderColor,
                                flexShrink: 0,
                              }}
                            />

                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "text.secondary",
                                lineHeight: 1.4,
                              }}
                            >
                              {config.label}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Stack>
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    datesSet={(dateInfo) => {
                      fetchCalendarCampaigns(
                        dateInfo.view.currentStart,
                        dateInfo.view.currentEnd
                      );
                    }}
                    timeZone="local"
                    height="auto"
                    events={calendarEvents}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "",
                    }}
                    eventDisplay="block"
                    dayMaxEvents={2}
                    eventClick={(info) => {
                      info.jsEvent.preventDefault();
                      info.jsEvent.stopPropagation();

                      const campaign = info.event.extendedProps?.campaign;

                      if (!campaign) return;

                      setSelectedCampaign(campaign);
                      setMenuType("calendar");

                      const menuWidth = 220;
                      const menuHeight = 160;
                      const padding = 10;

                      let x = info.jsEvent.clientX + 8;
                      let y = info.jsEvent.clientY + 8;

                      if (x + menuWidth > window.innerWidth - padding) {
                        x = info.jsEvent.clientX - menuWidth - 8;
                      }

                      if (y + menuHeight > window.innerHeight - padding) {
                        y = info.jsEvent.clientY - menuHeight - 8;
                      }

                      x = Math.max(padding, x);
                      y = Math.max(padding, y);

                      setEventMenu({
                        open: true,
                        x,
                        y,
                        campaign,
                      });
                    }}
                    eventDidMount={(info) => {
                      const campaign = info.event.extendedProps?.campaign;

                      if (!campaign) return;

                      const config = getStatusConfig(campaign.status);
                      const borderColor = statusBorderColors[config.color];

                      info.el.style.setProperty("--campaign-status-color", borderColor);

                      info.el.style.cursor = "pointer";
                      info.el.setAttribute("tabindex", "-1");
                    }}
                    eventContent={(eventInfo) => {
                      const campaign = eventInfo.event.extendedProps?.campaign;

                      if (!campaign) return null;

                      const eventDate = eventInfo.event.start;

                      const time = eventDate
                        ? eventDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "";

                      return (
                        <Tooltip
                          title={campaign.campaign_name}
                          placement="top"
                          arrow
                          enterDelay={300}
                        >
                          <Box
                            sx={{
                              width: "100%",
                              minWidth: 0,
                              px: 0.75,
                              py: 0.5,
                              overflow: "hidden",
                            }}
                          >
                            {/* Campaign name */}
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                fontSize: "12px",
                                lineHeight: 1.4,
                                fontWeight: 600,
                                color: "#1F2937",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {time} {campaign.campaign_name}
                            </Typography>

                            {/* Type + Status */}
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                mt: 0.4,
                                minWidth: 0,
                              }}
                            >
                              <SourceChip
                                value={campaign.campaign_type}
                                height={19}
                                fontSize="10px"
                                fontWeight={600}
                              />

                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="center"
                              >
                                <GroupIcon fontSize="small" color="primary" />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {campaign.contact_count}
                                </Typography>
                              </Stack>
                            </Box>
                          </Box>
                        </Tooltip>
                      );
                    }}
                  />
                </Box>
              ) : (
                <>
                  <TableContainer
                    sx={{
                      borderRadius: "12px",
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow
                          sx={{
                            background: `linear-gradient(110deg, ${alpha("#e7f0ff", 0.8)} 0%, ${alpha("#d8e9ff", 0.68)} 100%)`,
                          }}
                        >
                          <TableCell>Campaign Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Product</TableCell>
                          <TableCell>Scheduled Date</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {campaigns.length > 0 ? (
                          campaigns.map((item) => {
                            const config = getStatusConfig(item.status);

                            return (
                              <TableRow
                                key={item.id}
                                hover
                                sx={{
                                  "&:hover": {
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.05,
                                    ),
                                  },
                                }}
                              >
                                <TableCell>
                                  <Typography
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.9rem",
                                      lineHeight: 1.3,
                                      mb: 0.6,
                                    }}
                                  >
                                    {item.campaign_name}
                                  </Typography>

                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    useFlexGap
                                  >
                                    {/* Contact List */}
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.4,
                                        fontWeight: 500,
                                      }}
                                    >
                                      List:
                                      <Box
                                        component="span"
                                        sx={{
                                          color: "text.primary",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {item.contact_list_name || `#${item.contact_list_id}`}
                                      </Box>
                                    </Typography>

                                    {/* Contact Count */}
                                    <Stack
                                      direction="row"
                                      spacing={0.5}
                                      alignItems="center"
                                    >
                                      <GroupIcon fontSize="small" color="primary" />
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {item.contact_count}
                                      </Typography>
                                    </Stack>
                                  </Stack>
                                </TableCell>
                                <TableCell>{item.campaign_type}</TableCell>
                                <TableCell>{item.product_name || "-"}</TableCell>
                                <TableCell> {formatDisplayDate(item.scheduled_time)}</TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={config.label}
                                    color={config.color}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>
                                  {formatDisplayDate(item.created_at)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<SettingsIcon fontSize="small" />}
                                    onClick={(e) => handleActionClick(e, item)}
                                    disabled={busyAction}
                                    sx={{ textTransform: "none", fontWeight: 600 }}
                                  >
                                    Actions
                                  </Button>
                                </TableCell>
                                {/* <TableCell>
                            <Stack direction="row" spacing={1}>

                              <Button
                                size="small"
                                startIcon={<PlayArrowIcon />}
                                onClick={() =>
                                  setRunConfirmCampaign({
                                    id: item.id,
                                    name: item.campaign_name,
                                  })
                                }
                                disabled={isPlayDisabled(item.status)}
                              >
                                Run
                              </Button>
                              <Button
                                size="small"
                                color="inherit"
                                startIcon={<PauseIcon />}
                                onClick={() => handlePauseCampaign(item.id)}
                                disabled={isPauseDisabled(item.status)}
                              >
                                Pause
                              </Button>
                              <Button
                                size="small"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handleViewLogs(item.id)}
                              >
                                View
                              </Button>
                            </Stack>
                          </TableCell> */}
                              </TableRow>
                            )
                          }
                          )
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              No campaigns found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={campaignTotal}
                    page={campaignPage}
                    onPageChange={(_, pageValue) => setCampaignPage(pageValue)}
                    rowsPerPage={campaignRowsPerPage}
                    onRowsPerPageChange={(event) => {
                      setCampaignRowsPerPage(parseInt(event.target.value, 10));
                      setCampaignPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                  />
                </>
              )}



              <Menu
                open={
                  menuType === "calendar"
                    ? eventMenu.open
                    : Boolean(anchorEl)
                }
                onClose={handleClose}
                anchorReference={
                  menuType === "calendar"
                    ? "anchorPosition"
                    : "anchorEl"
                }
                anchorPosition={
                  menuType === "calendar"
                    ? {
                      top: eventMenu.y,
                      left: eventMenu.x,
                    }
                    : undefined
                }
                anchorEl={
                  menuType === "table"
                    ? anchorEl
                    : undefined
                }
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                disableAutoFocusItem
              >
                <MenuItem
                  disabled={!selectedCampaign || isPlayDisabled(selectedCampaign.status)}
                  onClick={() => {
                    if (!selectedCampaign) return;

                    setRunConfirmCampaign({
                      id: selectedCampaign.id,
                      name: selectedCampaign.campaign_name,
                    });

                    handleClose();
                  }}
                >
                  <ListItemIcon>
                    <PlayArrowIcon fontSize="small" />
                  </ListItemIcon>
                  Run
                </MenuItem>

                <MenuItem
                  disabled={!selectedCampaign || isPauseDisabled(selectedCampaign.status)}
                  onClick={() => {
                    if (!selectedCampaign) return;

                    handlePauseCampaign(selectedCampaign.id);
                    handleClose();
                  }}
                >
                  <ListItemIcon>
                    <PauseIcon fontSize="small" />
                  </ListItemIcon>
                  Pause
                </MenuItem>
                <MenuItem
                  disabled={
                    !selectedCampaign ||
                    !["draft", "scheduled", "paused"].includes(selectedCampaign.status)
                  }
                  onClick={() => {
                    if (!selectedCampaign) return;

                    handleEditCampaign(selectedCampaign.id);
                    handleClose();
                  }}
                >
                  <ListItemIcon>
                    <EditIcon fontSize="small" />
                  </ListItemIcon>
                  Edit
                </MenuItem>

                <MenuItem
                  disabled={!selectedCampaign}
                  onClick={() => {
                    if (!selectedCampaign) return;

                    handleViewLogs(selectedCampaign.id);
                    handleClose();
                  }}
                >
                  <ListItemIcon>
                    <VisibilityIcon fontSize="small" />
                  </ListItemIcon>
                  View
                </MenuItem>
                <MenuItem
                  disabled={!selectedCampaign || isDeleteDisabled(selectedCampaign.status)}
                  onClick={() => {
                    if (!selectedCampaign) return;
                    setCampaignToDelete(selectedCampaign);
                  }}
                >
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  Delete
                </MenuItem>
              </Menu>
            </Paper>
          )}

          {tab === 3 && (
            <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Campaign Logs
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Campaign</InputLabel>
                    <Select
                      value={selectedCampaignId}
                      label="Campaign"
                      onChange={(e) =>
                        setSelectedCampaignId(Number(e.target.value))
                      }
                    >
                      {campaignOptions.map((campaign) => (
                        <MenuItem key={campaign.id} value={campaign.id}>
                          {campaign.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Search"
                    placeholder="Search by name, email, phone  .."
                    value={logSearchText}
                    onChange={(e) => setLogSearchText(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={logStatusFilter}
                      label="Status"
                      onChange={(e) => setLogStatusFilter(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="delivered">Delivered</MenuItem>
                      <MenuItem value="opened">Opened</MenuItem>
                      <MenuItem value="read">Read</MenuItem>
                      <MenuItem value="clicked">Clicked</MenuItem>
                      <MenuItem value="bounced">Bounced</MenuItem>
                      <MenuItem value="complained">Complained</MenuItem>
                      <MenuItem value="unsubscribed">Unsubscribed</MenuItem>
                      <MenuItem value="sent">Sent</MenuItem>
                      <MenuItem value="failed">Failed</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleApplyLogsFilter}
                  >
                    Apply
                  </Button>
                </Grid>
                <Grid item xs={12} md={2}>
                  {selectedCampaignId && (
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => loadLogs(Number(selectedCampaignId))}
                    >
                      Refresh
                    </Button>
                  )}
                </Grid>
              </Grid>

              <TableContainer
                sx={{
                  borderRadius: "12px",
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{
                        background: `linear-gradient(110deg, ${alpha("#e7f0ff", 0.8)} 0%, ${alpha("#d8e9ff", 0.68)} 100%)`,
                      }}
                    >
                      <TableCell>Contact</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>From Email</TableCell>
                      <TableCell>Delivered</TableCell>
                      <TableCell>Opened / Read</TableCell>
                      <TableCell>Clicks</TableCell>
                      <TableCell>Last Event</TableCell>
                      <TableCell>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.length ? (
                      logs.map((item) => (
                        <TableRow
                          key={item.id}
                          hover
                          sx={{
                            "&:hover": {
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.05,
                              ),
                            },
                          }}
                        >
                          <TableCell>
                            <Box>
                              <Typography fontWeight={600}>
                                {item.contact_name || "-"}
                              </Typography>

                              {item.email && (
                                <Typography variant="caption" display="block">
                                  {item.email}
                                </Typography>
                              )}

                              {item.phone && (
                                <Typography variant="caption" display="block">
                                  {item.phone}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={item.status}
                              color={logStatusColor(item.status)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{item.from_email || "-"}</TableCell>
                          <TableCell>
                            {formatDisplayDate(
                              item.delivered_at ||
                              item.sent_at ||
                              item.created_at,
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              sx={{ display: "block" }}
                            >
                              Open: {formatDisplayDate(item.opened_at)}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ display: "block" }}
                            >
                              Read: {formatDisplayDate(item.read_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              sx={{ display: "block" }}
                            >
                              Count: {item.click_count || 0}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ display: "block" }}
                            >
                              Last: {formatDisplayDate(item.clicked_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              sx={{ display: "block" }}
                            >
                              {item.last_event_type || "-"}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ display: "block" }}
                            >
                              {formatDisplayDate(item.last_event_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {item.error_message ? (
                              <Tooltip title={item.error_message} arrow>
                                <ErrorOutlineIcon
                                  color="error"
                                  sx={{ cursor: "pointer" }}
                                />
                              </Tooltip>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          No logs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={logTotal}
                page={logPage}
                onPageChange={(_, value) => setLogPage(value)}
                rowsPerPage={logRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setLogRowsPerPage(parseInt(event.target.value, 10));
                  setLogPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </Paper>
          )}

          {tab === 4 && (
            <Stack spacing={2.5}>
              <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", md: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Campaign Reports
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<FileDownloadIcon />}
                      disabled={!reportData}
                      onClick={() => {
                        if (!reportData) return;
                        downloadTextFile(
                          `campaign_reports_${reportData.window_days}d.json`,
                          JSON.stringify(reportData, null, 2),
                          "application/json",
                        );
                      }}
                    >
                      Export Full JSON
                    </Button>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Window</InputLabel>
                      <Select
                        value={reportDays}
                        label="Window"
                        onChange={(e) => setReportDays(Number(e.target.value))}
                      >
                        <MenuItem value={7}>Last 7 days</MenuItem>
                        <MenuItem value={30}>Last 30 days</MenuItem>
                        <MenuItem value={90}>Last 90 days</MenuItem>
                        <MenuItem value={180}>Last 180 days</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await loadReports();
                        } catch (err: any) {
                          showError(
                            err?.response?.data?.detail ||
                            "Failed to refresh reports",
                          );
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Refresh
                    </Button>
                  </Stack>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block" }}
                >
                  Aggregated metrics focused on Email, SMS, and WhatsApp
                  campaign outcomes.
                </Typography>
              </Paper>

              {reportData ? (
                <>
                  <Paper sx={{ ...sectionPanelSx, p: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Overview KPIs
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => {
                          exportRowsToCsv(
                            `campaign_overview_kpis_${reportData.window_days}d.csv`,
                            ["Metric", "Value"],
                            [
                              ["Campaigns", reportData.overview.campaign_count],
                              ["Runs", reportData.overview.run_count],
                              ["Messages", reportData.overview.message_count],
                              ["Sent", reportData.overview.sent_count],
                              ["Failed", reportData.overview.failed_count],
                              [
                                "Success Rate %",
                                reportData.overview.success_rate,
                              ],
                            ],
                          );
                        }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                  </Paper>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(4, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    {[
                      {
                        label: "Campaigns",
                        value: reportData.overview.campaign_count,
                      },
                      { label: "Runs", value: reportData.overview.run_count },
                      {
                        label: "Messages",
                        value: reportData.overview.message_count,
                      },
                      {
                        label: "Success Rate",
                        value: `${reportData.overview.success_rate}%`,
                      },
                    ].map((metric) => (
                      <Paper
                        key={metric.label}
                        sx={{ ...sectionPanelSx, p: 2 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {metric.label}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          {metric.value}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>

                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{ mb: 1.2 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Channel Breakdown
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => {
                          exportRowsToCsv(
                            `campaign_channel_breakdown_${reportData.window_days}d.csv`,
                            [
                              "Channel",
                              "Runs",
                              "Messages",
                              "Sent",
                              "Failed",
                              "Success Rate %",
                            ],
                            (["email", "sms", "whatsapp"] as const).map(
                              (channel) => {
                                const row =
                                  reportData.channel_breakdown[channel];
                                return [
                                  channel,
                                  row.runs,
                                  row.messages,
                                  row.sent,
                                  row.failed,
                                  row.success_rate,
                                ];
                              },
                            ),
                          );
                        }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <TableContainer
                      sx={{
                        borderRadius: "12px",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Channel</TableCell>
                            <TableCell>Runs</TableCell>
                            <TableCell>Messages</TableCell>
                            <TableCell>Sent</TableCell>
                            <TableCell>Failed</TableCell>
                            <TableCell>Success Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(["email", "sms", "whatsapp"] as const).map(
                            (channel) => {
                              const row = reportData.channel_breakdown[channel];
                              return (
                                <TableRow key={`channel-${channel}`}>
                                  <TableCell
                                    sx={{
                                      textTransform: "uppercase",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {channel}
                                  </TableCell>
                                  <TableCell>{row.runs}</TableCell>
                                  <TableCell>{row.messages}</TableCell>
                                  <TableCell>{row.sent}</TableCell>
                                  <TableCell>{row.failed}</TableCell>
                                  <TableCell>{row.success_rate}%</TableCell>
                                </TableRow>
                              );
                            },
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>

                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{ mb: 1.2 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Email Analytics (Primary)
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => {
                          exportRowsToCsv(
                            `campaign_email_analytics_${reportData.window_days}d.csv`,
                            ["Metric", "Value"],
                            [
                              [
                                "Delivered",
                                reportData.email_analytics.delivered,
                              ],
                              ["Opened", reportData.email_analytics.opened],
                              ["Read", reportData.email_analytics.read],
                              ["Clicked", reportData.email_analytics.clicked],
                              ["Bounced", reportData.email_analytics.bounced],
                              [
                                "Complained",
                                reportData.email_analytics.complained,
                              ],
                              [
                                "Unsubscribed",
                                reportData.email_analytics.unsubscribed,
                              ],
                              [
                                "Total Open Events",
                                reportData.email_analytics.total_open_events,
                              ],
                              [
                                "Total Click Events",
                                reportData.email_analytics.total_click_events,
                              ],
                              [
                                "Delivery Rate %",
                                reportData.email_analytics.delivery_rate,
                              ],
                              [
                                "Open Rate %",
                                reportData.email_analytics.open_rate,
                              ],
                              [
                                "Read Rate %",
                                reportData.email_analytics.read_rate,
                              ],
                              [
                                "Click Rate %",
                                reportData.email_analytics.click_rate,
                              ],
                              [
                                "Click to Open Rate %",
                                reportData.email_analytics.click_to_open_rate,
                              ],
                              [
                                "Bounce Rate %",
                                reportData.email_analytics.bounce_rate,
                              ],
                              [
                                "Complaint Rate %",
                                reportData.email_analytics.complaint_rate,
                              ],
                              [
                                "Unsubscribe Rate %",
                                reportData.email_analytics.unsubscribe_rate,
                              ],
                            ],
                          );
                        }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <Grid container spacing={1.2}>
                      {[
                        {
                          label: "Delivery Rate",
                          value: `${reportData.email_analytics.delivery_rate}%`,
                        },
                        {
                          label: "Open Rate",
                          value: `${reportData.email_analytics.open_rate}%`,
                        },
                        {
                          label: "Read Rate",
                          value: `${reportData.email_analytics.read_rate}%`,
                        },
                        {
                          label: "Click Rate",
                          value: `${reportData.email_analytics.click_rate}%`,
                        },
                        {
                          label: "Click to Open",
                          value: `${reportData.email_analytics.click_to_open_rate}%`,
                        },
                        {
                          label: "Bounce Rate",
                          value: `${reportData.email_analytics.bounce_rate}%`,
                        },
                        {
                          label: "Complaint Rate",
                          value: `${reportData.email_analytics.complaint_rate}%`,
                        },
                        {
                          label: "Unsubscribe Rate",
                          value: `${reportData.email_analytics.unsubscribe_rate}%`,
                        },
                      ].map((metric) => (
                        <Grid item xs={12} sm={6} md={3} key={metric.label}>
                          <Paper
                            variant="outlined"
                            sx={{ p: 1.2, borderRadius: "10px" }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {metric.label}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {metric.value}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      sx={{ mt: 1.5 }}
                    >
                      <Chip
                        label={`Open Events: ${reportData.email_analytics.total_open_events}`}
                        variant="outlined"
                      />
                      <Chip
                        label={`Click Events: ${reportData.email_analytics.total_click_events}`}
                        variant="outlined"
                      />
                      <Chip
                        label={`Unique Opened: ${reportData.email_analytics.opened}`}
                        variant="outlined"
                      />
                      <Chip
                        label={`Unique Clicked: ${reportData.email_analytics.clicked}`}
                        variant="outlined"
                      />
                    </Stack>
                  </Paper>

                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{ mb: 1.2 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Top Campaigns
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => {
                          exportRowsToCsv(
                            `campaign_top_campaigns_${reportData.window_days}d.csv`,
                            [
                              "Campaign ID",
                              "Campaign Name",
                              "Type",
                              "Runs",
                              "Messages",
                              "Sent",
                              "Failed",
                              "Open Rate %",
                              "Click Rate %",
                              "Last Event",
                            ],
                            reportData.top_campaigns.map((row) => [
                              row.campaign_id,
                              row.campaign_name,
                              row.campaign_type,
                              row.runs,
                              row.messages,
                              row.sent,
                              row.failed,
                              row.open_rate,
                              row.click_rate,
                              row.last_event_at || "",
                            ]),
                          );
                        }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <TableContainer
                      sx={{
                        borderRadius: "12px",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Runs</TableCell>
                            <TableCell>Messages</TableCell>
                            <TableCell>Sent</TableCell>
                            <TableCell>Failed</TableCell>
                            <TableCell>Open Rate</TableCell>
                            <TableCell>Click Rate</TableCell>
                            <TableCell>Last Event</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.top_campaigns.length > 0 ? (
                            reportData.top_campaigns.map((row) => (
                              <TableRow
                                key={`report-campaign-${row.campaign_id}`}
                              >
                                <TableCell>{row.campaign_name}</TableCell>
                                <TableCell>{row.campaign_type}</TableCell>
                                <TableCell>{row.runs}</TableCell>
                                <TableCell>{row.messages}</TableCell>
                                <TableCell>{row.sent}</TableCell>
                                <TableCell>{row.failed}</TableCell>
                                <TableCell>{row.open_rate}%</TableCell>
                                <TableCell>{row.click_rate}%</TableCell>
                                <TableCell>
                                  {formatDisplayDate(row.last_event_at)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={9} align="center">
                                No report data found for selected window.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>

                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{ mb: 1.2 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Daily Trend
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => {
                          exportRowsToCsv(
                            `campaign_daily_trend_${reportData.window_days}d.csv`,
                            [
                              "Date",
                              "Email Sent",
                              "Email Opened",
                              "Email Clicked",
                              "SMS Sent",
                              "WhatsApp Sent",
                              "Failed",
                            ],
                            reportData.daily_trend.map((row) => [
                              row.date,
                              row.email_sent,
                              row.email_opened,
                              row.email_clicked,
                              row.sms_sent,
                              row.whatsapp_sent,
                              row.failed,
                            ]),
                          );
                        }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <TableContainer
                      sx={{
                        borderRadius: "12px",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Email Sent</TableCell>
                            <TableCell>Email Opened</TableCell>
                            <TableCell>Email Clicked</TableCell>
                            <TableCell>SMS Sent</TableCell>
                            <TableCell>WhatsApp Sent</TableCell>
                            <TableCell>Failed</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.daily_trend.length > 0 ? (
                            reportData.daily_trend.map((row) => (
                              <TableRow key={`daily-${row.date}`}>
                                <TableCell>{row.date}</TableCell>
                                <TableCell>{row.email_sent}</TableCell>
                                <TableCell>{row.email_opened}</TableCell>
                                <TableCell>{row.email_clicked}</TableCell>
                                <TableCell>{row.sms_sent}</TableCell>
                                <TableCell>{row.whatsapp_sent}</TableCell>
                                <TableCell>{row.failed}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} align="center">
                                No daily activity yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </>
              ) : (
                <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading report data...
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}

          {tab === 5 && (
            <Stack spacing={2.5}>
              <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Campaign to Lead (C2L)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure conversion rules and run the rule engine to convert
                  engaged campaign contacts into leads.
                </Typography>
                <Tabs
                  value={c2lTab}
                  onChange={(_, value) => setC2lTab(value)}
                  sx={{
                    mt: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                  }}
                >
                  <Tab label="Rule Setup" />
                  <Tab label="Run Engine" />
                </Tabs>
              </Paper>

              {c2lTab === 0 && c2lRule && (
                <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Rule Name"
                        value={c2lRule.rule_name}
                        onChange={(e) =>
                          setC2lRule((prev) =>
                            prev
                              ? { ...prev, rule_name: e.target.value }
                              : prev,
                          )
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        size="small"
                        fullWidth
                        type="number"
                        label="Min Score"
                        value={c2lRule.min_score_threshold}
                        onChange={(e) =>
                          setC2lRule((prev) =>
                            prev
                              ? {
                                ...prev,
                                min_score_threshold: Math.max(
                                  1,
                                  Number(e.target.value) || 1,
                                ),
                              }
                              : prev,
                          )
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        size="small"
                        fullWidth
                        type="number"
                        label="Dedupe Window (days)"
                        value={c2lRule.dedupe_window_days}
                        onChange={(e) =>
                          setC2lRule((prev) =>
                            prev
                              ? {
                                ...prev,
                                dedupe_window_days: Math.max(
                                  1,
                                  Number(e.target.value) || 1,
                                ),
                              }
                              : prev,
                          )
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Target Funnel Stage"
                        value={c2lRule.target_funnel_stage || ""}
                        onChange={(e) =>
                          setC2lRule((prev) =>
                            prev
                              ? { ...prev, target_funnel_stage: e.target.value }
                              : prev,
                          )
                        }
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.4, borderRadius: "10px" }}
                      >
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Include Statuses
                        </Typography>
                        <FormGroup row>
                          {["delivered", "opened", "read", "clicked"].map(
                            (status) => (
                              <FormControlLabel
                                key={`include-${status}`}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={(
                                      c2lRule.include_statuses || []
                                    ).includes(status)}
                                    onChange={(e) => {
                                      setC2lRule((prev) => {
                                        if (!prev) return prev;
                                        const next = new Set(
                                          prev.include_statuses || [],
                                        );
                                        if (e.target.checked) next.add(status);
                                        else next.delete(status);
                                        return {
                                          ...prev,
                                          include_statuses: Array.from(next),
                                        };
                                      });
                                    }}
                                  />
                                }
                                label={status}
                              />
                            ),
                          )}
                        </FormGroup>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper
                        variant="outlined"
                        sx={{ p: 1.4, borderRadius: "10px" }}
                      >
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Exclude Statuses
                        </Typography>
                        <FormGroup row>
                          {[
                            "failed",
                            "bounced",
                            "complained",
                            "unsubscribed",
                          ].map((status) => (
                            <FormControlLabel
                              key={`exclude-${status}`}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={(
                                    c2lRule.exclude_statuses || []
                                  ).includes(status)}
                                  onChange={(e) => {
                                    setC2lRule((prev) => {
                                      if (!prev) return prev;
                                      const next = new Set(
                                        prev.exclude_statuses || [],
                                      );
                                      if (e.target.checked) next.add(status);
                                      else next.delete(status);
                                      return {
                                        ...prev,
                                        exclude_statuses: Array.from(next),
                                      };
                                    });
                                  }}
                                />
                              }
                              label={status}
                            />
                          ))}
                        </FormGroup>
                      </Paper>
                    </Grid>

                    <Grid item xs={12}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        alignItems={{ xs: "stretch", sm: "center" }}
                      >
                        <FormControlLabel
                          control={
                            <Switch
                              checked={Boolean(c2lRule.auto_convert_enabled)}
                              onChange={(e) =>
                                setC2lRule((prev) =>
                                  prev
                                    ? {
                                      ...prev,
                                      auto_convert_enabled: e.target.checked,
                                    }
                                    : prev,
                                )
                              }
                            />
                          }
                          label="Auto-convert after campaign run"
                        />
                        <Button
                          variant="contained"
                          disabled={c2lSaving}
                          onClick={async () => {
                            if (!c2lRule) return;
                            setC2lSaving(true);
                            try {
                              const updated =
                                await campaignService.updateCampaignToLeadRule({
                                  rule_name: c2lRule.rule_name,
                                  auto_convert_enabled:
                                    c2lRule.auto_convert_enabled,
                                  min_score_threshold:
                                    c2lRule.min_score_threshold,
                                  dedupe_window_days:
                                    c2lRule.dedupe_window_days,
                                  target_funnel_stage:
                                    c2lRule.target_funnel_stage || undefined,
                                  include_statuses: c2lRule.include_statuses,
                                  exclude_statuses: c2lRule.exclude_statuses,
                                });
                              setC2lRule(updated);
                              showSuccess("C2L rule updated successfully");
                            } catch (err: any) {
                              showError(
                                err?.response?.data?.detail ||
                                "Failed to update C2L rule",
                              );
                            } finally {
                              setC2lSaving(false);
                            }
                          }}
                        >
                          {c2lSaving ? "Saving..." : "Save Rule"}
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {c2lTab === 1 && (
                <>
                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Campaign (optional)</InputLabel>
                          <Select
                            value={c2lRunCampaignId}
                            label="Campaign (optional)"
                            onChange={(e) =>
                              setC2lRunCampaignId(
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              )
                            }
                          >
                            <MenuItem value="">All Campaigns</MenuItem>
                            {campaignOptions.map((campaign) => (
                              <MenuItem
                                key={`c2l-campaign-${campaign.id}`}
                                value={campaign.id}
                              >
                                {campaign.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <TextField
                          size="small"
                          fullWidth
                          type="number"
                          label="Limit"
                          value={c2lRunLimit}
                          onChange={(e) =>
                            setC2lRunLimit(
                              Math.max(1, Number(e.target.value) || 1),
                            )
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={c2lDryRun}
                              onChange={(e) => setC2lDryRun(e.target.checked)}
                            />
                          }
                          label="Dry Run"
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={async () => {
                            setLoading(true);
                            try {
                              const result =
                                await campaignService.runCampaignToLeadRuleEngine(
                                  {
                                    campaign_id:
                                      c2lRunCampaignId === ""
                                        ? undefined
                                        : Number(c2lRunCampaignId),
                                    dry_run: c2lDryRun,
                                    limit: c2lRunLimit,
                                  },
                                );
                              setC2lRunResult(result);
                              await loadC2LConversions();
                              showSuccess(
                                `C2L engine completed: evaluated ${result.evaluated}, converted ${result.converted}`,
                              );
                            } catch (err: any) {
                              showError(
                                err?.response?.data?.detail ||
                                "Failed to run C2L engine",
                              );
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Run Engine
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {c2lRunResult && (
                    <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          label={`Evaluated: ${c2lRunResult.evaluated}`}
                          variant="outlined"
                        />
                        <Chip
                          label={`Converted: ${c2lRunResult.converted}`}
                          color="success"
                          variant="outlined"
                        />
                        <Chip
                          label={`Duplicates: ${c2lRunResult.skipped_duplicates}`}
                          color="warning"
                          variant="outlined"
                        />
                        <Chip
                          label={`Skipped: ${c2lRunResult.skipped}`}
                          variant="outlined"
                        />
                        <Chip
                          label={c2lRunResult.dry_run ? "Dry Run" : "Applied"}
                          color={c2lRunResult.dry_run ? "info" : "primary"}
                          variant="outlined"
                        />
                      </Stack>
                    </Paper>
                  )}

                  {c2lRunResult && (
                    <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 1.2 }}
                      >
                        {c2lRunResult.dry_run
                          ? "Dry Run Preview"
                          : "Latest Run Details"}
                      </Typography>
                      <TableContainer
                        sx={{
                          borderRadius: "12px",
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                        }}
                      >
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Campaign</TableCell>
                              <TableCell>Contact</TableCell>
                              <TableCell>Email / Phone</TableCell>
                              <TableCell>Score</TableCell>
                              <TableCell>Threshold</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Lead ID</TableCell>
                              <TableCell>Reasons</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(c2lRunResult.details || []).length ? (
                              c2lRunResult.details.map((row) => (
                                <TableRow
                                  key={`c2l-run-detail-${row.campaign_log_id}`}
                                >
                                  <TableCell>
                                    {row.campaign_name || row.campaign_id}
                                  </TableCell>
                                  <TableCell>
                                    {row.contact_name || row.contact_id}
                                  </TableCell>
                                  <TableCell>
                                    {row.email || row.phone || "-"}
                                  </TableCell>
                                  <TableCell>{row.score}</TableCell>
                                  <TableCell>{row.threshold}</TableCell>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      label={row.status}
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>{row.lead_id || "-"}</TableCell>
                                  <TableCell>
                                    {(row.reasons || []).join(", ") || "-"}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={8} align="center">
                                  No rows evaluated for this run.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  )}

                  <Paper sx={{ ...sectionPanelSx, p: 2.5 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, mb: 1.2 }}
                    >
                      Recent C2L Decisions
                    </Typography>
                    <TableContainer
                      sx={{
                        borderRadius: "12px",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Log ID</TableCell>
                            <TableCell>Lead ID</TableCell>
                            <TableCell>Score</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Reason</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {c2lConversions.length ? (
                            c2lConversions.map((item) => (
                              <TableRow key={`c2l-conv-${item.id}`}>
                                <TableCell>
                                  {formatDisplayDate(item.created_at)}
                                </TableCell>
                                <TableCell>{item.campaign_id}</TableCell>
                                <TableCell>{item.campaign_log_id}</TableCell>
                                <TableCell>{item.lead_id || "-"}</TableCell>
                                <TableCell>{item.score}</TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={item.status}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>{item.reason || "-"}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} align="center">
                                No C2L decisions yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </>
              )}
            </Stack>
          )}

          <Dialog
            open={runConfirmCampaign !== null}
            onClose={() => !loading && setRunConfirmCampaign(null)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Run campaign?</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary">
                Run &quot;{runConfirmCampaign?.name}&quot; now? Messages will be
                sent according to this campaign&apos;s settings and contact
                list.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setRunConfirmCampaign(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={confirmRunCampaign}
                disabled={loading}
                startIcon={<PlayArrowIcon />}
              >
                Run
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={productDialogOpen}
            onClose={() => setProductDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Add Product</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                <TextField
                  fullWidth
                  label="Product Name"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Product Code"
                  value={newProductCode}
                  onChange={(e) => setNewProductCode(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  minRows={3}
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setProductDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateProductFromCampaign}
                disabled={creatingProduct}
              >
                {creatingProduct ? "Saving..." : "Save Product"}
              </Button>
            </DialogActions>
          </Dialog>
          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={handleCloseDrawer}
            PaperProps={{
              sx: {
                width: { xs: "90%", sm: 550 },
                height: "100vh",
                maxHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                bgcolor: "#f9faff",
              },
            }}
          >
            {/* --- Sticky Header --- */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 3,
                borderBottom: "1px solid #e0e0e0",
                flexShrink: 0,
                bgcolor: "#f9faff",
              }}
            >
              <Typography variant="h6" fontWeight={700}>
                Contact Details
              </Typography>
              <IconButton onClick={handleCloseDrawer}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* --- Scrollable Content --- */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
              {selectedContact ? (
                <Stack spacing={3}>
                  {/* --- Basic Info --- */}
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ borderBottom: "1px solid #d0d0d0", pb: 1 }}
                  >
                    Basic Info
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Field label="Name" value={selectedContact.name} />
                      <Field label="Phone" value={selectedContact.phone} />
                      <Field label="Company" value={selectedContact.company} />
                      <Field label="Gender" value={selectedContact.gender} />
                    </Grid>
                    <Grid item xs={6}>
                      <Field label="Email" value={selectedContact.email} />
                      <Field
                        label="WhatsApp"
                        value={selectedContact.whatsapp_number}
                      />
                      <Field
                        label="Designation"
                        value={selectedContact.designation}
                      />
                      <Field
                        label="Created At"
                        value={formatDate(selectedContact.created_at)}
                      />
                    </Grid>
                  </Grid>

                  {/* --- Product Info --- */}
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ borderBottom: "1px solid #d0d0d0", pb: 1 }}
                  >
                    Product Info
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Field label="Item Name" value={selectedContact.item_name} />
                      <Field label="Item Type" value={selectedContact.item_type} />
                      <Field
                        label="Interest Stage"
                        value={selectedContact.interest_stage}
                        badge
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Field
                        label="Item Category"
                        value={selectedContact.item_category}
                      />
                      <Field label="Amount" value={selectedContact.amount} />
                      <Field
                        label="Offer Value"
                        value={selectedContact.offer_value}
                      />
                    </Grid>
                  </Grid>

                  {/* --- Location --- */}
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ borderBottom: "1px solid #d0d0d0", pb: 1 }}
                  >
                    Location
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Field
                        label="City / State / Country"
                        value={[
                          selectedContact.city,
                          selectedContact.state,
                          selectedContact.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                    </Grid>
                  </Grid>

                  {/* --- Tracking --- */}
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ borderBottom: "1px solid #d0d0d0", pb: 1 }}
                  >
                    Tracking
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Field label="Source" value={selectedContact.source} />
                      <Field
                        label="Lifecycle Stage"
                        value={selectedContact.lifecycle_stage}
                        badge
                      />
                      <Field label="Tags" value={selectedContact.tags} badges />
                    </Grid>
                  </Grid>
                </Stack>
              ) : (
                <Typography>No contact selected</Typography>
              )}
            </Box>
          </Drawer>
        </Stack>
      </Box>
      <ConfirmDialog
        open={Boolean(campaignToDelete)}
        title="Delete campaign?"
        description={
          campaignToDelete
            ? `This will permanently remove "${campaignToDelete.campaign_name}". This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setCampaignToDelete(null)}
        onConfirm={handleDeleteCampaign}
      />
    </AdminLayout>
  );
};

export default CampaignManagementPage;
