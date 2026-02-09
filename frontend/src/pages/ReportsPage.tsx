import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/Layout/AdminLayout';
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
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
} from '@mui/material';
import {
  Download as FileDownloadIcon,
  LocalPrintshop as PrintIcon,
  TrendingUp,
  Assignment,
  ShoppingCart,
  BarChart as BarChartIcon,
  Star,
  ChatBubble,
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportService, ConversationMetric, DailyStats } from '../services/reportService';

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
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ReportsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [widgetId, setWidgetId] = useState('');

  // Summary data
  const [summary, setSummary] = useState<any>(null);

  // Conversations data
  const [conversations, setConversations] = useState<ConversationMetric[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalConversations, setTotalConversations] = useState(0);
  const [sortBy] = useState('conversation_start');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // Token data
  const [tokenReport, setTokenReport] = useState<any>(null);

  // Leads data
  const [leadReport, setLeadReport] = useState<any>(null);

  // Daily stats
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);

  // Print dialog
  // const [printDialogOpen, setPrintDialogOpen] = useState(false);

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
      setError(err.message || 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  };

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getConversationsReport({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        start_date: startDate,
        end_date: endDate,
        widget_id: widgetId,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setConversations(data.metrics);
      setTotalConversations(data.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch conversations');
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
      setError(err.message || 'Failed to fetch token report');
    } finally {
      setLoading(false);
    }
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
      setError(err.message || 'Failed to fetch leads report');
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
      setError(err.message || 'Failed to fetch daily stats');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSummary();
  }, []);

  // Tab change handler
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    switch (newValue) {
      case 0:
        fetchSummary();
        break;
      case 1:
        setPage(0);
        fetchConversations();
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
    }
  };

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      await reportService.exportToCSV({
        start_date: startDate,
        end_date: endDate,
        widget_id: widgetId,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV');
    }
  };

  // Handle export PDF
  const handleExportPDF = async () => {
    try {
      switch (tabValue) {
        case 0: // Summary
          if (summary) {
            await reportService.exportSummaryToPDF(summary, 'Summary Report');
          } else {
            setError('No summary data to export. Please fetch summary first.');
          }
          break;
        case 1: // Conversations
          if (conversations.length > 0) {
            await reportService.exportConversationsToPDF(conversations, 'Conversations Report');
          } else {
            setError('No conversations data to export. Please fetch conversations first.');
          }
          break;
        case 2: // Token Usage
          if (tokenReport) {
            await reportService.exportTokensToPDF(tokenReport, 'Token Usage Report');
          } else {
            setError('No token data to export. Please fetch token report first.');
          }
          break;
        case 3: // Leads
          if (leadReport) {
            await reportService.exportLeadsToPDF(leadReport, 'Leads Analytics Report');
          } else {
            setError('No leads data to export. Please fetch leads report first.');
          }
          break;
        case 4: // Daily Stats
          if (dailyStats.length > 0) {
            await reportService.exportDailyStatsToPDF(dailyStats, 'Daily Statistics Report');
          } else {
            setError('No daily stats to export. Please fetch daily stats first.');
          }
          break;
        default:
          setError('Invalid tab selected');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <AdminLayout>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Reports & Analytics
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            View detailed analytics and metrics for your conversations, leads, and system performance.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Filter Reports
          </Typography>
          <Grid container spacing={2} alignItems="flex-end">
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
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="Widget ID"
                value={widgetId}
                onChange={(e) => setWidgetId(e.target.value)}
                placeholder="Optional"
                fullWidth
                size="small"
              />
              </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <Button 
                variant="contained" 
                onClick={fetchSummary} 
                fullWidth
                sx={{ height: 40 }}
              >
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Export/Print buttons */}
        <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            startIcon={<FileDownloadIcon />}
            variant="outlined"
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button
            startIcon={<FileDownloadIcon />}
            variant="outlined"
            onClick={handleExportPDF}
          >
            Export PDF
          </Button>
          <Button
            startIcon={<PrintIcon />}
            variant="outlined"
            onClick={handlePrint}
          >
            Print
          </Button>
        </Box>

        {loading && <LinearProgress />}

        {/* Tabs */}
        <Paper>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="report tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Summary" id="report-tab-0" aria-controls="report-tabpanel-0" />
            <Tab label="Conversations" id="report-tab-1" aria-controls="report-tabpanel-1" />
            <Tab label="Token Usage" id="report-tab-2" aria-controls="report-tabpanel-2" />
            <Tab label="Lead Analytics" id="report-tab-3" aria-controls="report-tabpanel-3" />
            <Tab label="Daily Stats" id="report-tab-4" aria-controls="report-tabpanel-4" />
          </Tabs>

        {/* Summary Tab */}
        <TabPanel value={tabValue} index={0}>
          {summary && (
            <Grid container spacing={3}>
              {summary.plan_usage && (
                <Grid item xs={12}>
                  <Card sx={{ boxShadow: 1 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        Current Plan Usage
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">Plan</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {summary.plan_usage.plan_name || '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {summary.plan_usage.billing_cycle || '—'} • {summary.plan_usage.status || '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Ends: {summary.plan_usage.end_date ? new Date(summary.plan_usage.end_date).toLocaleDateString() : '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Days left: {summary.plan_usage.days_left ?? '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={8}>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Conversations: {summary.plan_usage.used.conversations_used} / {summary.plan_usage.limits.monthly_conversation_limit ?? '∞'}
                              {summary.plan_usage.remaining.conversations_remaining !== null ? ` (Remaining ${summary.plan_usage.remaining.conversations_remaining})` : ''}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={summary.plan_usage.limits.monthly_conversation_limit ? Math.min((summary.plan_usage.used.conversations_used / summary.plan_usage.limits.monthly_conversation_limit) * 100, 100) : 0}
                              sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                            />
                          </Box>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Messages: {summary.plan_usage.used.messages_used} / {summary.plan_usage.limits.monthly_message_limit ?? '∞'}
                              {summary.plan_usage.remaining.messages_remaining !== null ? ` (Remaining ${summary.plan_usage.remaining.messages_remaining})` : ''}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={summary.plan_usage.limits.monthly_message_limit ? Math.min((summary.plan_usage.used.messages_used / summary.plan_usage.limits.monthly_message_limit) * 100, 100) : 0}
                              sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                            />
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Tokens: {summary.plan_usage.used.tokens_used.toLocaleString()} / {summary.plan_usage.limits.monthly_token_limit?.toLocaleString() ?? '∞'}
                              {summary.plan_usage.remaining.tokens_remaining !== null ? ` (Remaining ${summary.plan_usage.remaining.tokens_remaining.toLocaleString()})` : ''}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={summary.plan_usage.limits.monthly_token_limit ? Math.min((summary.plan_usage.used.tokens_used / summary.plan_usage.limits.monthly_token_limit) * 100, 100) : 0}
                              sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                            />
                          </Box>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Crawl Pages: {summary.plan_usage.used.crawl_pages_used} / {summary.plan_usage.limits.monthly_crawl_pages_limit ?? '∞'}
                              {summary.plan_usage.remaining.crawl_pages_remaining !== null ? ` (Remaining ${summary.plan_usage.remaining.crawl_pages_remaining})` : ''}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={summary.plan_usage.limits.monthly_crawl_pages_limit ? Math.min((summary.plan_usage.used.crawl_pages_used / summary.plan_usage.limits.monthly_crawl_pages_limit) * 100, 100) : 0}
                              sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                            />
                          </Box>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              Documents: {summary.plan_usage.used.documents_used} / {summary.plan_usage.limits.monthly_document_limit ?? '∞'}
                              {summary.plan_usage.remaining.documents_remaining !== null ? ` (Remaining ${summary.plan_usage.remaining.documents_remaining})` : ''}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={summary.plan_usage.limits.monthly_document_limit ? Math.min((summary.plan_usage.used.documents_used / summary.plan_usage.limits.monthly_document_limit) * 100, 100) : 0}
                              sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                            />
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ boxShadow: 1 }}>
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
                <Card sx={{ boxShadow: 1 }}>
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
                      <ChatBubble sx={{ fontSize: 32, color: '#00C49F', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ boxShadow: 1 }}>
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
                      <TrendingUp sx={{ fontSize: 32, color: '#FFBB28', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ boxShadow: 1 }}>
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
                      <BarChartIcon sx={{ fontSize: 32, color: '#FF8042', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ boxShadow: 1 }}>
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
                      <ShoppingCart sx={{ fontSize: 32, color: '#8884D8', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ boxShadow: 1 }}>
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
                      <Star sx={{ fontSize: 32, color: '#FFD700', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card sx={{ boxShadow: 1 }}>
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
        </TabPanel>

        {/* Conversations Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Session ID</TableCell>
                  <TableCell align="right">Messages</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Response Time</TableCell>
                  <TableCell align="right">Satisfaction</TableCell>
                  <TableCell>Lead</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {conversations.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell>{conv.session_id.substring(0, 12)}...</TableCell>
                    <TableCell align="right">{conv.total_messages}</TableCell>
                    <TableCell align="right">{conv.total_tokens}</TableCell>
                    <TableCell align="right">
                      {conv.average_response_time?.toFixed(2)}s
                    </TableCell>
                    <TableCell align="right">
                      {conv.user_satisfaction
                        ? `${conv.user_satisfaction.toFixed(1)}/5`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {conv.has_lead ? (
                        <Chip label={conv.lead_name || 'New Lead'} color="success" size="small" />
                      ) : (
                        <Chip label="No Lead" variant="outlined" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(conv.conversation_start).toLocaleDateString()}
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
        <TabPanel value={tabValue} index={2}>
          {tokenReport && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Total Tokens
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {tokenReport.total_tokens?.toLocaleString()}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Prompt Tokens
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {tokenReport.prompt_tokens?.toLocaleString()}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Completion Tokens
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {tokenReport.completion_tokens?.toLocaleString()}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Avg Tokens/Conversation
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {tokenReport.average_tokens_per_conversation?.toFixed(0)}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Conversations
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {tokenReport.conversations_count}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Estimated Cost
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      ${tokenReport.cost_estimate?.toFixed(4) || '0.00'}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <h4>Token Distribution</h4>
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
                          fill="#8884d8"
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
        </TabPanel>

        {/* Leads Tab */}
        <TabPanel value={tabValue} index={3}>
          {leadReport && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Total Leads
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {leadReport.total_leads}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Leads with Email
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {leadReport.leads_with_email}
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      Conversion Rate
                    </p>
                    <h3 style={{ margin: '8px 0 0 0' }}>
                      {leadReport.conversion_rate?.toFixed(2)}%
                    </h3>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <h4>Leads by Widget</h4>
                    <Box>
                      {Object.entries(leadReport.leads_by_widget || {}).map(
                        ([widget, count]: [string, any]) => (
                          <Box key={widget} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <span>{widget || 'Unknown'}</span>
                            <strong>{count}</strong>
                          </Box>
                        )
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <h4>Leads by Date (Last 7 Days)</h4>
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
                        <Bar dataKey="leads" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* Daily Stats Tab */}
        <TabPanel value={tabValue} index={4}>
          {dailyStats.length > 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <h4>Daily Conversations</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="conversation_count" stroke="#8884d8" name="Conversations" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <h4>Daily Messages & Tokens</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="total_messages" fill="#8884d8" name="Messages" />
                        <Bar yAxisId="right" dataKey="total_tokens" fill="#82ca9d" name="Tokens" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <h4>Daily Leads Captured</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="leads_captured" fill="#ffc658" name="Leads" />
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
        </TabPanel>
        </Paper>
      </Box>
    </AdminLayout>
  );
};

export default ReportsPage;
