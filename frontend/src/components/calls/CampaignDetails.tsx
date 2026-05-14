import { useEffect, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Chip,
  LinearProgress,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  TablePagination,
  InputAdornment,
  Paper,
  Drawer,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  TableContainer,
  CircularProgress,
  DialogActions,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PhoneIcon from "@mui/icons-material/Phone";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { callCampaignService } from "../../services/callCampaignService";
import CallDetailDrawer from "./CallDetailDrawer";
import {
  CallLog,
  CallLogFilterState,
  callLogService,
  ContactType,
  SentimentType,
  StatusType,
} from "../../services/callLogService";
import CallInsightsDrawer from "./CallInsightsDrawer";
import InsightsIcon from "@mui/icons-material/Insights";
import CallLogFilterSection from "./CallLogFilterSection";
import EllipsisCell from "../EllipsisCell";
import { ExportContactToExcel, ExportToExcel } from "../../utils/callLogExport";
import PeopleIcon from "@mui/icons-material/People";
import CallIcon from "@mui/icons-material/Call";
import ReplayIcon from "@mui/icons-material/Replay";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CloseIcon from "@mui/icons-material/Close";
import { useDateFormatter } from "../../hooks/useDateFormatter";
import { useAuth } from "../../context/AuthContext";
import { ConversionOutcomeChip, OutcomeChip, titleCase } from "../Common/StatusChips";
import WorkflowHistoryDrawer from "./WorkflowHistoryDrawer";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import { formatDate } from "../../utils/dateUtils";

interface Props {
  campaignId: number;
  onBack: () => void;
  onEdit: (id: number) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "ended":
      return "primary";
    case "queued":
      return "warning";
    case "failed":
      return "error";
    default:
      return "default";
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case "active":
    case "running":
      return "#dcfce7";

    case "scheduled":
      return "#fef3c7";

    case "paused":
      return "#fef3c7";

    case "completed":
      return "#dbeafe";

    case "cancelled":
      return "#fee2e2"; // light red

    case "failed":
      return "#fee2e2";

    default:
      return "#f3f4f6";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "active":
    case "running":
      return "#15803d";

    case "paused":
      return "#b45309";

    case "scheduled":
      return "#b45309";

    case "completed":
      return "#1d4ed8";

    case "cancelled":
      return "#b91c1c"; // dark red

    case "failed":
      return "#b91c1c";

    default:
      return "#374151";
  }
};

const formatEndedReason = (reason?: string) => {
  if (!reason) return "-";

  // Handle problematic long reasons
  if (reason.includes("failed-to-connect")) {
    return "Failed to Connect";
  }

  if (reason.includes("temporarily-unavailable")) {
    return "Temporarily Unavailable";
  }

  // Default: clean normal ones
  return reason.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); // capitalize
};

const instantReplyChannelLabel = (key: string) => {
  const k = key.toLowerCase();
  if (k === "sms") return "SMS";
  if (k === "email") return "Email";
  if (k === "whatsapp") return "WhatsApp";
  return key.charAt(0).toUpperCase() + key.slice(1);
};

type InstantReplyDetailRow = {
  channelKey: string;
  channelLabel: string;
  name: string;
  templateId: string;
};

const getInstantReplyDetailRows = (
  templates: Record<string, unknown> | undefined,
): InstantReplyDetailRow[] => {
  if (!templates) return [];
  const rows: InstantReplyDetailRow[] = [];
  for (const [channelKey, val] of Object.entries(templates)) {
    if (val == null || val === "") continue;
    if (typeof val === "number") {
      rows.push({
        channelKey,
        channelLabel: instantReplyChannelLabel(channelKey),
        name: "—",
        templateId: String(val),
      });
      continue;
    }
    if (typeof val === "object" && val !== null && "template_id" in val) {
      const o = val as { template_id?: number; name?: string };
      rows.push({
        channelKey,
        channelLabel: instantReplyChannelLabel(channelKey),
        name: o.name?.trim() ? o.name : "—",
        templateId: o.template_id != null ? String(o.template_id) : "—",
      });
    }
  }
  return rows;
};

export default function CampaignDetails({ campaignId, onBack, onEdit }: Props) {
  const theme = useTheme();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callLogTotal, setCallLogTotal] = useState(0);
  const [callLogPage, setCallLogPage] = useState(0);
  const [callLogRowsPerPage, setCallLogRowsPerPage] = useState(10);
  const [openInsights, setOpenInsights] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const formatDisplayDate = useDateFormatter()
  const { user } = useAuth()

  const [openContactsDialog, setOpenContactsDialog] = useState(false);
  const [contactType, setContactType] = useState<ContactType>("all");

  const [openWorkflowDrawer, setOpenWorkflowDrawer] = useState(false);
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);


  const [filters, setFilters] = useState<CallLogFilterState>({
    search: "",
    fromDate: "",
    endDate: "",
    call_end_reason: "All",
    status: "All",
    sentiment: "All",
    evaluation: "All",
    is_lead_qualified: "All",
    source: "All",
    is_connected: "All",
    sort_by: "oldest"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await callCampaignService.getCampaignDetails(campaignId);
      setCampaign(data);

      loadCallLogs(filters);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  useEffect(() => {
    const delay = setTimeout(() => {
      loadCallLogs(filters);
    }, 400);

    return () => clearTimeout(delay);
  }, [filters, callLogPage, callLogRowsPerPage]);

  const handleFilterChange = (newValues: Partial<CallLogFilterState>) => {
    setFilters((prev: CallLogFilterState) => ({
      ...prev,
      ...newValues,
    }));
  };

  const loadCallLogs = async (updatedFilters = filters) => {
    const data = await callLogService.allLogs({
      campaign_id: campaignId,
      search: updatedFilters.search || undefined,
      skip: callLogPage * callLogRowsPerPage,
      limit: callLogRowsPerPage,
      from_date: updatedFilters.fromDate || undefined,
      end_date: updatedFilters.endDate || undefined,
      call_end_reason:
        updatedFilters.call_end_reason !== "All"
          ? updatedFilters.call_end_reason
          : undefined,
      status:
        updatedFilters.status !== "All"
          ? (updatedFilters.status as StatusType)
          : undefined,
      sentiment:
        updatedFilters.sentiment !== "All"
          ? (updatedFilters.sentiment as SentimentType)
          : undefined,
      evaluation:
        updatedFilters.evaluation !== "All"
          ? updatedFilters.evaluation
          : undefined,
      is_lead_qualified:
        updatedFilters.is_lead_qualified !== "All"
          ? updatedFilters.is_lead_qualified
          : undefined,
      source:
        updatedFilters.source !== "All"
          ? updatedFilters.source
          : undefined,
      is_connected:
        updatedFilters.is_connected !== "All"
          ? updatedFilters.is_connected
          : undefined,
      sort_by:
        updatedFilters.sort_by
          ? updatedFilters.sort_by
          : "oldest",
    });
    setCallLogs(data.items || []);
    setCallLogTotal(data.pagination?.total || 0);
  };

  const progress = campaign?.total_calls
    ? (campaign.attempted_calls / campaign.total_contacts) * 100
    : 0;

  const handleExport = async () => {
    try {
      const data = await callLogService.allLogs({
        campaign_id: campaignId,
        search: filters.search || undefined,
        from_date: filters.fromDate || undefined,
        end_date: filters.endDate || undefined,
        call_end_reason:
          filters.call_end_reason !== "All"
            ? filters.call_end_reason
            : undefined,
        status: filters.status !== "All" ? filters.status : undefined,
        sentiment: filters.sentiment !== "All" ? filters.sentiment : undefined,
        evaluation:
          filters.evaluation !== "All" ? filters.evaluation : undefined,
        is_lead_qualified: filters.is_lead_qualified !== "All" ? filters.is_lead_qualified : undefined,
        source: filters.source !== "All" ? filters.source : undefined,
        is_connected: filters.is_connected !== "All" ? filters.is_connected : undefined
      });

      ExportToExcel(data, "Campaign_Call_Logs", user?.timezone);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const handleOpen = (type: ContactType) => {
    setContactType(type);
    setOpenContactsDialog(true);
  };

  const openWorkflowHistory = async (contactId?: number) => {
    if (!contactId) return;

    const data = await callCampaignService.getWorkflowHistory(
      campaignId,
      contactId
    );

    setWorkflowHistory(data);
    setOpenWorkflowDrawer(true);
  };


  return (
    <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      {/* LOADING */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* HEADER */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={onBack}>
            <ArrowBackIcon />
          </IconButton>

          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PhoneIcon sx={{ color: "#fff" }} />
          </Box>

          <Box>
            <Typography variant="h6" fontWeight="bold">
              {campaign?.name}
            </Typography>

            <Box display="flex" gap={2} mt={1}>
              <Typography variant="body2">
                Created {formatDisplayDate(campaign?.created_at)}
              </Typography>

              <Chip
                label={titleCase(campaign?.status || "pending")}
                size="small"
                sx={{
                  borderRadius: "999px",
                  fontWeight: 600,
                  backgroundColor: getStatusBg(campaign?.status),
                  color: getStatusText(campaign?.status),
                }}
                variant="outlined"
              />
            </Box>

            {/* ✅ NEW: Status Note */}
            {campaign?.stop_reason && (
              <Typography
                variant="body2"
                sx={{ mt: 0.5, color: "text.secondary" }}
              >
                Status Note - {campaign.stop_reason}
              </Typography>
            )}
          </Box>
        </Box>
        {["draft"].includes(campaign?.status) && (
          <Button variant="outlined" onClick={() => onEdit(campaignId)}>
            Edit
          </Button>
        )}
      </Box>
      {/* STATS */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={3}>
          <Card
            onClick={() => handleOpen("all")}
            sx={{
              cursor: "pointer",
              transition: "0.2s",
              "&:hover": {
                boxShadow: 6,
              },
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="subtitle2">Total Contacts</Typography>
                <PeopleIcon color="primary" />
              </Box>

              <Typography variant="h5" mt={1}>
                {campaign?.total_contacts || 0}
              </Typography>
              <Typography variant="caption" mt={1} color="text.secondary">
                Click to view all contacts
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            onClick={() => handleOpen("initiated")}
            sx={{
              cursor: "pointer",
              transition: "0.2s",
              "&:hover": {
                boxShadow: 6,
              },
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="subtitle2">Initiated Calls</Typography>
                <CallIcon color="primary" />
              </Box>
              <Typography variant="h5" mt={1}>
                {campaign?.attempted_calls || 0}
              </Typography>
              <Typography variant="caption" mt={1} color="text.secondary">
                Click to view initiated calls
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card
            onClick={() => handleOpen("rescheduled")}
            sx={{
              cursor: "pointer",
              transition: "0.2s",
              "&:hover": {
                boxShadow: 6,
              },
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="subtitle2">Follow-up Calls</Typography>
                <EventRepeatIcon color="primary" />
              </Box>
              <Typography variant="h5" mt={1}>
                {campaign?.rescheduled_calls || 0}
              </Typography>
              <Typography variant="caption" mt={1} color="text.secondary">
                Click to view follow-up calls
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            onClick={() => handleOpen("pending")}
            sx={{
              cursor: "pointer",
              transition: "0.2s",
              "&:hover": {
                boxShadow: 6,
              },
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="subtitle2">Pending Calls</Typography>
                <ScheduleIcon color="primary" />
              </Box>
              <Typography variant="h5" mt={1}>
                {campaign?.pending_scheduled_calls || 0}
              </Typography>
              <Typography variant="caption" mt={1} color="text.secondary">
                Click to view pending calls
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* PROGRESS */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography fontWeight="bold">Campaign Progress</Typography>
          <Typography variant="body2" mb={1}>
            {campaign?.attempted_calls || 0} of {campaign?.total_contacts || 0}{" "}
            contacts reached
          </Typography>
          <LinearProgress variant="determinate" value={progress} />
        </CardContent>
      </Card>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Campaign Information
          </Typography>

          {/* GENERAL INFO */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "grey.50",
              mb: 2,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
              General
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Agent
                </Typography>
                <Typography fontWeight={600}>
                  {campaign?.agent_name || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Category
                </Typography>
                <Typography fontWeight={600}>
                  {campaign?.category || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Product
                </Typography>
                <Typography fontWeight={600}>
                  {campaign?.product_name || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Send Option
                </Typography>
                <Typography
                  fontWeight={600}
                  color={
                    campaign?.send_option === "scheduled"
                      ? "warning.main"
                      : "success.main"
                  }
                >
                  {campaign?.send_option || "instant"}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* SCHEDULE INFO */}
          {campaign?.send_option === "scheduled" && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: "grey.50",
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
                Schedule
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography fontWeight={600}>
                    {campaign?.scheduled_at
                      ? formatDate(campaign?.scheduled_at)
                      : "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Timezone
                  </Typography>
                  <Typography fontWeight={600}>
                    {campaign?.timezone || "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Call Window
                  </Typography>
                  <Typography fontWeight={600}>
                    {campaign?.call_start_time || "-"} —{" "}
                    {campaign?.call_end_time || "-"}
                  </Typography>
                </Grid>

                {/* <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Interval
                  </Typography>
                  <Typography fontWeight={600}>
                    {campaign?.call_interval
                      ? `${campaign.call_interval} mins`
                      : "-"}
                  </Typography>
                </Grid> */}

                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Active Days
                  </Typography>
                  <Typography fontWeight={600}>
                    {campaign?.active_days || "-"}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}



          {/* Workflow & INSTANT REPLY */}
          {(() => {
            const irRows = getInstantReplyDetailRows(
              campaign?.instant_reply_templates,
            );

            const validRows = irRows.filter(
              (r) => r.name && r.name !== "—"
            );

            const modes: string[] = Array.isArray(campaign?.instant_reply_modes)
              ? campaign.instant_reply_modes
              : [];

            return (
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  mt: 2,
                  flexWrap: { xs: "wrap", md: "nowrap" },
                }}
              >
                {/* WORKFLOW */}
                <Box
                  sx={{
                    flex: 1,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "grey.50",
                    border: "1px solid",
                    borderColor: "grey.200",
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
                    Workflow
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Follow Workflow Template
                  </Typography>

                  <Typography
                    fontWeight={600}
                    color={campaign?.workflow_template_name ? "text.primary" : "text.secondary"}
                  >
                    {campaign?.workflow_template_name || "No workflow selected"}
                  </Typography>
                </Box>

                {/* INSTANT REPLY */}
                <Box
                  sx={{
                    flex: 1,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "grey.50",
                    border: "1px solid",
                    borderColor: "grey.200",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                  }}
                >
                  {/* LEFT */}
                  <Box sx={{ minWidth: 160, flexShrink: 0 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Instant reply
                    </Typography>

                    {modes.length > 0 ? (
                      <Box display="flex" gap={0.75} flexWrap="wrap" mt={1}>
                        {modes.map((m) => (
                          <Chip
                            key={m}
                            size="small"
                            label={instantReplyChannelLabel(m)}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        No channels selected
                      </Typography>
                    )}
                  </Box>

                  {/* RIGHT */}
                  {validRows.length > 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 2,
                        flex: 1,
                      }}
                    >
                      {validRows.map((row) => (
                        <Box
                          key={row.channelKey}
                          sx={{
                            flex: "1 1 120px",
                            maxWidth: 200,
                            minWidth: 120,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {row.channelLabel}
                          </Typography>

                          <Typography fontWeight={600} noWrap>
                            {row.name}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                      No instant reply templates selected
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })()}
        </CardContent>
      </Card>

      {/* ACTIONS */}
      {loading && (
        <Box mb={3}>
          <LinearProgress sx={{ borderRadius: 1.2 }} />
        </Box>
      )}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* HEADER */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            mb={2}
          >
            {/* LEFT */}
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Call List
              </Typography>

              <Box
                display="flex"
                gap={3}
                mt={0.5}
                flexWrap="wrap"
                color="text.secondary"
              >
                <Typography variant="body2" color="text.secondary">
                  From number:{" "}
                  <Box
                    component="span"
                    sx={{
                      color: "primary.main",
                      fontWeight: 500,
                    }}
                  //onClick={() => onEdit(campaign?.agent_id)}
                  >
                    {campaign?.calling_no || "-"}
                  </Box>
                </Typography>
              </Box>
            </Box>

            {/* RIGHT */}
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
              >
                Export
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => loadData()}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          {/* FILTER */}
          <CallLogFilterSection
            filters={filters}
            onFilterChange={handleFilterChange}
          />

          {/* TABLE */}

          <Card>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Contact</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ended Reason</TableCell>
                  <TableCell>Sentiment</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {callLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 8 }}>
                      <Box
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="center"
                        textAlign="center"
                        gap={1}
                      >
                        <SearchIcon
                          sx={{ fontSize: 40, color: "text.secondary" }}
                        />

                        <Typography
                          sx={{ color: "text.secondary", fontWeight: 500 }}
                        >
                          No call logs found
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{ color: "text.disabled" }}
                        >
                          Try adjusting your search
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  callLogs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="flex-start" gap={1}>
                          {/* Main icon */}
                          <Box>
                            {/* Contact name */}
                            <EllipsisCell value={log.contact} width={140} />

                            {/* Phone */}
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <PhoneIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {log.phone}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={titleCase(log.status)}
                          color={getStatusColor(log.status) as any}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box
                          component="span"
                          sx={{
                            color: "error.main",
                            fontWeight: 500,
                          }}
                        //onClick={() => onEdit(campaign?.agent_id)}
                        >
                          {formatEndedReason(log.ended_reason)}
                        </Box>
                      </TableCell>

                      <TableCell>
                        <OutcomeChip value={log.sentiment} />
                      </TableCell>
                      <TableCell>
                        <ConversionOutcomeChip value={log.lead_qualified_status} />
                      </TableCell>
                      <TableCell>
                        {log.duration ? `${log.duration} sec` : "N/A"}
                      </TableCell>
                      <TableCell>
                        {log.date ? formatDisplayDate(log.date) : "-"}
                      </TableCell>
                      <TableCell>
                        {campaign?.workflow_template_name && log.follow_up_count > 0 && (
                          <Tooltip title="View Follow Up">
                            <IconButton onClick={() => openWorkflowHistory(log.contact_id)}>
                              <EventRepeatIcon color="primary" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Insights">
                          <IconButton
                            onClick={() => {
                              setSelectedCall(log);
                              setOpenInsights(true);
                            }}
                          >
                            <InsightsIcon color="primary" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedCall(log);
                            setOpenDetail(true);
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={callLogTotal}
              page={callLogPage}
              onPageChange={(_, value) => setCallLogPage(value)}
              rowsPerPage={callLogRowsPerPage}
              onRowsPerPageChange={(event) => {
                setCallLogRowsPerPage(parseInt(event.target.value, 10));
                setCallLogPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </Card>
        </CardContent>
      </Card>
      {/* Drawer / Detail View */}
      <CallDetailDrawer
        open={openDetail}
        selectedCall={selectedCall}
        onClose={() => setOpenDetail(false)}
      />
      <CallInsightsDrawer
        open={openInsights}
        onClose={() => setOpenInsights(false)}
        data={selectedCall}
      />

      <ContactsDialog
        campaign_id={campaignId}
        open={openContactsDialog}
        onClose={() => setOpenContactsDialog(false)}
        type={contactType}
      />

      <WorkflowHistoryDrawer
        open={openWorkflowDrawer}
        onClose={() => setOpenWorkflowDrawer(false)}
        data={workflowHistory}
      />
    </Box>
  );
}

interface ContactsDialogProps {
  campaign_id: number;
  open: boolean;
  onClose: () => void;
  type: ContactType;
}

function ContactsDialog({
  campaign_id,
  open,
  onClose,
  type,
}: ContactsDialogProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatDisplayDate = useDateFormatter()

  useEffect(() => {
    if (open) {
      setData([]);
      setError(null);
      fetchData();
    }
  }, [open, type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await callLogService.getCampaignContacts(campaign_id, type);
      setData(data || []);
    } catch (e) {
      console.error(e);
      setData([]);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = (type: ContactType): string => {
    switch (type) {
      case "all":
        return "Total Contacts";
      case "initiated":
        return "Initiated Calls";
      case "rescheduled":
        return "Follow-up Calls";
      case "pending":
        return "Pending Calls";
      default:
        return "Data";
    }
  };

  const tableConfig: Record<
    ContactType,
    { columns: { label: string; key: string }[] }
  > = {
    all: {
      columns: [
        { label: "NAME", key: "name" },
        { label: "PHONE", key: "phone" },
        { label: "EMAIL", key: "email" },
      ],
    },
    pending: {
      columns: [
        { label: "NAME", key: "name" },
        { label: "PHONE", key: "phone" },
        { label: "EMAIL", key: "email" },
      ],
    },
    initiated: {
      columns: [
        { label: "NAME", key: "name" },
        { label: "PHONE", key: "phone" },
        { label: "STATUS", key: "status" },
        { label: "ENDED REASON", key: "ended_reason" },
        { label: "DATE", key: "date" },
      ],
    },
    rescheduled: {
      columns: [
        { label: "NAME", key: "name" },
        { label: "PHONE", key: "phone" },
        { label: "STATUS", key: "status" },
        { label: "ENDED REASON", key: "ended_reason" },
        { label: "DATE", key: "date" },
      ],
    },
  };

  const handleExport = async () => {
    try {
      ExportContactToExcel(data, type, getDialogTitle(type));
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const columns = tableConfig[type].columns;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{getDialogTitle(type)}</DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box textAlign="center">
            <CircularProgress size={20} />
            <Typography sx={{ mr: 1 }}>Loading data...</Typography>
          </Box>
        ) : error ? (
          <Box textAlign="center" mt={5}>
            <Typography color="error">{error}</Typography>
            <Button onClick={fetchData}>Retry</Button>
          </Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.key}>{col.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.key.includes("date")
                          ? formatDisplayDate(row[col.key])
                          : (row[col.key] ?? "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={loading || !!error || data.length === 0}
        >
          Export to Excel
        </Button>

        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>


  );
}
