import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Stack,
  Typography,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/Layout/AdminLayout';
import api from '../services/api';
import { buildPublicUrl } from '../config/env';

interface WidgetConfig {
  id?: number;
  widget_id: string;
  name: string;
  welcome_message?: string;
  system_prompt?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  position: string;
  lead_capture_enabled: boolean;
  lead_fields?: string;
  escalation_contact_level_1?: string;
  escalation_contact_level_2?: string;
  user_id?: number;
  organization_id?: number;
  created_at?: string;
}

interface WhatsAppConfigSummary {
  configured: boolean;
  widget_id?: string;
  phone_number_id?: string;
  waba_id?: string | null;
  is_active?: boolean;
}

type DialogMode = 'view' | null;

const normalizeWidget = (widget: Partial<WidgetConfig>): WidgetConfig => ({
  id: widget.id,
  widget_id: typeof widget.widget_id === 'string' ? widget.widget_id : '',
  name: typeof widget.name === 'string' && widget.name.trim() ? widget.name : 'Untitled Widget',
  welcome_message: typeof widget.welcome_message === 'string' ? widget.welcome_message : 'Hi! How can I help you?',
  system_prompt: typeof widget.system_prompt === 'string' ? widget.system_prompt : '',
  logo_url: typeof widget.logo_url === 'string' ? widget.logo_url : '',
  primary_color: typeof widget.primary_color === 'string' ? widget.primary_color : '#007bff',
  secondary_color: typeof widget.secondary_color === 'string' ? widget.secondary_color : '#6c757d',
  position: typeof widget.position === 'string' ? widget.position : 'bottom-right',
  lead_capture_enabled: Boolean(widget.lead_capture_enabled),
  lead_fields: typeof widget.lead_fields === 'string' ? widget.lead_fields : '',
  escalation_contact_level_1: typeof widget.escalation_contact_level_1 === 'string' ? widget.escalation_contact_level_1 : '',
  escalation_contact_level_2: typeof widget.escalation_contact_level_2 === 'string' ? widget.escalation_contact_level_2 : '',
  user_id: widget.user_id,
  organization_id: widget.organization_id,
  created_at: typeof widget.created_at === 'string' ? widget.created_at : undefined,
});

const managementSteps = ['Agent Profile', 'Knowledge Base', 'Integrations', 'Share & Embed'];

const WidgetManagementPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogStep, setDialogStep] = useState(0);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfigSummary>({ configured: false });
  const [formData, setFormData] = useState<WidgetConfig>({
    widget_id: '',
    name: '',
    welcome_message: 'Hi! How can I help you?',
    system_prompt: '',
    logo_url: '',
    primary_color: '#2f6bff',
    secondary_color: '#36c4ff',
    position: 'bottom-right',
    lead_capture_enabled: true,
    lead_fields: '',
    escalation_contact_level_1: 'Support Team: support@example.com | +1-555-0101',
    escalation_contact_level_2: 'Escalation Manager: escalation@example.com | +1-555-0102',
  });

  // Fetch widgets on mount
  useEffect(() => {
    fetchWidgets();
  }, []);

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const [widgetsRes, whatsappRes] = await Promise.all([
        api.get('/api/admin/widgets'),
        api.get('/api/admin/whatsapp/config').catch(() => ({ data: { configured: false } })),
      ]);

      const widgetList = Array.isArray(widgetsRes.data)
        ? widgetsRes.data.map((widget: Partial<WidgetConfig>) => normalizeWidget(widget))
        : [];

      setWidgets(widgetList);
      setWhatsappConfig(whatsappRes.data || { configured: false });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch widgets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    navigate('/create-chat-agent');
  };

  const handleOpenEdit = (widget: WidgetConfig) => {
    const widgetId = widget.widget_id?.trim();
    if (!widgetId) {
      setError('Widget ID is missing. Cannot edit this agent.');
      return;
    }
    navigate(`/widgets/edit/${encodeURIComponent(widgetId)}`);
  };

  const handleOpenView = (widget: WidgetConfig) => {
    setFormData(widget);
    setDialogStep(0);
    setDialogMode('view');
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setDialogStep(0);
  };

  const handleDelete = async (widgetId: string) => {
    if (!window.confirm('Are you sure you want to delete this widget?')) return;

    try {
      await api.delete(`/api/admin/widget/config/${widgetId}`);
      setSuccess('Widget deleted successfully');
      setError('');
      fetchWidgets();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete widget');
    }
  };

  const handleCopyEmbedCode = (widgetId: string) => {
    const embedCode = `<!-- AI Chatbot Widget -->
<link rel="stylesheet" href="https://your-domain.com/widget/dist/chatbot-widget.css" />
<script>
  window.AIChatbot = {
    widgetId: '${widgetId}',
    apiUrl: 'https://your-api-domain.com',
    name: 'AI Assistant',
    welcomeMessage: 'Hi! How can I help you today?',
    primaryColor: '#007bff',
    position: 'bottom-right'
  };
</script>
<script src="https://your-domain.com/widget/dist/chatbot-widget.iife.js"><\/script>`;
    navigator.clipboard.writeText(embedCode);
    setSuccess('Embed code copied to clipboard');
  };

  const getAgentTestUrl = (widgetId: string) => buildPublicUrl(`/agent-test/${encodeURIComponent(widgetId)}`);

  const handleCopyTestUrl = async (widgetId: string) => {
    if (!widgetId) return;
    try {
      await navigator.clipboard.writeText(getAgentTestUrl(widgetId));
      setSuccess('Agent test URL copied to clipboard');
      setError('');
    } catch {
      setError('Failed to copy agent test URL');
    }
  };

  const dialogLastStep = managementSteps.length - 1;
  const whatsappConnectedForAgent = Boolean(
    whatsappConfig.configured
      && whatsappConfig.widget_id
      && formData.widget_id
      && whatsappConfig.widget_id === formData.widget_id
      && whatsappConfig.is_active !== false
  );

  const dialogStepDescriptions = useMemo(
    () => [
      'Review and refine identity, messaging, and visual style.',
      'Manage website/docs/text sources for grounded responses.',
      'Verify channel connectivity and operational readiness.',
      'Copy test URL and embed code for rollout and QA.',
    ],
    []
  );

  const dialogProgress = useMemo(
    () => ((dialogStep + 1) / managementSteps.length) * 100,
    [dialogStep]
  );

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: alpha(theme.palette.common.white, 0.74),
    },
  } as const;

  const dialogPanelSx = {
    borderRadius: '18px',
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82
    )} 68%, ${alpha('#dce8f8', 0.78)} 100%)`,
    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
  } as const;

  const modernStepCardSx = {
    ...dialogPanelSx,
    borderRadius: '20px',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(152deg, ${alpha(theme.palette.common.white, 0.82)} 0%, ${alpha(
      theme.palette.background.paper,
      0.9
    )} 64%, ${alpha('#d7e7fb', 0.84)} 100%)`,
    boxShadow: `0 16px 30px ${alpha(theme.palette.primary.dark, 0.16)}`,
  } as const;

  const accentPanelSx = {
    borderRadius: '14px',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(145deg, ${alpha('#ffffff', 0.86)} 0%, ${alpha('#ecf3ff', 0.92)} 100%)`,
    p: 1.5,
  } as const;

  const stepActionBarSx = {
    borderRadius: '14px',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(145deg, ${alpha('#ffffff', 0.8)} 0%, ${alpha('#eaf2ff', 0.86)} 100%)`,
    px: 1.3,
    py: 1,
  } as const;

  const moveDialogStep = (delta: number) => {
    setDialogStep((prev) => Math.min(dialogLastStep, Math.max(0, prev + delta)));
  };

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
      <Stack spacing={3}>
        {/* Header */}
        <Paper
          sx={{
            p: { xs: 2, md: 2.4 },
            borderRadius: '22px',
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
              Agent Management
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Create and manage chatbot agents for your organization
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2f6bff 0%, #2d8ef0 100%)',
              boxShadow: '0 12px 22px rgba(45,122,240,0.3)',
            }}
          >
            Create Agent
          </Button>
        </Box>
        </Paper>

        {/* Alerts */}
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {/* Widgets Table */}
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}>
          <Table>
            <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.08) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Widget ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Position</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Lead Capture</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {widgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    No agents created yet. Click "Create Agent" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                widgets.map((widget, index) => {
                  const widgetId = widget.widget_id?.trim() || '';
                  return (
                  <TableRow key={widgetId || `widget-row-${widget.id ?? index}`} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{widget.name}</TableCell>
                    <TableCell>
                      <Box
                        component="code"
                        sx={{
                          fontSize: '11px',
                          backgroundColor: alpha(theme.palette.primary.main, 0.08),
                          px: 0.6,
                          py: 0.2,
                          borderRadius: 0.8,
                        }}
                      >
                        {widgetId ? `${widgetId.substring(0, 12)}...` : 'Unavailable'}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={widget.position}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={widget.lead_capture_enabled ? 'Enabled' : 'Disabled'}
                        size="small"
                        color={widget.lead_capture_enabled ? 'success' : 'default'}
                        variant={widget.lead_capture_enabled ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '12px', color: 'text.secondary' }}>
                      {widget.created_at ? new Date(widget.created_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <IconButton
                          size="small"
                          title="View"
                          onClick={() => handleOpenView(widget)}
                          color="info"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Copy Test URL"
                          onClick={() => handleCopyTestUrl(widgetId)}
                          disabled={!widgetId}
                          color="success"
                        >
                          <LinkIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Copy Embed Code"
                          onClick={() => handleCopyEmbedCode(widgetId)}
                          disabled={!widgetId}
                          color="primary"
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Edit"
                          onClick={() => handleOpenEdit(widget)}
                          disabled={!widgetId}
                          color="warning"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Delete"
                          onClick={() => handleDelete(widgetId)}
                          disabled={!widgetId}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* Step-by-step Agent Journey Dialog (View/Edit) */}
      <Dialog
        open={dialogMode === 'view'}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            ...dialogPanelSx,
            borderRadius: '20px',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.1 }}>
          <Stack spacing={1.2}>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                Agent Wizard
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Agent Journey
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Step {dialogStep + 1} of {managementSteps.length}: {managementSteps[dialogStep]}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={dialogProgress}
              sx={{
                height: 9,
                borderRadius: 999,
                backgroundColor: alpha(theme.palette.primary.main, 0.14),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 999,
                  background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                },
              }}
            />
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.2 }}>
          <Stack spacing={2}>
            <Paper sx={{ ...dialogPanelSx, p: 1.3 }}>
              <Stack spacing={1.2}>
                <Typography variant="body2" color="text.secondary">
                  {dialogStepDescriptions[dialogStep]}
                </Typography>
                <Stepper
                  activeStep={dialogStep}
                  alternativeLabel
                  sx={{
                    '& .MuiStepLabel-label': { fontWeight: 600 },
                    '& .MuiStepIcon-root': { color: alpha(theme.palette.primary.main, 0.24) },
                    '& .MuiStepIcon-root.Mui-active': { color: theme.palette.primary.main },
                    '& .MuiStepIcon-root.Mui-completed': { color: theme.palette.success.main },
                  }}
                >
                  {managementSteps.map((stepLabel) => (
                    <Step key={stepLabel}>
                      <StepLabel>{stepLabel}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Stack>
            </Paper>

            {dialogStep === 0 && (
              <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                <Stack spacing={1.8}>
                  <Box sx={accentPanelSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.4 }}>Agent Profile</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Update identity, welcome tone, colors, and routing preferences.
                    </Typography>
                  </Box>

                  <Stack spacing={1.3}>
                    <Box sx={accentPanelSx}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Agent ID</Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                        {formData.widget_id}
                      </Typography>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Name</Typography>
                      <Typography>{formData.name}</Typography>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Welcome Message</Typography>
                      <Typography>{formData.welcome_message || '-'}</Typography>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>System Prompt</Typography>
                      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{formData.system_prompt || '-'}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
                      <Box sx={accentPanelSx}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Primary Color</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Box sx={{ width: 18, height: 18, borderRadius: '4px', border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, bgcolor: formData.primary_color || '#2f6bff' }} />
                          <Typography>{formData.primary_color || '-'}</Typography>
                        </Stack>
                      </Box>
                      <Box sx={accentPanelSx}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Secondary Color</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Box sx={{ width: 18, height: 18, borderRadius: '4px', border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, bgcolor: formData.secondary_color || '#36c4ff' }} />
                          <Typography>{formData.secondary_color || '-'}</Typography>
                        </Stack>
                      </Box>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Position:</Typography>
                        <Chip size="small" variant="outlined" label={formData.position || 'bottom-right'} />
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lead Capture:</Typography>
                        <Chip
                          size="small"
                          color={formData.lead_capture_enabled ? 'success' : 'default'}
                          variant={formData.lead_capture_enabled ? 'filled' : 'outlined'}
                          label={formData.lead_capture_enabled ? 'Enabled' : 'Disabled'}
                        />
                      </Stack>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Escalation Contact - Level 1</Typography>
                      <Typography>{formData.escalation_contact_level_1 || '-'}</Typography>
                    </Box>
                    <Box sx={accentPanelSx}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Escalation Contact - Level 2</Typography>
                      <Typography>{formData.escalation_contact_level_2 || '-'}</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {dialogStep === 1 && (
              <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                <Stack spacing={1.6}>
                  <Box sx={accentPanelSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Knowledge Base Setup</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      Manage website crawl, document upload, and text knowledge from the dedicated module.
                    </Typography>
                  </Box>
                  <Box sx={accentPanelSx}>
                    <Typography variant="body2" color="text.secondary">
                      Agent: <strong>{formData.name || 'Unnamed Agent'}</strong> ({formData.widget_id || 'No ID'})
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="outlined" onClick={() => navigate('/knowledge')}>
                      Open Knowledge Base
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/create-chat-agent')}>
                      Open Full Creation Wizard
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {dialogStep === 2 && (
              <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                <Stack spacing={1.6}>
                  <Box sx={accentPanelSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Integration Setup</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                      <Typography variant="body2" color="text.secondary">WhatsApp (Meta):</Typography>
                      <Chip
                        size="small"
                        color={whatsappConnectedForAgent ? 'success' : 'default'}
                        label={whatsappConnectedForAgent ? 'Connected for this Agent' : 'Not Connected for this Agent'}
                      />
                    </Stack>
                    {whatsappConnectedForAgent && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        WABA: {whatsappConfig.waba_id || '-'} | Phone Number ID: {whatsappConfig.phone_number_id || '-'}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="outlined" onClick={() => navigate('/integrations/whatsapp')}>
                      Manage WhatsApp Integration
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/create-chat-agent')}>
                      Open Creation Wizard
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {dialogStep === 3 && (
              <Paper sx={{ ...modernStepCardSx, p: 2 }}>
                <Stack spacing={1.8}>
                  <Box sx={accentPanelSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.8 }}>Agent Test URL</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={formData.widget_id ? getAgentTestUrl(formData.widget_id) : ''}
                      InputProps={{ readOnly: true }}
                      sx={fieldSx}
                    />
                    <Button
                      size="small"
                      startIcon={<LinkIcon />}
                      onClick={() => handleCopyTestUrl(formData.widget_id)}
                      disabled={!formData.widget_id}
                      sx={{ mt: 1 }}
                    >
                      Copy Test URL
                    </Button>
                  </Box>

                  <Box sx={accentPanelSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.8 }}>Embed Code</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={6}
                      value={`<!-- AI Chatbot Widget -->
<link rel="stylesheet" href="https://your-domain.com/widget/dist/chatbot-widget.css" />
<script>
  window.AIChatbot = {
    widgetId: '${formData.widget_id}',
    apiUrl: 'https://your-api-domain.com',
    name: 'AI Assistant',
    welcomeMessage: 'Hi! How can I help you today?',
    primaryColor: '${formData.primary_color || '#2f6bff'}',
    position: '${formData.position || 'bottom-right'}'
  };
</script>
<script src="https://your-domain.com/widget/dist/chatbot-widget.iife.js"><\/script>`}
                      InputProps={{ readOnly: true }}
                      sx={fieldSx}
                    />
                    <Button
                      size="small"
                      startIcon={<CopyIcon />}
                      onClick={() => handleCopyEmbedCode(formData.widget_id)}
                      disabled={!formData.widget_id}
                      sx={{ mt: 1 }}
                    >
                      Copy Embed Code
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1.2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            sx={{ ...stepActionBarSx, width: '100%' }}
          >
            <Button onClick={handleCloseDialog}>Close</Button>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => moveDialogStep(-1)} disabled={dialogStep === 0}>
                Back
              </Button>
              {dialogStep < dialogLastStep ? (
                <Button
                  variant="contained"
                  onClick={() => moveDialogStep(1)}
                  sx={{
                    background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => handleOpenEdit(formData as WidgetConfig)}
                  variant="contained"
                  disabled={!formData.widget_id}
                  sx={{
                    background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                  }}
                >
                  Edit Agent
                </Button>
              )}
            </Stack>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
    </AdminLayout>
  );
};

export default WidgetManagementPage;


