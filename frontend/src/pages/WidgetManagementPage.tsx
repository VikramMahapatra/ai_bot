import React, { useState, useEffect } from 'react';
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
  Checkbox,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
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

type DialogMode = 'create' | 'edit' | 'view' | null;

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
  const [currentWidget, setCurrentWidget] = useState<WidgetConfig | null>(null);
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
    setCurrentWidget(widget);
    setFormData(widget);
    setDialogStep(0);
    setDialogMode('edit');
  };

  const handleOpenView = (widget: WidgetConfig) => {
    setCurrentWidget(widget);
    setFormData(widget);
    setDialogStep(0);
    setDialogMode('view');
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setCurrentWidget(null);
    setDialogStep(0);
  };

  const handleSave = async () => {
    try {
      if (dialogMode === 'create') {
        await api.post('/api/admin/widget/config', formData);
        setSuccess('Widget created successfully');
      } else if (dialogMode === 'edit' && currentWidget?.widget_id) {
        await api.put(`/api/admin/widget/config/${currentWidget.widget_id}`, formData);
        setSuccess('Widget updated successfully');
      } else if (dialogMode === 'edit') {
        setError('Widget ID is missing. Cannot update this widget.');
        return;
      }
      setError('');
      handleCloseDialog();
      fetchWidgets();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save widget');
    }
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

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const isViewMode = dialogMode === 'view';
  const dialogLastStep = managementSteps.length - 1;
  const whatsappConnectedForAgent = Boolean(
    whatsappConfig.configured
      && whatsappConfig.widget_id
      && formData.widget_id
      && whatsappConfig.widget_id === formData.widget_id
      && whatsappConfig.is_active !== false
  );

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
        open={dialogMode === 'create' || dialogMode === 'edit' || dialogMode === 'view'}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isViewMode ? 'Agent Journey' : dialogMode === 'create' ? 'Create Agent Journey' : 'Edit Agent Journey'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <Stepper activeStep={dialogStep} alternativeLabel>
              {managementSteps.map((stepLabel) => (
                <Step key={stepLabel}>
                  <StepLabel>{stepLabel}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {dialogStep === 0 && (
              <Stack spacing={2}>
                {isViewMode ? (
                  <>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Agent ID</Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                        {formData.widget_id}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Name</Typography>
                      <Typography>{formData.name}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Welcome Message</Typography>
                      <Typography>{formData.welcome_message}</Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <TextField
                      fullWidth
                      label="Widget Name"
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      placeholder="e.g., Sales Support Widget"
                    />
                    <TextField
                      fullWidth
                      label="Welcome Message"
                      name="welcome_message"
                      value={formData.welcome_message}
                      onChange={handleFormChange}
                      multiline
                      rows={2}
                      placeholder="Hi! How can I help you?"
                    />
                    <TextField
                      fullWidth
                      label="System Prompt (Optional)"
                      name="system_prompt"
                      value={formData.system_prompt}
                      onChange={handleFormChange}
                      multiline
                      rows={4}
                      placeholder="Use this to customize assistant behavior for this agent"
                    />
                  </>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
                      Primary Color
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box
                        component="input"
                        type="color"
                        name="primary_color"
                        value={formData.primary_color}
                        onChange={handleFormChange}
                        disabled={isViewMode}
                        sx={{ width: 50, height: 40, cursor: isViewMode ? 'default' : 'pointer', border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`, borderRadius: 1, p: 0 }}
                      />
                      <TextField
                        size="small"
                        name="primary_color"
                        value={formData.primary_color}
                        onChange={handleFormChange}
                        disabled={isViewMode}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
                      Secondary Color
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box
                        component="input"
                        type="color"
                        name="secondary_color"
                        value={formData.secondary_color}
                        onChange={handleFormChange}
                        disabled={isViewMode}
                        sx={{ width: 50, height: 40, cursor: isViewMode ? 'default' : 'pointer', border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`, borderRadius: 1, p: 0 }}
                      />
                      <TextField
                        size="small"
                        name="secondary_color"
                        value={formData.secondary_color}
                        onChange={handleFormChange}
                        disabled={isViewMode}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Box>
                </Box>

                <TextField
                  fullWidth
                  label="Position"
                  name="position"
                  value={formData.position}
                  onChange={handleFormChange}
                  disabled={isViewMode}
                  select
                  SelectProps={{ native: true }}
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </TextField>

                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="lead_capture_enabled"
                        checked={formData.lead_capture_enabled}
                        onChange={handleFormChange}
                        disabled={isViewMode}
                      />
                    }
                    label="Enable Lead Capture"
                  />
                </Box>

                <TextField
                  fullWidth
                  label="Escalation Contact - Level 1"
                  name="escalation_contact_level_1"
                  value={formData.escalation_contact_level_1 || ''}
                  onChange={handleFormChange}
                  disabled={isViewMode}
                  placeholder="Support Team: support@example.com | +1-555-0101"
                />
                <TextField
                  fullWidth
                  label="Escalation Contact - Level 2"
                  name="escalation_contact_level_2"
                  value={formData.escalation_contact_level_2 || ''}
                  onChange={handleFormChange}
                  disabled={isViewMode}
                  placeholder="Escalation Manager: escalation@example.com | +1-555-0102"
                />
              </Stack>
            )}

            {dialogStep === 1 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Knowledge Base Setup</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Step 2 in agent creation covers website crawl, document upload, and text knowledge. Use the Knowledge Base module to manage all sources for this agent.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Agent: <strong>{formData.name || 'Unnamed Agent'}</strong> ({formData.widget_id || 'No ID'})
                  </Typography>
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
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Integration Setup</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary">WhatsApp (Meta):</Typography>
                    <Chip
                      size="small"
                      color={whatsappConnectedForAgent ? 'success' : 'default'}
                      label={whatsappConnectedForAgent ? 'Connected for this Agent' : 'Not Connected for this Agent'}
                    />
                  </Stack>
                  {whatsappConnectedForAgent && (
                    <Typography variant="body2" color="text.secondary">
                      WABA: {whatsappConfig.waba_id || '-'} | Phone Number ID: {whatsappConfig.phone_number_id || '-'}
                    </Typography>
                  )}
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
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Agent Test URL</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.widget_id ? getAgentTestUrl(formData.widget_id) : ''}
                    InputProps={{ readOnly: true }}
                    sx={{ mt: 0.5 }}
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

                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Embed Code</Typography>
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
                    sx={{ mt: 0.5 }}
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
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button onClick={handleCloseDialog}>{isViewMode ? 'Close' : 'Cancel'}</Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => moveDialogStep(-1)} disabled={dialogStep === 0}>
              Back
            </Button>
            {dialogStep < dialogLastStep ? (
              <Button variant="contained" onClick={() => moveDialogStep(1)}>
                Next
              </Button>
            ) : isViewMode ? (
              <Button onClick={() => handleOpenEdit(formData as WidgetConfig)} variant="contained" disabled={!formData.widget_id}>
                Edit Agent
              </Button>
            ) : (
              <Button onClick={handleSave} variant="contained">
                {dialogMode === 'create' ? 'Create' : 'Update'}
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
    </AdminLayout>
  );
};

export default WidgetManagementPage;


