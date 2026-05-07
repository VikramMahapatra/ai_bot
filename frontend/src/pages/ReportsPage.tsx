import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "../components/Layout/AdminLayout";
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Alert,
  LinearProgress,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Snackbar,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Download as FileDownloadIcon,
  LocalPrintshop as PrintIcon,
  TrendingUp,
  Assignment,
  Star,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";

import {
  reportService,
  ConversationMetric,
  DailyStats,
  SessionMessage,
  VoiceCampaignReportItem,
  VoiceCampaignReportSummary,
} from "../services/reportService";
import {
  campaignService,
  CampaignItem,
  ContactListItem,
} from "../services/campaignService";
import { productService, Product } from "../services/productService";
import {
  ConversionOutcomeChip,
  OutcomeChip,
  SourceChip,
  StageChip,
  titleCase,
} from "../components/Common/StatusChips";
import { Menu, ListItemIcon, ListItemText } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { FunnelCategory } from "../types";
import { funnelCategoryService } from "../services/funnelCategoryService";
import { useDateFormatter } from "../hooks/useDateFormatter";
import EmailIcon from "@mui/icons-material/Email";
import EllipsisCell from "../components/EllipsisCell";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { formatDate } from "../utils/dateUtils";

export const ActionMenu = ({
  handleExportCSV,
  handlePrint,
  handleRunOutcomeProcessing,
  outcomeRunning,
}: any) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);

  const handleOpen = (event: any) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<SettingsIcon />}
        onClick={handleOpen}
        sx={{
          textTransform: "none",
          fontWeight: 600,
        }}
      >
        Actions
      </Button>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem
          onClick={() => {
            handleExportCSV();
            handleClose();
          }}
        >
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export CSV</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handlePrint();
            handleClose();
          }}
        >
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Print</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleRunOutcomeProcessing();
            handleClose();
          }}
          disabled={outcomeRunning}
        >
          <ListItemIcon>
            <Star fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {outcomeRunning ? "Running..." : "Run Outcome Processing"}
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const reportTabIndexes = {
  conversations: 0,
  campaign: 1,
};

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ReportsPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [widgetId, setWidgetId] = useState("");

  // Campaign report filters
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [campaignStatus, setCampaignStatus] = useState("");
  const [campaignProductId, setCampaignProductId] = useState<number | "">("");
  const [campaignContactListId, setCampaignContactListId] = useState<
    number | ""
  >("");
  const [campaignCreatedFrom, setCampaignCreatedFrom] = useState("");
  const [campaignCreatedTo, setCampaignCreatedTo] = useState("");
  const [campaignScheduledFrom, setCampaignScheduledFrom] = useState("");
  const [campaignScheduledTo, setCampaignScheduledTo] = useState("");

  // Summary data
  const [summary, setSummary] = useState<any>(null);

  // Conversations data
  const [conversations, setConversations] = useState<ConversationMetric[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalConversations, setTotalConversations] = useState(0);
  const [sortBy] = useState("conversation_start");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionDialogLoading, setSessionDialogLoading] = useState(false);
  const [sessionDialogId, setSessionDialogId] = useState("");
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([]);
  const [outcomeRunning, setOutcomeRunning] = useState(false);
  const [outcomeSnackbarOpen, setOutcomeSnackbarOpen] = useState(false);
  const [outcomeSnackbarMessage, setOutcomeSnackbarMessage] = useState("");

  // Token data
  const [tokenReport, setTokenReport] = useState<any>(null);

  // Leads data
  const [leadReport, setLeadReport] = useState<any>(null);

  // Daily stats
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);

  // Campaign report data
  const [campaignReportTab, setCampaignReportTab] = useState(0);
  const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(10);
  const [campaignProducts, setCampaignProducts] = useState<Product[]>([]);
  const [campaignContactLists, setCampaignContactLists] = useState<
    ContactListItem[]
  >([]);

  // Voice campaign report data
  const [voiceAgentName, setVoiceAgentName] = useState("");
  const [voiceCampaignName, setVoiceCampaignName] = useState("");
  const [voiceLeadOutcomes, setVoiceLeadOutcomes] = useState<string[]>([]);
  const [voiceCreatedFrom, setVoiceCreatedFrom] = useState("");
  const [voiceCreatedTo, setVoiceCreatedTo] = useState("");
  const [voiceSummary, setVoiceSummary] =
    useState<VoiceCampaignReportSummary | null>(null);
  const [voiceItems, setVoiceItems] = useState<VoiceCampaignReportItem[]>([]);
  const [voiceTotal, setVoiceTotal] = useState(0);
  const [voicePage, setVoicePage] = useState(0);
  const [voiceRowsPerPage, setVoiceRowsPerPage] = useState(10);
  const [voiceAgentOptions, setVoiceAgentOptions] = useState<string[]>([]);
  const [voiceCampaignOptions, setVoiceCampaignOptions] = useState<string[]>(
    [],
  );
  const [voiceDefaultCampaignName, setVoiceDefaultCampaignName] = useState("");
  const [voiceLeadOutcomeOptions, setVoiceLeadOutcomeOptions] = useState<
    string[]
  >(["positive", "satisfactory", "neutral", "negative", "unresolved"]);
  const [voiceDetailsOpen, setVoiceDetailsOpen] = useState(false);
  const [voiceDetailsItem, setVoiceDetailsItem] =
    useState<VoiceCampaignReportItem | null>(null);
  const [funnelCategories, setFunnelCategories] = useState<FunnelCategory[]>(
    [],
  );
  const [conversationOutcome, setConversationOutcome] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [conversationSentiments, setConversationSentiments] = useState<
    string[]
  >([]);
  const formatDisplayDate = useDateFormatter();

  // Print dialog
  // const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const loadFunnelCategories = async () => {
    try {
      const data = await funnelCategoryService.list(true);
      setFunnelCategories(data);
    } catch {
      setError("Failed to load funnel categories");
    }
  };

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

  const stageLabel = (stage?: string | null) => {
    if (!stage || !stage.trim()) return "Unassigned";
    return titleCase(stage.toLowerCase());
  };

  // Fetch summary
  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getReportSummary({
        start_date: startDate,
        end_date: endDate,
        widget_id: widgetId,
      });
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch summary");
    } finally {
      setLoading(false);
    }
  };

  // Fetch conversations
  const fetchConversations = async (pageValue?: number) => {
    try {
      setLoading(true);
      setError(null);
      const currentPage = pageValue ?? page;
      const data = await reportService.getConversationsReport({
        skip: currentPage * rowsPerPage,
        limit: rowsPerPage,
        start_date: startDate,
        end_date: endDate,
        widget_id: widgetId,
        sort_by: sortBy,
        sort_order: sortOrder,
        search: contactSearch,
        sentiments: conversationSentiments,
        outcome: conversationOutcome,
      });
      setConversations(data.metrics);
      setTotalConversations(data.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  };

  // Fetch token report
  const fetchTokenReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getTokenUsageReport({
        start_date: startDate,
        end_date: endDate,
      });
      setTokenReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch token report");
    } finally {
      setLoading(false);
    }
  };

  const handleRunOutcomeProcessing = async () => {
    try {
      setOutcomeRunning(true);
      const res = await reportService.runOutcomeProcessingNow();
      // Refresh conversations after processing
      if (tabValue === reportTabIndexes.conversations) fetchConversations();
      setOutcomeSnackbarMessage(res.message!);
      setOutcomeSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to run outcome processing");
    } finally {
      setOutcomeRunning(false);
    }
  };

  const handleOutcomeSnackbarClose = () => {
    setOutcomeSnackbarOpen(false);
  };

  // Fetch leads report
  const fetchLeadsReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getLeadsReport({
        start_date: startDate,
        end_date: endDate,
      });
      setLeadReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch leads report");
    } finally {
      setLoading(false);
    }
  };

  // Fetch daily stats
  const fetchDailyStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getDailyStats({ days: 30 });
      setDailyStats(data.daily_stats);
    } catch (err: any) {
      setError(err.message || "Failed to fetch daily stats");
    } finally {
      setLoading(false);
    }
  };

  const toIsoStartOfDay = (value: string) =>
    value ? `${value}T00:00:00` : undefined;
  const toIsoEndOfDay = (value: string) =>
    value ? `${value}T23:59:59` : undefined;

  const fetchCampaignLookups = async () => {
    try {
      const [products, lists] = await Promise.all([
        productService.productLookup(),
        campaignService.listContactLists({ skip: 0, limit: 300 }),
      ]);
      setCampaignProducts(products || []);
      setCampaignContactLists(lists.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load campaign filter options");
    }
  };

  const fetchCampaignReport = async (pageValue?: number) => {
    try {
      setLoading(true);
      setError(null);
      const currentPage = pageValue ?? campaignPage;
      const data = await campaignService.listCampaigns({
        search: campaignSearch || undefined,
        campaign_type: (campaignType || undefined) as any,
        status: (campaignStatus || undefined) as any,
        product_id: campaignProductId ? Number(campaignProductId) : undefined,
        contact_list_id: campaignContactListId
          ? Number(campaignContactListId)
          : undefined,
        created_from: toIsoStartOfDay(campaignCreatedFrom),
        created_to: toIsoEndOfDay(campaignCreatedTo),
        scheduled_from: toIsoStartOfDay(campaignScheduledFrom),
        scheduled_to: toIsoEndOfDay(campaignScheduledTo),
        skip: currentPage * campaignRowsPerPage,
        limit: campaignRowsPerPage,
      });
      setCampaignItems(data.items || []);
      setCampaignTotal(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to fetch campaign report");
    } finally {
      setLoading(false);
    }
  };

  const fetchVoiceCampaignReport = async (
    pageValue?: number,
    overrides?: {
      agent_name?: string;
      campaign_name?: string;
      lead_outcomes?: string[];
      start_date?: string;
      end_date?: string;
    },
  ) => {
    try {
      setLoading(true);
      setError(null);
      const currentPage = pageValue ?? voicePage;
      const data = await reportService.getVoiceCampaignReport({
        skip: currentPage * voiceRowsPerPage,
        limit: voiceRowsPerPage,
        agent_name: overrides?.agent_name ?? (voiceAgentName || undefined),
        campaign_name:
          overrides?.campaign_name ??
          (voiceCampaignName && voiceCampaignName !== "All"
            ? voiceCampaignName
            : undefined),
        lead_outcomes:
          overrides?.lead_outcomes ??
          (voiceLeadOutcomes.length > 0 ? voiceLeadOutcomes : undefined),
        start_date: overrides?.start_date ?? toIsoStartOfDay(voiceCreatedFrom),
        end_date: overrides?.end_date ?? toIsoEndOfDay(voiceCreatedTo),
      });
      setVoiceItems(data.items || []);
      setVoiceTotal(data.total || 0);
      setVoiceSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch voice campaign report");
    } finally {
      setLoading(false);
    }
  };

  const buildVoiceReportParams = () => ({
    agent_name: voiceAgentName || undefined,
    campaign_name: voiceCampaignName || undefined,
    lead_outcomes: voiceLeadOutcomes.length > 0 ? voiceLeadOutcomes : undefined,
    start_date: toIsoStartOfDay(voiceCreatedFrom),
    end_date: toIsoEndOfDay(voiceCreatedTo),
  });

  const fetchAllVoiceCampaignDataForExport = async () => {
    const pageSize = 1000;
    const params = buildVoiceReportParams();
    let skip = 0;
    let total = 0;
    let summary: VoiceCampaignReportSummary | null = null;
    const allItems: VoiceCampaignReportItem[] = [];

    while (true) {
      const response = await reportService.getVoiceCampaignReport({
        ...params,
        skip,
        limit: pageSize,
      });

      if (!summary) {
        summary = response.summary || null;
      }

      total = response.total || 0;
      const batch = response.items || [];
      allItems.push(...batch);
      skip += batch.length;

      if (batch.length === 0 || skip >= total) {
        break;
      }
    }

    return { items: allItems, summary };
  };

  const fetchVoiceCampaignFilterOptions = async () => {
    try {
      const data = await reportService.getVoiceCampaignFilterOptions();
      setVoiceAgentOptions(data.agent_names || []);
      setVoiceCampaignOptions(data.campaign_names || []);
      const defaultCampaign = data.default_campaign_name || "";
      setVoiceDefaultCampaignName(defaultCampaign);
      if (defaultCampaign) {
        setVoiceCampaignName((prev) => prev || defaultCampaign);
      }
      if (data.lead_outcomes && data.lead_outcomes.length > 0) {
        setVoiceLeadOutcomeOptions(data.lead_outcomes);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load voice filter options");
    }
  };

  const handleApplyCampaignReportFilters = async () => {
    if (campaignPage !== 0) setCampaignPage(0);
    await fetchCampaignReport(0);
  };

  const handleResetCampaignReportFilters = async () => {
    setCampaignSearch("");
    setCampaignType("");
    setCampaignStatus("");
    setCampaignProductId("");
    setCampaignContactListId("");
    setCampaignCreatedFrom("");
    setCampaignCreatedTo("");
    setCampaignScheduledFrom("");
    setCampaignScheduledTo("");
    setCampaignPage(0);
    await fetchCampaignReport(0);
  };

  const handleResetCoversationReportFilters = async () => {
    setContactSearch("");
    setConversationSentiments([]);
    setConversationOutcome("");
    setStartDate("");
    setEndDate("");
    setPage(0);
    await fetchConversations(0);
  };

  const handleApplyVoiceCampaignFilters = async () => {
    if (voicePage !== 0) setVoicePage(0);
    await fetchVoiceCampaignReport(0);
  };

  const handleResetVoiceCampaignFilters = async () => {
    const resetCampaign = voiceDefaultCampaignName || "";
    setVoiceAgentName("");
    setVoiceCampaignName(resetCampaign);
    setVoiceLeadOutcomes([]);
    setVoiceCreatedFrom("");
    setVoiceCreatedTo("");
    setVoicePage(0);
    await fetchVoiceCampaignReport(0, {
      agent_name: undefined,
      campaign_name: resetCampaign || undefined,
      lead_outcomes: undefined,
      start_date: undefined,
      end_date: undefined,
    });
  };

  // Initial fetch
  useEffect(() => {
    // fetchSummary();
    loadFunnelCategories();
  }, []);

  useEffect(() => {
    if (tabValue === reportTabIndexes.conversations) {
      fetchConversations();
    }
  }, [tabValue, page, rowsPerPage]);

  useEffect(() => {
    if (tabValue === reportTabIndexes.campaign && campaignReportTab === 0) {
      fetchCampaignReport();
    }
  }, [tabValue, campaignReportTab, campaignPage, campaignRowsPerPage]);

  useEffect(() => {
    if (tabValue === reportTabIndexes.campaign && campaignReportTab === 1) {
      fetchVoiceCampaignReport();
    }
  }, [tabValue, campaignReportTab, voicePage, voiceRowsPerPage]);

  useEffect(() => {
    if (tabValue === reportTabIndexes.campaign && campaignReportTab === 1) {
      fetchVoiceCampaignFilterOptions();
    }
  }, [tabValue, campaignReportTab]);

  // Tab change handler
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    switch (newValue) {
      case 0:
        fetchSummary();
        break;
      case 1:
        setPage(0);
        if (page === 0) {
          fetchConversations();
        }
        break;
      case 2:
        fetchTokenReport();
        break;
      case 3:
        fetchLeadsReport();
        break;
      case 4:
        fetchDailyStats();
        break;
      case 5:
        if (campaignReportTab === 0) {
          fetchCampaignLookups();
          fetchCampaignReport();
        } else {
          fetchVoiceCampaignFilterOptions();
          fetchVoiceCampaignReport();
        }
        break;
    }
  };

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle sort change
  // const handleSort = (column: string) => {
  //   if (sortBy === column) {
  //     setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  //   } else {
  //     setSortBy(column);
  //     setSortOrder('desc');
  //   }
  //   setPage(0);
  // };

  // Handle export CSV
  const handleExportCSV = async () => {
    try {
      if (tabValue === reportTabIndexes.campaign && campaignReportTab === 1) {
        setLoading(true);
        setError(null);
        const { items, summary } = await fetchAllVoiceCampaignDataForExport();
        if (items.length === 0) {
          setError("No voice campaign data to export.");
          return;
        }
        await reportService.exportVoiceCampaignToExcel(
          items,
          formatDisplayDate,
          summary,
          "voice_campaign_report",
        );
        return;
      }

      await reportService.exportToCSV({
        start_date: startDate,
        end_date: endDate,
        widget_id: widgetId,
      });
    } catch (err: any) {
      setError(err.message || "Failed to export CSV");
    } finally {
      if (tabValue === reportTabIndexes.campaign && campaignReportTab === 1) {
        setLoading(false);
      }
    }
  };

  // Handle export PDF
  const handleExportPDF = async () => {
    try {
      switch (tabValue) {
        case 0: // Summary
          if (summary) {
            await reportService.exportSummaryToPDF(summary, "Summary Report");
          } else {
            setError("No summary data to export. Please fetch summary first.");
          }
          break;
        case 1: // Conversations
          if (conversations.length > 0) {
            await reportService.exportConversationsToPDF(
              conversations,
              "Conversations Report",
            );
          } else {
            setError(
              "No conversations data to export. Please fetch conversations first.",
            );
          }
          break;
        case 2: // Token Usage
          if (tokenReport) {
            await reportService.exportTokensToPDF(
              tokenReport,
              "Token Usage Report",
            );
          } else {
            setError(
              "No token data to export. Please fetch token report first.",
            );
          }
          break;
        case 3: // Leads
          if (leadReport) {
            await reportService.exportLeadsToPDF(
              leadReport,
              "Leads Analytics Report",
            );
          } else {
            setError(
              "No leads data to export. Please fetch leads report first.",
            );
          }
          break;
        case 4: // Daily Stats
          if (dailyStats.length > 0) {
            await reportService.exportDailyStatsToPDF(
              dailyStats,
              "Daily Statistics Report",
            );
          } else {
            setError(
              "No daily stats to export. Please fetch daily stats first.",
            );
          }
          break;
        case 5: // Campaign report
          if (campaignReportTab === 1) {
            setLoading(true);
            setError(null);
            const { items, summary } =
              await fetchAllVoiceCampaignDataForExport();
            if (items.length > 0) {
              await reportService.exportVoiceCampaignToPDF(
                items,
                formatDisplayDate,
                summary,
                "Voice Campaign Report",
              );
            } else {
              setError(
                "No voice campaign data to export. Please fetch voice report first.",
              );
            }
          } else {
            setError("PDF export is currently available for Voice report tab.");
          }
          break;
        default:
          setError("Invalid tab selected");
      }
    } catch (err: any) {
      setError(err.message || "Failed to export PDF");
    } finally {
      if (tabValue === reportTabIndexes.campaign && campaignReportTab === 1) {
        setLoading(false);
      }
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  const exportPrimaryLabel =
    tabValue === 5 && campaignReportTab === 1 ? "Export Excel" : "Export CSV";

  const truncateSessionId = (sessionId: string) => {
    if (!sessionId || sessionId.length <= 18) return sessionId;
    return `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;
  };

  const handleViewSession = async (
    sessionId: string,
    sessionWidgetId?: string | null,
  ) => {
    try {
      setSessionDialogLoading(true);
      setSessionDialogId(sessionId);
      setSessionDialogOpen(true);
      const messages = await reportService.getSessionMessages(
        sessionId,
        sessionWidgetId || undefined,
      );
      setSessionMessages(messages);
    } catch (err: any) {
      setError(err.message || "Failed to fetch session messages");
      setSessionMessages([]);
    } finally {
      setSessionDialogLoading(false);
    }
  };

  const handleCloseSessionDialog = () => {
    setSessionDialogOpen(false);
    setSessionDialogId("");
    setSessionMessages([]);
  };

  const handleOpenVoiceDetails = (item: VoiceCampaignReportItem) => {
    setVoiceDetailsItem(item);
    setVoiceDetailsOpen(true);
  };

  const handleCloseVoiceDetails = () => {
    setVoiceDetailsOpen(false);
    setVoiceDetailsItem(null);
  };

  const COLORS = ["#2f6bff", "#2d8ef0", "#5e72ff", "#36c4ff", "#7ab9ff"];

  const metricCardSx = {
    boxShadow: 2,
    borderRadius: 3,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
    background:
      "linear-gradient(140deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.92) 100%)",
  };

  const voiceWrapCellSx = {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    verticalAlign: "top",
    maxWidth: 220,
    lineHeight: 1.4,
  };

  const voiceNoWrapCellSx = {
    whiteSpace: "nowrap",
    verticalAlign: "top",
    minWidth: 150,
  };

  const sourceLabel = (source?: string) =>
    titleCase((source || "chat").toLowerCase());

  return (
    <AdminLayout>
      <Box>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.6 },
            mb: 3,
            borderRadius: "22px",
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
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            {/* LEFT SIDE */}
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}
              >
                Reports
              </Typography>
              <Typography variant="body1" sx={{ color: "text.secondary" }}>
                View detailed reports on conversations, token usage, lead
                generation, and more.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <ActionMenu
                handleExportCSV={handleExportCSV}
                handlePrint={handlePrint}
                handleRunOutcomeProcessing={handleRunOutcomeProcessing}
                outcomeRunning={outcomeRunning}
              />
            </Box>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Filters */}

        {loading && <LinearProgress />}

        <Snackbar
          open={outcomeSnackbarOpen}
          autoHideDuration={4000}
          onClose={handleOutcomeSnackbarClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleOutcomeSnackbarClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {outcomeSnackbarMessage}
          </Alert>
        </Snackbar>

        {/* Tabs */}
        <Paper
          sx={{
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="report tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            {/* <Tab label="Summary" id="report-tab-0" aria-controls="report-tabpanel-0"  /> */}
            <Tab
              label="Conversations"
              id="report-tab-1"
              aria-controls="report-tabpanel-1"
            />
            {/* <Tab label="Token Usage" id="report-tab-2" aria-controls="report-tabpanel-2" />
            <Tab label="Lead Analytics" id="report-tab-3" aria-controls="report-tabpanel-3" />
            <Tab label="Daily Stats" id="report-tab-4" aria-controls="report-tabpanel-4" /> */}
            <Tab
              label="Campaign Report"
              id="report-tab-5"
              aria-controls="report-tabpanel-5"
            />
          </Tabs>

          {/* Summary Tab */}
          {/* <TabPanel value={tabValue} index={0}>
            {summary && (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Total Conversations
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                            {summary.total_conversations}
                          </Typography>
                        </Box>
                        <Assignment sx={{ fontSize: 32, color: 'primary.main', opacity: 0.7 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Total Messages
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                            {summary.total_messages}
                          </Typography>
                        </Box>
                        <ChatBubble sx={{ fontSize: 32, color: '#2d8ef0', opacity: 0.7 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Total Tokens
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                            {summary.total_tokens?.toLocaleString()}
                          </Typography>
                        </Box>
                        <TrendingUp sx={{ fontSize: 32, color: '#5e72ff', opacity: 0.7 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Avg Tokens/Conversation
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                            {summary.average_tokens_per_conversation?.toFixed(0)}
                          </Typography>
                        </Box>
                        <BarChartIcon sx={{ fontSize: 32, color: '#369fff', opacity: 0.7 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Total Leads
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                            {summary.total_leads_captured}
                          </Typography>
                        </Box>
                        <ShoppingCart sx={{ fontSize: 32, color: '#5e72ff', opacity: 0.7 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Avg Satisfaction
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                            {summary.average_satisfaction_rating?.toFixed(2) || 'N/A'} / 5
                          </Typography>
                        </Box>
                        <Star sx={{ fontSize: 32, color: '#2d8ef0', opacity: 0.7 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Conversation Duration
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Average: <strong>{summary.average_conversation_duration?.toFixed(2)} seconds</strong>
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel> */}

          {/* Conversations Tab */}
          <TabPanel value={tabValue} index={0}>
            <Paper
              sx={{
                p: 3,
                mb: 3,
                borderRadius: "18px",
                border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Filter Reports
              </Typography>
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Contact"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sentiment</InputLabel>
                    <Select
                      multiple
                      value={conversationSentiments}
                      onChange={(e) =>
                        setConversationSentiments(
                          typeof e.target.value === "string"
                            ? e.target.value.split(",")
                            : e.target.value,
                        )
                      }
                      input={<OutlinedInput label="Sentiment" />}
                      renderValue={(selected) =>
                        (selected as string[]).join(", ")
                      }
                    >
                      {voiceLeadOutcomeOptions.map((sentiment) => (
                        <MenuItem key={sentiment} value={sentiment}>
                          <Checkbox
                            checked={
                              conversationSentiments.indexOf(sentiment) > -1
                            }
                          />
                          {sentiment}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={conversationOutcome}
                      label="Type"
                      onChange={(e) => setConversationOutcome(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="positive">Positive</MenuItem>
                      <MenuItem value="negative">Negative</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2.5}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.5}>
                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                  />
                </Grid>
                {/* <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="Widget ID"
                value={widgetId}
                onChange={(e) => setWidgetId(e.target.value)}
                placeholder="Optional"
                fullWidth
                size="small"
              />
            </Grid> */}
                <Grid item xs={12} sm={3}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="contained"
                      onClick={() => fetchConversations()}
                      fullWidth
                      sx={{ height: 40 }}
                    >
                      Apply Filters
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleResetCoversationReportFilters}
                    >
                      Reset
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Contact</TableCell>
                    <TableCell>Source</TableCell>
                    {/* <TableCell align="right">Messages</TableCell>
                    <TableCell align="right">Tokens</TableCell> */}
                    {/* <TableCell align="right">Response Time</TableCell>
                    <TableCell>AI Funnel</TableCell> */}
                    <TableCell>Sentiment</TableCell>
                    <TableCell>Outcome</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conversations.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell
                        title={conv.contact_name}
                        sx={{ maxWidth: 220 }}
                      >
                        <Typography variant="body2" noWrap>
                          {conv.contact_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <SourceChip value={conv.source} />
                      </TableCell>
                      {/* <TableCell align="right">{conv.total_messages}</TableCell>
                      <TableCell align="right">{conv.total_tokens}</TableCell> */}
                      {/* <TableCell align="right">
                        {conv.average_response_time?.toFixed(2)}s
                      </TableCell> */}
                      {/* <TableCell>
                        {conv.ai_funnel ? (
                          <Chip
                            label={conv.ai_funnel}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            label="Unassigned"
                            variant="outlined"
                            size="small"
                          />
                        )}
                      </TableCell> */}
                      <TableCell>
                        <OutcomeChip value={conv.outcome || "Pending"} />
                      </TableCell>
                      <TableCell>
                        <ConversionOutcomeChip value={conv.lead_conversion} />
                      </TableCell>
                      <TableCell>
                        {formatDisplayDate(conv.conversation_start)}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() =>
                            handleViewSession(conv.session_id, conv.widget_id)
                          }
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={totalConversations}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TabPanel>

          {/* Token Usage Tab */}
          {/* <TabPanel value={tabValue} index={2}>
            {tokenReport && (
              <Grid container spacing={2}>
                {[
                  ['Total Tokens', tokenReport.total_tokens?.toLocaleString()],
                  ['Prompt Tokens', tokenReport.prompt_tokens?.toLocaleString()],
                  ['Completion Tokens', tokenReport.completion_tokens?.toLocaleString()],
                  ['Avg Tokens/Conversation', tokenReport.average_tokens_per_conversation?.toFixed(0)],
                  ['Conversations', tokenReport.conversations_count],
                  ['Estimated Cost', `$${tokenReport.cost_estimate?.toFixed(4) || '0.00'}`],
                ].map(([label, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={String(label)}>
                    <Card sx={metricCardSx}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          {String(label)}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
                          {String(value ?? '0')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                <Grid item xs={12}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                        Token Distribution
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Prompt Tokens', value: tokenReport.prompt_tokens },
                              { name: 'Completion Tokens', value: tokenReport.completion_tokens },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry: any) => `${entry.name}: ${entry.value}`}
                            outerRadius={80}
                            fill="#2f6bff"
                            dataKey="value"
                          >
                            {COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel> */}

          {/* Leads Tab */}
          {/* <TabPanel value={tabValue} index={3}>
            {leadReport && (
              <Grid container spacing={2}>
                {[
                  ['Total Leads', leadReport.total_leads],
                  ['Leads with Email', leadReport.leads_with_email],
                  ['Conversion Rate', `${leadReport.conversion_rate?.toFixed(2)}%`],
                ].map(([label, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={String(label)}>
                    <Card sx={metricCardSx}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          {String(label)}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
                          {String(value ?? '0')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                <Grid item xs={12} md={6}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                        Leads by Widget
                      </Typography>
                      <Box>
                        {Object.entries(leadReport.leads_by_widget || {}).map(
                          ([widget, count]: [string, any]) => (
                            <Box key={widget} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">{widget || 'Unknown'}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{count}</Typography>
                            </Box>
                          )
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                        Leads by Date (Last 7 Days)
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={Object.entries(leadReport.leads_by_date || {})
                            .slice(-7)
                            .map(([date, count]) => ({ date, leads: count }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="leads" fill="#2f6bff" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel> */}

          {/* Daily Stats Tab */}
          {/* <TabPanel value={tabValue} index={4}>
            {dailyStats.length > 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                        Daily Conversations
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="conversation_count" stroke="#2f6bff" name="Conversations" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                        Daily Messages & Tokens
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="total_messages" fill="#2f6bff" name="Messages" />
                          <Bar yAxisId="right" dataKey="total_tokens" fill="#36c4ff" name="Tokens" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card sx={metricCardSx}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                        Daily Leads Captured
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="leads_captured" fill="#5e72ff" name="Leads" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Conversations</TableCell>
                          <TableCell align="right">Messages</TableCell>
                          <TableCell align="right">Tokens</TableCell>
                          <TableCell align="right">Leads</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dailyStats.map((stat, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{stat.date}</TableCell>
                            <TableCell align="right">{stat.conversation_count}</TableCell>
                            <TableCell align="right">{stat.total_messages}</TableCell>
                            <TableCell align="right">{stat.total_tokens}</TableCell>
                            <TableCell align="right">{stat.leads_captured}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}
          </TabPanel> */}

          <TabPanel value={tabValue} index={1}>
            <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
              <Tabs
                value={campaignReportTab}
                onChange={(_, newValue: number) => {
                  setCampaignReportTab(newValue);
                  if (newValue === 0) {
                    fetchCampaignLookups();
                    if (campaignPage === 0) {
                      fetchCampaignReport();
                    } else {
                      setCampaignPage(0);
                    }
                    return;
                  }
                  fetchVoiceCampaignFilterOptions();
                  if (voicePage === 0) {
                    fetchVoiceCampaignReport();
                  } else {
                    setVoicePage(0);
                  }
                }}
                aria-label="campaign report sub tabs"
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Text" />
                <Tab label="Voice" />
              </Tabs>
            </Paper>

            {campaignReportTab === 0 ? (
              <>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 1.5 }}
                  >
                    Campaign Report Filters
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Search Campaign"
                        value={campaignSearch}
                        onChange={(e) => setCampaignSearch(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={campaignType}
                          label="Type"
                          onChange={(e) => setCampaignType(e.target.value)}
                        >
                          <MenuItem value="">All</MenuItem>
                          <MenuItem value="email">Email</MenuItem>
                          <MenuItem value="whatsapp">WhatsApp</MenuItem>
                          <MenuItem value="sms">SMS</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={campaignStatus}
                          label="Status"
                          onChange={(e) => setCampaignStatus(e.target.value)}
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
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Product</InputLabel>
                        <Select
                          value={campaignProductId}
                          label="Product"
                          onChange={(e) =>
                            setCampaignProductId(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                        >
                          <MenuItem value="">All</MenuItem>
                          {campaignProducts.map((item) => (
                            <MenuItem key={item.id} value={item.id}>
                              {item.name} ({item.code})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Contact List</InputLabel>
                        <Select
                          value={campaignContactListId}
                          label="Contact List"
                          onChange={(e) =>
                            setCampaignContactListId(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                        >
                          <MenuItem value="">All</MenuItem>
                          {campaignContactLists.map((item) => (
                            <MenuItem key={item.id} value={item.id}>
                              {item.list_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Created From"
                        value={campaignCreatedFrom}
                        onChange={(e) => setCampaignCreatedFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Created To"
                        value={campaignCreatedTo}
                        onChange={(e) => setCampaignCreatedTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Scheduled From"
                        value={campaignScheduledFrom}
                        onChange={(e) =>
                          setCampaignScheduledFrom(e.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Scheduled To"
                        value={campaignScheduledTo}
                        onChange={(e) => setCampaignScheduledTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                      >
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleApplyCampaignReportFilters}
                        >
                          Apply Filters
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleResetCampaignReportFilters}
                        >
                          Reset
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Campaign</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Contact List</TableCell>
                        <TableCell>Scheduled</TableCell>
                        <TableCell align="right">Sent</TableCell>
                        <TableCell align="right">Failed</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {campaignItems.length > 0 ? (
                        campaignItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 600 }}>
                                {item.campaign_name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                #{item.id}
                              </Typography>
                            </TableCell>
                            <TableCell>{item.campaign_type}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={item.status}
                                color={
                                  item.status === "completed"
                                    ? "success"
                                    : item.status === "failed"
                                      ? "error"
                                      : "primary"
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{item.product_name || "-"}</TableCell>
                            <TableCell>
                              {item.contact_list_name || item.contact_list_id}
                            </TableCell>
                            <TableCell>
                              {item.scheduled_time
                                ? formatDisplayDate(item.scheduled_time)
                                : "-"}
                            </TableCell>
                            <TableCell align="right">
                              {item.number_sent}
                            </TableCell>
                            <TableCell align="right">
                              {item.number_failed}
                            </TableCell>
                            <TableCell>
                              {item.created_at
                                ? formatDisplayDate(item.created_at)
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} align="center">
                            No campaigns found for selected filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={campaignTotal}
                  rowsPerPage={campaignRowsPerPage}
                  page={campaignPage}
                  onPageChange={(_, newPage) => setCampaignPage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setCampaignRowsPerPage(parseInt(event.target.value, 10));
                    setCampaignPage(0);
                  }}
                />
              </>
            ) : (
              <>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 1.5 }}
                  >
                    Voice Campaign Filters
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Call Agent Name</InputLabel>
                        <Select
                          value={voiceAgentName}
                          label="Call Agent Name"
                          onChange={(e) => setVoiceAgentName(e.target.value)}
                        >
                          <MenuItem value="">All</MenuItem>
                          {voiceAgentOptions.map((name) => (
                            <MenuItem key={name} value={name}>
                              {name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Campaign Name</InputLabel>
                        <Select
                          value={voiceCampaignName}
                          label="Campaign Name"
                          displayEmpty
                          onChange={(e) => setVoiceCampaignName(e.target.value)}
                        >
                          {voiceCampaignOptions.map((name) => (
                            <MenuItem key={name} value={name}>
                              {name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Sentiment</InputLabel>
                        <Select
                          multiple
                          value={voiceLeadOutcomes}
                          onChange={(e) =>
                            setVoiceLeadOutcomes(
                              typeof e.target.value === "string"
                                ? e.target.value.split(",")
                                : e.target.value,
                            )
                          }
                          input={<OutlinedInput label="Sentiment" />}
                          renderValue={(selected) =>
                            (selected as string[]).join(", ")
                          }
                        >
                          {voiceLeadOutcomeOptions.map((outcome) => (
                            <MenuItem key={outcome} value={outcome}>
                              <Checkbox
                                checked={
                                  voiceLeadOutcomes.indexOf(outcome) > -1
                                }
                              />
                              {outcome}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Lead Created From"
                        value={voiceCreatedFrom}
                        onChange={(e) => setVoiceCreatedFrom(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Lead Created To"
                        value={voiceCreatedTo}
                        onChange={(e) => setVoiceCreatedTo(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                      >
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleApplyVoiceCampaignFilters}
                        >
                          Apply
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleResetVoiceCampaignFilters}
                        >
                          Reset
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={metricCardSx}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Total Call
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{ mt: 1, fontWeight: 700 }}
                        >
                          {voiceSummary?.total_calls ?? 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={metricCardSx}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Successful Attempt
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{ mt: 1, fontWeight: 700 }}
                        >
                          {voiceSummary?.successful_attempts ?? 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={metricCardSx}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Sum of Call Duration
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{ mt: 1, fontWeight: 700 }}
                        >
                          {voiceSummary?.sum_call_duration_label || "0s"}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={metricCardSx}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Campaign Duration
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{ mt: 1, fontWeight: 700 }}
                        >
                          {voiceSummary?.campaign_duration_label || "0s"}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <TableContainer
                  sx={{
                    width: "100%",
                    overflowX: "auto",
                    overflowY: "hidden",
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  }}
                >
                  <Table
                    stickyHeader
                    size="small"
                    sx={{
                      width: "100%",
                      minWidth: 1100,
                      "& .MuiTableHead-root .MuiTableCell-root": {
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.06,
                        ),
                      },
                      "& .MuiTableBody-root .MuiTableCell-root": {
                        py: 1.2,
                      },
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer Name</TableCell>
                        <TableCell>Campaign Name</TableCell>
                        <TableCell>Campaign Start Date</TableCell>
                        <TableCell>Lead Sentiment</TableCell>
                        <TableCell>Lead Created Date</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {voiceItems.length > 0 ? (
                        voiceItems.map((item, idx) => (
                          <TableRow key={`${item.email || "voice"}-${idx}`}>
                            <TableCell sx={voiceWrapCellSx}>
                              <Box
                                display="flex"
                                flexDirection="column"
                                gap={0.5}
                              >
                                <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, lineHeight: 1.35 }}
                              >
                                {item.customer_name || "-"}
                              </Typography>
                              {item.email?.trim() ? (
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
                                    {item.email}
                                  </Box>
                                </Typography>
                              ) : null}
                              </Box>
                            </TableCell>
                            {/* CAMPAIGN NAME */}
                            <TableCell>
                              <Box
                                display="flex"
                                flexDirection="column"
                                gap={0.5}
                              >
                                <Typography fontWeight={600}>
                                  {item.campaign_name}
                                </Typography>

                                {/* Agent */}
                                <Box
                                  display="flex"
                                  alignItems="center"
                                  gap={0.5}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Agent:
                                  </Typography>
                                  <EllipsisCell value={item.agent_name} />
                                </Box>

                                <Box display="flex" alignItems="center" gap={2}>
                                  {/* Product */}
                                  {item.product_name && (
                                    <Box
                                      display="flex"
                                      alignItems="center"
                                      gap={0.5}
                                    >
                                      <Inventory2Icon
                                        fontSize="small"
                                        sx={{ fontSize: 16 }}
                                        color="action"
                                      />
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {item.product_name}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell sx={voiceNoWrapCellSx}>
                              {item.campaign_start_date
                                ? formatDisplayDate(item.campaign_start_date)
                                : "-"}
                            </TableCell>
                            <TableCell sx={voiceWrapCellSx}>
                              <OutcomeChip value={item.lead_outcome} />
                            </TableCell>
                            <TableCell sx={voiceNoWrapCellSx}>
                              {item.created_at
                                ? formatDisplayDate(item.created_at)
                                : "-"}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handleOpenVoiceDetails(item)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} align="center">
                            No voice campaign records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={voiceTotal}
                  rowsPerPage={voiceRowsPerPage}
                  page={voicePage}
                  onPageChange={(_, newPage) => setVoicePage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setVoiceRowsPerPage(parseInt(event.target.value, 10));
                    setVoicePage(0);
                  }}
                />
              </>
            )}
          </TabPanel>
        </Paper>

        <Dialog
          open={voiceDetailsOpen}
          onClose={handleCloseVoiceDetails}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Voice Lead Details</DialogTitle>
          <DialogContent dividers>
            {!voiceDetailsItem ? (
              <Typography variant="body2" color="text.secondary">
                No details available.
              </Typography>
            ) : (
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Agent Name
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.agent_name || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Customer Name
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.customer_name || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.email || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Company
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.company || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Organization
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.organization_name || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Campaign Name
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.campaign_name || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Campaign Start Date
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.campaign_start_date
                                ? formatDisplayDate(voiceDetailsItem.campaign_start_date)
                                : "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Campaign Source
                  </Typography>
                  <Typography variant="body1">
                    <SourceChip value={voiceDetailsItem.campaign_source} />
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Funnel Stage
                  </Typography>
                  <Typography variant="body1">
                    <StageChip
                      value={voiceDetailsItem.funnel_stage}
                      funnelCategories={funnelCategories}
                      stageNameByKey={stageNameByKey}
                      stageLabel={stageLabel!}
                    />
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Lead Outcome
                  </Typography>
                  <Typography variant="body1">
                    <OutcomeChip value={voiceDetailsItem.lead_outcome} />
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Product
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.product_name || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Lead Created Date
                  </Typography>
                  <Typography variant="body1">
                    {voiceDetailsItem.created_at
                      ? formatDisplayDate(voiceDetailsItem.created_at)
                      : "-"}
                  </Typography>
                </Grid>
              </Grid>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={sessionDialogOpen}
          onClose={handleCloseSessionDialog}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>
            Session Messages: {truncateSessionId(sessionDialogId)}
          </DialogTitle>
          <DialogContent dividers>
            {sessionDialogLoading ? (
              <LinearProgress />
            ) : sessionMessages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No messages found for this session.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {sessionMessages.map((item, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 1 }}
                    >
                      {formatDisplayDate(item.created_at)}
                    </Typography>

                    {/* ---------------- VOICE ---------------- */}
                    {item.source === "voice" ? (
                      <Box>
                        {item.message?.trim() && (
                          <>
                            <Typography fontWeight={600} mb={0.5}>
                              User
                            </Typography>
                            <Typography sx={{ whiteSpace: "pre-wrap" }}>
                              {item.message}
                            </Typography>
                          </>
                        )}
                        {item.response?.trim() && (
                          <>
                            <Typography fontWeight={600} mb={0.5}>
                              Assistant
                            </Typography>
                            <Typography
                              sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}
                            >
                              {item.response}
                            </Typography>
                          </>
                        )}
                      </Box>
                    ) : (
                      /* ---------------- CHAT ---------------- */
                      <Box>
                        <Typography fontWeight={600} mb={0.5}>
                          User
                        </Typography>
                        <Typography sx={{ mb: 1.5, whiteSpace: "pre-wrap" }}>
                          {item.message || "-"}
                        </Typography>

                        <Typography fontWeight={600} mb={0.5}>
                          Assistant
                        </Typography>
                        <Typography sx={{ whiteSpace: "pre-wrap" }}>
                          {item.response || "-"}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </AdminLayout>
  );
};

export default ReportsPage;
