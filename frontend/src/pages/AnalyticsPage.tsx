import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, CircularProgress, Alert, LinearProgress, Paper } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AdminLayout from '../components/Layout/AdminLayout';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyticsService } from '../services/analyticsService';
import type { AnalyticsMetrics } from '../services/analyticsService';

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

  const usagePercent = (used: number, limit: number | null): number => {
    if (!limit || limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const formatLimitValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') return '∞';
    return value.toLocaleString();
  };

  const analyticsPlanUsageItems = metrics.plan_usage
    ? [
        {
          label: 'Conversations',
          used: metrics.plan_usage.used.conversations_used,
          limit: metrics.plan_usage.limits.monthly_conversation_limit,
          remaining: metrics.plan_usage.remaining.conversations_remaining,
          color: '#4e89d5',
        },
        {
          label: 'Messages',
          used: metrics.plan_usage.used.messages_used,
          limit: metrics.plan_usage.limits.monthly_message_limit,
          remaining: metrics.plan_usage.remaining.messages_remaining,
          color: '#5a9fdd',
        },
        {
          label: 'Tokens',
          used: metrics.plan_usage.used.tokens_used,
          limit: metrics.plan_usage.limits.monthly_token_limit,
          remaining: metrics.plan_usage.remaining.tokens_remaining,
          color: '#56a8d6',
        },
        {
          label: 'Crawl Pages',
          used: metrics.plan_usage.used.crawl_pages_used,
          limit: metrics.plan_usage.limits.monthly_crawl_pages_limit,
          remaining: metrics.plan_usage.remaining.crawl_pages_remaining,
          color: '#4f83cf',
        },
        {
          label: 'Documents',
          used: metrics.plan_usage.used.documents_used,
          limit: metrics.plan_usage.limits.monthly_document_limit,
          remaining: metrics.plan_usage.remaining.documents_remaining,
          color: '#6a98d0',
        },
      ]
    : [];

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
            position: 'relative',
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
          {metrics.plan_usage && (
            <Grid item xs={12}>
              <Card sx={{ ...panelSx }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                    Current Plan Usage
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} lg={4}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.8,
                          borderRadius: '12px',
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.76)} 0%, ${alpha(
                            '#dfeafb',
                            0.68
                          )} 100%)`,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">Plan</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.4 }}>
                          {metrics.plan_usage.plan_name || '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {metrics.plan_usage.billing_cycle || '—'} • {metrics.plan_usage.status || '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Ends: {metrics.plan_usage.end_date ? new Date(metrics.plan_usage.end_date).toLocaleDateString() : '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Days left: {metrics.plan_usage.days_left ?? '—'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} lg={8}>
                      <Grid container spacing={1.5}>
                        {analyticsPlanUsageItems.map((item) => {
                          const progress = usagePercent(item.used, item.limit);
                          return (
                            <Grid item xs={12} sm={6} key={item.label}>
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 1.4,
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
                                  <Box
                                    sx={{
                                      px: 0.8,
                                      py: 0.2,
                                      borderRadius: 2,
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      color: item.color,
                                      bgcolor: alpha(item.color, 0.14),
                                      border: `1px solid ${alpha(item.color, 0.24)}`,
                                    }}
                                  >
                                    {progress.toFixed(1)}%
                                  </Box>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                  {item.used.toLocaleString()} / {formatLimitValue(item.limit)}
                                  {item.remaining !== null ? ` (remaining ${item.remaining.toLocaleString()})` : ''}
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
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
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


