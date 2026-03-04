import React, { useState, useEffect } from 'react';
import { keyframes } from '@mui/system';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WidgetsIcon from '@mui/icons-material/Widgets';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardService } from '../services/dashboardService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Animated counter for metrics (custom hook)
function useAnimatedCount(value: number, duration = 1200) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const step = Math.ceil((value || 0) / (duration / 16));
    if (!value) return setCount(0);
    const interval = setInterval(() => {
      start += step;
      if (start >= value) {
        setCount(value);
        clearInterval(interval);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [value, duration]);
  return count;
}


const AdminDashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [dailyConversations, setDailyConversations] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<any[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<any[]>([]);
  const [topSessions, setTopSessions] = useState<any[]>([]);
  const [conversationTrend, setConversationTrend] = useState<any[]>([]);


  useEffect(() => {
    loadDashboardData();
  }, []);

  // Animated values for metrics (call hooks in stable order)
  // Always call hooks with a number to keep hook order stable
  const animatedTotalConversations = useAnimatedCount(
    typeof stats?.total_conversations === 'number' ? stats.total_conversations : 0
  );
  const animatedTotalLeads = useAnimatedCount(
    typeof stats?.total_leads === 'number' ? stats.total_leads : 0
  );
  const animatedConversionRate = useAnimatedCount(
    typeof stats?.conversion_rate === 'number' ? stats.conversion_rate : 0
  );
  const animatedTotalWidgets = useAnimatedCount(
    typeof stats?.total_widgets === 'number' ? stats.total_widgets : 0
  );

  

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load each endpoint individually with error handling
      const stats = await dashboardService.getStats().catch(err => {
        console.error('Stats error:', err);
        return null;
      });
      
      const daily = await dashboardService.getDailyConversations(7).catch(err => {
        console.error('Daily conversations error:', err);
        return { data: [] };
      });
      
      const leads = await dashboardService.getRecentLeads(10).catch(err => {
        console.error('Recent leads error:', err);
        return { leads: [] };
      });
      
      const widgetsData = await dashboardService.getWidgets().catch(err => {
        console.error('Widgets error:', err);
        return { widgets: [] };
      });
      
      const sources = await dashboardService.getKnowledgeSources().catch(err => {
        console.error('Knowledge sources error:', err);
        return { sources: [] };
      });
      
      const leadSource = await dashboardService.getLeadsBySource().catch(err => {
        console.error('Leads by source error:', err);
        return { data: [] };
      });
      
      const sessions = await dashboardService.getTopSessions(10).catch(err => {
        console.error('Top sessions error:', err);
        return { sessions: [] };
      });
      
      const trend = await dashboardService.getConversationTrend(30).catch(err => {
        console.error('Conversation trend error:', err.response?.data?.detail || err.message);
        setError(`Chart data unavailable: ${err.response?.data?.detail || err.message}`);
        return { data: [] };
      });

      setStats(stats);
      setDailyConversations(daily.data || []);
      setRecentLeads(leads.leads || []);
      setWidgets(widgetsData.widgets || []);
      setKnowledgeSources(sources.sources || []);
      setLeadsBySource(leadSource.data || []);
      setTopSessions(sessions.sessions || []);
      setConversationTrend(trend.data || []);
      
      // Debug logging
      console.log('Daily conversations data:', daily.data);
      console.log('Leads by source data:', leadSource.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    // Only show full-page loading on first load
    return (
      <AdminLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  const COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea'];






  // Glassmorphism effect
  const glass = {
    background: 'rgba(255,255,255,0.25)',
    boxShadow: '0 8px 32px 0 rgba(31,38,135,0.12)',
    backdropFilter: 'blur(8px)',
    border: '1.5px solid rgba(255,255,255,0.18)',
  };

  // Icon avatar style
  const iconAvatar = {
    bgcolor: 'rgba(38,155,159,0.12)',
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    boxShadow: '0 6px 18px 0 rgba(38,155,159,0.08)',
    position: 'absolute',
    top: 16,
    right: 16,
  };

  // Animated gradient background for header
  const gradientAnim = keyframes`
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  `;

  return (
    <AdminLayout>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2 }}>
        {/* Header */}
        <Box sx={{
          mb: 4,
          p: 3,
          borderRadius: 4,
          background: 'linear-gradient(90deg, #21c8af 0%, #43e97b 100%)',
          color: 'white',
          boxShadow: '0 8px 32px 0 rgba(33,200,175,0.12)',
          animation: `${gradientAnim} 8s ease-in-out infinite`,
          backgroundSize: '200% 200%',
        }}>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 1, mb: 1 }}>
            <span role="img" aria-label="dashboard">📊</span> Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)' }}>
            Welcome! Here's your business performance overview.
          </Typography>
        </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {stats?.plan_usage && (
        <Paper sx={{ p: 3, mb: 4, borderRadius: 2, boxShadow: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Current Plan Usage
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{
                p: 4,
                minHeight: 150,
                borderRadius: '16px',
                ...glass,
                background: 'linear-gradient(135deg, #43e97b 0%, #21c8af 100%)',
                color: 'primary.contrastText',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 20px 40px rgba(33,200,175,0.12)' },
              }}>
                <Box sx={iconAvatar}><WidgetsIcon sx={{ fontSize: 26, color: 'white' }} /></Box>
                <Typography variant="caption" sx={{ opacity: 0.95, display: 'block', mb: 1, color: 'white' }}>
                  Active Widgets
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'white', letterSpacing: 1 }}>
                  {stats ? animatedTotalWidgets : 0}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85, color: 'white' }}>
                  Knowledge sources: {stats?.total_knowledge_sources || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={9}>
              <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
                <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Messages: {stats.plan_usage.used.messages_used} / {stats.plan_usage.limits.monthly_message_limit ?? '∞'}
                  {stats.plan_usage.remaining.messages_remaining !== null ? ` (Remaining ${stats.plan_usage.remaining.messages_remaining})` : ''}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.plan_usage.limits.monthly_message_limit ? Math.min((stats.plan_usage.used.messages_used / stats.plan_usage.limits.monthly_message_limit) * 100, 100) : 0}
                  sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Tokens: {stats.plan_usage.used.tokens_used?.toLocaleString?.() ?? stats.plan_usage.used.tokens_used} / {stats.plan_usage.limits.monthly_token_limit?.toLocaleString?.() ?? stats.plan_usage.limits.monthly_token_limit ?? '∞'}
                  {stats.plan_usage.remaining.tokens_remaining !== null ? ` (Remaining ${stats.plan_usage.remaining.tokens_remaining.toLocaleString?.() ?? stats.plan_usage.remaining.tokens_remaining})` : ''}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.plan_usage.limits.monthly_token_limit ? Math.min((stats.plan_usage.used.tokens_used / stats.plan_usage.limits.monthly_token_limit) * 100, 100) : 0}
                  sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Crawl Pages: {stats.plan_usage.used.crawl_pages_used} / {stats.plan_usage.limits.monthly_crawl_pages_limit ?? '∞'}
                  {stats.plan_usage.remaining.crawl_pages_remaining !== null ? ` (Remaining ${stats.plan_usage.remaining.crawl_pages_remaining})` : ''}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.plan_usage.limits.monthly_crawl_pages_limit ? Math.min((stats.plan_usage.used.crawl_pages_used / stats.plan_usage.limits.monthly_crawl_pages_limit) * 100, 100) : 0}
                  sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Documents: {stats.plan_usage.used.documents_used} / {stats.plan_usage.limits.monthly_document_limit ?? '∞'}
                  {stats.plan_usage.remaining.documents_remaining !== null ? ` (Remaining ${stats.plan_usage.remaining.documents_remaining})` : ''}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.plan_usage.limits.monthly_document_limit ? Math.min((stats.plan_usage.used.documents_used / stats.plan_usage.limits.monthly_document_limit) * 100, 100) : 0}
                  sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Key Metrics Grid - Redesigned */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Conversations */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 4,
            minHeight: 150,
            borderRadius: '16px',
            ...glass,
            background: 'linear-gradient(135deg, #667eea 0%, #21c8af 100%)',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.22s ease, box-shadow 0.22s ease',
            '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 20px 40px rgba(33,200,175,0.12)' },
          }}>
            <Box sx={iconAvatar}><ChatBubbleOutlineIcon sx={{ fontSize: 26, color: 'white' }} /></Box>
            <Typography variant="caption" sx={{ opacity: 0.95, display: 'block', mb: 1, color: 'white' }}>
              Total Conversations
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'white', letterSpacing: 1 }}>
              {stats ? animatedTotalConversations : 0}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, color: 'white' }}>
              {stats?.conversations_7d || 0} in last 7 days
            </Typography>
          </Paper>
        </Grid>
        {/* Total Leads */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 4,
            minHeight: 150,
            borderRadius: '16px',
            ...glass,
            background: 'linear-gradient(135deg, #f093fb 0%, #43e97b 100%)',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.22s ease, box-shadow 0.22s ease',
            '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 20px 40px rgba(245, 87, 108, 0.12)' },
          }}>
            <Box sx={iconAvatar}><PersonAddIcon sx={{ fontSize: 26, color: 'white' }} /></Box>
            <Typography variant="caption" sx={{ opacity: 0.95, display: 'block', mb: 1, color: 'white' }}>
              Total Leads
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'white', letterSpacing: 1 }}>
              {stats ? animatedTotalLeads : 0}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, color: 'white' }}>
              {stats?.leads_7d || 0} in last 7 days
            </Typography>
          </Paper>
        </Grid>
        {/* Conversion Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 4,
            minHeight: 150,
            borderRadius: '16px',
            ...glass,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.22s ease, box-shadow 0.22s ease',
            '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 20px 40px rgba(79, 172, 254, 0.12)' },
          }}>
            <Box sx={iconAvatar}><TrendingUpIcon sx={{ fontSize: 26, color: 'white' }} /></Box>
            <Typography variant="caption" sx={{ opacity: 0.95, display: 'block', mb: 1, color: 'white' }}>
              Conversion Rate
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'white', letterSpacing: 1 }}>
              {stats ? animatedConversionRate : 0}%
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, color: 'white' }}>
              Leads from conversations
            </Typography>
          </Paper>
        </Grid>
        {/* Total Widgets */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 3,
            borderRadius: '20px',
            ...glass,
            background: 'linear-gradient(135deg, #43e97b 0%, #21c8af 100%)',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s',
            '&:hover': { transform: 'translateY(-4px) scale(1.03)', boxShadow: '0 12px 32px 0 rgba(67, 233, 123, 0.18)' },
          }}>
            <Box sx={iconAvatar}><WidgetsIcon sx={{ fontSize: 28, color: '#43e97b' }} /></Box>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1, color: 'white' }}>
              Active Widgets
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'white', letterSpacing: 1 }}>
              {stats ? animatedTotalWidgets : 0}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, color: 'white' }}>
              Knowledge sources: {stats?.total_knowledge_sources || 0}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Section - Two-column layout: main charts left, pie+sessions right */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={7}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>
                  Daily Conversations (7 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyConversations}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <ChartTooltip 
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: 'white' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#2db3a0" 
                      strokeWidth={3}
                      dot={{ fill: '#2db3a0', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>
                  Conversation vs Leads Trend (30 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={conversationTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <ChartTooltip 
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: 'white' }}
                    />
                    <Legend />
                    <Bar dataKey="conversations" fill="#2db3a0" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="leads" fill="#667eea" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12} md={5}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                  Leads by Source
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: '#64748b', fontSize: '0.875rem' }}>
                  Where your leads are coming from (by widget/channel)
                </Typography>
                {leadsBySource.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={leadsBySource}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ source, count, percent }) => `${source}: ${count} (${(percent * 100).toFixed(1)}%)`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {leadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: 'white' }}
                        formatter={(value: any, name: any, props: any) => {
                          const total = leadsBySource.reduce((sum, item) => sum + item.count, 0);
                          const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return [`${value} leads (${percent}%)`, 'Count'];
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value, entry: any) => {
                          const item = leadsBySource.find(d => d.source === entry.payload.source);
                          return `${entry.payload.source} (${item?.count || 0})`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No lead data available
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                  Top Active Sessions
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: '#64748b', fontSize: '0.875rem' }}>
                  Sessions with the most message exchanges
                </Typography>
                {topSessions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topSessions.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6edf3" />
                      <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} />
                      <YAxis 
                        type="category" 
                        dataKey="session_id" 
                        stroke="#64748b" 
                        tick={{ fontSize: 11 }}
                        width={110}
                        tickFormatter={(value) => value.substring(0, 12) + '...'}
                      />
                      <ChartTooltip 
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: 'white' }}
                        formatter={(value: any, name: any, props: any) => {
                          const session = topSessions.find(s => s.session_id === props.payload.session_id);
                          return [`${value} messages`, 'Count'];
                        }}
                        labelFormatter={(value) => {
                          const session = topSessions.find(s => s.session_id === value);
                          if (session?.last_message_at) {
                            const date = new Date(session.last_message_at);
                            return `Session: ${value.substring(0, 16)}...\nLast active: ${date.toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}`;
                          }
                          return `Session: ${value.substring(0, 20)}...`;
                        }}
                      />
                      <Bar 
                        dataKey="message_count" 
                        fill="#43e97b" 
                        radius={[0, 8, 8, 0]}
                        name="Messages"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No session data available
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Tabs for Detailed Views */}
      <Paper sx={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 500,
              color: '#64748b',
              '&.Mui-selected': {
                color: '#2db3a0',
              }
            }
          }}
        >
          <Tab label="Recent Leads" />
          <Tab label="Top Conversations" />
          <Tab label="Widgets" />
          <Tab label="Knowledge Sources" />
        </Tabs>

        {/* Recent Leads Tab */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ background: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentLeads.length > 0 ? (
                  recentLeads.map((lead) => (
                    <TableRow key={lead.id} sx={{ '&:hover': { background: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{lead.name || 'N/A'}</TableCell>
                      <TableCell>{lead.email || 'N/A'}</TableCell>
                      <TableCell>{lead.phone || 'N/A'}</TableCell>
                      <TableCell>
                        {lead.company ? (
                          <Chip label={lead.company} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>-</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b', fontSize: '13px' }}>
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                      No leads yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Top Conversations Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ background: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Session ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Messages</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Lead Captured</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Last Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topSessions.length > 0 ? (
                  topSessions.map((session) => (
                    <TableRow key={session.session_id} sx={{ '&:hover': { background: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 500, fontSize: '12px', maxWidth: '200px', overflow: 'auto' }}>
                        {session.session_id.substring(0, 30)}...
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={session.message_count} 
                          size="small" 
                          sx={{ background: '#e0f2f7', color: '#2db3a0', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        {session.has_lead ? (
                          <Chip 
                            label={session.lead_name || 'Yes'} 
                            size="small" 
                            color="success"
                            variant="filled"
                          />
                        ) : (
                          <Chip 
                            label="No" 
                            size="small" 
                            variant="outlined"
                            sx={{ color: '#94a3b8' }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b', fontSize: '13px' }}>
                        {session.last_message_at ? new Date(session.last_message_at).toLocaleString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                      No conversations yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Widgets Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            {widgets.length > 0 ? (
              widgets.map((widget) => (
                <Grid item xs={12} sm={6} md={4} key={widget.id}>
                  <Card sx={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
                        {widget.name}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                          Conversations: {widget.conversations_count}
                        </Typography>
                        <LinearProgress variant="determinate" value={Math.min(widget.conversations_count * 10, 100)} sx={{ mb: 1 }} />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                          Leads: {widget.leads_count}
                        </Typography>
                        <LinearProgress variant="determinate" value={Math.min(widget.leads_count * 10, 100)} sx={{ mb: 1 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                        <Chip 
                          label={widget.position} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={widget.lead_capture_enabled ? 'Capture On' : 'Capture Off'} 
                          size="small" 
                          color={widget.lead_capture_enabled ? 'success' : 'default'}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Typography sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                  No widgets created yet
                </Typography>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Knowledge Sources Tab */}
        <TabPanel value={tabValue} index={3}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ background: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {knowledgeSources.length > 0 ? (
                  knowledgeSources.map((source) => (
                    <TableRow key={source.id} sx={{ '&:hover': { background: '#f8fafc' } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{source.name}</TableCell>
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
                          color={source.status === 'active' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#64748b', fontSize: '13px' }}>
                        {source.created_at ? new Date(source.created_at).toLocaleDateString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
                      No knowledge sources yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>
      </Box>
    </AdminLayout>
  );
};

export default AdminDashboard;
