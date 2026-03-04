import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  MenuItem,
  Divider,
  Stack,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AdminLayout from '../components/Layout/AdminLayout';
import api from '../services/api';
import { whatsappService } from '../services/whatsappService';

interface WidgetConfig {
  widget_id: string;
  name: string;
}

const WhatsAppIntegrationPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);

  const [form, setForm] = useState({
    widget_id: '',
    phone_number_id: '',
    waba_id: '',
    access_token: '',
    verify_token: '',
    business_phone_number: '',
    is_active: true,
  });

  const [testToNumber, setTestToNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Zentrixel WhatsApp bot');
  const webhookUrl = `${import.meta.env.VITE_API_URL || window.location.origin}/api/channels/whatsapp/webhook`;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [widgetsRes, config] = await Promise.all([
        api.get('/api/admin/widgets'),
        whatsappService.getConfig(),
      ]);

      const widgetList: WidgetConfig[] = widgetsRes.data || [];
      setWidgets(widgetList);

      if (config.configured) {
        setForm((prev) => ({
          ...prev,
          widget_id: config.widget_id || prev.widget_id,
          phone_number_id: config.phone_number_id || '',
          waba_id: config.waba_id || '',
          business_phone_number: config.business_phone_number || '',
          is_active: config.is_active ?? true,
        }));
      } else if (widgetList.length > 0) {
        setForm((prev) => ({ ...prev, widget_id: widgetList[0].widget_id }));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (!form.widget_id || !form.phone_number_id || !form.access_token || !form.verify_token) {
        setError('Please fill required fields: widget, phone number id, access token, verify token');
        return;
      }

      await whatsappService.saveConfig({
        widget_id: form.widget_id,
        phone_number_id: form.phone_number_id,
        waba_id: form.waba_id || undefined,
        access_token: form.access_token,
        verify_token: form.verify_token,
        business_phone_number: form.business_phone_number || undefined,
        is_active: form.is_active,
      });

      setForm((prev) => ({ ...prev, access_token: '' }));
      setSuccess('WhatsApp configuration saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save WhatsApp config');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setTesting(true);
      setError('');
      setSuccess('');

      if (!testToNumber || !testMessage) {
        setError('Enter test number and test message');
        return;
      }

      await whatsappService.sendTestMessage({ to_number: testToNumber, message: testMessage });
      setSuccess('Test message sent successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  const handleCopyText = async (value: string, successText: string) => {
    try {
      if (!value) {
        setError('Nothing to copy');
        return;
      }
      await navigator.clipboard.writeText(value);
      setError('');
      setSuccess(successText);
    } catch {
      setError('Failed to copy text');
    }
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
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            WhatsApp Integration
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Connect Meta WhatsApp Cloud API and send chatbot replies to mobile users.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Channel Configuration
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Widget"
                value={form.widget_id}
                onChange={(e) => handleChange('widget_id', e.target.value)}
                helperText="Incoming WhatsApp messages use this widget knowledge base"
              >
                {widgets.map((widget) => (
                  <MenuItem key={widget.widget_id} value={widget.widget_id}>
                    {widget.name} ({widget.widget_id})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone Number ID *"
                value={form.phone_number_id}
                onChange={(e) => handleChange('phone_number_id', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="WABA ID"
                value={form.waba_id}
                onChange={(e) => handleChange('waba_id', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Business Phone Number"
                value={form.business_phone_number}
                onChange={(e) => handleChange('business_phone_number', e.target.value)}
                placeholder="+91XXXXXXXXXX"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Meta Access Token *"
                value={form.access_token}
                onChange={(e) => handleChange('access_token', e.target.value)}
                type="password"
                helperText="Required when creating/updating config"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Webhook Verify Token *"
                value={form.verify_token}
                onChange={(e) => handleChange('verify_token', e.target.value)}
                helperText="Use the same token in Meta webhook verification"
              />
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Meta Webhook Setup
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  Callback URL: {webhookUrl}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => handleCopyText(webhookUrl, 'Webhook URL copied')}
                  >
                    Copy Webhook URL
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => handleCopyText(form.verify_token, 'Verify token copied')}
                  >
                    Copy Verify Token
                  </Button>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                  />
                }
                label="Channel Active"
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Test Message
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Send a test message via Meta API to verify your configuration.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Recipient Number (with country code)"
                value={testToNumber}
                onChange={(e) => setTestToNumber(e.target.value)}
                placeholder="9198XXXXXXXX"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Test Message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="outlined" onClick={handleSendTest} disabled={testing}>
                {testing ? 'Sending...' : 'Send Test Message'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </AdminLayout>
  );
};

export default WhatsAppIntegrationPage;
