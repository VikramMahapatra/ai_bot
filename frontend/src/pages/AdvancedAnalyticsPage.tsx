import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, CircularProgress, Alert, Chip, Divider, Tabs, Tab, Skeleton } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import PieChartIcon from '@mui/icons-material/PieChart';
import TagIcon from '@mui/icons-material/Tag';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import RepeatIcon from '@mui/icons-material/Repeat';
import GppGoodIcon from '@mui/icons-material/GppGood';
import UpdateIcon from '@mui/icons-material/Update';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SearchIcon from '@mui/icons-material/Search';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import PaidIcon from '@mui/icons-material/Paid';
import SpeedIcon from '@mui/icons-material/Speed';
import TimelineIcon from '@mui/icons-material/Timeline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WidgetsIcon from '@mui/icons-material/Widgets';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import AdminLayout from '../components/Layout/AdminLayout';
import { analyticsService } from '../services/analyticsService';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const AdvancedAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [loadingQuoteIndex, setLoadingQuoteIndex] = useState(0);
  const [showLoadingQuotes, setShowLoadingQuotes] = useState(true);

  useEffect(() => {
    let isActive = true;
    const fetchAdvanced = async () => {
      try {
        setLoading(true);
        setError(null);
        const advancedRes = await analyticsService.getAdvancedAnalytics(30, 50);
        if (isActive) setAdvanced(advancedRes);
      } catch (err) {
        console.error('Error fetching advanced analytics:', err);
        if (isActive) setError('Failed to load advanced analytics');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchAdvanced();
    return () => {
      isActive = false;
    };
  }, []);

  const loadingQuotes = useMemo(
    () => [
      'Mapping signals into insights…',
      'Tuning the signal-to-noise ratio…',
      'Distilling patterns from conversations…',
      'Aligning metrics with momentum…',
      'Surfacing trends you can act on…',
      'Connecting intent to outcomes…',
    ],
    []
  );

  const loadingQuoteColors = useMemo(
    () => [
      '#0f172a',
      '#1e293b',
      '#334155',
      '#0b3b54',
      '#1f2937',
      '#0f2e47',
    ],
    []
  );

  useEffect(() => {
    if (!loading) return undefined;
    const id = window.setInterval(() => {
      setLoadingQuoteIndex((prev) => (prev + 1) % loadingQuotes.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [loading, loadingQuotes.length]);

  useEffect(() => {
    if (loading) {
      setShowLoadingQuotes(true);
      return undefined;
    }
    const id = window.setTimeout(() => setShowLoadingQuotes(false), 1800);
    return () => window.clearTimeout(id);
  }, [loading]);



  const safeAdvanced = advanced || {
    funnel: { sessions: 0, leads: 0, conversion_rate: 0 },
    retrieval_quality: { hit_rate: 0, empty_context_rate: 0, avg_sources_per_query: 0 },
    answer_quality: { thumbs_up_rate: 0, feedback_count: 0, average_rating: null },
    source_attribution: [],
    intent_keywords: [],
    widget_performance: [],
    forecast: null,
    message_stats: { user_messages: 0, assistant_messages: 0, avg_messages_per_session: 0, avg_response_length: 0 },
    cost: { total_tokens: 0, average_tokens_per_conversation: 0, cost_estimate: null },
    latency: { p50: null, p95: null },
    top_unanswered: [],
    knowledge_gaps: [],
    alerts: [],
    ml_predictions: {
      lead_conversion_by_widget: [],
      demand_forecast: { sessions_forecast: [], messages_forecast: [] },
      lead_forecast: { leads_forecast: [] },
      token_forecast_band: { mean_daily_tokens: 0, std_daily_tokens: 0, lower: 0, upper: 0 },
      escalation_rate_forecast: { current_rate: 0, daily_rate_forecast: [] },
      response_time_forecast: [],
      csat_forecast: [],
      predicted_intents: [],
      peak_hour_prediction: { hour: null, share: 0 },
    },
    retention: { cohort_size: 0, d1_rate: 0, d7_rate: 0, d30_rate: 0 },
    escalation: { overall_rate: 0, by_widget: [] },
    topic_drift: { new_topics: [], recurring_topics: [], new_topic_rate: 0 },
    knowledge_coverage: { answered: 0, unanswered: 0, coverage_rate: 0 },
    source_freshness: { '0-7d': 0, '8-30d': 0, '31-90d': 0, '90d+': 0 },
  };

  const radarData = useMemo(() => ([
    { metric: 'Hit Rate', value: safeAdvanced.retrieval_quality.hit_rate },
    { metric: 'Thumbs Up', value: safeAdvanced.answer_quality.thumbs_up_rate },
    { metric: 'Conversion', value: safeAdvanced.funnel.conversion_rate },
    { metric: 'Empty Context', value: Math.max(0, 100 - safeAdvanced.retrieval_quality.empty_context_rate) },
  ]), [safeAdvanced]);

  const sourcePie = useMemo(() => (
    safeAdvanced.source_attribution.map((item: any) => ({
      name: item.source_name,
      value: item.count,
    }))
  ), [safeAdvanced]);

  const intentBar = useMemo(() => (
    safeAdvanced.intent_keywords.slice(0, 8).map((item: any) => ({
      keyword: item.keyword,
      count: item.count,
    }))
  ), [safeAdvanced]);

  const widgetScatter = useMemo(() => (
    safeAdvanced.widget_performance.map((item: any) => ({
      widget: item.widget_id,
      messages: item.messages,
      leads: item.leads,
    }))
  ), [safeAdvanced]);

  const forecastArea = useMemo(() => ([
    { name: 'Used', value: safeAdvanced.forecast?.tokens_used || 0 },
    { name: 'Remaining', value: safeAdvanced.forecast?.tokens_remaining || 0 },
  ]), [safeAdvanced]);

  const predictionSessions = useMemo(() => (
    safeAdvanced.ml_predictions.demand_forecast.sessions_forecast.map((v: number, i: number) => ({
      day: `D+${i + 1}`,
      sessions: v,
    }))
  ), [safeAdvanced]);

  const predictionMessages = useMemo(() => (
    safeAdvanced.ml_predictions.demand_forecast.messages_forecast.map((v: number, i: number) => ({
      day: `D+${i + 1}`,
      messages: v,
    }))
  ), [safeAdvanced]);

  const predictionLeads = useMemo(() => (
    safeAdvanced.ml_predictions.lead_forecast.leads_forecast.map((v: number, i: number) => ({
      day: `D+${i + 1}`,
      leads: v,
    }))
  ), [safeAdvanced]);

  const conversionPrediction = useMemo(() => (
    safeAdvanced.ml_predictions.lead_conversion_by_widget.map((item: any) => ({
      widget: item.widget_id,
      rate: item.predicted_conversion_rate,
    }))
  ), [safeAdvanced]);

  const escalationRatePrediction = useMemo(() => (
    safeAdvanced.ml_predictions.escalation_rate_forecast.daily_rate_forecast.map((v: number, i: number) => ({
      day: `D+${i + 1}`,
      rate: v,
    }))
  ), [safeAdvanced]);

  const responseTimePrediction = useMemo(() => (
    safeAdvanced.ml_predictions.response_time_forecast.map((v: number, i: number) => ({
      day: `D+${i + 1}`,
      time: v,
    }))
  ), [safeAdvanced]);

  const csatPrediction = useMemo(() => (
    safeAdvanced.ml_predictions.csat_forecast.map((v: number, i: number) => ({
      day: `D+${i + 1}`,
      csat: v,
    }))
  ), [safeAdvanced]);

  const retentionData = useMemo(() => ([
    { label: 'D+1', value: safeAdvanced.retention.d1_rate },
    { label: 'D+7', value: safeAdvanced.retention.d7_rate },
    { label: 'D+30', value: safeAdvanced.retention.d30_rate },
  ]), [safeAdvanced]);

  const coveragePie = useMemo(() => ([
    { name: 'Answered', value: safeAdvanced.knowledge_coverage.answered },
    { name: 'Unanswered', value: safeAdvanced.knowledge_coverage.unanswered },
  ]), [safeAdvanced]);

  const freshnessBar = useMemo(() => ([
    { bucket: '0-7d', value: safeAdvanced.source_freshness['0-7d'] },
    { bucket: '8-30d', value: safeAdvanced.source_freshness['8-30d'] },
    { bucket: '31-90d', value: safeAdvanced.source_freshness['31-90d'] },
    { bucket: '90d+', value: safeAdvanced.source_freshness['90d+'] },
  ]), [safeAdvanced]);

  const cardSx = {
    boxShadow: 2,
    borderRadius: 3,
    background: 'linear-gradient(135deg, rgba(236,254,255,0.9) 0%, rgba(248,250,252,0.9) 60%, rgba(224,231,255,0.9) 100%)',
    border: '1px solid rgba(148,163,184,0.25)',
  } as const;
  const chartCardSx = {
    boxShadow: 2,
    borderRadius: 3,
    background: 'linear-gradient(135deg, rgba(240,253,250,0.9) 0%, rgba(239,246,255,0.9) 100%)',
    border: '1px solid rgba(148,163,184,0.25)',
  } as const;
  const titleSx = { mb: 0, fontWeight: 700, color: '#0f172a' } as const;
  const chartTitleSx = { mb: 0, fontWeight: 700, color: '#0f172a' } as const;

  if (error) {
    return (
      <AdminLayout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            Advanced Analytics
          </Typography>
        </Box>
        <Alert severity="error">{error}</Alert>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              mb: 4,
              p: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(38,155,159,0.16) 0%, rgba(45,179,160,0.12) 40%, rgba(99,102,241,0.12) 100%)',
              border: '1px solid rgba(148,163,184,0.25)',
              boxShadow: '0 20px 40px rgba(15,23,42,0.08)',
            }}
          >
            <Skeleton variant="text" width={260} height={40} />
            <Skeleton variant="text" width={420} height={24} />
            <Box
              sx={{
                mt: 1.5,
                width: '100vw',
                overflow: 'hidden',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                top: 16,
                pointerEvents: 'none',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: loadingQuoteColors[loadingQuoteIndex % loadingQuoteColors.length],
                  fontStyle: 'italic',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 2,
                  py: 0.75,
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.25) 0%, rgba(14,165,233,0.25) 50%, rgba(99,102,241,0.25) 100%)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  boxShadow: '0 12px 24px rgba(15,23,42,0.14)',
                  whiteSpace: 'nowrap',
                  animation: 'quoteMarquee 10s ease-in-out infinite alternate',
                  '@keyframes quoteMarquee': {
                    '0%': { transform: 'translateX(0)', opacity: 0.9 },
                    '100%': { transform: 'translateX(calc(100vw - 360px))', opacity: 1 },
                  },
                }}
              >
                “{loadingQuotes[loadingQuoteIndex]}”
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3} sx={{ mb: 2 }}>
            {[1, 2].map((item) => (
              <Grid item xs={12} md={item === 1 ? 7 : 5} key={`chart-skel-${item}`}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <Skeleton variant="text" width={200} height={28} />
                    <Skeleton variant="rectangular" height={220} sx={{ mt: 2, borderRadius: 2 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Grid item xs={12} md={6} lg={4} key={`card-skel-${item}`}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Skeleton variant="text" width={160} height={26} />
                    <Skeleton variant="text" width={240} height={18} />
                    <Skeleton variant="text" width={200} height={18} />
                    <Skeleton variant="text" width={140} height={18} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, color: '#64748b' }}>
            <CircularProgress size={18} sx={{ mr: 1 }} />
            <Typography variant="body2">Crunching advanced insights…</Typography>
          </Box>
        </Box>
      </AdminLayout>
    );
  }

  if (!advanced) {
    return null;
  }

  const palette = ['#22c55e', '#06b6d4', '#a855f7', '#f97316', '#facc15', '#38bdf8'];

  const CardHeader = ({
    icon,
    title,
    subtitle,
    compact = false,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    compact?: boolean;
  }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: compact ? 1.25 : 1.5 }}>
      <Box
        sx={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(45,179,160,0.25) 0%, rgba(99,102,241,0.25) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0f172a',
          boxShadow: '0 8px 18px rgba(15,23,42,0.12)'
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" sx={compact ? chartTitleSx : titleSx}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <AdminLayout>
      <Box>
        <Box
          sx={{
            mb: 4,
            p: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(38,155,159,0.16) 0%, rgba(45,179,160,0.12) 40%, rgba(99,102,241,0.12) 100%)',
            border: '1px solid rgba(148,163,184,0.25)',
            boxShadow: '0 20px 40px rgba(15,23,42,0.08)',
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
            Advanced Analytics
          </Typography>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            A deep view of performance, quality, costs, and knowledge gaps.
          </Typography>
          {showLoadingQuotes && (
            <Typography
              variant="body2"
              sx={{
                mt: 1.5,
                color: '#475569',
                fontStyle: 'italic',
              }}
            >
              “{loadingQuotes[loadingQuoteIndex]}”
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 3, borderColor: 'rgba(148,163,184,0.25)' }} />

        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 3 }}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="Overview" />
          <Tab label="Predictions" />
        </Tabs>

        {tab === 0 && (
          <>

        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={12} md={7}>
            <Card sx={{ ...chartCardSx, height: '100%' }}>
              <CardContent>
                <CardHeader
                  icon={<InsightsIcon fontSize="small" />}
                  title="Performance Radar"
                  subtitle="A quick health snapshot of quality and conversions."
                  compact
                />
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar dataKey="value" stroke="#269b9f" fill="#269b9f" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Card sx={{ ...chartCardSx, height: '100%' }}>
              <CardContent>
                <CardHeader
                  icon={<PieChartIcon fontSize="small" />}
                  title="Source Mix"
                  subtitle="Which knowledge sources power answers the most."
                  compact
                />
                {sourcePie.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie dataKey="value" data={sourcePie} innerRadius={60} outerRadius={100} paddingAngle={3}>
                        {sourcePie.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No attribution data</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={12} md={7}>
            <Card sx={chartCardSx}>
              <CardContent>
                <CardHeader
                  icon={<TagIcon fontSize="small" />}
                  title="Intent Keywords"
                  subtitle="Top topics users are asking about."
                  compact
                />
                {intentBar.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={intentBar}>
                      <XAxis dataKey="keyword" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2db3a0" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No keywords</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Card sx={chartCardSx}>
              <CardContent>
                <CardHeader
                  icon={<LocalFireDepartmentIcon fontSize="small" />}
                  title="Token Burn"
                  subtitle="How your token budget is being consumed."
                  compact
                />
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={forecastArea}>
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#a5b4fc" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={12} md={4}>
            <Card sx={chartCardSx}>
              <CardContent>
                <CardHeader
                  icon={<RepeatIcon fontSize="small" />}
                  title="Retention Curve"
                  subtitle="Percent of users who return after first chat."
                  compact
                />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={retentionData}>
                    <XAxis dataKey="label" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={chartCardSx}>
              <CardContent>
                <CardHeader
                  icon={<GppGoodIcon fontSize="small" />}
                  title="Knowledge Coverage"
                  subtitle="Answered vs unanswered questions."
                  compact
                />
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie dataKey="value" data={coveragePie} innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {coveragePie.map((_: any, index: number) => (
                        <Cell key={`cell-coverage-${index}`} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={chartCardSx}>
              <CardContent>
                <CardHeader
                  icon={<UpdateIcon fontSize="small" />}
                  title="Source Freshness"
                  subtitle="Answers by how fresh your sources are."
                  compact
                />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={freshnessBar}>
                    <XAxis dataKey="bucket" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#a855f7" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={12}>
            <Card sx={chartCardSx}>
              <CardContent>
                <CardHeader
                  icon={<ScatterPlotIcon fontSize="small" />}
                  title="Widget Performance Scatter"
                  subtitle="Compare messages vs leads by widget."
                  compact
                />
                {widgetScatter.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart>
                      <XAxis type="number" dataKey="messages" name="Messages" stroke="#64748b" />
                      <YAxis type="number" dataKey="leads" name="Leads" stroke="#64748b" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={widgetScatter} fill="#38bdf8" />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No widget data</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<FilterAltIcon fontSize="small" />}
                  title="Funnel"
                  subtitle="How chats turn into leads."
                />
                <Typography variant="body2" color="text.secondary">
                  Sessions: {safeAdvanced.funnel.sessions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Leads: {safeAdvanced.funnel.leads}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Conversion: {safeAdvanced.funnel.conversion_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<ChatBubbleOutlineIcon fontSize="small" />}
                  title="Message Stats"
                  subtitle="How much users and the bot are talking."
                />
                <Typography variant="body2" color="text.secondary">
                  User messages: {safeAdvanced.message_stats.user_messages}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assistant messages: {safeAdvanced.message_stats.assistant_messages}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg messages/session: {safeAdvanced.message_stats.avg_messages_per_session}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg response length: {safeAdvanced.message_stats.avg_response_length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<SearchIcon fontSize="small" />}
                  title="Retrieval Quality"
                  subtitle="How often the bot finds relevant knowledge."
                />
                <Typography variant="body2" color="text.secondary">
                  Hit rate: {safeAdvanced.retrieval_quality.hit_rate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Empty context: {safeAdvanced.retrieval_quality.empty_context_rate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg sources/query: {safeAdvanced.retrieval_quality.avg_sources_per_query}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<ThumbUpAltIcon fontSize="small" />}
                  title="Answer Quality"
                  subtitle="User feedback on answer helpfulness."
                />
                <Typography variant="body2" color="text.secondary">
                  Feedback: {safeAdvanced.answer_quality.feedback_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg rating: {safeAdvanced.answer_quality.average_rating ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Thumbs up rate: {safeAdvanced.answer_quality.thumbs_up_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<PaidIcon fontSize="small" />}
                  title="Cost Analytics"
                  subtitle="Token usage translated to cost."
                />
                <Typography variant="body2" color="text.secondary">
                  Total tokens: {safeAdvanced.cost.total_tokens.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg tokens/convo: {safeAdvanced.cost.average_tokens_per_conversation}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Est. cost: {safeAdvanced.cost.cost_estimate ?? '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<SpeedIcon fontSize="small" />}
                  title="Latency Percentiles"
                  subtitle="Typical vs worst‑case response time."
                />
                <Typography variant="body2" color="text.secondary">
                  P50: {safeAdvanced.latency.p50 ?? '—'}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  P95: {safeAdvanced.latency.p95 ?? '—'}s
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<TimelineIcon fontSize="small" />}
                  title="Token Forecast"
                  subtitle="How long your token budget may last."
                />
                {safeAdvanced.forecast ? (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Remaining: {safeAdvanced.forecast.tokens_remaining?.toLocaleString() ?? '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg/day: {safeAdvanced.forecast.avg_daily_tokens.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Days to exhaust: {safeAdvanced.forecast.days_to_exhaust ?? '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Est. date: {safeAdvanced.forecast.estimated_exhaust_date ?? '—'}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">No token limit</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<AccountTreeIcon fontSize="small" />}
                  title="Source Attribution"
                  subtitle="Which sources answer the most questions."
                />
                {safeAdvanced.source_attribution.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {safeAdvanced.source_attribution.map((item: any) => (
                      <Typography key={item.source_id} variant="body2" color="text.secondary">
                        {item.source_name}: {item.count}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No attribution data</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<RepeatIcon fontSize="small" />}
                  title="Retention"
                  subtitle="How many users return after their first chat."
                />
                <Typography variant="body2" color="text.secondary">
                  D+1: {safeAdvanced.retention.d1_rate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  D+7: {safeAdvanced.retention.d7_rate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  D+30: {safeAdvanced.retention.d30_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<SupportAgentIcon fontSize="small" />}
                  title="Escalation Rate"
                  subtitle="How often chats turn into leads."
                />
                <Typography variant="body2" color="text.secondary">
                  Overall: {safeAdvanced.escalation.overall_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<GppGoodIcon fontSize="small" />}
                  title="Knowledge Coverage"
                  subtitle="How often the bot can answer from your data."
                />
                <Typography variant="body2" color="text.secondary">
                  Coverage: {safeAdvanced.knowledge_coverage.coverage_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<SsidChartIcon fontSize="small" />}
                  title="Topic Drift"
                  subtitle="How much user interest is shifting week to week."
                />
                <Typography variant="body2" color="text.secondary">
                  New topic rate: {safeAdvanced.topic_drift.new_topic_rate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<WidgetsIcon fontSize="small" />}
                  title="Widget Performance"
                  subtitle="Messages and leads by widget."
                />
                {safeAdvanced.widget_performance.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {safeAdvanced.widget_performance.map((item: any) => (
                      <Typography key={item.widget_id} variant="body2" color="text.secondary">
                        {item.widget_id}: {item.messages} messages • {item.leads} leads
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No widget data</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<TagIcon fontSize="small" />}
                  title="Intent Keywords"
                  subtitle="Common topics users are exploring."
                />
                {safeAdvanced.intent_keywords.length ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {safeAdvanced.intent_keywords.map((item: any) => (
                      <Chip key={item.keyword} label={`${item.keyword} (${item.count})`} size="small" />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No keywords</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<AutoGraphIcon fontSize="small" />}
                  title="Topic Highlights"
                  subtitle="New vs recurring topics from the last week."
                />
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>New topics</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                    {safeAdvanced.topic_drift.new_topics.length ? (
                      safeAdvanced.topic_drift.new_topics.map((topic: string) => (
                        <Chip key={`new-${topic}`} label={topic} size="small" color="secondary" />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">None</Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Recurring topics</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                    {safeAdvanced.topic_drift.recurring_topics.length ? (
                      safeAdvanced.topic_drift.recurring_topics.map((topic: string) => (
                        <Chip key={`rec-${topic}`} label={topic} size="small" />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">None</Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <CardHeader
                  icon={<HelpOutlineIcon fontSize="small" />}
                  title="Top Unanswered Questions"
                  subtitle="Questions where the bot lacked context."
                />
                {safeAdvanced.top_unanswered.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {safeAdvanced.top_unanswered.map((item: any, index: number) => (
                      <Box key={`${item.created_at}-${index}`}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.question}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No unanswered questions</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
          </>
        )}

        {tab === 1 && (
          <>
        {safeAdvanced.alerts.length > 0 && (
          <Grid container spacing={3} sx={{ mb: 1 }}>
            {safeAdvanced.alerts.map((alert: any, index: number) => (
              <Grid item xs={12} md={4} key={`alert-${index}`}>
                <Card sx={cardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<GppGoodIcon fontSize="small" />}
                      title={alert.title}
                      subtitle={alert.severity.toUpperCase()}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {alert.message}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip label={`Current: ${alert.current}`} size="small" />
                      <Chip label={`Prev: ${alert.previous}`} size="small" variant="outlined" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

            <Grid container spacing={3} sx={{ mb: 1 }}>
              <Grid item xs={12} md={7}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<TimelineIcon fontSize="small" />}
                      title="Demand Forecast (Sessions)"
                      subtitle="Predicted number of sessions for the next 14 days."
                      compact
                    />
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={predictionSessions}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip />
                        <Line type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<ChatBubbleOutlineIcon fontSize="small" />}
                      title="Demand Forecast (Messages)"
                      subtitle="Predicted message volume for the next 14 days."
                      compact
                    />
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={predictionMessages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip />
                        <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mb: 1 }}>
              <Grid item xs={12} md={7}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<AutoGraphIcon fontSize="small" />}
                      title="Lead Forecast"
                      subtitle="Predicted lead volume for the next 14 days."
                      compact
                    />
                    {predictionLeads.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={predictionLeads}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip />
                          <Line type="monotone" dataKey="leads" stroke="#f97316" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No lead forecast data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<RepeatIcon fontSize="small" />}
                      title="Escalation Rate Forecast"
                      subtitle="Projected escalation rate over the next week."
                      compact
                    />
                    {escalationRatePrediction.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={escalationRatePrediction}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip />
                          <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No escalation forecast data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mb: 1 }}>
              <Grid item xs={12} md={7}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<SpeedIcon fontSize="small" />}
                      title="Response Time Forecast"
                      subtitle="Predicted average response time for the next week."
                      compact
                    />
                    {responseTimePrediction.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={responseTimePrediction}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip />
                          <Line type="monotone" dataKey="time" stroke="#06b6d4" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No response time forecast data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<ThumbUpAltIcon fontSize="small" />}
                      title="CSAT Forecast"
                      subtitle="Predicted average rating for the next week."
                      compact
                    />
                    {csatPrediction.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={csatPrediction}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip />
                          <Line type="monotone" dataKey="csat" stroke="#22c55e" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No CSAT forecast data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Card sx={chartCardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<AutoGraphIcon fontSize="small" />}
                      title="Lead Conversion Prediction (by Widget)"
                      subtitle="Estimated chance that a chat becomes a lead."
                      compact
                    />
                    {conversionPrediction.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={conversionPrediction}>
                          <XAxis dataKey="widget" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip />
                          <Bar dataKey="rate" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No prediction data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={cardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<LocalFireDepartmentIcon fontSize="small" />}
                      title="Token Forecast Band"
                      subtitle="Expected daily usage range based on recent activity."
                    />
                    <Typography variant="body2" color="text.secondary">
                      Mean daily tokens: {safeAdvanced.ml_predictions.token_forecast_band.mean_daily_tokens}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Std dev: {safeAdvanced.ml_predictions.token_forecast_band.std_daily_tokens}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Lower band: {safeAdvanced.ml_predictions.token_forecast_band.lower}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Upper band: {safeAdvanced.ml_predictions.token_forecast_band.upper}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<SearchIcon fontSize="small" />}
                      title="Predicted Top Intents"
                      subtitle="Likely trending questions in the next week."
                    />
                    {safeAdvanced.ml_predictions.predicted_intents.length ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {safeAdvanced.ml_predictions.predicted_intents.map((item: any) => (
                          <Chip key={`pred-${item.keyword}`} label={`${item.keyword} (${item.count})`} size="small" />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No intent forecast data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <CardHeader
                      icon={<SsidChartIcon fontSize="small" />}
                      title="Peak Hour Prediction"
                      subtitle="Best hour to staff for live support."
                    />
                    {safeAdvanced.ml_predictions.peak_hour_prediction.hour ? (
                      <>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {safeAdvanced.ml_predictions.peak_hour_prediction.hour}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Share of traffic: {safeAdvanced.ml_predictions.peak_hour_prediction.share}%
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No peak hour data</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Box>
    </AdminLayout>
  );
};

export default AdvancedAnalyticsPage;
