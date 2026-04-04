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
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { alpha, useTheme } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MoveDownIcon from "@mui/icons-material/MoveDown";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GroupIcon from "@mui/icons-material/Group";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import { leadService } from "../../services/leadService";
import { dashboardService } from "../../services/dashboardService";
import { funnelCategoryService } from "../../services/funnelCategoryService";
import { Product, productService } from "../../services/productService";
import {
  campaignService,
  type CampaignItem,
  type CampaignType,
} from "../../services/campaignService";
import { FunnelCategory, FunnelCategoryPayload, Lead } from "../../types";
import { ConfirmDialog } from "../Common/ConfirmDialog";

const LEAD_SOURCES = ["chat", "voice", "email", "sms", "whatsapp"] as const;

const CAMPAIGN_TYPES: readonly CampaignType[] = ["email", "whatsapp", "sms"];

const titleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const sourceLabel = (source?: string) =>
  titleCase((source || "chat").toLowerCase());

const campaignTypeLabel = (type?: string) =>
  titleCase((type || "email").toLowerCase());

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

const LeadManager: React.FC = () => {
  const theme = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>(
    [],
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [funnelCategories, setFunnelCategories] = useState<FunnelCategory[]>(
    [],
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedFunnelStage, setSelectedFunnelStage] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [selectedCampaignType, setSelectedCampaignType] = useState<
    "all" | CampaignType
  >("all");
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
  const [categoryToDelete, setCategoryToDelete] =
    useState<FunnelCategory | null>(null);
  const [categoryDeleteSubmitting, setCategoryDeleteSubmitting] =
    useState(false);
  const [funnelMasterOpen, setFunnelMasterOpen] = useState(false);
  const [leadFiltersExpanded, setLeadFiltersExpanded] = useState(true);
  const [leadSearch, setLeadSearch] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

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

  const totalLeads = displayLeads.length;
  const contactableLeads = useMemo(
    () =>
      displayLeads.filter((lead) => Boolean(lead.email || lead.phone)).length,
    [displayLeads],
  );
  const companyLeads = useMemo(
    () => displayLeads.filter((lead) => Boolean(lead.company)).length,
    [displayLeads],
  );
  const weekLeads = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return displayLeads.filter(
      (lead) => new Date(lead.created_at).getTime() >= weekAgo,
    ).length;
  }, [displayLeads]);
  const conversionRate = totalLeads
    ? Math.round((contactableLeads / totalLeads) * 100)
    : 0;

  const activeFunnelCategories = useMemo(
    () =>
      funnelCategories
        .filter((item) => item.is_active)
        .sort((a, b) => a.position - b.position),
    [funnelCategories],
  );

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
        label: "Total Leads",
        value: totalLeads.toLocaleString(),
        hint: "All captured lead records",
        icon: <GroupIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#9fcbf6", 0.64)} 0%, ${alpha("#deedff", 0.76)} 100%)`,
        wave: theme.palette.secondary.main,
      },
      {
        label: "Total Conversion",
        value: `${conversionRate}%`,
        hint: `${contactableLeads.toLocaleString()} leads with contact info`,
        icon: <TrendingUpIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#a9d2fb", 0.64)} 0%, ${alpha("#e3f0ff", 0.78)} 100%)`,
        wave: "#468ed4",
      },
      {
        label: "Leads This Week",
        value: weekLeads.toLocaleString(),
        hint: "New leads in last 7 days",
        icon: <CalendarMonthIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#9cc3f3", 0.64)} 0%, ${alpha("#dce9ff", 0.76)} 100%)`,
        wave: theme.palette.primary.main,
      },
      {
        label: "Companies Captured",
        value: companyLeads.toLocaleString(),
        hint: "Leads that include company",
        icon: <BusinessIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#a1c8f4", 0.64)} 0%, ${alpha("#dceaff", 0.76)} 100%)`,
        wave: "#4b84ce",
      },
    ],
    [
      companyLeads,
      contactableLeads,
      conversionRate,
      theme.palette.primary.dark,
      theme.palette.primary.main,
      theme.palette.secondary.main,
      totalLeads,
      weekLeads,
    ],
  );

  const loadWidgets = async () => {
    try {
      const data = await dashboardService.getWidgets();
      const widgetItems = data?.widgets || [];
      setWidgets(
        widgetItems.map((widget: any) => ({
          widget_id: widget.widget_id,
          name: widget.name,
        })),
      );
    } catch {
      setError("Failed to load widgets");
    }
  };

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

  const loadCampaigns = async () => {
    try {
      const data = await campaignService.listCampaigns({
        skip: 0,
        limit: 500,
      });
      setCampaigns(data.items || []);
    } catch {
      setCampaigns([]);
    }
  };

  const loadLeads = async (
    widgetId?: string,
    source?: string,
    funnelStage?: string,
    productId?: string,
    campaignId?: string,
    campaignType?: string,
  ) => {
    try {
      setLoading(true);
      setError("");
      const data = await leadService.listLeads(
        0,
        100,
        widgetId,
        source,
        funnelStage,
        productId,
        campaignId,
        campaignType,
      );
      setLeads(data);
    } catch {
      setError("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
    loadProducts();
    loadFunnelCategories();
    loadCampaigns();
  }, []);

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
    );
  }, [
    selectedWidgetId,
    selectedProductId,
    selectedSource,
    selectedFunnelStage,
    selectedCampaignId,
    selectedCampaignType,
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

  // Used when the row "Filters" button is shown again.
  // const resetLeadBarFilters = () => {
  //   setLeadSearch("");
  //   setFilterStartDate("");
  //   setFilterEndDate("");
  // };

  const openDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const openMoveDialog = (lead: Lead) => {
    setMoveStage(lead.funnel_stage || "");
    setSelectedLead(lead);
    setMoveOpen(true);
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

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete?.id) return;

    setCategoryDeleteSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await funnelCategoryService.remove(categoryToDelete.id);
      setCategoryToDelete(null);
      setSuccess("Funnel category deleted.");
      await loadFunnelCategories();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to delete funnel category",
      );
    } finally {
      setCategoryDeleteSubmitting(false);
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
      );
      setLeads((prev) =>
        prev.map((lead) => (lead.id === updated.id ? updated : lead)),
      );
      setSelectedLead(updated);
      setMoveOpen(false);
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

  const filterPanel = (
    <Paper sx={{ ...panelSx, p: { xs: 1.6, md: 1.8 }, mb: 2.8 }}>
      <Box sx={{ maxWidth: 720 }}>
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
          for your sales workflow. Use{" "}
          <Box component="span" sx={{ fontWeight: 700 }}>
            Filter leads
          </Box>{" "}
          below for all dropdown filters.
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.9 }}
        >
          {[
            selectedWidget && `widget: ${selectedWidget.name}`,
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
            .join(" · ") || "Showing leads from all widgets"}
        </Typography>
      </Box>
    </Paper>
  );

  const gradientBarButtonSx = {
    minHeight: 44,
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

  const barFieldSx = {
    "& .MuiOutlinedInput-root": { borderRadius: "10px" },
  } as const;

  const dropdownFiltersInsetSx = {
    borderRadius: "12px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
    backgroundColor: alpha("#dce8f8", 0.52),
    p: { xs: 1.25, sm: 1.5 },
  } as const;

  const advancedLeadsFilterPanel = (
    <Paper
      elevation={0}
      sx={{
        ...panelSx,
        p: 2,
        mb: 2.8,
        overflow: "hidden",
        boxShadow: `0 8px 28px ${alpha(theme.palette.primary.dark, 0.12)}`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={leadFiltersExpanded}
          onClick={() => setLeadFiltersExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLeadFiltersExpanded((v) => !v);
            }
          }}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            cursor: "pointer",
            userSelect: "none",
            flex: 1,
            minWidth: 0,
            outline: "none",
            "&:focus-visible": {
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
              borderRadius: 1,
            },
          }}
        >
          <ExpandMoreIcon
            sx={{
              color: "text.secondary",
              transform: leadFiltersExpanded
                ? "rotate(180deg)"
                : "rotate(0deg)",
              transition: theme.transitions.create("transform", {
                duration: theme.transitions.duration.shortest,
              }),
            }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Filter leads
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={(e) => {
            e.stopPropagation();
            handleExport();
          }}
          disabled={leads.length === 0}
          sx={gradientBarButtonSx}
        >
          Export to CSV
        </Button>
      </Box>

      <Collapse in={leadFiltersExpanded} timeout="auto">
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by phone, campaign, widget..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                sx={barFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
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
                sx={barFieldSx}
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
                sx={barFieldSx}
              />
            </Grid>
            {/* <Grid item xs={6} sm={6} md={1.5}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<FilterListIcon />}
                onClick={resetLeadBarFilters}
                sx={gradientBarButtonSx}
              >
                Filters
              </Button>
            </Grid>
            <Grid item xs={6} sm={6} md={1.5}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={leads.length === 0}
                sx={gradientBarButtonSx}
              >
                Export to CSV
              </Button>
            </Grid> */}
          </Grid>

          <Box sx={dropdownFiltersInsetSx}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={barFieldSx}>
                  <InputLabel id="lead-bar-widget-label">Widget</InputLabel>
                  <Select
                    labelId="lead-bar-widget-label"
                    label="Widget"
                    value={selectedWidgetId}
                    onChange={(e: SelectChangeEvent<string>) =>
                      setSelectedWidgetId(e.target.value)
                    }
                    MenuProps={compactMenuProps}
                  >
                    <MenuItem value="all">All Widgets</MenuItem>
                    {widgets.map((widget) => (
                      <MenuItem key={widget.widget_id} value={widget.widget_id}>
                        {widget.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={barFieldSx}>
                  <InputLabel id="lead-bar-campaign-label">Campaign</InputLabel>
                  <Select
                    labelId="lead-bar-campaign-label"
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
                        {campaign.campaign_name} (
                        {campaignTypeLabel(campaign.campaign_type)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={barFieldSx}>
                  <InputLabel id="lead-filter-product-label">
                    Product
                  </InputLabel>
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
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={barFieldSx}>
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
                <FormControl fullWidth size="small" sx={barFieldSx}>
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
          </Box>
        </Stack>
      </Collapse>
    </Paper>
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

      <Paper sx={{ ...panelSx, p: 2.4, mb: 2.6, overflow: "hidden" }}>
        <Box
          role="button"
          aria-expanded={funnelMasterOpen}
          aria-controls="funnel-category-master-panel"
          tabIndex={0}
          onClick={() => setFunnelMasterOpen((open) => !open)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFunnelMasterOpen((open) => !open);
            }
          }}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            cursor: "pointer",
            userSelect: "none",
            mb: funnelMasterOpen ? 1.3 : 0,
            borderRadius: 1,
            outline: "none",
            "&:focus-visible": {
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
            },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <ExpandMoreIcon
              sx={{
                color: "text.secondary",
                transform: funnelMasterOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: theme.transitions.create("transform", {
                  duration: theme.transitions.duration.shortest,
                }),
              }}
              aria-hidden
            />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Funnel Category Master
            </Typography>
          </Stack>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={(e) => {
              e.stopPropagation();
              openCreateCategoryDialog();
            }}
          >
            Add Category
          </Button>
        </Box>

        <Collapse
          id="funnel-category-master-panel"
          in={funnelMasterOpen}
          timeout="auto"
        >
          <TableContainer
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
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCategoryDialog(category);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToDelete(category);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
        </Collapse>
      </Paper>

      {filterPanel}

      {advancedLeadsFilterPanel}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
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
                    sx={{ fontWeight: 800, mt: 0.35, color: "text.primary" }}
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
            </Paper>
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
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, maxWidth: 520 }}
            >
              Adjust filters in{" "}
              <Box component="span" sx={{ fontWeight: 700 }}>
                Filter leads
              </Box>{" "}
              above; the table reflects your selections.
            </Typography>
          </Box>
          <Chip
            label={`${displayLeads.length.toLocaleString()} records`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ fontWeight: 600, flexShrink: 0, mt: 0.4 }}
          />
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
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Funnel Stage</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <Tooltip title="Actions">
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </Box>
                  </Tooltip>
                </TableCell>
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
                  <TableCell>{lead.name || "-"}</TableCell>
                  <TableCell>{lead.email || "-"}</TableCell>
                  <TableCell>{lead.phone || "-"}</TableCell>
                  <TableCell>{lead.company || "-"}</TableCell>
                  <TableCell>{lead.product_name || "-"}</TableCell>
                  <TableCell>
                    <Chip
                      label={sourceLabel(lead.source)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={displayStageLabel(lead.funnel_stage)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(lead.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View lead actions">
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
                  </TableCell>
                </TableRow>
              ))}
              {displayLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {leads.length === 0
                        ? "No leads found for the selected filters."
                        : "No leads match the current search and filters."}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Lead Details</DialogTitle>
        <DialogContent dividers>
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
                    Created:{" "}
                    {new Date(selectedLead.created_at).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2">
                <strong>Email:</strong> {selectedLead.email || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Phone:</strong> {selectedLead.phone || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Company:</strong> {selectedLead.company || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Product Name:</strong> {selectedLead.product_name || ""}
              </Typography>
              <Typography variant="body2">
                <strong>Source:</strong> {sourceLabel(selectedLead.source)}
              </Typography>
              <Typography variant="body2">
                <strong>Funnel Stage:</strong>{" "}
                {displayStageLabel(selectedLead.funnel_stage)}
              </Typography>
              <Typography variant="body2">
                <strong>Session ID:</strong> {selectedLead.session_id || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Widget ID:</strong> {selectedLead.widget_id || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Lead outcome:</strong>{" "}
                {selectedLead.lead_outcome || "-"}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<MoveDownIcon />}
            onClick={() => {
              if (!selectedLead) return;
              setDetailsOpen(false);
              openMoveDialog(selectedLead);
            }}
          >
            Move to Funnel
          </Button>
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
                <Select
                  value={moveStage}
                  onChange={(event: SelectChangeEvent<string>) =>
                    setMoveStage(event.target.value)
                  }
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
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Back</Button>
          <Button
            variant="contained"
            onClick={handleMoveLead}
            disabled={moving || !moveStage}
            startIcon={
              moving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {moving ? "Saving..." : "Confirm & Move"}
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
              onChange={(event) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  key: toStageKey(event.target.value),
                }))
              }
              fullWidth
              size="small"
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
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    position: Number(event.target.value || 0),
                  }))
                }
                size="small"
                sx={{ width: 140 }}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={categoryForm.is_active}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      is_active: event.target.checked,
                    }))
                  }
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
        open={Boolean(categoryToDelete)}
        title="Delete funnel category?"
        description={
          categoryToDelete
            ? `This will permanently remove "${categoryToDelete.name}". This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={categoryDeleteSubmitting}
        onCancel={() => !categoryDeleteSubmitting && setCategoryToDelete(null)}
        onConfirm={handleConfirmDeleteCategory}
      />
    </Box>
  );
};

export default LeadManager;
