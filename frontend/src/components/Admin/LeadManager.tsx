import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { alpha, useTheme } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { leadService } from '../../services/leadService';
import { dashboardService } from '../../services/dashboardService';
import { Lead } from '../../types';

const LEAD_SOURCES = ['chat', 'voice', 'email', 'sms', 'whatsapp'] as const;
const FUNNEL_STAGE_OPTIONS = [
  'lead_qualification',
  'initial_contact',
  'needs_analysis',
  'proposal_quote',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

const titleCase = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const sourceLabel = (source?: string) => titleCase((source || 'chat').toLowerCase());

const stageLabel = (stage?: string | null) => {
  if (!stage || !stage.trim()) return 'Unassigned';
  return titleCase(stage.toLowerCase());
};

const readCallOutcome = (lead: Lead): string | null => {
  if (!lead.custom_fields) return null;
  try {
    const parsed = JSON.parse(lead.custom_fields);
    const candidate = parsed?.call_outcome || parsed?.outcome || parsed?.callOutcome;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  } catch {
    return null;
  }
};

const LeadManager: React.FC = () => {
  const theme = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedFunnelStage, setSelectedFunnelStage] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveStage, setMoveStage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const panelSx = {
    borderRadius: '18px',
    border: `1px solid ${alpha(theme.palette.common.white, 0.64)}`,
    background: `linear-gradient(145deg, ${alpha(theme.palette.common.white, 0.76)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82
    )} 62%, ${alpha('#dce8f8', 0.82)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
    backdropFilter: 'blur(10px)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background:
        'linear-gradient(138deg, rgba(255,255,255,0.2) 6%, transparent 26%), linear-gradient(26deg, transparent 58%, rgba(78,137,213,0.12) 59%, transparent 80%)',
    },
    '& > *': {
      position: 'relative',
      zIndex: 1,
    },
  } as const;

  const totalLeads = leads.length;
  const contactableLeads = useMemo(() => leads.filter((lead) => Boolean(lead.email || lead.phone)).length, [leads]);
  const companyLeads = useMemo(() => leads.filter((lead) => Boolean(lead.company)).length, [leads]);
  const weekLeads = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return leads.filter((lead) => new Date(lead.created_at).getTime() >= weekAgo).length;
  }, [leads]);
  const conversionRate = totalLeads ? Math.round((contactableLeads / totalLeads) * 100) : 0;

  const kpis = useMemo(
    () => [
      {
        label: 'Total Leads',
        value: totalLeads.toLocaleString(),
        hint: 'All captured lead records',
        icon: <GroupIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha('#9fcbf6', 0.64)} 0%, ${alpha('#deedff', 0.76)} 100%)`,
        wave: theme.palette.secondary.main,
      },
      {
        label: 'Total Conversion',
        value: `${conversionRate}%`,
        hint: `${contactableLeads.toLocaleString()} leads with contact info`,
        icon: <TrendingUpIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha('#a9d2fb', 0.64)} 0%, ${alpha('#e3f0ff', 0.78)} 100%)`,
        wave: '#468ed4',
      },
      {
        label: 'Leads This Week',
        value: weekLeads.toLocaleString(),
        hint: 'New leads in last 7 days',
        icon: <CalendarMonthIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha('#9cc3f3', 0.64)} 0%, ${alpha('#dce9ff', 0.76)} 100%)`,
        wave: theme.palette.primary.main,
      },
      {
        label: 'Companies Captured',
        value: companyLeads.toLocaleString(),
        hint: 'Leads that include company',
        icon: <BusinessIcon sx={{ color: theme.palette.primary.dark }} />,
        gradient: `linear-gradient(130deg, ${alpha('#a1c8f4', 0.64)} 0%, ${alpha('#dceaff', 0.76)} 100%)`,
        wave: '#4b84ce',
      },
    ],
    [
      companyLeads,
      contactableLeads,
      conversionRate,
      theme.palette.primary.dark,
      theme.palette.primary.main,
      theme.palette.secondary.main,
      totalLeads,
      weekLeads,
    ]
  );

  const loadWidgets = async () => {
    try {
      const data = await dashboardService.getWidgets();
      const widgetItems = data?.widgets || [];
      setWidgets(widgetItems.map((widget: any) => ({ widget_id: widget.widget_id, name: widget.name })));
    } catch {
      setError('Failed to load widgets');
    }
  };

  const loadLeads = async (widgetId?: string, source?: string, funnelStage?: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await leadService.listLeads(0, 100, widgetId, source, funnelStage);
      setLeads(data);
    } catch {
      setError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  useEffect(() => {
    const widgetId = selectedWidgetId === 'all' ? undefined : selectedWidgetId;
    const source = selectedSource === 'all' ? undefined : selectedSource;
    const funnelStage = selectedFunnelStage === 'all' ? undefined : selectedFunnelStage;
    loadLeads(widgetId, source, funnelStage);
  }, [selectedWidgetId, selectedSource, selectedFunnelStage]);

  const handleExport = async () => {
    try {
      const widgetId = selectedWidgetId === 'all' ? undefined : selectedWidgetId;
      const blob = await leadService.exportLeads(widgetId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export leads');
    }
  };

  const openDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const openMoveDialog = (lead: Lead) => {
    setMoveStage(lead.funnel_stage || '');
    setSelectedLead(lead);
    setMoveOpen(true);
  };

  const handleMoveLead = async () => {
    if (!selectedLead) return;
    if (!moveStage) {
      setError('Please select a funnel stage before confirming.');
      return;
    }

    try {
      setMoving(true);
      setError('');
      const updated = await leadService.moveLeadToFunnel(selectedLead.id, moveStage);
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
      setSelectedLead(updated);
      setMoveOpen(false);
      setDetailsOpen(true);
    } catch {
      setError('Failed to move lead to funnel stage');
    } finally {
      setMoving(false);
    }
  };

  const selectedWidget =
    selectedWidgetId === 'all' ? null : widgets.find((widget) => widget.widget_id === selectedWidgetId);

  return (
    <Box>
      <Paper sx={{ ...panelSx, p: 2.3, mb: 2.8 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 1.8,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', mb: 0.5 }}>
              Lead Overview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review lead quality, source channels, funnel stage, and export data for your sales workflow.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.9 }}>
              {selectedWidget
                ? `Filtered by widget: ${selectedWidget.name} (${selectedWidget.widget_id})`
                : 'Showing leads from all widgets'}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.1}
            sx={{ width: { xs: '100%', md: 'auto' }, alignItems: 'stretch' }}
          >
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <Select value={selectedWidgetId} onChange={(event: SelectChangeEvent<string>) => setSelectedWidgetId(event.target.value)}>
                <MenuItem value="all">All Widgets</MenuItem>
                {widgets.map((widget) => (
                  <MenuItem key={widget.widget_id} value={widget.widget_id}>
                    {widget.name} ({widget.widget_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select value={selectedSource} onChange={(event: SelectChangeEvent<string>) => setSelectedSource(event.target.value)}>
                <MenuItem value="all">All Sources</MenuItem>
                {LEAD_SOURCES.map((source) => (
                  <MenuItem key={source} value={source}>
                    {sourceLabel(source)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={selectedFunnelStage}
                onChange={(event: SelectChangeEvent<string>) => setSelectedFunnelStage(event.target.value)}
              >
                <MenuItem value="all">All Funnel Stages</MenuItem>
                {FUNNEL_STAGE_OPTIONS.map((stage) => (
                  <MenuItem key={stage} value={stage}>
                    {stageLabel(stage)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={leads.length === 0}
              size="large"
              sx={{
                borderRadius: '12px',
                px: 2,
                boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.22)}`,
                background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(
                  theme.palette.primary.dark,
                  0.92
                )} 100%)`,
                '&:hover': {
                  boxShadow: `0 14px 24px ${alpha(theme.palette.primary.dark, 0.28)}`,
                },
              }}
            >
              Export to CSV
            </Button>
          </Stack>
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 1.2 }} />}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '18px',
                background: kpi.gradient,
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
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
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

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2.2,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}`,
          }}
        >
          {error}
        </Alert>
      )}

      {leads.length > 0 && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {leads.slice(0, 3).map((lead) => (
            <Grid item xs={12} md={4} key={lead.id}>
              <Card
                elevation={0}
                sx={{
                  ...panelSx,
                  background: `linear-gradient(150deg, ${alpha('#f3f8ff', 0.74)} 0%, ${alpha(
                    theme.palette.background.paper,
                    0.86
                  )} 64%, ${alpha('#d7e5f8', 0.84)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.66)}`,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        sx={{
                          mr: 1.5,
                          width: 44,
                          height: 44,
                          color: 'primary.dark',
                          background: `linear-gradient(130deg, ${alpha('#d6e7ff', 0.9)} 0%, ${alpha('#b9d6fb', 0.96)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.common.white, 0.76)}`,
                        }}
                      >
                        <PersonIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {lead.name || 'Anonymous'}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={lead.company ? 'Business' : 'Individual'}
                      color={lead.company ? 'primary' : 'default'}
                      variant={lead.company ? 'filled' : 'outlined'}
                    />
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ mb: 1.2, flexWrap: 'wrap' }}>
                    <Chip size="small" label={sourceLabel(lead.source)} variant="outlined" />
                    <Chip size="small" label={stageLabel(lead.funnel_stage)} color="primary" variant="outlined" />
                  </Stack>

                  <Stack spacing={1}>
                    {lead.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {lead.email}
                        </Typography>
                      </Box>
                    )}
                    {lead.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {lead.phone}
                        </Typography>
                      </Box>
                    )}
                    {lead.company && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <BusinessIcon fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {lead.company}
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.6, display: 'block' }}>
                    Captured: {new Date(lead.created_at).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Paper sx={{ ...panelSx, p: 2.4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            All Leads
          </Typography>
          <Chip
            label={`${totalLeads.toLocaleString()} records`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  background: `linear-gradient(110deg, ${alpha('#e7f0ff', 0.8)} 0%, ${alpha('#d8e9ff', 0.68)} 100%)`,
                }}
              >
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Funnel Stage</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  hover
                  sx={{
                    '&:last-child td': { borderBottom: 0 },
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
                  }}
                >
                  <TableCell>{lead.name || '-'}</TableCell>
                  <TableCell>{lead.email || '-'}</TableCell>
                  <TableCell>{lead.phone || '-'}</TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>
                    <Chip label={sourceLabel(lead.source)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={stageLabel(lead.funnel_stage)} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{new Date(lead.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => openDetails(lead)}
                    >
                      Actions
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No leads found for the selected filters.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Lead Details</DialogTitle>
        <DialogContent dividers>
          {selectedLead && (
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: 'primary.dark' }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {selectedLead.name || 'Anonymous'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Created: {new Date(selectedLead.created_at).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2"><strong>Email:</strong> {selectedLead.email || '-'}</Typography>
              <Typography variant="body2"><strong>Phone:</strong> {selectedLead.phone || '-'}</Typography>
              <Typography variant="body2"><strong>Company:</strong> {selectedLead.company || '-'}</Typography>
              <Typography variant="body2"><strong>Source:</strong> {sourceLabel(selectedLead.source)}</Typography>
              <Typography variant="body2"><strong>Funnel Stage:</strong> {stageLabel(selectedLead.funnel_stage)}</Typography>
              <Typography variant="body2"><strong>Session ID:</strong> {selectedLead.session_id || '-'}</Typography>
              <Typography variant="body2"><strong>Widget ID:</strong> {selectedLead.widget_id || '-'}</Typography>
              <Typography variant="body2"><strong>Call Outcome:</strong> {readCallOutcome(selectedLead) || '-'}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<MoveDownIcon />}
            onClick={() => {
              if (!selectedLead) return;
              setDetailsOpen(false);
              openMoveDialog(selectedLead);
            }}
          >
            Move to Funnel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move to Sales Funnel</DialogTitle>
        <DialogContent dividers>
          {selectedLead && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedLead.name || 'Anonymous'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedLead.phone || selectedLead.email || '-'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Call Outcome: {readCallOutcome(selectedLead) || '-'}
                </Typography>
              </Paper>

              <FormControl fullWidth size="small">
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                  Select Funnel Stage
                </Typography>
                <Select value={moveStage} onChange={(event: SelectChangeEvent<string>) => setMoveStage(event.target.value)}>
                  <MenuItem value="">
                    <em>Select a stage...</em>
                  </MenuItem>
                  {FUNNEL_STAGE_OPTIONS.map((stage) => (
                    <MenuItem key={stage} value={stage}>
                      {stageLabel(stage)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Back</Button>
          <Button variant="contained" onClick={handleMoveLead} disabled={moving || !moveStage}>
            {moving ? 'Moving...' : 'Confirm & Move'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeadManager;
