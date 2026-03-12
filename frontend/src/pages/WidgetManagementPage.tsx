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

const WidgetManagementPage: React.FC = () => {
  const theme = useTheme();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [currentWidget, setCurrentWidget] = useState<WidgetConfig | null>(null);
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
      const response = await api.get('/api/admin/widgets');
      const widgetList = Array.isArray(response.data)
        ? response.data.map((widget: Partial<WidgetConfig>) => normalizeWidget(widget))
        : [];
      setWidgets(widgetList);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch widgets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      widget_id: `widget_${Date.now()}`,
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
    setDialogMode('create');
  };

  const handleOpenEdit = (widget: WidgetConfig) => {
    setCurrentWidget(widget);
    setFormData(widget);
    setDialogMode('edit');
  };

  const handleOpenView = (widget: WidgetConfig) => {
    setCurrentWidget(widget);
    setFormData(widget);
    setDialogMode('view');
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setCurrentWidget(null);
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' ? 'Create New Agent' : 'Edit Agent'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
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
            <TextField
              fullWidth
              label="Logo URL"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleFormChange}
              placeholder="https://example.com/logo.png"
            />
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
                    sx={{ width: 50, height: 40, cursor: 'pointer', border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`, borderRadius: 1, p: 0 }}
                  />
                  <TextField
                    size="small"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleFormChange}
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
                    sx={{ width: 50, height: 40, cursor: 'pointer', border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`, borderRadius: 1, p: 0 }}
                  />
                  <TextField
                    size="small"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleFormChange}
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
              select
              SelectProps={{
                native: true,
              }}
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
              placeholder="Support Team: support@example.com | +1-555-0101"
            />
            <TextField
              fullWidth
              label="Escalation Contact - Level 2"
              name="escalation_contact_level_2"
              value={formData.escalation_contact_level_2 || ''}
              onChange={handleFormChange}
              placeholder="Escalation Manager: escalation@example.com | +1-555-0102"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {dialogMode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={dialogMode === 'view'} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Agent Details</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
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
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Primary Color</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Box
                    sx={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: formData.primary_color,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                      borderRadius: '4px',
                    }}
                  />
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {formData.primary_color}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Secondary Color</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Box
                    sx={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: formData.secondary_color,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                      borderRadius: '4px',
                    }}
                  />
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {formData.secondary_color}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Position</Typography>
              <Typography>{formData.position}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lead Capture</Typography>
              <Typography>{formData.lead_capture_enabled ? 'Enabled' : 'Disabled'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Escalation Contact - Level 1</Typography>
              <Typography>{formData.escalation_contact_level_1 || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Escalation Contact - Level 2</Typography>
              <Typography>{formData.escalation_contact_level_2 || '-'}</Typography>
            </Box>
            {formData.created_at && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Created</Typography>
                <Typography>{new Date(formData.created_at).toLocaleString()}</Typography>
              </Box>
            )}
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
    primaryColor: '#007bff',
    primaryColor: '#2f6bff',
    position: 'bottom-right'
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button onClick={() => handleOpenEdit(formData as WidgetConfig)} variant="contained" disabled={!formData.widget_id}>
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </AdminLayout>
  );
};

export default WidgetManagementPage;


