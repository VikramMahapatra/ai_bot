import React, { useEffect, useMemo, useState } from 'react';
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AdminLayout from '../components/Layout/AdminLayout';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import WidgetsIcon from '@mui/icons-material/Widgets';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
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
} from 'recharts';
import { dashboardService } from '../services/dashboardService';

interface PlanUsage {
  limits: {
    monthly_message_limit: number | null;
    monthly_token_limit: number | null;
    monthly_crawl_pages_limit: number | null;
    monthly_document_limit: number | null;
  };
  used: {
    messages_used: number;
    tokens_used: number;
    crawl_pages_used: number;
    documents_used: number;
  };
  remaining: {
    messages_remaining: number | null;
    tokens_remaining: number | null;
    crawl_pages_remaining: number | null;
    documents_remaining: number | null;
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
  return value && value.trim() ? value : '-';
};

const shortText = (value: string, length: number): string => {
  if (!value) return '-';
  return value.length > length ? `${value.slice(0, length)}...` : value;
};

const formatDate = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const percent = (used: number, limit: number | null): number => {
  if (!limit || limit <= 0) return 0;
  return Math.min((used / limit) * 100, 100);
};

const formatLimitValue = (value: number | null): string => {
  if (value === null || typeof value === 'undefined') return '∞';
  return value.toLocaleString();
};

const AdminDashboard: React.FC = () => {
  const theme = useTheme();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyConversations, setDailyConversations] = useState<DailyConversationPoint[]>([]);
  const [conversationTrend, setConversationTrend] = useState<TrendPoint[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<LeadSourcePoint[]>([]);
  const [recentLeads, setRecentLeads] = useState<LeadItem[]>([]);
  const [topSessions, setTopSessions] = useState<SessionItem[]>([]);
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceItem[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      const [
        statsRes,
        dailyRes,
        leadsRes,
        widgetsRes,
        sourcesRes,
        bySourceRes,
        topSessionsRes,
        trendRes,
      ] = await Promise.allSettled([
        dashboardService.getStats(),
        dashboardService.getDailyConversations(7),
        dashboardService.getRecentLeads(10),
        dashboardService.getWidgets(),
        dashboardService.getKnowledgeSources(),
        dashboardService.getLeadsBySource(),
        dashboardService.getTopSessions(10),
        dashboardService.getConversationTrend(30),
      ]);

      if (statsRes.status === 'fulfilled') {
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
        });
      }

      if (dailyRes.status === 'fulfilled') {
        const data = Array.isArray((dailyRes.value as any)?.data) ? (dailyRes.value as any).data : [];
        setDailyConversations(
          data.map((row: any) => ({
            date: String(row?.date || ''),
            count: numberOrZero(row?.count),
          }))
        );
      }

      if (leadsRes.status === 'fulfilled') {
        const data = Array.isArray((leadsRes.value as any)?.leads) ? (leadsRes.value as any).leads : [];
        setRecentLeads(data as LeadItem[]);
      }

      if (widgetsRes.status === 'fulfilled') {
        const data = Array.isArray((widgetsRes.value as any)?.widgets) ? (widgetsRes.value as any).widgets : [];
        setWidgets(data as WidgetItem[]);
      }

      if (sourcesRes.status === 'fulfilled') {
        const data = Array.isArray((sourcesRes.value as any)?.sources) ? (sourcesRes.value as any).sources : [];
        setKnowledgeSources(data as KnowledgeSourceItem[]);
      }

      if (bySourceRes.status === 'fulfilled') {
        const data = Array.isArray((bySourceRes.value as any)?.data) ? (bySourceRes.value as any).data : [];
        setLeadsBySource(
          data.map((row: any) => ({
            source: String(row?.source || 'Unknown'),
            count: numberOrZero(row?.count),
          }))
        );
      }

      if (topSessionsRes.status === 'fulfilled') {
        const data = Array.isArray((topSessionsRes.value as any)?.sessions) ? (topSessionsRes.value as any).sessions : [];
        setTopSessions(data as SessionItem[]);
      }

      if (trendRes.status === 'fulfilled') {
        const data = Array.isArray((trendRes.value as any)?.data) ? (trendRes.value as any).data : [];
        setConversationTrend(
          data.map((row: any) => ({
            date: String(row?.date || ''),
            conversations: numberOrZero(row?.conversations),
            leads: numberOrZero(row?.leads),
          }))
        );
      } else {
        setError('Some chart sections could not be loaded right now.');
      }

      setLoading(false);
    };

    load().catch(() => {
      setLoading(false);
      setError('Failed to load dashboard. Please refresh.');
    });
  }, []);

  const pieColors = useMemo(
    () => [
      '#4e89d5',
      '#67a4e8',
      '#3d75d9',
      '#79b4f1',
      '#5f99dd',
      '#7f93b8',
    ],
    []
  );

  const glassPanelSx = {
    borderRadius: '18px',
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.66)} 0%, ${alpha(
      theme.palette.background.paper,
      0.76
    )} 66%, ${alpha('#dbe9fa', 0.72)} 100%)`,
    boxShadow: `0 16px 32px ${alpha(theme.palette.primary.dark, 0.13)}`,
    backdropFilter: 'blur(12px)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background:
        'linear-gradient(138deg, rgba(255,255,255,0.22) 10%, transparent 28%), linear-gradient(28deg, transparent 52%, rgba(120,168,223,0.14) 53%, transparent 76%)',
    },
  } as const;

  const kpis = [
    {
      label: 'Total Conversations',
      value: numberOrZero(stats?.total_conversations),
      hint: `${numberOrZero(stats?.conversations_7d)} in last 7 days`,
      icon: <ChatBubbleOutlineIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#9cc3f3', 0.64)} 0%, ${alpha('#dce9ff', 0.76)} 100%)`,
      wave: theme.palette.primary.main,
    },
    {
      label: 'Total Leads',
      value: numberOrZero(stats?.total_leads),
      hint: `${numberOrZero(stats?.leads_7d)} in last 7 days`,
      icon: <PersonAddAlt1Icon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#9fcbf6', 0.64)} 0%, ${alpha('#deedff', 0.76)} 100%)`,
      wave: theme.palette.secondary.main,
    },
    {
      label: 'Conversion Rate',
      value: `${numberOrZero(stats?.conversion_rate)}%`,
      hint: 'Leads from conversations',
      icon: <TrendingUpIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#a9d2fb', 0.64)} 0%, ${alpha('#e3f0ff', 0.78)} 100%)`,
      wave: '#468ed4',
    },
    {
      label: 'Active Agents',
      value: numberOrZero(stats?.total_widgets),
      hint: `${numberOrZero(stats?.total_knowledge_sources)} sources connected`,
      icon: <WidgetsIcon sx={{ color: theme.palette.primary.dark }} />,
      gradient: `linear-gradient(130deg, ${alpha('#a1c8f4', 0.64)} 0%, ${alpha('#dceaff', 0.76)} 100%)`,
      wave: '#4b84ce',
    },
  ];

  const planUsageItems = stats?.plan_usage
    ? [
        {
          label: 'Messages',
          used: numberOrZero(stats.plan_usage.used.messages_used),
          limit: stats.plan_usage.limits.monthly_message_limit,
          remaining: stats.plan_usage.remaining.messages_remaining,
          color: '#4e89d5',
        },
        {
          label: 'Tokens',
          used: numberOrZero(stats.plan_usage.used.tokens_used),
          limit: stats.plan_usage.limits.monthly_token_limit,
          remaining: stats.plan_usage.remaining.tokens_remaining,
          color: '#56a8d6',
        },
        {
          label: 'Crawl Pages',
          used: numberOrZero(stats.plan_usage.used.crawl_pages_used),
          limit: stats.plan_usage.limits.monthly_crawl_pages_limit,
          remaining: stats.plan_usage.remaining.crawl_pages_remaining,
          color: '#4f83cf',
        },
        {
          label: 'Documents',
          used: numberOrZero(stats.plan_usage.used.documents_used),
          limit: stats.plan_usage.limits.monthly_document_limit,
          remaining: stats.plan_usage.remaining.documents_remaining,
          color: '#5e9bd9',
        },
      ]
    : [];

  return (
    <AdminLayout>
      <Box sx={{ maxWidth: 1380, mx: 'auto', px: { xs: 0, md: 0.5 }, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background:
              'linear-gradient(130deg, transparent 18%, rgba(132,172,228,0.18) 19%, transparent 38%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.14) 53%, transparent 74%)',
          }}
        />
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            zIndex: 1,
            p: { xs: 2, md: 2.8 },
            mb: 3,
            borderRadius: '24px',
            border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
            background: `linear-gradient(125deg, ${alpha('#deebfb', 0.9)} 0%, ${alpha(
              theme.palette.background.paper,
              0.82
            )} 74%, ${alpha('#a9bfdc', 0.96)} 100%)`,
            color: 'text.primary',
            boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.4, color: 'text.primary' }}>
            Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Real-time view of conversations, leads, agent performance, and knowledge growth.
          </Typography>
        </Paper>

        {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {kpis.map((kpi) => (
            <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
              <Paper
                elevation={0}
                sx={{
                  zIndex: 1,
                  p: 2,
                  borderRadius: '18px',
                  background: kpi.gradient,
                  color: 'text.primary',
                  minHeight: 142,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.6)}`,
                  boxShadow: `0 12px 26px ${alpha(theme.palette.primary.dark, 0.16)}`,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background:
                      'linear-gradient(140deg, rgba(255,255,255,0.18) 6%, transparent 22%), linear-gradient(28deg, transparent 58%, rgba(74,137,213,0.14) 59%, transparent 82%)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {kpi.label}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.35, color: 'text.primary' }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.2 }}>
                      {kpi.hint}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.14),
                      border: `1px solid ${alpha(theme.palette.common.white, 0.48)}`,
                    }}
                  >
                    {kpi.icon}
                  </Box>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    left: 14,
                    right: 14,
                    bottom: 12,
                    height: 30,
                    opacity: 0.95,
                  }}
                >
                  <svg width="100%" height="100%" viewBox="0 0 220 30" preserveAspectRatio="none" aria-hidden="true">
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

        {stats?.plan_usage && (
          <Paper sx={{ ...glassPanelSx, p: 2.5, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <AutoGraphIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Plan Usage
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {planUsageItems.map((item) => {
                const progress = percent(item.used, item.limit);
                return (
                  <Grid item xs={12} md={6} key={item.label}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.74)} 0%, ${alpha(
                          '#deebfb',
                          0.62
                        )} 100%)`,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {item.label}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${progress.toFixed(1)}%`}
                          sx={{
                            fontWeight: 700,
                            bgcolor: alpha(item.color, 0.14),
                            color: item.color,
                            border: `1px solid ${alpha(item.color, 0.25)}`,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
                        {item.used.toLocaleString()} / {formatLimitValue(item.limit)}
                        {item.remaining !== null ? ` (remaining ${numberOrZero(item.remaining).toLocaleString()})` : ''}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          overflow: 'hidden',
                          bgcolor: alpha(item.color, 0.18),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${alpha(item.color, 0.85)} 0%, ${item.color} 100%)`,
                          },
                        }}
                      />
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        )}

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} lg={8}>
            <Paper sx={{ ...glassPanelSx, p: 2.5, mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Daily Conversations (7 days)</Typography>
              <ResponsiveContainer width="100%" height={290}>
                <LineChart data={dailyConversations}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.secondary, 0.2)} />
                  <XAxis dataKey="date" stroke={theme.palette.text.secondary} tick={{ fontSize: 12 }} />
                  <YAxis stroke={theme.palette.text.secondary} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.55)}`,
                      background: alpha(theme.palette.background.paper, 0.92),
                      boxShadow: `0 10px 24px ${alpha(theme.palette.primary.dark, 0.16)}`,
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#4e89d5" strokeWidth={3.4} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ ...glassPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Conversations vs Leads Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={conversationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.secondary, 0.2)} />
                  <XAxis dataKey="date" stroke={theme.palette.text.secondary} tick={{ fontSize: 12 }} />
                  <YAxis stroke={theme.palette.text.secondary} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${alpha(theme.palette.common.white, 0.55)}`,
                      background: alpha(theme.palette.background.paper, 0.92),
                      boxShadow: `0 10px 24px ${alpha(theme.palette.primary.dark, 0.16)}`,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="conversations" fill="#4e89d5" radius={[7, 7, 0, 0]} />
                  <Bar dataKey="leads" fill="#67a4e8" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper sx={{ ...glassPanelSx, p: 2.5, mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>Leads by Source</Typography>
              {leadsBySource.length > 0 ? (
                <ResponsiveContainer width="100%" height={290}>
                  <PieChart>
                    <Pie data={leadsBySource} dataKey="count" nameKey="source" cx="50%" cy="45%" outerRadius={88} innerRadius={46}>
                      {leadsBySource.map((_, idx) => (
                        <Cell key={`lead-source-${idx}`} fill={pieColors[idx % pieColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(value: number | string | undefined, _name, item) => {
                        const sourceName = (item?.payload as LeadSourcePoint)?.source || 'Source';
                        return [`${numberOrZero(value)} leads`, sourceName];
                      }}
                    />
                    <Legend verticalAlign="bottom" height={32} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">No lead source data available.</Typography>
              )}
            </Paper>

            <Paper sx={{ ...glassPanelSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>Top Sessions</Typography>
              {topSessions.length > 0 ? (
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart data={topSessions.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.secondary, 0.2)} />
                    <XAxis type="number" stroke={theme.palette.text.secondary} tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="session_id"
                      stroke={theme.palette.text.secondary}
                      width={108}
                      tickFormatter={(value: string) => shortText(value, 10)}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      formatter={(value: number | string | undefined) => [`${numberOrZero(value)} messages`, 'Volume']}
                    />
                    <Bar dataKey="message_count" fill="#4e89d5" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">No session data available.</Typography>
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
            sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`, mb: 0.5 }}
          >
            <Tab label="Recent Leads" />
            <Tab label="Top Conversations" />
            <Tab label="Agents" />
            <Tab label="Knowledge Sources" />
          </Tabs>

          <TabPanel value={tab} index={0}>
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
                      <TableCell colSpan={5} align="center">No recent leads.</TableCell>
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
                    <TableCell sx={{ fontWeight: 700 }}>Session ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Messages</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Lead</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last Activity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topSessions.length ? (
                    topSessions.map((session) => (
                      <TableRow key={session.session_id} hover>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{shortText(session.session_id, 28)}</TableCell>
                        <TableCell align="center">
                          <Chip label={session.message_count} size="small" color="primary" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {session.has_lead ? (
                            <Chip label={textOrDash(session.lead_name)} size="small" color="success" />
                          ) : (
                            <Chip label="No" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(session.last_message_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No conversation sessions yet.</TableCell>
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
                  <Grid item xs={12} sm={6} md={4} key={widget.widget_id || String(widget.id || idx)}>
                    <Card sx={{ borderRadius: 2.5, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                          {widget.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                          {widget.widget_id}
                        </Typography>

                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">Conversations: {numberOrZero(widget.conversations_count)}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(numberOrZero(widget.conversations_count) * 10, 100)} sx={{ mt: 0.4, borderRadius: 1 }} />
                        </Box>

                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">Leads: {numberOrZero(widget.leads_count)}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(numberOrZero(widget.leads_count) * 10, 100)} sx={{ mt: 0.4, borderRadius: 1 }} />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label={textOrDash(widget.position)} variant="outlined" />
                          <Chip
                            size="small"
                            label={widget.lead_capture_enabled ? 'Lead Capture On' : 'Lead Capture Off'}
                            color={widget.lead_capture_enabled ? 'success' : 'default'}
                            variant={widget.lead_capture_enabled ? 'filled' : 'outlined'}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center">No agents found.</Typography>
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MenuBookIcon fontSize="small" color="primary" />
                            {source.name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={source.source_type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={source.status}
                            size="small"
                            color={source.status === 'active' ? 'success' : 'default'}
                            variant={source.status === 'active' ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>{formatDate(source.created_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No knowledge sources yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Paper>

        {loading && !stats && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </AdminLayout>
  );
};

export default AdminDashboard;


