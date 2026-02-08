import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, CircularProgress, Alert, LinearProgress } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyticsService } from '../services/analyticsService';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<SessionMessageData[]>([]);
  const [userEngagementData, setUserEngagementData] = useState<EngagementData[]>([]);
  const [metrics, setMetrics] = useState({
    avg_response_time: 0,
    conversion_rate: 0,
    total_sessions: 0,
    total_messages: 0,
    plan_usage: null as any,
  });

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
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Analytics
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Track performance metrics and user engagement across your AI platform.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {metrics.plan_usage && (
            <Grid item xs={12}>
              <Card sx={{ boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Current Plan Usage
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">Plan</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
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
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Conversations: {metrics.plan_usage.used.conversations_used} / {metrics.plan_usage.limits.monthly_conversation_limit ?? '∞'}
                          {metrics.plan_usage.remaining.conversations_remaining !== null ? ` (Remaining ${metrics.plan_usage.remaining.conversations_remaining})` : ''}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.plan_usage.limits.monthly_conversation_limit ? Math.min((metrics.plan_usage.used.conversations_used / metrics.plan_usage.limits.monthly_conversation_limit) * 100, 100) : 0}
                          sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Messages: {metrics.plan_usage.used.messages_used} / {metrics.plan_usage.limits.monthly_message_limit ?? '∞'}
                          {metrics.plan_usage.remaining.messages_remaining !== null ? ` (Remaining ${metrics.plan_usage.remaining.messages_remaining})` : ''}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.plan_usage.limits.monthly_message_limit ? Math.min((metrics.plan_usage.used.messages_used / metrics.plan_usage.limits.monthly_message_limit) * 100, 100) : 0}
                          sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Tokens: {metrics.plan_usage.used.tokens_used.toLocaleString()} / {metrics.plan_usage.limits.monthly_token_limit?.toLocaleString() ?? '∞'}
                          {metrics.plan_usage.remaining.tokens_remaining !== null ? ` (Remaining ${metrics.plan_usage.remaining.tokens_remaining.toLocaleString()})` : ''}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.plan_usage.limits.monthly_token_limit ? Math.min((metrics.plan_usage.used.tokens_used / metrics.plan_usage.limits.monthly_token_limit) * 100, 100) : 0}
                          sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                        />
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Crawl Pages: {metrics.plan_usage.used.crawl_pages_used} / {metrics.plan_usage.limits.monthly_crawl_pages_limit ?? '∞'}
                          {metrics.plan_usage.remaining.crawl_pages_remaining !== null ? ` (Remaining ${metrics.plan_usage.remaining.crawl_pages_remaining})` : ''}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.plan_usage.limits.monthly_crawl_pages_limit ? Math.min((metrics.plan_usage.used.crawl_pages_used / metrics.plan_usage.limits.monthly_crawl_pages_limit) * 100, 100) : 0}
                          sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                        />
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Documents: {metrics.plan_usage.used.documents_used} / {metrics.plan_usage.limits.monthly_document_limit ?? '∞'}
                          {metrics.plan_usage.remaining.documents_remaining !== null ? ` (Remaining ${metrics.plan_usage.remaining.documents_remaining})` : ''}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.plan_usage.limits.monthly_document_limit ? Math.min((metrics.plan_usage.used.documents_used / metrics.plan_usage.limits.monthly_document_limit) * 100, 100) : 0}
                          sx={{ height: 8, borderRadius: 2, mt: 0.5 }}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
          {/* Session & Message Trends */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ boxShadow: 2 }}>
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
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }} 
                      />
                      <Line type="monotone" dataKey="sessions" stroke="#269b9f" strokeWidth={2} />
                      <Line type="monotone" dataKey="messages" stroke="#2db3a0" strokeWidth={2} />
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
            <Card sx={{ boxShadow: 2 }}>
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
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="users" fill="#269b9f" radius={[8, 8, 0, 0]} />
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
            <Card sx={{ boxShadow: 2 }}>
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
            <Card sx={{ boxShadow: 2 }}>
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
            <Card sx={{ boxShadow: 2 }}>
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
            <Card sx={{ boxShadow: 2 }}>
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
