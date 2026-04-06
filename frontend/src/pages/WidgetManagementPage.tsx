import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Stack,
  Typography,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  InputAdornment,
  TablePagination,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  Link as LinkIcon,
  AddAlarm as AddAlarmIcon,
  Email as EmailIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/Layout/AdminLayout";
import { ConfirmDialog } from '../components/Common/ConfirmDialog';
import api from "../services/api";
import { buildPublicUrl } from "../config/env";
import SearchIcon from "@mui/icons-material/Search";

interface WidgetConfig {
  id?: number;
  widget_id: string;
  name: string;
  welcome_message?: string;
  system_prompt?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  position: string;
  lead_capture_enabled: boolean;
  lead_fields?: string;
  escalation_contact_level_1?: string;
  escalation_contact_level_2?: string;
  user_id?: number;
  organization_id?: number;
  created_at?: string;
}

interface WhatsAppConfigSummary {
  configured: boolean;
  widget_id?: string;
  phone_number_id?: string;
  waba_id?: string | null;
  is_active?: boolean;
}

interface WidgetTestLinkMeta {
  url?: string;
  startAt?: string;
  expiresAt?: string;
  loading?: boolean;
  attempted?: boolean;
}

export interface WidgetListResponse {
  widgets: WidgetConfig[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

type DialogMode = "view" | null;

const normalizeWidget = (widget: Partial<WidgetConfig>): WidgetConfig => ({
  id: widget.id,
  widget_id: typeof widget.widget_id === "string" ? widget.widget_id : "",
  name:
    typeof widget.name === "string" && widget.name.trim()
      ? widget.name
      : "Untitled Widget",
  welcome_message:
    typeof widget.welcome_message === "string"
      ? widget.welcome_message
      : "Hi! How can I help you?",
  system_prompt:
    typeof widget.system_prompt === "string" ? widget.system_prompt : "",
  logo_url: typeof widget.logo_url === "string" ? widget.logo_url : "",
  primary_color:
    typeof widget.primary_color === "string" ? widget.primary_color : "#007bff",
  secondary_color:
    typeof widget.secondary_color === "string"
      ? widget.secondary_color
      : "#6c757d",
  position:
    typeof widget.position === "string" ? widget.position : "bottom-right",
  lead_capture_enabled: Boolean(widget.lead_capture_enabled),
  lead_fields: typeof widget.lead_fields === "string" ? widget.lead_fields : "",
  escalation_contact_level_1:
    typeof widget.escalation_contact_level_1 === "string"
      ? widget.escalation_contact_level_1
      : "",
  escalation_contact_level_2:
    typeof widget.escalation_contact_level_2 === "string"
      ? widget.escalation_contact_level_2
      : "",
  user_id: widget.user_id,
  organization_id: widget.organization_id,
  created_at:
    typeof widget.created_at === "string" ? widget.created_at : undefined,
});

const managementSteps = [
  "Agent Profile",
  "Knowledge Base",
  "Integrations",
  "Share & Embed",
];
const DAY_MS = 24 * 60 * 60 * 1000;

const formatRemainingTime = (remainingMs: number): string => {
  if (remainingMs <= 0) return "Expired";

  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

const WidgetManagementPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogStep, setDialogStep] = useState(0);
  const [dialogTestLink, setDialogTestLink] = useState("");
  const [dialogTestLinkExpiresAt, setDialogTestLinkExpiresAt] = useState("");
  const [dialogTestLinkLoading, setDialogTestLinkLoading] = useState(false);
  const [widgetTestLinks, setWidgetTestLinks] = useState<
    Record<string, WidgetTestLinkMeta>
  >({});
  const [emailShareOpen, setEmailShareOpen] = useState(false);
  const [emailShareWidgetId, setEmailShareWidgetId] = useState("");
  const [emailShareWidgetName, setEmailShareWidgetName] = useState("");
  const [emailShareTo, setEmailShareTo] = useState("");
  const [emailShareSubject, setEmailShareSubject] = useState("");
  const [emailShareBody, setEmailShareBody] = useState("");
  const [emailShareSending, setEmailShareSending] = useState(false);
  const [widgetToDelete, setWidgetToDelete] = useState<WidgetConfig | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfigSummary>({
    configured: false,
  });
  const [formData, setFormData] = useState<WidgetConfig>({
    widget_id: "",
    name: "",
    welcome_message: "Hi! How can I help you?",
    system_prompt: "",
    logo_url: "",
    primary_color: "#2f6bff",
    secondary_color: "#36c4ff",
    position: "bottom-right",
    lead_capture_enabled: true,
    lead_fields: "",
    escalation_contact_level_1:
      "Support Team: support@example.com | +1-555-0101",
    escalation_contact_level_2:
      "Escalation Manager: escalation@example.com | +1-555-0102",
  });

  const [search, setSearch] = useState("");
  const [widgetTotal, setWidgetTotal] = useState(0);
  const [widgetPage, setWidgetPage] = useState(0);
  const [widgetRowsPerPage, setWidgetRowsPerPage] = useState(10);

  // Fetch widgets on mount
  useEffect(() => {
    fetchWidgets();
  }, [search, widgetPage, widgetRowsPerPage]);

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const [widgetsRes, whatsappRes] = await Promise.all([
        api.get<WidgetListResponse>("/api/admin/widgets", {
          params: {
            search: search, // your search state
            limit: widgetRowsPerPage,
            skip: widgetPage * widgetRowsPerPage,
          },
        }),
        api
          .get("/api/admin/whatsapp/config")
          .catch(() => ({ data: { configured: false } })),
      ]);

      const response = widgetsRes.data;

      const widgetList = Array.isArray(response.widgets)
        ? response.widgets.map((widget) => normalizeWidget(widget))
        : [];

      setWidgets(widgetList);
      setWidgetTotal(response.pagination?.total ?? 0);
      setWhatsappConfig(whatsappRes.data || { configured: false });

      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch widgets");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    navigate("/create-chat-agent");
  };

  const handleOpenEdit = (widget: WidgetConfig) => {
    const widgetId = widget.widget_id?.trim();
    if (!widgetId) {
      setError("Widget ID is missing. Cannot edit this agent.");
      return;
    }
    navigate(`/widgets/edit/${encodeURIComponent(widgetId)}`);
  };

  const handleOpenView = (widget: WidgetConfig) => {
    setFormData(widget);
    setDialogStep(0);
    setDialogTestLink("");
    setDialogTestLinkExpiresAt("");
    setDialogMode("view");
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setDialogStep(0);
    setDialogTestLink("");
    setDialogTestLinkExpiresAt("");
    setDialogTestLinkLoading(false);
  };

  const handleCloseEmailDialog = () => {
    setEmailShareOpen(false);
    setEmailShareWidgetId("");
    setEmailShareWidgetName("");
    setEmailShareTo("");
    setEmailShareSubject("");
    setEmailShareBody("");
    setEmailShareSending(false);
  };

  const handleConfirmDeleteWidget = async () => {
    const widgetId = widgetToDelete?.widget_id?.trim();
    if (!widgetId) return;

    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/admin/widget/config/${widgetId}`);
      setSuccess('Widget deleted successfully');
      setError('');
      setWidgetToDelete(null);
      await fetchWidgets();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete widget');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCopyEmbedCode = (widgetId: string) => {
    const embedCode = `<!-- AI Chatbot Widget -->
<link rel="stylesheet" href="https://your-domain.com/widget/dist/chatbot-widget.css" />
<script>
  window.AIChatbot = {
    widgetId: '${widgetId}',
    apiUrl: 'https://your-api-domain.com',
    name: 'AI Assistant',
    welcomeMessage: 'Hi! How can I help you today?',
    primaryColor: '#007bff',
    position: 'bottom-right'
  };
</script>
<script src="https://your-domain.com/widget/dist/chatbot-widget.iife.js"><\/script>`;
    navigator.clipboard.writeText(embedCode);
    setSuccess("Embed code copied to clipboard");
  };

  const getAgentTestUrl = (widgetId: string, token: string) =>
    buildPublicUrl(
      `/agent-test/${encodeURIComponent(widgetId)}?token=${encodeURIComponent(token)}`,
    );

  const buildShareEmailBody = (url: string, widgetName?: string) => {
    const safeName = (widgetName || "our AI assistant").trim();
    return [
      "Welcome from Zentrixel!",
      "",
      `You can test ${safeName} using this secure link:`,
      url,
      "",
      "If you have any questions, feel free to reply to this email.",
      "",
      "Regards,",
      "Zentrixel Team",
    ].join("\n");
  };

  const fetchWidgetTestLink = useCallback(
    async (
      widgetId: string,
      options?: { extraHours?: number; silent?: boolean },
    ): Promise<WidgetTestLinkMeta | null> => {
      if (!widgetId) return null;

      const extraHours = options?.extraHours || 0;
      const silent = Boolean(options?.silent);

      setWidgetTestLinks((prev) => ({
        ...prev,
        [widgetId]: { ...(prev[widgetId] || {}), loading: true },
      }));

      try {
        const response = await api.get(
          `/api/admin/widget/test-link/${encodeURIComponent(widgetId)}`,
          {
            params: extraHours > 0 ? { extra_hours: extraHours } : undefined,
          },
        );
        const token = String(response?.data?.token || "").trim();
        if (!token) {
          throw new Error("Missing test link token");
        }

        const nextMeta: WidgetTestLinkMeta = {
          url: getAgentTestUrl(widgetId, token),
          startAt:
            typeof response?.data?.start_at === "string"
              ? response.data.start_at
              : "",
          expiresAt:
            typeof response?.data?.expires_at === "string"
              ? response.data.expires_at
              : "",
          loading: false,
          attempted: true,
        };

        setWidgetTestLinks((prev) => ({
          ...prev,
          [widgetId]: nextMeta,
        }));

        return nextMeta;
      } catch (err: any) {
        setWidgetTestLinks((prev) => ({
          ...prev,
          [widgetId]: {
            ...(prev[widgetId] || {}),
            loading: false,
            attempted: true,
          },
        }));

        if (!silent) {
          setError(
            err?.response?.data?.detail ||
              "Failed to generate expiring test URL",
          );
        }
        return null;
      }
    },
    [],
  );

  const handleCopyTestUrl = async (widgetId: string) => {
    if (!widgetId) return;
    try {
      setDialogTestLinkLoading(true);
      const meta = widgetTestLinks[widgetId]?.url
        ? widgetTestLinks[widgetId]
        : await fetchWidgetTestLink(widgetId);

      const nextUrl = meta?.url || "";
      if (!nextUrl) {
        throw new Error("Unable to generate test URL");
      }

      setDialogTestLink(nextUrl);
      setDialogTestLinkExpiresAt(meta?.expiresAt || "");
      await navigator.clipboard.writeText(nextUrl);
      setSuccess("Agent test URL copied to clipboard");
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to copy agent test URL");
    } finally {
      setDialogTestLinkLoading(false);
    }
  };

  const handleExtendTestUrl = async (widgetId: string) => {
    if (!widgetId) return;
    const meta = await fetchWidgetTestLink(widgetId, { extraHours: 24 });
    if (!meta?.url) {
      return;
    }

    if (dialogMode === "view" && formData.widget_id === widgetId) {
      setDialogTestLink(meta.url || "");
      setDialogTestLinkExpiresAt(meta.expiresAt || "");
    }

    setSuccess(
      "Test link window reset to now and expiry set to next 24 hours.",
    );
    setError("");
  };

  const handleOpenEmailShare = async (widget: WidgetConfig) => {
    const widgetId = widget.widget_id?.trim() || "";
    if (!widgetId) {
      setError("Widget ID is missing.");
      return;
    }

    const meta = widgetTestLinks[widgetId]?.url
      ? widgetTestLinks[widgetId]
      : await fetchWidgetTestLink(widgetId);

    const url = meta?.url || "";
    if (!url) {
      setError("Could not generate test URL for email sharing.");
      return;
    }

    setEmailShareWidgetId(widgetId);
    setEmailShareWidgetName(widget.name || "AI Assistant");
    setEmailShareSubject(
      `Welcome to Zentrixel - Test ${widget.name || "AI Assistant"}`,
    );
    setEmailShareBody(buildShareEmailBody(url, widget.name));
    setEmailShareOpen(true);
    setError("");
  };

  const handleSendEmailShare = async () => {
    const email = emailShareTo.trim();
    if (!email) {
      setError("Please enter an email address.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!emailShareWidgetId) {
      setError(
        "Widget context missing for email sharing. Please reopen the dialog.",
      );
      return;
    }

    const subject = emailShareSubject.trim() || "Welcome to Zentrixel";
    const body = emailShareBody.trim();
    if (!body) {
      setError("Please enter email content.");
      return;
    }

    try {
      setEmailShareSending(true);
      await api.post("/api/admin/widget/test-link/email", {
        widget_id: emailShareWidgetId,
        to_email: email,
        subject,
        body,
      });

      setSuccess("Email sent successfully via SMTP.");
      setError("");
      handleCloseEmailDialog();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to send email");
    } finally {
      setEmailShareSending(false);
    }
  };

  const dialogLastStep = managementSteps.length - 1;
  const whatsappConnectedForAgent = Boolean(
    whatsappConfig.configured &&
    whatsappConfig.widget_id &&
    formData.widget_id &&
    whatsappConfig.widget_id === formData.widget_id &&
    whatsappConfig.is_active !== false,
  );

  const dialogStepDescriptions = useMemo(
    () => [
      "Review and refine identity, messaging, and visual style.",
      "Manage website/docs/text sources for grounded responses.",
      "Verify channel connectivity and operational readiness.",
      "Copy test URL and embed code for rollout and QA.",
    ],
    [],
  );

  const dialogProgress = useMemo(
    () => ((dialogStep + 1) / managementSteps.length) * 100,
    [dialogStep],
  );

  const linkStatusSummary = useMemo(() => {
    const now = Date.now();
    let active = 0;
    let expired = 0;
    for (const widget of widgets) {
      const widgetId = widget.widget_id?.trim() || "";
      if (!widgetId) continue;
      const expiry = widgetTestLinks[widgetId]?.expiresAt;
      if (!expiry) continue;
      const ts = new Date(expiry).getTime();
      if (!Number.isFinite(ts)) continue;
      if (ts > now) {
        active += 1;
      } else {
        expired += 1;
      }
    }
    return {
      total: widgets.length,
      active,
      expired,
    };
  }, [widgets, widgetTestLinks]);

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px",
      backgroundColor: alpha(theme.palette.common.white, 0.74),
    },
  } as const;

  const dialogPanelSx = {
    borderRadius: "18px",
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82,
    )} 68%, ${alpha("#dce8f8", 0.78)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
  } as const;

  const modernStepCardSx = {
    ...dialogPanelSx,
    borderRadius: "20px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(152deg, ${alpha(theme.palette.common.white, 0.82)} 0%, ${alpha(
      theme.palette.background.paper,
      0.9,
    )} 64%, ${alpha("#d7e7fb", 0.84)} 100%)`,
    boxShadow: `0 16px 30px ${alpha(theme.palette.primary.dark, 0.16)}`,
  } as const;

  const accentPanelSx = {
    borderRadius: "14px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(145deg, ${alpha("#ffffff", 0.86)} 0%, ${alpha("#ecf3ff", 0.92)} 100%)`,
    p: 1.5,
  } as const;

  const stepActionBarSx = {
    borderRadius: "14px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(145deg, ${alpha("#ffffff", 0.8)} 0%, ${alpha("#eaf2ff", 0.86)} 100%)`,
    px: 1.3,
    py: 1,
  } as const;

  const moveDialogStep = (delta: number) => {
    setDialogStep((prev) =>
      Math.min(dialogLastStep, Math.max(0, prev + delta)),
    );
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (widgets.length === 0) {
      setWidgetTestLinks({});
      return;
    }

    widgets.forEach((widget) => {
      const widgetId = widget.widget_id?.trim() || "";
      if (
        !widgetId ||
        widgetTestLinks[widgetId]?.attempted ||
        widgetTestLinks[widgetId]?.loading
      ) {
        return;
      }
      fetchWidgetTestLink(widgetId, { silent: true });
    });
  }, [widgets, widgetTestLinks, fetchWidgetTestLink]);

  useEffect(() => {
    if (dialogMode !== "view" || dialogStep !== 3 || !formData.widget_id) {
      return;
    }

    let active = true;

    const loadDialogTestLink = async () => {
      try {
        setDialogTestLinkLoading(true);
        const response = await fetchWidgetTestLink(formData.widget_id);
        if (!active) return;

        if (!response?.url) {
          throw new Error("Missing test link token");
        }

        setDialogTestLink(response.url);
        setDialogTestLinkExpiresAt(response.expiresAt || "");
      } catch (err: any) {
        if (!active) return;
        setDialogTestLink("");
        setDialogTestLinkExpiresAt("");
        setError(
          err?.response?.data?.detail || "Failed to generate expiring test URL",
        );
      } finally {
        if (active) {
          setDialogTestLinkLoading(false);
        }
      }
    };

    loadDialogTestLink();

    return () => {
      active = false;
    };
  }, [dialogMode, dialogStep, formData.widget_id, fetchWidgetTestLink]);


  return (
    <AdminLayout>
      <Box>
        <Stack spacing={3}>
          {/* Header */}
          <Paper
            sx={{
              p: { xs: 2, md: 2.4 },
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
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 700, color: "primary.main", mb: 1 }}
                >
                  Agent Management
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Create and manage chatbot agents for your organization
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  background:
                    "linear-gradient(135deg, #2f6bff 0%, #2d8ef0 100%)",
                  boxShadow: "0 12px 22px rgba(45,122,240,0.3)",
                }}
              >
                Create Agent
              </Button>
            </Box>
          </Paper>

          {/* Alerts */}
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

          {/* Widgets Table */}
          <Paper
            sx={{
              borderRadius: "20px",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              background: `linear-gradient(150deg, ${alpha("#ffffff", 0.88)} 0%, ${alpha("#edf4ff", 0.9)} 100%)`,
              boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
              overflow: "hidden",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                px: 2,
                py: 1.3,
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
              }}
            >
              <Chip
                size="small"
                color="primary"
                label={`Total Agents: ${linkStatusSummary.total}`}
              />
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={`Active Links: ${linkStatusSummary.active}`}
              />
              <Chip
                size="small"
                color="error"
                variant="outlined"
                label={`Expired Links: ${linkStatusSummary.expired}`}
              />
            </Stack>

            {/* Search Box */}
            <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 2, ml: 2, mb: 2 }}>
              <TextField
                size="small"
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ width: 260 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table
                size="small"
                sx={{
                  tableLayout: "fixed",
                  "& .MuiTableCell-root": {
                    borderColor: alpha(theme.palette.primary.main, 0.11),
                  },
                }}
              >
                <TableHead
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.09),
                  }}
                >
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: "22%" }}>
                      Agent Name
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: "16%" }}>
                      Lead Capture
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: "34%" }}>
                      Test Link Expiry
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: "12%" }}>
                      Created
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, textAlign: "right", width: "16%" }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {widgets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        sx={{
                          textAlign: "center",
                          py: 3,
                          color: "text.secondary",
                        }}
                      >
                        No agents created yet. Click "Create Agent" to get
                        started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    widgets.map((widget, index) => {
                      const widgetId = widget.widget_id?.trim() || "";
                      const linkMeta = widgetId
                        ? widgetTestLinks[widgetId]
                        : undefined;
                      const startTs = linkMeta?.startAt
                        ? new Date(linkMeta.startAt).getTime()
                        : 0;
                      const expiryTs = linkMeta?.expiresAt
                        ? new Date(linkMeta.expiresAt).getTime()
                        : 0;
                      const remainingMs = expiryTs ? expiryTs - nowMs : 0;
                      const isExpired = Boolean(expiryTs && remainingMs <= 0);
                      const windowMs =
                        startTs && expiryTs && expiryTs > startTs
                          ? expiryTs - startTs
                          : DAY_MS;
                      const barValue = expiryTs
                        ? Math.max(
                            0,
                            Math.min(100, (remainingMs / windowMs) * 100),
                          )
                        : 0;

                      return (
                        <TableRow
                          key={widgetId || `widget-row-${widget.id ?? index}`}
                          hover
                          sx={{
                            "&:nth-of-type(even)": {
                              backgroundColor: alpha(
                                theme.palette.common.white,
                                0.42,
                              ),
                            },
                            "&:hover": {
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.05,
                              ),
                            },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  background: `linear-gradient(135deg, ${widget.primary_color || "#2f6bff"}, ${widget.secondary_color || "#2d8ef0"})`,
                                }}
                              />
                              <Typography
                                sx={{ fontSize: "0.875rem", fontWeight: 600 }}
                              >
                                {widget.name || "Untitled Agent"}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                widget.lead_capture_enabled
                                  ? "Enabled"
                                  : "Disabled"
                              }
                              size="small"
                              color={
                                widget.lead_capture_enabled
                                  ? "success"
                                  : "default"
                              }
                              variant={
                                widget.lead_capture_enabled
                                  ? "filled"
                                  : "outlined"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {linkMeta?.loading ? (
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <CircularProgress size={14} />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Generating...
                                </Typography>
                              </Stack>
                            ) : linkMeta?.expiresAt ? (
                              <Stack spacing={0.6}>
                                <Stack
                                  direction="row"
                                  spacing={0.8}
                                  alignItems="center"
                                >
                                  <Chip
                                    label={isExpired ? "Expired" : "Active"}
                                    size="small"
                                    color={isExpired ? "error" : "success"}
                                  />
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {formatRemainingTime(remainingMs)}
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={barValue}
                                  sx={{
                                    height: 7,
                                    borderRadius: 999,
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.16,
                                    ),
                                    "& .MuiLinearProgress-bar": {
                                      borderRadius: 999,
                                      background: isExpired
                                        ? alpha(theme.palette.error.dark, 0.85)
                                        : `linear-gradient(90deg, ${alpha(theme.palette.primary.dark, 0.96)} 0%, ${theme.palette.primary.main} 100%)`,
                                    },
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Start:{" "}
                                  {linkMeta.startAt
                                    ? new Date(
                                        linkMeta.startAt,
                                      ).toLocaleString()
                                    : "-"}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  End:{" "}
                                  {new Date(
                                    linkMeta.expiresAt,
                                  ).toLocaleString()}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Not generated
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell
                            sx={{ fontSize: "12px", color: "text.secondary" }}
                          >
                            {widget.created_at
                              ? new Date(widget.created_at).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell sx={{ textAlign: "right" }}>
                            <Stack
                              direction="row"
                              spacing={0.1}
                              sx={{
                                justifyContent: "flex-end",
                                flexWrap: "nowrap",
                              }}
                            >
                              <IconButton
                                size="small"
                                title="View"
                                onClick={() => handleOpenView(widget)}
                                color="info"
                                sx={{ p: 0.45 }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Copy Test URL"
                                onClick={() => handleCopyTestUrl(widgetId)}
                                disabled={
                                  !widgetId || Boolean(linkMeta?.loading)
                                }
                                color="success"
                                sx={{ p: 0.45 }}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Increase +24h"
                                onClick={() => handleExtendTestUrl(widgetId)}
                                disabled={
                                  !widgetId || Boolean(linkMeta?.loading)
                                }
                                color="info"
                                sx={{ p: 0.45 }}
                              >
                                <AddAlarmIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Share by Email"
                                onClick={() => handleOpenEmailShare(widget)}
                                disabled={
                                  !widgetId || Boolean(linkMeta?.loading)
                                }
                                color="secondary"
                                sx={{ p: 0.45 }}
                              >
                                <EmailIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Copy Embed Code"
                                onClick={() => handleCopyEmbedCode(widgetId)}
                                disabled={!widgetId}
                                color="primary"
                                sx={{ p: 0.45 }}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Edit"
                                onClick={() => handleOpenEdit(widget)}
                                disabled={!widgetId}
                                color="warning"
                                sx={{ p: 0.45 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Delete"
                                onClick={() => setWidgetToDelete(widget)}
                                disabled={!widgetId}
                                color="error"
                                sx={{ p: 0.45 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={widgetTotal}
                page={widgetPage}
                onPageChange={(_, value) => setWidgetPage(value)}
                rowsPerPage={widgetRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setWidgetRowsPerPage(parseInt(event.target.value, 10));
                  setWidgetPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </TableContainer>
          </Paper>
        </Stack>

        {/* Step-by-step Agent Journey Dialog (View/Edit) */}
        <Dialog
          open={dialogMode === "view"}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              ...dialogPanelSx,
              borderRadius: "20px",
              overflow: "hidden",
            },
          }}
        >
          <DialogTitle sx={{ pb: 1.1 }}>
            <Stack spacing={1.2}>
              <Box>
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: "0.08em", color: "text.secondary" }}
                >
                  Agent Wizard
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Agent Journey
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Step {dialogStep + 1} of {managementSteps.length}:{" "}
                  {managementSteps[dialogStep]}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={dialogProgress}
                sx={{
                  height: 9,
                  borderRadius: 999,
                  backgroundColor: alpha(theme.palette.primary.main, 0.14),
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                  },
                }}
              />
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ pt: 1.2 }}>
            <Stack spacing={2}>
              <Paper sx={{ ...dialogPanelSx, p: 1.3 }}>
                <Stack spacing={1.2}>
                  <Typography variant="body2" color="text.secondary">
                    {dialogStepDescriptions[dialogStep]}
                  </Typography>
                  <Stepper
                    activeStep={dialogStep}
                    alternativeLabel
                    sx={{
                      "& .MuiStepLabel-label": { fontWeight: 600 },
                      "& .MuiStepIcon-root": {
                        color: alpha(theme.palette.primary.main, 0.24),
                      },
                      "& .MuiStepIcon-root.Mui-active": {
                        color: theme.palette.primary.main,
                      },
                      "& .MuiStepIcon-root.Mui-completed": {
                        color: theme.palette.success.main,
                      },
                    }}
                  >
                    {managementSteps.map((stepLabel) => (
                      <Step key={stepLabel}>
                        <StepLabel>{stepLabel}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Stack>
              </Paper>

              {dialogStep === 0 && (
                <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                  <Stack spacing={1.8}>
                    <Box sx={accentPanelSx}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 0.4 }}
                      >
                        Agent Profile
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Update identity, welcome tone, colors, and routing
                        preferences.
                      </Typography>
                    </Box>

                    <Stack spacing={1.3}>
                      <Box sx={accentPanelSx}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          Agent ID
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            wordBreak: "break-all",
                          }}
                        >
                          {formData.widget_id}
                        </Typography>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          Name
                        </Typography>
                        <Typography>{formData.name}</Typography>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          Welcome Message
                        </Typography>
                        <Typography>
                          {formData.welcome_message || "-"}
                        </Typography>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          System Prompt
                        </Typography>
                        <Typography sx={{ whiteSpace: "pre-wrap" }}>
                          {formData.system_prompt || "-"}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                          gap: 1.2,
                        }}
                      >
                        <Box sx={accentPanelSx}>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Primary Color
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mt: 0.5 }}
                          >
                            <Box
                              sx={{
                                width: 18,
                                height: 18,
                                borderRadius: "4px",
                                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                bgcolor: formData.primary_color || "#2f6bff",
                              }}
                            />
                            <Typography>
                              {formData.primary_color || "-"}
                            </Typography>
                          </Stack>
                        </Box>
                        <Box sx={accentPanelSx}>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Secondary Color
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mt: 0.5 }}
                          >
                            <Box
                              sx={{
                                width: 18,
                                height: 18,
                                borderRadius: "4px",
                                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                bgcolor: formData.secondary_color || "#36c4ff",
                              }}
                            />
                            <Typography>
                              {formData.secondary_color || "-"}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Position:
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={formData.position || "bottom-right"}
                          />
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mt: 1 }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Lead Capture:
                          </Typography>
                          <Chip
                            size="small"
                            color={
                              formData.lead_capture_enabled
                                ? "success"
                                : "default"
                            }
                            variant={
                              formData.lead_capture_enabled
                                ? "filled"
                                : "outlined"
                            }
                            label={
                              formData.lead_capture_enabled
                                ? "Enabled"
                                : "Disabled"
                            }
                          />
                        </Stack>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          Escalation Contact - Level 1
                        </Typography>
                        <Typography>
                          {formData.escalation_contact_level_1 || "-"}
                        </Typography>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          Escalation Contact - Level 2
                        </Typography>
                        <Typography>
                          {formData.escalation_contact_level_2 || "-"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {dialogStep === 1 && (
                <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                  <Stack spacing={1.6}>
                    <Box sx={accentPanelSx}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Knowledge Base Setup
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.6 }}
                      >
                        Manage website crawl, document upload, and text
                        knowledge from the dedicated module.
                      </Typography>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Typography variant="body2" color="text.secondary">
                        Agent:{" "}
                        <strong>{formData.name || "Unnamed Agent"}</strong> (
                        {formData.widget_id || "No ID"})
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={() => navigate("/knowledge")}
                      >
                        Open Knowledge Base
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => navigate("/create-chat-agent")}
                      >
                        Open Full Creation Wizard
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {dialogStep === 2 && (
                <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                  <Stack spacing={1.6}>
                    <Box sx={accentPanelSx}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Integration Setup
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mt: 0.8 }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          WhatsApp (Meta):
                        </Typography>
                        <Chip
                          size="small"
                          color={
                            whatsappConnectedForAgent ? "success" : "default"
                          }
                          label={
                            whatsappConnectedForAgent
                              ? "Connected for this Agent"
                              : "Not Connected for this Agent"
                          }
                        />
                      </Stack>
                      {whatsappConnectedForAgent && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.8 }}
                        >
                          WABA: {whatsappConfig.waba_id || "-"} | Phone Number
                          ID: {whatsappConfig.phone_number_id || "-"}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={() => navigate("/integrations/whatsapp")}
                      >
                        Manage WhatsApp Integration
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => navigate("/create-chat-agent")}
                      >
                        Open Creation Wizard
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {dialogStep === 3 && (
                <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                  <Stack spacing={1.8}>
                    <Box sx={accentPanelSx}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 0.8 }}
                      >
                        Agent Test URL
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={
                          dialogTestLinkLoading
                            ? "Generating expiring test URL..."
                            : dialogTestLink
                        }
                        InputProps={{ readOnly: true }}
                        sx={fieldSx}
                      />
                      {dialogTestLinkExpiresAt && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.8, display: "block" }}
                        >
                          This test link expires on{" "}
                          {new Date(dialogTestLinkExpiresAt).toLocaleString()}.
                        </Typography>
                      )}
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => handleCopyTestUrl(formData.widget_id)}
                        disabled={!formData.widget_id || dialogTestLinkLoading}
                        sx={{ mt: 1 }}
                      >
                        Copy Test URL
                      </Button>
                    </Box>

                    <Box sx={accentPanelSx}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 0.8 }}
                      >
                        Embed Code
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={6}
                        value={`<!-- AI Chatbot Widget -->
<link rel="stylesheet" href="https://your-domain.com/widget/dist/chatbot-widget.css" />
<script>
  window.AIChatbot = {
    widgetId: '${formData.widget_id}',
    apiUrl: 'https://your-api-domain.com',
    name: 'AI Assistant',
    welcomeMessage: 'Hi! How can I help you today?',
    primaryColor: '${formData.primary_color || "#2f6bff"}',
    position: '${formData.position || "bottom-right"}'
  };
</script>
<script src="https://your-domain.com/widget/dist/chatbot-widget.iife.js"><\/script>`}
                        InputProps={{ readOnly: true }}
                        sx={fieldSx}
                      />
                      <Button
                        size="small"
                        startIcon={<CopyIcon />}
                        onClick={() => handleCopyEmbedCode(formData.widget_id)}
                        disabled={!formData.widget_id}
                        sx={{ mt: 1 }}
                      >
                        Copy Embed Code
                      </Button>
                    </Box>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 1.2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              sx={{ ...stepActionBarSx, width: "100%" }}
            >
              <Button onClick={handleCloseDialog}>Close</Button>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={() => moveDialogStep(-1)}
                  disabled={dialogStep === 0}
                >
                  Back
                </Button>
                {dialogStep < dialogLastStep ? (
                  <Button
                    variant="contained"
                    onClick={() => moveDialogStep(1)}
                    sx={{
                      background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleOpenEdit(formData as WidgetConfig)}
                    variant="contained"
                    disabled={!formData.widget_id}
                    sx={{
                      background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                    }}
                  >
                    Edit Agent
                  </Button>
                )}
              </Stack>
            </Stack>
          </DialogActions>
        </Dialog>

        <Dialog
          open={emailShareOpen}
          onClose={handleCloseEmailDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: "18px",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              background: `linear-gradient(150deg, ${alpha("#ffffff", 0.92)} 0%, ${alpha("#eef4ff", 0.88)} 100%)`,
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>
            Share Test Link by Email
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.3} sx={{ mt: 0.8 }}>
              <Typography variant="body2" color="text.secondary">
                Send a simple welcome email with secure test URL for{" "}
                {emailShareWidgetName || "this agent"}.
              </Typography>
              <TextField
                label="Recipient Email"
                type="email"
                value={emailShareTo}
                onChange={(e) => setEmailShareTo(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Subject"
                value={emailShareSubject}
                onChange={(e) => setEmailShareSubject(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Message"
                value={emailShareBody}
                onChange={(e) => setEmailShareBody(e.target.value)}
                fullWidth
                multiline
                minRows={7}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleCloseEmailDialog}
              disabled={emailShareSending}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSendEmailShare}
              disabled={emailShareSending}
            >
              {emailShareSending ? "Sending..." : "Send Email"}
            </Button>
          </DialogActions>
        </Dialog>
  
      <ConfirmDialog
        open={Boolean(widgetToDelete)}
        title="Delete agent?"
        description={
          widgetToDelete
            ? `This will permanently remove "${widgetToDelete.name}" and its configuration. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setWidgetToDelete(null)}
        onConfirm={handleConfirmDeleteWidget}
      />
    </Box>
    </AdminLayout>
  );
};

export default WidgetManagementPage;
