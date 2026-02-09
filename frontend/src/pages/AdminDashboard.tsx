import React, { useState, useEffect } from 'react';
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

const AdminDashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
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

  return (
    <AdminLayout>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">Plan</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {stats.plan_usage.plan_name || '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.plan_usage.billing_cycle || '—'} • {stats.plan_usage.status || '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ends: {stats.plan_usage.end_date ? new Date(stats.plan_usage.end_date).toLocaleDateString() : '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Days left: {stats.plan_usage.days_left ?? '—'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Conversations: {stats.plan_usage.used.conversations_used} / {stats.plan_usage.limits.monthly_conversation_limit ?? '∞'}
                  {stats.plan_usage.remaining.conversations_remaining !== null ? ` (Remaining ${stats.plan_usage.remaining.conversations_remaining})` : ''}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={stats.plan_usage.limits.monthly_conversation_limit ? Math.min((stats.plan_usage.used.conversations_used / stats.plan_usage.limits.monthly_conversation_limit) * 100, 100) : 0}
                  sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
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
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Key Metrics Grid */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {/* Total Conversations */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
                  Total Conversations
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  {stats?.total_conversations || 0}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {stats?.conversations_7d || 0} in last 7 days
                </Typography>
              </Box>
              <ChatBubbleOutlineIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            </Box>
          </Paper>
        </Grid>

        {/* Total Leads */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 3,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(245, 87, 108, 0.4)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
                  Total Leads
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  {stats?.total_leads || 0}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {stats?.leads_7d || 0} in last 7 days
                </Typography>
              </Box>
              <PersonAddIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            </Box>
          </Paper>
        </Grid>

        {/* Conversion Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 3,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(79, 172, 254, 0.4)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
                  Conversion Rate
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  {stats?.conversion_rate || 0}%
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Leads from conversations
                </Typography>
              </Box>
              <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            </Box>
          </Paper>
        </Grid>

        {/* Total Widgets */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{
            p: 3,
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(67, 233, 123, 0.4)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
                  Active Widgets
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  {stats?.total_widgets || 0}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Knowledge sources: {stats?.total_knowledge_sources || 0}
                </Typography>
              </Box>
              <WidgetsIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Daily Conversations Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
              Daily Conversations (7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyConversations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <ChartTooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2db3a0" 
                  strokeWidth={3}
                  dot={{ fill: '#2db3a0', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Conversation vs Leads Trend */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
              Conversation vs Leads Trend (30 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <ChartTooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                />
                <Legend />
                <Bar dataKey="conversations" fill="#2db3a0" radius={[8, 8, 0, 0]} />
                <Bar dataKey="leads" fill="#667eea" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Leads by Source */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
              Leads by Source
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#64748b', fontSize: '0.875rem' }}>
              Where your leads are coming from (by widget/channel)
            </Typography>
            {leadsBySource.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={leadsBySource}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ source, count, percent }) => `${source}: ${count} (${(percent * 100).toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {leadsBySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
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
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No lead data available
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Daily Conversations - Line Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
              Top Active Sessions
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#64748b', fontSize: '0.875rem' }}>
              Sessions with the most message exchanges
            </Typography>
            {topSessions.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topSessions.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="session_id" 
                    stroke="#64748b" 
                    tick={{ fontSize: 11 }}
                    width={100}
                    tickFormatter={(value) => value.substring(0, 12) + '...'}
                  />
                  <ChartTooltip 
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
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
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No session data available
                </Typography>
              </Box>
            )}
          </Paper>
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
