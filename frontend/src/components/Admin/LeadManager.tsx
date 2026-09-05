import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
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
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Drawer,
  Divider,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { alpha, useTheme } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MoveDownIcon from "@mui/icons-material/MoveDown";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
} from "@mui/lab";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { LeadActivity, leadService } from "../../services/leadService";
import { dashboardService } from "../../services/dashboardService";
import { funnelCategoryService } from "../../services/funnelCategoryService";
import { Product, productService } from "../../services/productService";
import {
  type CampaignItem,
  type CampaignType,
} from "../../services/campaignService";
import {
  organizationService,
  type OrganizationWidget,
} from "../../services/organizationService";
import { FunnelCategory, FunnelCategoryPayload, Lead } from "../../types";
import {
  FUNNEL_ALL_CHIP_TINT,
  LEAD_SOURCE_FILTER_TINTS,
} from "../../constants/leadFilterChartColors";
import Field from "../Common/Field";
import CallIcon from "@mui/icons-material/Call";
import EmailIcon from "@mui/icons-material/Email";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import {
  OutcomeChip,
  SourceChip,
  StageChip,
  titleCase,
} from "../Common/StatusChips";
import {
  useDateFormatter,
  useOnlyDateFormatter,
} from "../../hooks/useDateFormatter";
import { ConfirmDialog } from "../Common/ConfirmDialog";
import { formatEndedReason } from "../calls/CallDetailDrawer";

const LEAD_SOURCES = ["chat", "voice", "email", "sms", "whatsapp"] as const;

/** Whether a widget row should appear for the selected lead source filter. */
const widgetMatchesLeadSource = (
  widgetSource: string | undefined | null,
  selectedLeadSource: string,
): boolean => {
  const ws = (widgetSource || "chat").toLowerCase().trim();
  const sel = selectedLeadSource.toLowerCase().trim();
  if (ws === sel) return true;
  if (["email", "sms", "whatsapp"].includes(sel) && ws === "chat") return true;
  return false;
};

const sourceLabel = (source?: string) =>
  titleCase((source || "chat").toLowerCase());

const campaignTypeLabel = (type?: string) =>
  titleCase((type || "").toLowerCase());

const stageLabel = (stage?: string | null) => {
  if (!stage || !stage.trim()) return "Unassigned";
  return titleCase(stage.toLowerCase());
};

const toStageKey = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "_");

const normalizeHexColor = (value?: string) => {
  const fallback = "#4e89d5";
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : fallback;
};
const parseCustomFields = (raw?: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const formatCustomFieldLabel = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const fixedLeadCustomFieldKeys = new Set([
  "whatsapp_number",
  "gender",
  "designation",
  "source",
  "city",
  "state",
  "country",
  "session_id",
  "widget_id",
]);

type LeadManagerProps = {
  openFunnelCatDialog: boolean;
  setOpenFunnelCatDialog: React.Dispatch<React.SetStateAction<boolean>>;
};

const LeadManager = ({
  openFunnelCatDialog,
  setOpenFunnelCatDialog,
}: LeadManagerProps) => {
  const theme = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [widgets, setWidgets] = useState<OrganizationWidget[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [funnelCategories, setFunnelCategories] = useState<FunnelCategory[]>(
    [],
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedFunnelStage, setSelectedFunnelStage] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveStage, setMoveStage] = useState<string>("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FunnelCategory | null>(
    null,
  );
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState<FunnelCategoryPayload>({
    name: "",
    key: "",
    color: "#4e89d5",
    position: 0,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(0);
  const [leadsRowsPerPage, setLeadsRowsPerPage] = useState(10);
  const [funnelMasterOpen, setFunnelMasterOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [selectedCampaignType] = useState<"all" | CampaignType>("all");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [closeDateOpen, setCloseDateOpen] = useState(false);
  const [closeDate, setCloseDate] = useState(
  new Date().toISOString().split("T")[0]
);
  const [summary, setSummary] = useState<any>({});
  const formatDisplayDate = useDateFormatter();
  const formatDisplayOnlyDate = useOnlyDateFormatter();
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const panelSx = {
    borderRadius: "18px",
    border: `1px solid ${alpha(theme.palette.common.white, 0.64)}`,
    background: `linear-gradient(145deg, ${alpha(theme.palette.common.white, 0.76)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82,
    )} 62%, ${alpha("#dce8f8", 0.82)} 100%)`,
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
        "linear-gradient(138deg, rgba(255,255,255,0.2) 6%, transparent 26%), linear-gradient(26deg, transparent 58%, rgba(78,137,213,0.12) 59%, transparent 80%)",
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  } as const;

  const pipelineLeads = summary.total_pipeline_leads || 0;
  const wonLeads = summary.closed_won_leads || 0;
  const lostLeads = summary.closed_lost_leads || 0;

  const activeFunnelCategories = useMemo(
    () =>
      funnelCategories
        .filter((item) => item.is_active)
        .sort((a, b) => a.position - b.position),
    [funnelCategories],
  );

  const visibleWidgets = useMemo(() => {
    if (selectedSource === "all") return widgets;
    return widgets.filter((w) =>
      widgetMatchesLeadSource(w.source, selectedSource),
    );
  }, [widgets, selectedSource]);

  const stageNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    funnelCategories.forEach((item) => map.set(item.key, item.name));
    return map;
  }, [funnelCategories]);

  const displayStageLabel = (stage?: string | null) => {
    if (!stage || !stage.trim()) return "Unassigned";
    return stageNameByKey.get(stage) || stageLabel(stage);
  };

  const kpis = useMemo(
    () => [
      {
        label: "Total",
        value: leadsTotal.toLocaleString(),
        hint: "All captured lead records",
        icon: <GroupIcon sx={{ color: "#fff" }} />,
        gradient: "linear-gradient(135deg, #0d47a1, #1976d2)",
      },
      {
        label: "Pipeline Leads",
        value: pipelineLeads.toLocaleString(),
        hint: "Leads in progress",
        icon: <AccountTreeIcon sx={{ color: "#fff" }} />,
        gradient: "linear-gradient(135deg, #7b1fa2, #ba68c8)", // 🟣 Purple
      },
      {
        label: "Closed Leads",
        value: wonLeads.toLocaleString(),
        hint: "Successfully converted",
        icon: <CheckCircleIcon sx={{ color: "#fff" }} />,
        gradient: "linear-gradient(135deg, #2e7d32, #66bb6a)", // 🟢 Green
      },
      {
        label: "Lost Leads",
        value: lostLeads.toLocaleString(),
        hint: "Unsuccessful leads",
        icon: <CancelIcon sx={{ color: "#fff" }} />,
        gradient: "linear-gradient(135deg, #c62828, #ef5350)", // 🔴 Red
      },
    ],
    [leadsTotal, pipelineLeads, wonLeads, lostLeads],
  );

  const displayLeads = useMemo(() => {
    const startMs = filterStartDate
      ? new Date(`${filterStartDate}T00:00:00`).getTime()
      : null;
    const endMs = filterEndDate
      ? new Date(`${filterEndDate}T23:59:59.999`).getTime()
      : null;
    const q = leadSearch.trim().toLowerCase();
    const campaignLabel =
      selectedCampaignId !== "all"
        ? (campaigns
            .find((c) => String(c.id) === selectedCampaignId)
            ?.campaign_name?.toLowerCase() ?? "")
        : "";

    return leads.filter((lead) => {
      if (q) {
        const widgetName =
          widgets
            .find((w) => w.widget_id === lead.widget_id)
            ?.name?.toLowerCase() ?? "";
        const haystack = [
          lead.name,
          lead.email,
          lead.phone,
          lead.company,
          lead.widget_id,
          lead.product_name,
          lead.session_id,
          lead.custom_fields,
          widgetName,
          campaignLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      const t = new Date(lead.created_at).getTime();
      if (startMs !== null && !Number.isNaN(startMs) && t < startMs) {
        return false;
      }
      if (endMs !== null && !Number.isNaN(endMs) && t > endMs) {
        return false;
      }

      return true;
    });
  }, [
    leads,
    leadSearch,
    filterStartDate,
    filterEndDate,
    campaigns,
    selectedCampaignId,
    widgets,
  ]);

  useEffect(() => {
    if (!activityOpen || !selectedLead) return;

    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const res = await leadService.listLeadActivities(selectedLead.id);
        setActivities(res || []);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [activityOpen, selectedLead]);

  const loadFunnelCategories = async () => {
    try {
      const data = await funnelCategoryService.list(true);
      setFunnelCategories(data);
    } catch {
      setError("Failed to load funnel categories");
    }
  };

  const loadProducts = async () => {
    try {
      const data = await productService.productLookup();
      setProducts(data || []);
    } catch {
      setError("Failed to load products");
    }
  };

  const loadLeads = async (
    widgetId: any,
    source: any,
    funnelStage: any,
    productId: any,
    campaignId: any,
    campaignType: any,
    search: any,
    startDate: any,
    endDate: any,
  ) => {
    try {
      setLoading(true);
      setError("");

      const data = await leadService.listLeads(
        leadsPage * leadsRowsPerPage,
        leadsRowsPerPage,
        widgetId,
        source,
        funnelStage,
        productId,
        campaignId,
        campaignType,
        search,
        startDate,
        endDate,
      );

      setLeads(data.items);
      setLeadsTotal(data.pagination?.total || 0);
      setSummary(data.summary || {});
    } catch {
      setError("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadFunnelCategories();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const mapWidget = (
      widget: any,
      inferredSource: string,
    ): OrganizationWidget => ({
      widget_id: widget.widget_id,
      name: widget.name,
      source: String(widget.source ?? inferredSource)
        .toLowerCase()
        .trim(),
      created_at: widget.created_at,
    });

    (async () => {
      try {
        if (selectedSource === "voice") {
          const data = await dashboardService.getWidgets({ source: "voice" });
          if (cancelled) return;
          setWidgets(
            (data?.widgets || []).map((w: any) => mapWidget(w, "voice")),
          );
          return;
        }

        const baseRes = await dashboardService.getWidgets();
        if (cancelled) return;
        const baseItems = baseRes?.widgets || [];

        if (selectedSource === "all") {
          let voiceItems: any[] = [];
          try {
            const voiceRes = await dashboardService.getWidgets({
              source: "voice",
            });
            voiceItems = voiceRes?.widgets || [];
          } catch {
            voiceItems = [];
          }
          if (cancelled) return;
          const merged = new Map<string, OrganizationWidget>();
          for (const w of voiceItems) {
            merged.set(w.widget_id, mapWidget(w, "voice"));
          }
          for (const w of baseItems) {
            if (!merged.has(w.widget_id)) {
              merged.set(w.widget_id, mapWidget(w, "chat"));
            }
          }
          setWidgets([...merged.values()]);
          return;
        }

        if (cancelled) return;
        setWidgets(baseItems.map((w: any) => mapWidget(w, "chat")));
      } catch {
        if (!cancelled) setError("Failed to load widgets");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSource]);

  useEffect(() => {
    if (selectedWidgetId === "all") return;
    const ok = visibleWidgets.some((w) => w.widget_id === selectedWidgetId);
    if (!ok) setSelectedWidgetId("all");
  }, [visibleWidgets, selectedWidgetId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sourceParam =
          selectedSource === "all" ? undefined : selectedSource;
        const widgetIdParam =
          selectedWidgetId === "all" ? undefined : selectedWidgetId;
        const items = await organizationService.listMeCampaigns({
          source: sourceParam,
          widget_id: widgetIdParam,
          skip: 0,
          limit: 500,
        });
        if (cancelled) return;
        setCampaigns(items);
        setSelectedCampaignId((prev) => {
          if (prev === "all") return prev;
          return items.some((c) => String(c.id) === prev) ? prev : "all";
        });
      } catch {
        if (!cancelled) {
          setCampaigns([]);
          setSelectedCampaignId("all");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSource, selectedWidgetId]);

  useEffect(() => {
    const widgetId = selectedWidgetId === "all" ? undefined : selectedWidgetId;
    const productId =
      selectedProductId === "all" ? undefined : selectedProductId;
    const source = selectedSource === "all" ? undefined : selectedSource;
    const funnelStage =
      selectedFunnelStage === "all" ? undefined : selectedFunnelStage;
    const campaignId =
      selectedCampaignId === "all" ? undefined : selectedCampaignId;
    const campaignType =
      selectedCampaignType === "all" ? undefined : selectedCampaignType;

    loadLeads(
      widgetId,
      source,
      funnelStage,
      productId,
      campaignId,
      campaignType,
      leadSearch, // ✅ ADD
      filterStartDate, // ✅ ADD
      filterEndDate, // ✅ ADD
    );
  }, [
    selectedWidgetId,
    selectedProductId,
    selectedSource,
    selectedFunnelStage,
    selectedCampaignId,
    selectedCampaignType,
    leadsPage,
    leadsRowsPerPage,
    leadSearch, // ✅ ADD
    filterStartDate, // ✅ ADD
    filterEndDate, // ✅ ADD
  ]);

  const handleExport = async () => {
    try {
      const widgetId =
        selectedWidgetId === "all" ? undefined : selectedWidgetId;
      const productId =
        selectedProductId === "all" ? undefined : selectedProductId;
      const campaignId =
        selectedCampaignId === "all" ? undefined : selectedCampaignId;
      const campaignType =
        selectedCampaignType === "all" ? undefined : selectedCampaignType;
      const blob = await leadService.exportLeads(
        widgetId,
        productId,
        campaignId,
        campaignType,
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "leads.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export leads");
    }
  };

  const handleDateChange = (lead: Lead, date: string) => {
    const updatedRows = leads.map((row) =>
      row.id === lead.id ? { ...row, close_date: date } : row,
    );
    setLeads(updatedRows);
  };

  const openDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const openMoveDialog = (lead: Lead) => {
    const stage = lead.funnel_stage;
    if (!stage || !stage.trim()) setMoveStage(funnelCategories[0].key || "");
    else setMoveStage(lead.funnel_stage || "");
    setSelectedLead(lead);
    setMoveOpen(true);
  };

  const openExpCloseDateDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setCloseDateOpen(true);
  };

  const openCreateCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      key: "",
      color: "#4e89d5",
      position: funnelCategories.length + 1,
      is_active: true,
    });
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: FunnelCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      key: category.key,
      color: category.color,
      position: category.position,
      is_active: category.is_active,
    });
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      setError("Category name is required.");
      return;
    }

    const payload: FunnelCategoryPayload = {
      ...categoryForm,
      name: categoryForm.name.trim(),
      key: toStageKey(categoryForm.key || categoryForm.name),
      color: normalizeHexColor(categoryForm.color),
      position: Number(categoryForm.position) || 0,
    };

    try {
      setCategorySaving(true);
      setError("");
      setSuccess("");
      if (editingCategory) {
        await funnelCategoryService.update(editingCategory.id, payload);
        setSuccess("Funnel category updated.");
      } else {
        await funnelCategoryService.create(payload);
        setSuccess("Funnel category created.");
      }
      setCategoryDialogOpen(false);
      await loadFunnelCategories();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Failed to save funnel category",
      );
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (category: FunnelCategory) => {
    try {
      setError("");
      setSuccess("");
      await funnelCategoryService.remove(category.id);
      setSuccess("Funnel category deleted.");
      await loadFunnelCategories();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to delete funnel category",
      );
    }
  };

  const handleMoveLead = async () => {
    if (!selectedLead) return;
    if (!moveStage) {
      setError("Please select a funnel stage before confirming.");
      return;
    }

    try {
      setMoving(true);
      setError("");
      setSuccess("");
      const updated = await leadService.moveLeadToFunnel(
        selectedLead.id,
        moveStage,
        closeDate,
      );
      setLeads((prev) =>
        prev.map((lead) => (lead.id === updated.id ? updated : lead)),
      );
      setSelectedLead(updated);
      setMoveOpen(false);
      setConfirmationDialogOpen(false);
      setDetailsOpen(true);
      setSuccess(
        `Lead moved to ${displayStageLabel(updated.funnel_stage)} successfully.`,
      );
    } catch {
      setError("Failed to move lead to funnel stage");
    } finally {
      setMoving(false);
    }
  };

  const handleLeadCloseDate = async () => {
    if (!selectedLead) return;
    if (!closeDate) {
      setError("Please select a expected close date before confirming.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const updated = await leadService.setLeadCloseDate(
        selectedLead.id,
        closeDate,
      );
      setLeads((prev) =>
        prev.map((lead) => (lead.id === updated.id ? updated : lead)),
      );
      setSelectedLead(updated);
      setCloseDateOpen(false);
      // setSuccess(
      //   `Lead moved to ${displayStageLabel(updated.funnel_stage)} successfully.`,
      // );
    } catch {
      setError("Failed to set close date to lead");
    } finally {
      setMoving(false);
    }
  };

  const selectedWidget =
    selectedWidgetId === "all"
      ? null
      : widgets.find((widget) => widget.widget_id === selectedWidgetId);
  const selectedProduct =
    selectedProductId === "all"
      ? null
      : products.find((product) => String(product.id) === selectedProductId);
  const selectedCampaign =
    selectedCampaignId === "all"
      ? null
      : campaigns.find((c) => String(c.id) === selectedCampaignId);
  const sourceTintByKey: Record<string, string> = {
    ...LEAD_SOURCE_FILTER_TINTS,
  };

  const compactMenuProps = {
    PaperProps: {
      sx: {
        mt: 0.4,
        borderRadius: "10px",
        "& .MuiMenuItem-root": {
          minHeight: 34,
          fontSize: "0.8rem",
        },
      },
    },
  } as const;

  const filterChipSx = (active: boolean, tint: string) => ({
    height: 23,
    borderRadius: "7px",
    fontSize: "0.68rem",
    fontWeight: 700,
    color: active ? tint : alpha(tint, 0.86),
    borderColor: active ? alpha(tint, 0.5) : alpha(tint, 0.35),
    backgroundColor: active ? alpha(tint, 0.2) : alpha(tint, 0.08),
    "& .MuiChip-label": { px: 0.9 },
    "&:hover": {
      backgroundColor: active ? alpha(tint, 0.24) : alpha(tint, 0.12),
    },
  });

  const getActivityIcon = (source: string) => {
    switch (source) {
      case "voice":
        return <CallIcon fontSize="small" />;
      case "email":
        return <EmailIcon fontSize="small" />;
      case "chat":
        return <ChatBubbleIcon fontSize="small" />;
      case "whatsapp":
        return <WhatsAppIcon fontSize="small" />;
      case "ai":
        return <SmartToyIcon fontSize="small" />;
      default:
        return <HelpOutlineIcon fontSize="small" />;
    }
  };

  const gradientBarButtonSx = {
    minHeight: 46,
    px: 2.5,
    borderRadius: "12px",
    fontWeight: 700,
    fontSize: "0.875rem",
    textTransform: "none" as const,
    boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.22)}`,
    background: `linear-gradient(115deg, ${theme.palette.primary.main} 0%, ${alpha(
      theme.palette.secondary?.main ?? theme.palette.info.main,
      0.94,
    )} 100%)`,
    color: theme.palette.primary.contrastText,
    "&:hover": {
      boxShadow: `0 12px 28px ${alpha(theme.palette.primary.dark, 0.3)}`,
      background: `linear-gradient(115deg, ${alpha(theme.palette.primary.dark, 0.98)} 0%, ${alpha(
        theme.palette.secondary?.main ?? theme.palette.info.main,
        1,
      )} 100%)`,
    },
    "&.Mui-disabled": {
      background: alpha(theme.palette.action.disabledBackground, 0.5),
      color: theme.palette.action.disabled,
    },
  };

  const filtersToggleClosedSx = {
    minHeight: 46,
    px: 2.5,
    borderRadius: "12px",
    fontWeight: 700,
    fontSize: "0.875rem",
    textTransform: "none" as const,
    backgroundColor: alpha(theme.palette.common.white, 0.96),
    color: theme.palette.text.primary,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
    boxShadow: "none",
    "&:hover": {
      backgroundColor: theme.palette.common.white,
      borderColor: alpha(theme.palette.primary.main, 0.4),
      boxShadow: "none",
    },
  };

  const filterSheetSx = {
    borderRadius: "14px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
    background: `linear-gradient(165deg, ${alpha("#eef5fc", 0.98)} 0%, ${alpha("#e2ecf8", 0.92)} 48%, ${alpha("#d8e6f5", 0.9)} 100%)`,
    p: { xs: 1.75, sm: 2, md: 2.25 },
    boxShadow: `inset 0 1px 0 ${alpha("#fff", 0.7)}`,
  } as const;

  const filterControlSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      backgroundColor: alpha(theme.palette.common.white, 0.96),
      fontSize: "0.875rem",
    },
    "& .MuiOutlinedInput-input": {
      py: 1,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: alpha(theme.palette.primary.main, 0.22),
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.primary.main,
      borderWidth: 1,
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.8125rem",
      fontWeight: 600,
      color: alpha(theme.palette.text.secondary, 0.95),
    },
  } as const;

  const filterSearchFieldSx = {
    ...filterControlSx,
    "& .MuiOutlinedInput-root": {
      ...filterControlSx["& .MuiOutlinedInput-root"],
      minHeight: 44,
    },
    "& .MuiOutlinedInput-input": {
      py: 1.1,
      fontSize: "0.875rem",
    },
  } as const;

  const leadOverviewPanel = (
    <Paper sx={{ ...panelSx, p: { xs: 1.6, md: 1.8 }, mb: 2.8 }}>
      <Box sx={{ maxWidth: 800 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            letterSpacing: "-0.01em",
            mb: 0.25,
            fontSize: "1.2rem",
          }}
        >
          Lead Overview
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: "0.93rem" }}
        >
          Review lead quality, source channels, funnel stage, and export data
          for your sales workflow.
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.9 }}
        >
          {[
            selectedWidget &&
              `widget: ${selectedWidget.name}${
                selectedWidget.source
                  ? ` (${sourceLabel(selectedWidget.source)})`
                  : ""
              }`,
            selectedProduct && `product: ${selectedProduct.name}`,
            selectedSource !== "all" &&
              `source: ${sourceLabel(selectedSource)}`,
            selectedFunnelStage !== "all" &&
              `funnel: ${activeFunnelCategories.find((s) => s.key === selectedFunnelStage)?.name ?? selectedFunnelStage}`,
            selectedCampaign &&
              `campaign: ${selectedCampaign.campaign_name} (${campaignTypeLabel(selectedCampaign.campaign_type)})`,
            selectedCampaignType !== "all" &&
              `campaign type: ${campaignTypeLabel(selectedCampaignType)}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Showing leads from all widgets and campaigns"}
        </Typography>
      </Box>
    </Paper>
  );

  const advancedLeadsFilterPanel = (
    <Box sx={{ ...filterSheetSx, mb: 2.8 }}>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by phone, campaign, widget..."
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            sx={filterSearchFieldSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "action.active", fontSize: 22 }} />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="Start Date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={filterControlSx}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="End Date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={filterControlSx}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={2}>
          <Button
            fullWidth
            variant={advancedFiltersOpen ? "contained" : "outlined"}
            startIcon={<FilterListIcon />}
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
            aria-expanded={advancedFiltersOpen}
            sx={
              advancedFiltersOpen ? gradientBarButtonSx : filtersToggleClosedSx
            }
          >
            {advancedFiltersOpen ? "Hide filters" : "Filters"}
          </Button>
        </Grid>
        <Grid item xs={6} sm={6} md={2}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={leads.length === 0}
            sx={{ ...gradientBarButtonSx, whiteSpace: "nowrap" }}
          >
            Export to CSV
          </Button>
        </Grid>
      </Grid>

      <Collapse in={advancedFiltersOpen}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" sx={filterControlSx}>
              <InputLabel id="lead-filter-source-label">Source</InputLabel>
              <Select
                labelId="lead-filter-source-label"
                label="Source"
                value={selectedSource}
                onChange={(e: SelectChangeEvent<string>) =>
                  setSelectedSource(e.target.value)
                }
                MenuProps={compactMenuProps}
              >
                <MenuItem value="all">All Sources</MenuItem>
                {LEAD_SOURCES.map((source) => (
                  <MenuItem key={source} value={source}>
                    {sourceLabel(source)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" sx={filterControlSx}>
              <InputLabel id="lead-filter-widget-label">Widget</InputLabel>
              <Select
                labelId="lead-filter-widget-label"
                label="Widget"
                value={selectedWidgetId}
                onChange={(e: SelectChangeEvent<string>) =>
                  setSelectedWidgetId(e.target.value)
                }
                MenuProps={compactMenuProps}
              >
                <MenuItem value="all">All Widgets</MenuItem>
                {visibleWidgets.map((widget) => (
                  <MenuItem key={widget.widget_id} value={widget.widget_id}>
                    {widget.name}
                    {widget.source ? ` (${sourceLabel(widget.source)})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small" sx={filterControlSx}>
              <InputLabel id="lead-filter-campaign-label">Campaign</InputLabel>
              <Select
                labelId="lead-filter-campaign-label"
                label="Campaign"
                value={selectedCampaignId}
                onChange={(e: SelectChangeEvent<string>) =>
                  setSelectedCampaignId(e.target.value)
                }
                MenuProps={compactMenuProps}
              >
                <MenuItem value="all">All Campaigns</MenuItem>
                {campaigns.map((campaign) => (
                  <MenuItem key={campaign.id} value={String(campaign.id)}>
                    {campaign.campaign_name}
                    {campaign.campaign_type &&
                    campaignTypeLabel(campaign.campaign_type)
                      ? `(${campaignTypeLabel(campaign.campaign_type)})`
                      : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small" sx={filterControlSx}>
              <InputLabel id="lead-filter-product-label">Product</InputLabel>
              <Select
                labelId="lead-filter-product-label"
                label="Product"
                value={selectedProductId}
                onChange={(e: SelectChangeEvent<string>) =>
                  setSelectedProductId(e.target.value)
                }
                MenuProps={compactMenuProps}
              >
                <MenuItem value="all">All Products</MenuItem>
                {products.map((product) => (
                  <MenuItem key={product.id} value={String(product.id)}>
                    {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <FormControl fullWidth size="small" sx={filterControlSx}>
              <InputLabel id="lead-filter-funnel-label">
                Funnel Stage
              </InputLabel>
              <Select
                labelId="lead-filter-funnel-label"
                label="Funnel Stage"
                value={selectedFunnelStage}
                onChange={(e: SelectChangeEvent<string>) =>
                  setSelectedFunnelStage(e.target.value)
                }
                MenuProps={compactMenuProps}
              >
                <MenuItem value="all">All Funnel Stages</MenuItem>
                {activeFunnelCategories.map((stage) => (
                  <MenuItem key={stage.key} value={stage.key}>
                    {stage.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Collapse>
    </Box>
  );

  const filterPanel = (
    <>
      {/* {leadOverviewPanel} */}
      {advancedLeadsFilterPanel}
    </>
  );

  const customFields = parseCustomFields(selectedLead?.custom_fields);
  const dynamicCustomFieldEntries = Object.entries(customFields).filter(
    ([key, value]) =>
      !fixedLeadCustomFieldKeys.has(key) &&
      value !== undefined &&
      value !== null &&
      String(value).trim() !== "",
  );

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 1.2 }} />}

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2.2,
            borderRadius: "14px",
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
          }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{
            mb: 2.2,
            borderRadius: "14px",
            border: `1px solid ${alpha(theme.palette.success.main, 0.24)}`,
            boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}`,
          }}
        >
          {success}
        </Alert>
      )}

      {filterPanel}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
            <SummaryCard
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              hint={kpi.hint}
            />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ ...panelSx, p: 2.4 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            mb: 1.1,
            gap: 1.4,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              All Leads
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1.5 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "110px minmax(0, 1fr)",
                  },
                  alignItems: "start",
                  columnGap: 0.8,
                  rowGap: 0.4,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: "text.secondary", pt: 0.35 }}
                >
                  Source Type
                </Typography>
                <Stack direction="row" spacing={0.55} sx={{ flexWrap: "wrap" }}>
                  <SourceChip
                    value="all"
                    height={23}
                    selected={selectedSource === "all"}
                    onClick={() => setSelectedSource("all")}
                  />
                  {LEAD_SOURCES.map((source) => (
                    <SourceChip
                      key={source}
                      value={source}
                      height={23}
                      selected={selectedSource === source}
                      onClick={() => setSelectedSource(source)}
                    />
                  ))}
                </Stack>
              </Box>

              <Box
                sx={{
                  borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                }}
              />

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "110px minmax(0, 1fr)",
                  },
                  alignItems: "start",
                  columnGap: 0.8,
                  rowGap: 0.4,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: "text.secondary", pt: 0.35 }}
                >
                  Funnel Stage
                </Typography>
                <Stack direction="row" spacing={0.55} sx={{ flexWrap: "wrap" }}>
                  <StageChip
                    value="all"
                    height={23}
                    selected={selectedFunnelStage === "all"}
                    onClick={() => setSelectedFunnelStage("all")}
                    funnelCategories={funnelCategories}
                    stageNameByKey={stageNameByKey}
                    stageLabel={stageLabel}
                    allTint={FUNNEL_ALL_CHIP_TINT}
                  />
                  {activeFunnelCategories.map((stage) => (
                    <StageChip
                      key={stage.key}
                      value={stage.key}
                      funnelCategories={funnelCategories}
                      stageNameByKey={stageNameByKey}
                      stageLabel={stageLabel}
                      height={23}
                      selected={selectedFunnelStage === stage.key}
                      onClick={() => setSelectedFunnelStage(stage.key)}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
          {/* <Chip
            label={`${displayLeads.length.toLocaleString()} records`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ fontWeight: 600, flexShrink: 0, mt: 0.4 }}
          /> */}
        </Box>

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
                <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Latest Sentiment</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Funnel Stage</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Exp/Actual Closed Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  hover
                  sx={{
                    "&:last-child td": { borderBottom: 0 },
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <TableCell
                    sx={{ minWidth: 200, maxWidth: 300, verticalAlign: "top" }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, lineHeight: 1.35 }}
                    >
                      {lead.name?.trim() || "—"}
                    </Typography>
                    <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                      {lead.email?.trim() ? (
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
                            sx={{ fontSize: 13, flexShrink: 0, opacity: 0.85 }}
                          />
                          <Box
                            component="span"
                            sx={{ wordBreak: "break-word" }}
                          >
                            {lead.email}
                          </Box>
                        </Typography>
                      ) : null}
                      {lead.phone?.trim() ? (
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
                            sx={{ fontSize: 13, flexShrink: 0, opacity: 0.85 }}
                          />
                          <Box
                            component="span"
                            sx={{ wordBreak: "break-word" }}
                          >
                            {lead.phone}
                          </Box>
                        </Typography>
                      ) : null}
                      {!lead.email?.trim() && !lead.phone?.trim() ? (
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
                  <TableCell>{lead.product_name || "-"}</TableCell>
                  <TableCell>
                    <SourceChip value={lead.source} />
                  </TableCell>
                  <TableCell>
                    <OutcomeChip value={lead.lead_outcome} />
                  </TableCell>
                  <TableCell>
                    <StageChip
                      value={lead.funnel_stage}
                      funnelCategories={funnelCategories}
                      stageNameByKey={stageNameByKey}
                      stageLabel={stageLabel}
                    />
                  </TableCell>
                  <TableCell>{formatDisplayDate(lead.created_at)}</TableCell>
                  <TableCell>
                    {formatDisplayOnlyDate(lead.close_date)}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip title="View activities">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedLead(lead);
                            setActivityOpen(true);
                          }}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                          }}
                        >
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View lead details">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openDetails(lead)}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Move to funnel">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            if (!lead) return;
                            setDetailsOpen(false);
                            openMoveDialog(lead);
                          }}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                          }}
                        >
                          <MoveDownIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* <Tooltip title="Set close date">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openExpCloseDateDialog(lead)}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                          }}
                        >
                          <EventIcon fontSize="small" />
                        </IconButton>
                      </Tooltip> */}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {displayLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {leads.length === 0
                        ? "No leads found for the selected filters."
                        : "No leads match your search or date range on this page."}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={leadsTotal}
            page={leadsPage}
            onPageChange={(_, value) => setLeadsPage(value)}
            rowsPerPage={leadsRowsPerPage}
            onRowsPerPageChange={(event) => {
              setLeadsRowsPerPage(parseInt(event.target.value, 10));
              setLeadsPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>
      </Paper>

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth={false}
        sx={{
          "& .MuiDialog-paper": {
            width: 720,
            maxWidth: "95%",
            margin: 0,
            overflowX: "hidden",
          },
        }}
      >
        <DialogTitle>Lead Details</DialogTitle>
        <DialogContent sx={{ overflowX: "hidden" }}>
          {selectedLead && (
            <Stack spacing={1.5}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.14),
                    color: "primary.dark",
                  }}
                >
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {selectedLead.name || "Anonymous"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Created: {formatDisplayDate(selectedLead.created_at)}
                  </Typography>
                </Box>
              </Box>

              {/* --- Basic Info --- */}
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ borderBottom: "1px solid #d0d0d0", pb: 1 }}
              >
                Basic Info
              </Typography>
              <Grid container spacing={4}>
                <Grid item xs={6}>
                  <Field label="Email:" value={selectedLead.email || "-"} />
                  <Field label="Phone:" value={selectedLead.phone || "-"} />
                  <Field label="Company:" value={selectedLead.company || "-"} />
                  <Field
                    label="Product Name:"
                    value={selectedLead.product_name || ""}
                  />
                  <Field label="Source:" value={selectedLead.source} />
                </Grid>
                <Grid item xs={6}>
                  <Field
                    label="Funnel Stage:"
                    value={displayStageLabel(selectedLead.funnel_stage)}
                  />
                  <Field
                    label="Session ID:"
                    value={selectedLead.session_id || "-"}
                  />
                  <Field
                    label="Widget ID:"
                    value={selectedLead.widget_id || "-"}
                  />
                  <Field
                    label="Lead outcome:"
                    value={selectedLead.lead_outcome || "-"}
                  />
                </Grid>
              </Grid>
              {/* --- Custom Fields --- */}
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ borderBottom: "1px solid #d0d0d0", pb: 1 }}
              >
                Additional Info
              </Typography>
              <Grid container spacing={4}>
                <Grid item xs={6}>
                  <Field
                    label="Whatsapp Number:"
                    value={String(customFields.whatsapp_number || "-")}
                  />
                  <Field label="Gender:" value={String(customFields.gender || "-")} />
                  <Field
                    label="Designation:"
                    value={String(customFields.designation || "-")}
                  />
                  <Field label="Source:" value={String(customFields.source || "")} />
                </Grid>
                <Grid item xs={6}>
                  <Field label="City:" value={String(customFields.city || "-")} />
                  <Field
                    label="State:"
                    value={String(customFields.state || "-")}
                  />
                  <Field
                    label="Country:"
                    value={String(customFields.country || "-")}
                  />
                </Grid>
              </Grid>
              {dynamicCustomFieldEntries.length > 0 && (
                <Grid container spacing={4}>
                  {dynamicCustomFieldEntries.map(([key, value]) => (
                    <Grid item xs={6} key={key}>
                      <Field
                        label={`${formatCustomFieldLabel(key)}:`}
                        value={String(value)}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          {/* <Button
            variant="contained"
            startIcon={<MoveDownIcon />}
            onClick={() => {
              if (!selectedLead) return;
              setDetailsOpen(false);
              openMoveDialog(selectedLead);
            }}
          >
            Move to Funnel
          </Button> */}
        </DialogActions>
      </Dialog>

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Move to Sales Funnel</DialogTitle>
        <DialogContent dividers>
          {selectedLead && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedLead.name || "Anonymous"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedLead.phone || selectedLead.email || "-"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Lead outcome: {selectedLead.lead_outcome || "-"}
                </Typography>
              </Paper>

              <FormControl fullWidth size="small">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Select Funnel Stage
                </Typography>

                {selectedLead?.funnel_stage === "closed_won" ||
                selectedLead?.funnel_stage === "closed_lost" ? (
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "grey.400",
                      borderRadius: 1,
                      px: 2,
                      py: 1.5,
                      bgcolor: "grey.100",
                      fontSize: 14,
                    }}
                  >
                    {activeFunnelCategories.find((s) => s.key === moveStage)
                      ?.name || moveStage}
                  </Box>
                ) : (
                  <Select
                    value={moveStage}
                    onChange={(event) => {
                      const selectedValue = event.target.value;
                      setMoveStage(selectedValue);
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a stage...</em>
                    </MenuItem>

                    {activeFunnelCategories.map((stage) => (
                      <MenuItem key={stage.key} value={stage.key}>
                        {stage.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
                {/* Show Close Date field below dropdown */}
                {selectedLead?.funnel_stage !== "closed_won" &&
                  selectedLead?.funnel_stage !== "closed_lost" &&
                  (moveStage === "closed_won" ||
                    moveStage === "closed_lost") && (
                    <>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 2, mb: 0.5 }} // same spacing as above
                      >
                        Select Close Date
                      </Typography>

                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        value={closeDate}
                        disabled={moveStage === "closed_lost"}
                        onChange={(e) => setCloseDate(e.target.value)}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        inputProps={{
                          // Prevent future date selection
                          max: new Date().toISOString().split("T")[0],

                          // Prevent selecting before created_date
                          min: selectedLead?.created_at
                            ? new Date(selectedLead.created_at)
                                .toISOString()
                                .split("T")[0]
                            : undefined,
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 1, // rectangle like Select
                          },
                        }}
                      />
                    </>
                  )}
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Back</Button>
          <Button
            variant="contained"
            onClick={() => setConfirmationDialogOpen(true)}
            disabled={moving || !moveStage}
            startIcon={moving}
          >
            {"Confirm & Move"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={closeDateOpen}
        onClose={() => setCloseDateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Expected Close Date</DialogTitle>
        <DialogContent dividers>
          {selectedLead && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedLead.name || "Anonymous"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedLead.phone || "-"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {selectedLead.email || "-"}
                </Typography>
              </Paper>

              <FormControl fullWidth size="small">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Select Expected Close Date
                </Typography>
                <TextField
                  //label="Expected Close Date"
                  type="date"
                  size="small"
                  value={selectedLead.close_date}
                  onChange={(e) => setCloseDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: new Date().toISOString().split("T")[0], // prevent past dates
                  }}
                  sx={{ width: 200 }}
                />
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDateOpen(false)}>Back</Button>
          <Button
            variant="contained"
            onClick={handleLeadCloseDate}
            disabled={loading}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingCategory ? "Update Funnel Category" : "Add Funnel Category"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Category Name"
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Stage Key"
              helperText="Used internally, lowercase with underscores"
              value={categoryForm.key}
              // onChange={(event) =>
              //   setCategoryForm((prev) => ({
              //     ...prev,
              //     key: toStageKey(event.target.value),
              //   }))
              // }
              fullWidth
              size="small"
              disabled
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Color Code"
                value={categoryForm.color}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                helperText="HEX value (example: #4e89d5)"
                size="small"
                fullWidth
              />
              <TextField
                label="Pick"
                type="color"
                value={normalizeHexColor(categoryForm.color)}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                size="small"
                sx={{ width: 88 }}
                inputProps={{
                  "aria-label": "Pick category color",
                }}
              />
              <TextField
                label="Position"
                type="number"
                value={categoryForm.position}
                // onChange={(event) =>
                //   setCategoryForm((prev) => ({
                //     ...prev,
                //     position: Number(event.target.value || 0),
                //   }))
                // }
                size="small"
                sx={{ width: 140 }}
                disabled
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={categoryForm.is_active}
                  // onChange={(event) =>
                  //   setCategoryForm((prev) => ({
                  //     ...prev,
                  //     is_active: event.target.checked,
                  //   }))
                  // }
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            disabled={categorySaving}
            startIcon={
              categorySaving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {categorySaving
              ? "Saving..."
              : editingCategory
                ? "Update"
                : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmationDialogOpen}
        title="Save funnel stage data"
        description={`Are you sure you want to save funnel stage data?`}
        confirmLabel="Save"
        cancelLabel="Cancel"
        confirmColor="success"
        loading={moving}
        onCancel={() => setConfirmationDialogOpen(false)}
        onConfirm={handleMoveLead}
      />

      <Dialog
              open={openFunnelCatDialog}
              onClose={() => setOpenFunnelCatDialog(false)}
              sx={{
                "& .MuiDialog-paper": {
                  maxWidth: "60%",
                  margin: 0,
                  overflowX: "hidden",
                },
              }}
        fullWidth
            >
              <DialogTitle>Funnel Category Master</DialogTitle>
              <DialogContent sx={{ overflowX: "hidden" }}>
                <TableContainer
            id="funnel-category-master-panel"
            sx={{
              borderRadius: "12px",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Key</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Position</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Color</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {funnelCategories.map((category) => (
                  <TableRow key={category.id} hover>
                    <TableCell>{category.name}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {category.key}
                    </TableCell>
                    <TableCell>{category.position}</TableCell>
                    <TableCell>
                      <Chip
                        label={category.color}
                        size="small"
                        sx={{
                          bgcolor: alpha(category.color, 0.15),
                          color: category.color,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={category.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={category.is_active ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => openEditCategoryDialog(category)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip> */}
                    </TableCell>
                  </TableRow>
                ))}
                {funnelCategories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No funnel categories found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setOpenFunnelCatDialog(false)}>Close</Button>
              </DialogActions>
            </Dialog>

      <Drawer
        anchor="right"
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        PaperProps={{ sx: { width: 420, p: 2 } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="h6">Lead Activity Timeline</Typography>
          <IconButton
            size="small"
            onClick={() => setActivityOpen(false)}
            aria-label="Close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ my: 2 }} />

        {loadingActivities ? (
          <Box display="flex" justifyContent="center" mt={4}>
            <CircularProgress size={24} />
          </Box>
        ) : activities.length === 0 ? (
          <Box
            sx={{
              bgcolor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              p: 3,
              textAlign: "center",
            }}
          >
            <InfoOutlinedIcon
              sx={{
                fontSize: 40,
                color: "#9ca3af",
                mb: 1,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              No activity data found.
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              Timeline entries will appear when this lead has engagements.
            </Typography>
          </Box>
        ) : (
          <Timeline
            sx={{
              width: "100%",
              p: 0,
              "& .MuiTimelineItem-root:before": {
                flex: 0,
                padding: 0,
              },
            }}
          >
            {activities.map((a, index) => (
              <TimelineItem key={a.id}>
                <TimelineSeparator>
                  <TimelineDot color="primary" />
                  {index !== activities.length - 1 && (
                    <TimelineConnector
                      sx={{ bgcolor: "#cdd4e1", width: "2px" }}
                    />
                  )}
                </TimelineSeparator>

                <TimelineContent sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      position: "relative",
                      borderRadius: 2,
                      border: "1px solid #eee",
                      bgcolor: "#fff",
                      p: 1.5,
                      transition: "0.2s",
                      "&:hover": {
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1.2,
                        alignItems: "flex-start",
                      }}
                    >
                      {/* ICON */}
                      <Box
                        sx={{
                          mt: 0.2,
                          color: "text.secondary",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {getActivityIcon(a.source!)}
                      </Box>

                      {/* CONTENT */}
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.3,
                        }}
                      >
                        {/* TITLE */}
                        <Typography
                          fontSize={13}
                          fontWeight={700}
                          lineHeight={1.2}
                        >
                          {a.attempt_label || "Activity"}
                        </Typography>

                        {/* META */}
                        <Box display="flex" alignItems="center" gap={1}>
                          {a.created_at && (
                            <>
                              <Typography
                                fontSize={15}
                                fontWeight={700}
                                color="text.secondary"
                              >
                                •
                              </Typography>
                              <Typography fontSize={12} color="text.secondary">
                                {formatDisplayDate(a.created_at)}
                              </Typography>
                            </>
                          )}
                        </Box>

                        {a.status && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Typography
                              fontSize={13}
                              variant="body2"
                              color="text.secondary"
                            >
                              Status:
                            </Typography>
                            <Typography
                              fontSize={13}
                              variant="body2"
                              fontWeight={600}
                              color="error.main"
                            >
                              {formatEndedReason(a.status)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* CHIPS */}
                    <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                      <SourceChip value={a.source || "Unknown source"} />
                      <OutcomeChip value={a.outcome} />
                    </Box>

                    {/* SUMMARY (VISUAL DE-EMPHASIS FIX) */}
                    {a.summary && (
                      <Box
                        sx={{
                          mt: 1.2,
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: "#f8fafc",
                          borderLeft: "3px solid #e5e7eb",
                        }}
                      >
                        <Typography fontSize={12} color="text.secondary">
                          {a.summary}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Drawer>
    </Box>
  );
};

export default LeadManager;

const SummaryCard = ({ label, value, icon, hint }: any) => {
  const getColor = () => {
    switch (label) {
      case "Total":
        return {
          bg: "#eff6ff",
          iconBg: "#dbeafe",
          color: "#2563eb",
        };

      case "Pipeline Leads":
        return {
          bg: "#f5f3ff",
          iconBg: "#ede9fe",
          color: "#7c3aed",
        };

      case "Closed Leads":
        return {
          bg: "#ecfdf5",
          iconBg: "#d1fae5",
          color: "#059669",
        };

      case "Lost Leads":
        return {
          bg: "#fef2f2",
          iconBg: "#fee2e2",
          color: "#dc2626",
        };

      default:
        return {
          bg: "#f8fafc",
          iconBg: "#f1f5f9",
          color: "#334155",
        };
    }
  };

  const theme = getColor();

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: "16px",
        background: theme.bg,
        border: "1px solid #eef0f3",
        minHeight: 142,
        transition: "all 0.2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: "text.primary" }}
          >
            {label}
          </Typography>

          <Typography
            variant="h4"
            sx={{ fontWeight: 800, mt: 0.5, color: theme.color }}
          >
            {value}
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.2 }}>
            {hint}
          </Typography>
        </Box>

        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            background: theme.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${theme.color}30`, // 🔥 adds contrast
          }}
        >
          {React.cloneElement(icon, {
            sx: { color: theme.color, fontSize: 22 },
          })}
        </Box>
      </Box>
    </Box>
  );
};
