import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  TextField,
  Button,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AdminLayout from '../components/Layout/AdminLayout';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyticsService } from '../services/analyticsService';
import type { AnalyticsMetrics, RetrievalTrace } from '../services/analyticsService';

interface SessionMessageData {
  date: string;
  sessions: number;
  messages: number;
}

interface EngagementData {
  hour: string;
  users: number;
}

const AnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<SessionMessageData[]>([]);
  const [userEngagementData, setUserEngagementData] = useState<EngagementData[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({
    avg_response_time: 0,
    conversion_rate: 0,
    total_sessions: 0,
    total_messages: 0,
    total_leads: 0,
    plan_usage: null as any,
  });
  const [traceSessionFilter, setTraceSessionFilter] = useState('');
  const [traceWidgetFilter, setTraceWidgetFilter] = useState('');
  const [tracesLoading, setTracesLoading] = useState(false);
  const [tracesError, setTracesError] = useState<string | null>(null);
  const [retrievalTraces, setRetrievalTraces] = useState<RetrievalTrace[]>([]);

  const panelSx = {
    borderRadius: '18px',
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(145deg, ${alpha(theme.palette.common.white, 0.76)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82
    )} 62%, ${alpha('#dce8f8', 0.82)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.16)}`,
    backdropFilter: 'blur(10px)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background:
        'linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)',
    },
    '& > *': {
      position: 'relative',
      zIndex: 1,
    },
  } as const;

  const getChunkPreview = (chunk: { chunk?: string; content?: string }) => {
    const text = (chunk.chunk || chunk.content || '').trim();
    if (!text) {
      return 'No chunk text captured';
    }
    return text.length > 260 ? `${text.slice(0, 260)}...` : text;
  };

  const fetchRetrievalTraces = async (overrides?: { sessionId?: string; widgetId?: string }) => {
    try {
      setTracesLoading(true);
      setTracesError(null);

      const sessionId = typeof overrides?.sessionId !== 'undefined'
        ? overrides.sessionId
        : (traceSessionFilter.trim() || undefined);
      const widgetId = typeof overrides?.widgetId !== 'undefined'
        ? overrides.widgetId
        : (traceWidgetFilter.trim() || undefined);

      const response = await analyticsService.getRetrievalTraces({
        sessionId,
        widgetId,
        days: 14,
        limit: 30,
      });

      setRetrievalTraces(response.data || []);
    } catch (err) {
      console.error('Error fetching retrieval traces:', err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setTracesError('Retrieval traces are available to admin users only.');
      } else {
        setTracesError('Failed to load retrieval traces.');
      }
      setRetrievalTraces([]);
    } finally {
      setTracesLoading(false);
    }
  };

  const handleTraceSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fetchRetrievalTraces();
  };

  const handleTraceReset = () => {
    setTraceSessionFilter('');
    setTraceWidgetFilter('');
    fetchRetrievalTraces({ sessionId: undefined, widgetId: undefined });
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all analytics data
        const [sessionsRes, engagementRes, metricsRes] = await Promise.all([
          analyticsService.getSessionsMessages(7),
          analyticsService.getUserEngagement(7),
          analyticsService.getMetrics(7),
        ]);

        console.log('Sessions/Messages data:', sessionsRes.data);
        console.log('Engagement data:', engagementRes.data);
        console.log('Metrics:', metricsRes);

        setAnalyticsData(sessionsRes.data || []);
        setUserEngagementData(engagementRes.data || []);
        setMetrics(metricsRes);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchRetrievalTraces({ sessionId: undefined, widgetId: undefined });
  }, []);

  if (error) {
    return (
      <AdminLayout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Analytics
          </Typography>
        </Box>
        <Alert severity="error">{error}</Alert>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

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
              'linear-gradient(132deg, transparent 16%, rgba(132,172,228,0.2) 17%, transparent 34%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.16) 53%, transparent 72%)',
          }}
        />

        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            zIndex: 1,
            p: { xs: 2, md: 2.6 },
            mb: 3,
            borderRadius: '24px',
            border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
            background: `linear-gradient(125deg, ${alpha('#deebfb', 0.92)} 0%, ${alpha(
              theme.palette.background.paper,
              0.84
            )} 72%, ${alpha('#a9bfdc', 0.98)} 100%)`,
            boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)',
              pointerEvents: 'none',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-24%',
              right: '-6%',
              width: '42%',
              height: '150%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)',
              pointerEvents: 'none',
            },
            '& > *': {
              position: 'relative',
              zIndex: 1,
            },
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.8, letterSpacing: '-0.02em' }}>
            Analytics
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Track performance metrics and user engagement across your AI platform.
          </Typography>
        </Paper>

        <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
          {/* Session & Message Trends */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Sessions & Messages (Last 7 Days)
                </Typography>
                {analyticsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={analyticsData}>
                      <XAxis dataKey="date" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          borderRadius: '8px'
                        }} 
                      />
                      <Line type="monotone" dataKey="sessions" stroke={theme.palette.primary.main} strokeWidth={2.2} />
                      <Line type="monotone" dataKey="messages" stroke={theme.palette.secondary.main} strokeWidth={2.2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 4 }}>
                    No data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* User Engagement by Hour */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  User Engagement by Hour
                </Typography>
                {userEngagementData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={userEngagementData}>
                      <XAxis dataKey="hour" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="users" fill={theme.palette.primary.main} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 4 }}>
                    No data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
                  Retrieval Trace Explorer
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Inspect why the assistant answered a question by reviewing selected context chunks.
                </Typography>

                <Box component="form" onSubmit={handleTraceSearch} sx={{ mb: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                    <TextField
                      size="small"
                      label="Session ID"
                      value={traceSessionFilter}
                      onChange={(event) => setTraceSessionFilter(event.target.value)}
                      sx={{ minWidth: { md: 280 } }}
                    />
                    <TextField
                      size="small"
                      label="Widget ID"
                      value={traceWidgetFilter}
                      onChange={(event) => setTraceWidgetFilter(event.target.value)}
                      sx={{ minWidth: { md: 220 } }}
                    />
                    <Button type="submit" variant="contained" disabled={tracesLoading}>
                      Load Traces
                    </Button>
                    <Button type="button" variant="text" onClick={handleTraceReset} disabled={tracesLoading}>
                      Reset
                    </Button>
                  </Stack>
                </Box>

                {tracesLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading retrieval traces...
                    </Typography>
                  </Box>
                )}

                {!tracesLoading && tracesError && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    {tracesError}
                  </Alert>
                )}

                {!tracesLoading && !tracesError && retrievalTraces.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
                    No traces found for this filter set.
                  </Typography>
                )}

                {!tracesLoading && !tracesError && retrievalTraces.length > 0 && (
                  <Box sx={{ display: 'grid', gap: 1.3 }}>
                    {retrievalTraces.map((trace) => (
                      <Paper
                        key={trace.id}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: '12px',
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                          bgcolor: alpha(theme.palette.common.white, 0.72),
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={0.8}
                          sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', mb: 0.8 }}
                        >
                          <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                            <Chip size="small" label={`Session: ${trace.session_id}`} />
                            {trace.widget_id && <Chip size="small" label={`Widget: ${trace.widget_id}`} variant="outlined" />}
                            {trace.has_context ? (
                              <Chip size="small" color="success" label="Context Found" />
                            ) : (
                              <Chip size="small" color="warning" label="No Context" />
                            )}
                            {trace.escalation_triggered && <Chip size="small" color="error" label="Escalation" />}
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {trace.created_at ? new Date(trace.created_at).toLocaleString() : 'Unknown time'}
                          </Typography>
                        </Stack>

                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          User Query
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', mb: 0.8 }}>
                          {trace.user_query}
                        </Typography>

                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Retrieval Query
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.8 }}>
                          {trace.retrieval_query || 'Used raw user query'}
                        </Typography>

                        <Stack direction="row" spacing={1.2} sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Selected chunks: {trace.selected_chunks.length}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Retrieved chunks: {trace.retrieved_chunks.length}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Top distance: {typeof trace.top_distance === 'number' ? trace.top_distance.toFixed(4) : 'n/a'}
                          </Typography>
                        </Stack>

                        <Divider sx={{ mb: 1 }} />

                        {trace.selected_chunks.length > 0 ? (
                          <Box sx={{ display: 'grid', gap: 0.75 }}>
                            {trace.selected_chunks.slice(0, 3).map((chunk, index) => (
                              <Typography key={`${trace.id}-chunk-${index}`} variant="body2" sx={{ color: 'text.primary' }}>
                                {index + 1}. {getChunkPreview(chunk)}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            No selected chunk payload was captured for this trace.
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Key Metrics */}
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Avg. Response Time
                </Typography>
                <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  {metrics.avg_response_time.toFixed(1)}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last 7 days
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Lead Conversion
                </Typography>
                <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 700 }}>
                  {metrics.conversion_rate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Session to Lead
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Total Sessions
                </Typography>
                <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  {metrics.total_sessions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last 7 days
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ ...panelSx }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Total Messages
                </Typography>
                <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 700 }}>
                  {metrics.total_messages}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  User messages sent
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

      </Box>
    </AdminLayout>
  );
};

export default AnalyticsPage;





