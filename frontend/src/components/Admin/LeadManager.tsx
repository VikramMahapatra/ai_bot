import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { alpha, useTheme } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { leadService } from '../../services/leadService';
import { dashboardService } from '../../services/dashboardService';
import { funnelCategoryService } from '../../services/funnelCategoryService';
import { FunnelCategory, FunnelCategoryPayload, Lead } from '../../types';

const LEAD_SOURCES = ['chat', 'voice', 'email', 'sms', 'whatsapp'] as const;

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

const toStageKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '_');

const normalizeHexColor = (value?: string) => {
  const fallback = '#4e89d5';
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : fallback;
};

const LeadManager: React.FC = () => {
  const theme = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>([]);
  const [funnelCategories, setFunnelCategories] = useState<FunnelCategory[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedFunnelStage, setSelectedFunnelStage] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveStage, setMoveStage] = useState<string>('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FunnelCategory | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState<FunnelCategoryPayload>({
    name: '',
    key: '',
    color: '#4e89d5',
    position: 0,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const activeFunnelCategories = useMemo(
    () => funnelCategories.filter((item) => item.is_active).sort((a, b) => a.position - b.position),
    [funnelCategories]
  );

  const stageNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    funnelCategories.forEach((item) => map.set(item.key, item.name));
    return map;
  }, [funnelCategories]);

  const displayStageLabel = (stage?: string | null) => {
    if (!stage || !stage.trim()) return 'Unassigned';
    return stageNameByKey.get(stage) || stageLabel(stage);
  };

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

  const loadFunnelCategories = async () => {
    try {
      const data = await funnelCategoryService.list(true);
      setFunnelCategories(data);
    } catch {
      setError('Failed to load funnel categories');
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
    loadFunnelCategories();
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

  const openCreateCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', key: '', color: '#4e89d5', position: funnelCategories.length + 1, is_active: true });
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: FunnelCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      key: category.key,
      color: category.color,
      position: category.position,
      is_active: category.is_active,
    });
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      setError('Category name is required.');
      return;
    }

    const payload: FunnelCategoryPayload = {
      ...categoryForm,
      name: categoryForm.name.trim(),
      key: toStageKey(categoryForm.key || categoryForm.name),
      color: normalizeHexColor(categoryForm.color),
      position: Number(categoryForm.position) || 0,
    };

    try {
      setCategorySaving(true);
      setError('');
      setSuccess('');
      if (editingCategory) {
        await funnelCategoryService.update(editingCategory.id, payload);
        setSuccess('Funnel category updated.');
      } else {
        await funnelCategoryService.create(payload);
        setSuccess('Funnel category created.');
      }
      setCategoryDialogOpen(false);
      await loadFunnelCategories();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to save funnel category');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (category: FunnelCategory) => {
    try {
      setError('');
      setSuccess('');
      await funnelCategoryService.remove(category.id);
      setSuccess('Funnel category deleted.');
      await loadFunnelCategories();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to delete funnel category');
    }
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
      setSuccess('');
      const updated = await leadService.moveLeadToFunnel(selectedLead.id, moveStage);
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
      setSelectedLead(updated);
      setMoveOpen(false);
      setDetailsOpen(true);
      setSuccess(`Lead moved to ${displayStageLabel(updated.funnel_stage)} successfully.`);
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

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedFunnelStage}
                onChange={(event: SelectChangeEvent<string>) => setSelectedFunnelStage(event.target.value)}
              >
                <MenuItem value="all">All Funnel Stages</MenuItem>
                {activeFunnelCategories.map((stage) => (
                  <MenuItem key={stage.key} value={stage.key}>
                    {stage.name}
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

      {success && (
        <Alert
          severity="success"
          sx={{
            mb: 2.2,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.success.main, 0.24)}`,
            boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}`,
          }}
        >
          {success}
        </Alert>
      )}

      <Paper sx={{ ...panelSx, p: 2.4, mb: 2.6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Funnel Category Master
          </Typography>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreateCategoryDialog}>
            Add Category
          </Button>
        </Box>

        <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}` }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Key</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Position</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Color</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {funnelCategories.map((category) => (
                <TableRow key={category.id} hover>
                  <TableCell>{category.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{category.key}</TableCell>
                  <TableCell>{category.position}</TableCell>
                  <TableCell>
                    <Chip label={category.color} size="small" sx={{ bgcolor: alpha(category.color, 0.15), color: category.color }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={category.is_active ? 'Active' : 'Inactive'} size="small" color={category.is_active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditCategoryDialog(category)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDeleteCategory(category)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {funnelCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No funnel categories found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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
                    <Chip size="small" label={displayStageLabel(lead.funnel_stage)} color="primary" variant="outlined" />
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
            </Paper>
          </Grid>
        ))}
      </Grid>

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
                    <Chip label={displayStageLabel(lead.funnel_stage)} size="small" color="primary" variant="outlined" />
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
              <Typography variant="body2"><strong>Funnel Stage:</strong> {displayStageLabel(selectedLead.funnel_stage)}</Typography>
              <Typography variant="body2"><strong>Session ID:</strong> {selectedLead.session_id || '-'}</Typography>
              <Typography variant="body2"><strong>Widget ID:</strong> {selectedLead.widget_id || '-'}</Typography>
              <Typography variant="body2"><strong>Lead outcome:</strong> {selectedLead.lead_outcome || '-'}</Typography>
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
                  Lead outcome: {selectedLead.lead_outcome || '-'}
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
                  {activeFunnelCategories.map((stage) => (
                    <MenuItem key={stage.key} value={stage.key}>
                      {stage.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Back</Button>
          <Button
            variant="contained"
            onClick={handleMoveLead}
            disabled={moving || !moveStage}
            startIcon={moving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {moving ? 'Saving...' : 'Confirm & Move'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Update Funnel Category' : 'Add Funnel Category'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Category Name"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Stage Key"
              helperText="Used internally, lowercase with underscores"
              value={categoryForm.key}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, key: toStageKey(event.target.value) }))}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Color Code"
                value={categoryForm.color}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                helperText="HEX value (example: #4e89d5)"
                size="small"
                fullWidth
              />
              <TextField
                label="Pick"
                type="color"
                value={normalizeHexColor(categoryForm.color)}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                size="small"
                sx={{ width: 88 }}
                inputProps={{
                  'aria-label': 'Pick category color',
                }}
              />
              <TextField
                label="Position"
                type="number"
                value={categoryForm.position}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, position: Number(event.target.value || 0) }))}
                size="small"
                sx={{ width: 140 }}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={categoryForm.is_active}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            disabled={categorySaving}
            startIcon={categorySaving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {categorySaving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeadManager;
