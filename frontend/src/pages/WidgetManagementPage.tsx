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
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import AdminLayout from '../components/Layout/AdminLayout';
import api from '../services/api';

interface WidgetConfig {
  id?: number;
  widget_id: string;
  name: string;
  welcome_message?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  position: string;
  lead_capture_enabled: boolean;
  lead_fields?: string;
  user_id?: number;
  organization_id?: number;
  created_at?: string;
}

type DialogMode = 'create' | 'edit' | 'view' | null;

const WidgetManagementPage: React.FC = () => {
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
    logo_url: '',
    primary_color: '#007bff',
    secondary_color: '#6c757d',
    position: 'bottom-right',
    lead_capture_enabled: true,
    lead_fields: '',
  });

  // Fetch widgets on mount
  useEffect(() => {
    fetchWidgets();
  }, []);

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/widgets');
      setWidgets(response.data);
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
      logo_url: '',
      primary_color: '#007bff',
      secondary_color: '#6c757d',
      position: 'bottom-right',
      lead_capture_enabled: true,
      lead_fields: '',
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
      } else if (dialogMode === 'edit' && currentWidget) {
        await api.put(`/api/admin/widget/config/${currentWidget.widget_id}`, formData);
        setSuccess('Widget updated successfully');
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
    const embedCode = `<script async src="http://localhost:5173/widget.html?widget_id=${widgetId}"></script>`;
    navigator.clipboard.writeText(embedCode);
    setSuccess('Embed code copied to clipboard');
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
              Widget Management
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Create and manage chatbot widgets for your organization
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Create Widget
          </Button>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {/* Widgets Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
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
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: '#999' }}>
                    No widgets created yet. Click "Create Widget" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                widgets.map((widget) => (
                  <TableRow key={widget.widget_id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{widget.name}</TableCell>
                    <TableCell>
                      <code style={{ fontSize: '11px', backgroundColor: '#f5f5f5', padding: '2px 4px' }}>
                        {widget.widget_id.substring(0, 12)}...
                      </code>
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
                    <TableCell sx={{ fontSize: '12px', color: '#666' }}>
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
                          title="Copy Embed Code"
                          onClick={() => handleCopyEmbedCode(widget.widget_id)}
                          color="primary"
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Edit"
                          onClick={() => handleOpenEdit(widget)}
                          color="warning"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Delete"
                          onClick={() => handleDelete(widget.widget_id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
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
          {dialogMode === 'create' ? 'Create New Widget' : 'Edit Widget'}
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
              label="Logo URL"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleFormChange}
              placeholder="https://example.com/logo.png"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                  Primary Color
                </label>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleFormChange}
                    style={{ width: '50px', height: '40px', cursor: 'pointer' }}
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                  Secondary Color
                </label>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <input
                    type="color"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleFormChange}
                    style={{ width: '50px', height: '40px', cursor: 'pointer' }}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="lead_capture_enabled"
                  checked={formData.lead_capture_enabled}
                  onChange={handleFormChange}
                />
                <span>Enable Lead Capture</span>
              </label>
            </Box>
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
        <DialogTitle>Widget Details</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ color: '#666' }}>Widget ID</Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                {formData.widget_id}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#666' }}>Name</Typography>
              <Typography>{formData.name}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#666' }}>Welcome Message</Typography>
              <Typography>{formData.welcome_message}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#666' }}>Primary Color</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Box
                    sx={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: formData.primary_color,
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {formData.primary_color}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#666' }}>Secondary Color</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Box
                    sx={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: formData.secondary_color,
                      border: '1px solid #ddd',
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
              <Typography variant="caption" sx={{ color: '#666' }}>Position</Typography>
              <Typography>{formData.position}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#666' }}>Lead Capture</Typography>
              <Typography>{formData.lead_capture_enabled ? 'Enabled' : 'Disabled'}</Typography>
            </Box>
            {formData.created_at && (
              <Box>
                <Typography variant="caption" sx={{ color: '#666' }}>Created</Typography>
                <Typography>{new Date(formData.created_at).toLocaleString()}</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" sx={{ color: '#666' }}>Embed Code</Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                value={`<script async src="http://localhost:5173/widget.html?widget_id=${formData.widget_id}"></script>`}
                InputProps={{ readOnly: true }}
                sx={{ mt: 0.5 }}
              />
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={() => handleCopyEmbedCode(formData.widget_id)}
                sx={{ mt: 1 }}
              >
                Copy Embed Code
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button onClick={() => handleOpenEdit(formData as WidgetConfig)} variant="contained">
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </AdminLayout>
  );
};

export default WidgetManagementPage;
