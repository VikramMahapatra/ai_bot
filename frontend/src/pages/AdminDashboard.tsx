import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AdminLayout from "../components/Layout/AdminLayout";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import WidgetsIcon from "@mui/icons-material/Widgets";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CallIcon from "@mui/icons-material/Call";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import CampaignIcon from "@mui/icons-material/Campaign";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { dashboardService } from "../services/dashboardService";
import {
  FUNNEL_ALL_CHIP_TINT,
  FUNNEL_STAGE_BAR_BLUES,
  LEAD_SOURCE_FILTER_TINTS,
  leadSourceChartFill,
  TREND_CONVERSATIONS_BAR,
  TREND_LEADS_BAR,
} from "../constants/leadFilterChartColors";
import type { AnalyticsSummary } from "../services/callService";
import { callService } from "../services/callService";
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

interface PlanUsage {
  used: {
    messages_used: number;
    tokens_used: number;
    crawl_pages_used: number;
    documents_used: number;
  };
}

interface DashboardStats {
  total_conversations: number;
  total_leads: number;
  conversion_rate: number;
  total_widgets: number;
  total_knowledge_sources: number;
  conversations_7d: number;
  leads_7d: number;
  plan_usage: PlanUsage | null;
  total_agents: number;
  pipeline_leads: number;
  pipeline_leads_7d: number;
}

interface DailyConversationPoint {
  date: string;
  count: number;
}

interface TrendPoint {
  date: string;
  conversations: number;
  leads: number;
}

interface LeadSourcePoint {
  source: string;
  count: number;
}

interface FunnelStagePoint {
  stage_key: string;
  stage_name: string;
  color: string;
  position: number;
  count: number;
  conversion_rate: number;
}

interface LeadItem {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  created_at?: string;
}

interface SessionItem {
  session_id: string;
  message_count: number;
  has_lead: boolean;
  lead_name?: string;
  last_message_at?: string;
}

interface WidgetItem {
  id: number;
  name: string;
  widget_id: string;
  conversations_count: number;
  leads_count: number;
  position?: string;
  lead_capture_enabled?: boolean;
}

interface KnowledgeSourceItem {
  id: number;
  name: string;
  source_type: string;
  status: string;
  created_at?: string;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  if (value !== index) return null;
  return <Box sx={{ pt: 2.5 }}>{children}</Box>;
};

const numberOrZero = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const textOrDash = (value?: string | null): string => {
  return value && value.trim() ? value : "-";
};

const shortText = (value: string, length: number): string => {
  if (!value) return "-";
  return value.length > length ? `${value.slice(0, length)}...` : value;
};

const formatDate = (value?: string): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const formatDateTime = (value?: string): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatLimitValue = (value: number | null): string => {
  if (value === null || typeof value === "undefined") return "∞";
  return value.toLocaleString();
};

const AdminDashboard: React.FC = () => {
  const theme = useTheme();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyConversations, setDailyConversations] = useState<
    DailyConversationPoint[]
  >([]);
  const [conversationTrend, setConversationTrend] = useState<TrendPoint[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<LeadSourcePoint[]>([]);
  const [leadsFunnel, setLeadsFunnel] = useState<FunnelStagePoint[]>([]);
  const [recentLeads, setRecentLeads] = useState<LeadItem[]>([]);
  const [topSessions, setTopSessions] = useState<SessionItem[]>([]);
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<
    KnowledgeSourceItem[]
  >([]);
  const [callSummary, setCallSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const today = new Date();
      const callEnd = today.toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const callStart = thirtyDaysAgo.toISOString().split("T")[0];

      const [
        statsRes,
        dailyRes,
        leadsRes,
        widgetsRes,
        sourcesRes,
        bySourceRes,
        funnelRes,
        topSessionsRes,
        trendRes,
        callAnalyticsRes,
      ] = await Promise.allSettled([
        dashboardService.getStats(),
        dashboardService.getDailyConversations(7),
        dashboardService.getRecentLeads(10),
        dashboardService.getWidgets(),
        dashboardService.getKnowledgeSources(),
        dashboardService.getLeadsBySource(),
        dashboardService.getLeadsFunnel(),
        dashboardService.getTopSessions(10),
        dashboardService.getConversationTrend(30),
        callService.callAnalytics({
          start_date: callStart,
          end_date: callEnd,
        }),
      ]);

      if (statsRes.status === "fulfilled") {
        const raw = (statsRes.value || {}) as Partial<DashboardStats>;
        setStats({
          total_conversations: numberOrZero(raw.total_conversations),
          total_leads: numberOrZero(raw.total_leads),
          conversion_rate: numberOrZero(raw.conversion_rate),
          total_widgets: numberOrZero(raw.total_widgets),
          total_knowledge_sources: numberOrZero(raw.total_knowledge_sources),
          conversations_7d: numberOrZero(raw.conversations_7d),
          leads_7d: numberOrZero(raw.leads_7d),
          plan_usage: raw.plan_usage || null,
          total_agents: numberOrZero(raw.total_agents),
          pipeline_leads: numberOrZero(raw.pipeline_leads),
          pipeline_leads_7d: numberOrZero(raw.pipeline_leads_7d),
        });
      }

      if (dailyRes.status === "fulfilled") {
        const data = Array.isArray((dailyRes.value as any)?.data)
          ? (dailyRes.value as any).data
          : [];
        setDailyConversations(
          data.map((row: any) => ({
            date: String(row?.date || ""),
            count: numberOrZero(row?.count),
          })),
        );
      }

      if (leadsRes.status === "fulfilled") {
        const data = Array.isArray((leadsRes.value as any)?.leads)
          ? (leadsRes.value as any).leads
          : [];
        setRecentLeads(data as LeadItem[]);
      }

      if (widgetsRes.status === "fulfilled") {
        const data = Array.isArray((widgetsRes.value as any)?.widgets)
          ? (widgetsRes.value as any).widgets
          : [];
        setWidgets(data as WidgetItem[]);
      }

      if (sourcesRes.status === "fulfilled") {
        const data = Array.isArray((sourcesRes.value as any)?.sources)
          ? (sourcesRes.value as any).sources
          : [];
        setKnowledgeSources(data as KnowledgeSourceItem[]);
      }

      if (bySourceRes.status === "fulfilled") {
        const data = Array.isArray((bySourceRes.value as any)?.data)
          ? (bySourceRes.value as any).data
          : [];
        setLeadsBySource(
          data.map((row: any) => ({
            source: String(row?.source || "Unknown"),
            count: numberOrZero(row?.count),
          })),
        );
      }

      if (funnelRes.status === "fulfilled") {
        const data = Array.isArray((funnelRes.value as any)?.data)
          ? (funnelRes.value as any).data
          : [];
        setLeadsFunnel(
          data.map((row: any) => ({
            stage_key: String(row?.stage_key || "unassigned"),
            stage_name: String(row?.stage_name || "Unassigned"),
            color: String(row?.color || "#9aa8bb"),
            position: numberOrZero(row?.position),
            count: numberOrZero(row?.count),
            conversion_rate: numberOrZero(row?.conversion_rate),
          })),
        );
      }

      if (topSessionsRes.status === "fulfilled") {
        const data = Array.isArray((topSessionsRes.value as any)?.sessions)
          ? (topSessionsRes.value as any).sessions
          : [];
        setTopSessions(data as SessionItem[]);
      }

      if (trendRes.status === "fulfilled") {
        const data = Array.isArray((trendRes.value as any)?.data)
          ? (trendRes.value as any).data
          : [];
        setConversationTrend(
          data.map((row: any) => ({
            date: String(row?.date || ""),
            conversations: numberOrZero(row?.conversations),
            leads: numberOrZero(row?.leads),
          })),
        );
      } else {
        setError("Some chart sections could not be loaded right now.");
      }

      if (callAnalyticsRes.status === "fulfilled") {
        const s = (callAnalyticsRes.value as { summary?: AnalyticsSummary })
          ?.summary;
        if (s) {
          setCallSummary({
            total_calls: numberOrZero(s.total_calls),
            successful_calls: numberOrZero(s.successful_calls),
            pickup_rate: numberOrZero(s.pickup_rate),
            conversion_rate: numberOrZero(s.conversion_rate),
            total_duration: numberOrZero(s.total_duration),
            active_campaigns: numberOrZero(s.active_campaigns),
            recent_calls: Array.isArray(s.recent_calls) ? s.recent_calls : [],
          });
        }
      }

      setLoading(false);
    };

    load().catch(() => {
      setLoading(false);
      setError("Failed to load dashboard. Please refresh.");
    });
  }, []);

  const glassPanelSx = {
    borderRadius: "18px",
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.66)} 0%, ${alpha(
      theme.palette.background.paper,
      0.76,
    )} 66%, ${alpha("#dbe9fa", 0.72)} 100%)`,
    boxShadow: `0 16px 32px ${alpha(theme.palette.primary.dark, 0.13)}`,
    backdropFilter: "blur(12px)",
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "linear-gradient(138deg, rgba(255,255,255,0.22) 10%, transparent 28%), linear-gradient(28deg, transparent 52%, rgba(120,168,223,0.14) 53%, transparent 76%)",
    },
  } as const;

  const kpis = [
    {
      label: "Total Conversations",
      value: numberOrZero(stats?.total_conversations),
      hint: `${numberOrZero(stats?.conversations_7d)} in last 7 days`,
      icon: (
        <ChatBubbleOutlineIcon sx={{ color: theme.palette.primary.dark }} />
      ),
      gradient: `linear-gradient(130deg, ${alpha("#9cc3f3", 0.64)} 0%, ${alpha("#dce9ff", 0.76)} 100%)`,
      wave: theme.palette.primary.main,
    },
    {
      label: "Total Leads",
      value: numberOrZero(stats?.total_leads),
      hint: `${numberOrZero(stats?.leads_7d)} in last 7 days`,
      icon: <PersonAddAlt1Icon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha("#9fcbf6", 0.64)} 0%, ${alpha("#deedff", 0.76)} 100%)`,
      wave: theme.palette.secondary.main,
    },
    {
      label: "Pipeline Leads",
      value: numberOrZero(stats?.pipeline_leads),
      hint: `${numberOrZero(stats?.pipeline_leads_7d)} in last 7 days`,
      icon: <FilterAltIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha("#a9d2fb", 0.64)} 0%, ${alpha("#e3f0ff", 0.78)} 100%)`,
      wave: "#468ed4",
    },
    {
      label: "Total Agents",
      value: numberOrZero(stats?.total_widgets) + numberOrZero(stats?.total_agents),
      hint: `Chats is ${numberOrZero(stats?.total_widgets)} and Calls is ${numberOrZero(stats?.total_agents)}`,
      icon: <SupportAgentIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha("#a1c8f4", 0.64)} 0%, ${alpha("#dceaff", 0.76)} 100%)`,
      wave: "#4b84ce",
    },
  ];

  const callingKpis = useMemo(
    () => [
      {
        label: "Total Calls",
        value: numberOrZero(callSummary?.total_calls),
        hint: "Last 30 days",
        icon: <CallIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#9cc3f3", 0.64)} 0%, ${alpha("#dce9ff", 0.76)} 100%)`,
        wave: theme.palette.primary.main,
      },
      {
        label: "Successful Calls",
        value: numberOrZero(callSummary?.successful_calls),
        hint: "Last 30 days",
        icon: <CheckCircleIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#9fcbf6", 0.64)} 0%, ${alpha("#deedff", 0.76)} 100%)`,
        wave: theme.palette.secondary.main,
      },
      {
        label: "Pickup Rate",
        value: `${numberOrZero(callSummary?.pickup_rate)}%`,
        hint: "Last 30 days",
        icon: <PhoneInTalkIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#a9d2fb", 0.64)} 0%, ${alpha("#e3f0ff", 0.78)} 100%)`,
        wave: "#468ed4",
      },
      {
        label: "Active Call Campaigns",
        value: numberOrZero(callSummary?.active_campaigns),
        hint: "Last 30 days",
        icon: <CampaignIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha("#a1c8f4", 0.64)} 0%, ${alpha("#dceaff", 0.76)} 100%)`,
        wave: "#4b84ce",
      },
    ],
    [callSummary, theme],
  );

  const funnelData = useMemo(() => {
    const sorted = [...leadsFunnel].sort(
      (a, b) => a.position - b.position,
    );
    let blueIdx = 0;

    return sorted.map((item) => {
      const key = String(item.stage_key || "").toLowerCase();
      const name = String(item.stage_name || "").toLowerCase();

      if (
        key === "unassigned" ||
        key.includes("unassign") ||
        name.includes("unassigned")
      ) {
        return { ...item, fill: alpha(FUNNEL_ALL_CHIP_TINT, 0.72) };
      }
      if (
        (key.includes("won") && !key.includes("lost")) ||
        name.includes("closed won")
      ) {
        return { ...item, fill: LEAD_SOURCE_FILTER_TINTS.whatsapp };
      }
      if (key.includes("lost") || name.includes("closed lost")) {
        return { ...item, fill: "#ef4444" };
      }

      const fill =
        FUNNEL_STAGE_BAR_BLUES[blueIdx % FUNNEL_STAGE_BAR_BLUES.length];
      blueIdx += 1;
      return { ...item, fill };
    });
  }, [leadsFunnel]);

  return (
    <AdminLayout>
      <Box
        sx={{
          maxWidth: 1380,
          mx: "auto",
          px: { xs: 0, md: 0.5 },
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            background:
              "linear-gradient(130deg, transparent 18%, rgba(132,172,228,0.18) 19%, transparent 38%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.14) 53%, transparent 74%)",
          }}
        />
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            zIndex: 1,
            p: { xs: 2, md: 2.8 },
            mb: 3,
            borderRadius: "24px",
            border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
            background: `linear-gradient(125deg, ${alpha("#deebfb", 0.9)} 0%, ${alpha(
              theme.palette.background.paper,
              0.82,
            )} 74%, ${alpha("#a9bfdc", 0.96)} 100%)`,
            color: "text.primary",
            boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              mb: 0.4,
              color: "text.primary",
            }}
          >
            Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Real-time view of conversations, leads, agent performance, and
            knowledge growth.
          </Typography>
        </Paper>

        {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {kpis.map((kpi) => (
            <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
              <Paper
                elevation={0}
                sx={{
                  zIndex: 1,
                  p: 2,
                  borderRadius: "18px",
                  background: kpi.gradient,
                  color: "text.primary",
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
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {callingKpis.map((kpi) => (
            <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
              <Paper
                elevation={0}
                sx={{
                  zIndex: 1,
                  p: 2,
                  borderRadius: "18px",
                  background: kpi.gradient,
                  color: "text.primary",
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
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} lg={8}>
            <Paper sx={{ ...glassPanelSx, p: 2.5, mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Daily Conversations (7 days)
              </Typography>
              <ResponsiveContainer width="100%" height={290}>
                <LineChart data={dailyConversations}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={alpha(theme.palette.text.secondary, 0.2)}
                  />
                  <XAxis
                    dataKey="date"
                    stroke={theme.palette.text.secondary}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke={theme.palette.text.secondary}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.55)}`,
                      background: alpha(theme.palette.background.paper, 0.92),
                      boxShadow: `0 10px 24px ${alpha(theme.palette.primary.dark, 0.16)}`,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#4e89d5"
                    strokeWidth={3.4}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ ...glassPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Conversations vs Leads Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={conversationTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={alpha(theme.palette.text.secondary, 0.2)}
                  />
                  <XAxis
                    dataKey="date"
                    stroke={theme.palette.text.secondary}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke={theme.palette.text.secondary}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.55)}`,
                      background: alpha(theme.palette.background.paper, 0.92),
                      boxShadow: `0 10px 24px ${alpha(theme.palette.primary.dark, 0.16)}`,
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="conversations"
                    fill={TREND_CONVERSATIONS_BAR}
                    radius={[7, 7, 0, 0]}
                  />
                  <Bar
                    dataKey="leads"
                    fill={TREND_LEADS_BAR}
                    radius={[7, 7, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper sx={{ ...glassPanelSx, p: 2.5, mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                Leads by Source
              </Typography>
              {leadsBySource.length > 0 ? (
                <ResponsiveContainer width="100%" height={290}>
                  <PieChart>
                    <Pie
                      data={leadsBySource}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="45%"
                      outerRadius={88}
                      innerRadius={46}
                    >
                      {leadsBySource.map((row, idx) => (
                        <Cell
                          key={`lead-source-${row.source}-${idx}`}
                          fill={leadSourceChartFill(row.source, idx)}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(
                        value: number | string | undefined,
                        _name,
                        item,
                      ) => {
                        const sourceName =
                          (item?.payload as LeadSourcePoint)?.source ||
                          "Source";
                        return [`${numberOrZero(value)} leads`, sourceName];
                      }}
                    />
                    <Legend verticalAlign="bottom" height={32} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No lead source data available.
                </Typography>
              )}
            </Paper>

            <Paper sx={{ ...glassPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                Funnel Dashboard
              </Typography>
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart
                    data={funnelData}
                    layout="vertical"
                    margin={{ top: 6, right: 18, left: 8, bottom: 6 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={alpha(theme.palette.text.secondary, 0.2)}
                    />
                    <XAxis
                      type="number"
                      stroke={theme.palette.text.secondary}
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="stage_name"
                      stroke={theme.palette.text.secondary}
                      width={128}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      formatter={(
                        value: number | string | undefined,
                        _name,
                        item,
                      ) => [
                        `${numberOrZero(value)} leads`,
                        String((item?.payload as any)?.stage_name || "Stage"),
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {funnelData.map((entry, idx) => (
                        <Cell
                          key={`funnel-stage-bar-${entry.stage_key}-${idx}`}
                          fill={entry.fill}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No funnel data available.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Paper sx={{ ...glassPanelSx, p: 2.2 }}>
          <Tabs
            value={tab}
            onChange={(_, value: number) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
              mb: 0.5,
            }}
          >
            <Tab label="Top Conversations" />
            <Tab label="Recent Leads" />
            {/* <Tab label="Agents" />
            <Tab label="Knowledge Sources" /> */}
          </Tabs>

          <TabPanel value={tab} index={0}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Session ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">
                      Messages
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Lead</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Last Activity
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topSessions.length ? (
                    topSessions.map((session) => (
                      <TableRow key={session.session_id} hover>
                        <TableCell sx={{ fontFamily: "monospace" }}>
                          {shortText(session.session_id, 28)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={session.message_count}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {session.has_lead ? (
                            <Chip
                              label={textOrDash(session.lead_name)}
                              size="small"
                              color="success"
                            />
                          ) : (
                            <Chip label="No" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(session.last_message_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No conversation sessions yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentLeads.length ? (
                    recentLeads.map((lead) => (
                      <TableRow key={lead.id} hover>
                        <TableCell>{textOrDash(lead.name)}</TableCell>
                        <TableCell>{textOrDash(lead.email)}</TableCell>
                        <TableCell>{textOrDash(lead.phone)}</TableCell>
                        <TableCell>{textOrDash(lead.company)}</TableCell>
                        <TableCell>{formatDate(lead.created_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No recent leads.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Grid container spacing={2}>
              {widgets.length ? (
                widgets.map((widget, idx) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={4}
                    key={widget.widget_id || String(widget.id || idx)}
                  >
                    <Card
                      sx={{
                        borderRadius: 2.5,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                      }}
                    >
                      <CardContent>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700, mb: 1 }}
                        >
                          {widget.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 1.5 }}
                        >
                          {widget.widget_id}
                        </Typography>

                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Conversations:{" "}
                            {numberOrZero(widget.conversations_count)}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(
                              numberOrZero(widget.conversations_count) * 10,
                              100,
                            )}
                            sx={{ mt: 0.4, borderRadius: 1 }}
                          />
                        </Box>

                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Leads: {numberOrZero(widget.leads_count)}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(
                              numberOrZero(widget.leads_count) * 10,
                              100,
                            )}
                            sx={{ mt: 0.4, borderRadius: 1 }}
                          />
                        </Box>

                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          <Chip
                            size="small"
                            label={textOrDash(widget.position)}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={
                              widget.lead_capture_enabled
                                ? "Lead Capture On"
                                : "Lead Capture Off"
                            }
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
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center">
                    No agents found.
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {knowledgeSources.length ? (
                    knowledgeSources.map((source) => (
                      <TableRow key={source.id} hover>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <MenuBookIcon fontSize="small" color="primary" />
                            {source.name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={source.source_type}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={source.status}
                            size="small"
                            color={
                              source.status === "active" ? "success" : "default"
                            }
                            variant={
                              source.status === "active" ? "filled" : "outlined"
                            }
                          />
                        </TableCell>
                        <TableCell>{formatDate(source.created_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No knowledge sources yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Paper>

        {loading && !stats && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </AdminLayout>
  );
};

export default AdminDashboard;
