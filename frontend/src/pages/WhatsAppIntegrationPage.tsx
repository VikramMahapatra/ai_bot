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
import { alpha, useTheme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AdminLayout from '../components/Layout/AdminLayout';
import api from '../services/api';
import { launchWhatsAppEmbeddedSignup, loadFacebookSdk } from '../services/metaEmbeddedSignup';
import { whatsappService } from '../services/whatsappService';
import {
  buildApiUrl,
  getMetaAppId,
  getMetaEmbeddedSignupConfigId,
  getMetaWhatsAppEmbeddedSignupUrl,
} from '../config/env';

interface WidgetConfig {
  widget_id: string;
  name: string;
}

const WhatsAppIntegrationPage: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaSdkReady, setMetaSdkReady] = useState(false);
  const [metaSdkFailed, setMetaSdkFailed] = useState(false);
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
  const webhookUrl = buildApiUrl('/api/channels/whatsapp/webhook');
  const metaRedirectUri = buildApiUrl(`/api/admin/whatsapp/embedded/callback?origin=${encodeURIComponent(window.location.origin)}`);

  useEffect(() => {
    const metaAppId = getMetaAppId();
    if (!metaAppId) {
      setMetaSdkReady(false);
      setMetaSdkFailed(true);
      return;
    }

    let active = true;
    setMetaSdkFailed(false);
    loadFacebookSdk(metaAppId)
      .then(() => {
        if (active) {
          setMetaSdkReady(true);
          setMetaSdkFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setMetaSdkReady(false);
          setMetaSdkFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const openMetaOAuthFallback = (metaAppId: string, configId: string) => {
    const state = `wa_${Date.now()}`;
    const oauthUrl =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(metaAppId)}` +
      `&redirect_uri=${encodeURIComponent(metaRedirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('business_management,whatsapp_business_management,whatsapp_business_messaging')}` +
      `&config_id=${encodeURIComponent(configId)}` +
      `&state=${encodeURIComponent(state)}`;

    const popup = window.open(oauthUrl, 'meta_whatsapp_oauth', 'width=980,height=760,resizable=yes,scrollbars=yes');
    if (!popup) {
      window.location.assign(oauthUrl);
      setError('Popup blocked. Opened Meta signup in current tab.');
    } else {
      setSuccess('Meta signup opened via OAuth fallback. Complete setup in popup.');
    }
  };

  const handleMetaAuthCode = async (code: string, source: 'sdk' | 'redirect' = 'sdk') => {
    if (!form.widget_id) {
      throw new Error('Please select a widget before connecting WhatsApp.');
    }

    const verifyToken = (form.verify_token || '').trim() || `wa_verify_${Date.now()}`;
    const exchange = await whatsappService.exchangeEmbeddedSignupCode({
      code,
      redirect_uri: source === 'redirect' ? metaRedirectUri : undefined,
      widget_id: form.widget_id,
      verify_token: verifyToken,
      business_phone_number: (form.business_phone_number || '').trim() || undefined,
      is_active: form.is_active,
      auto_save: true,
    });

    setForm((prev) => ({
      ...prev,
      phone_number_id: exchange.phone_number_id || prev.phone_number_id,
      waba_id: exchange.waba_id || prev.waba_id,
      access_token: exchange.access_token || prev.access_token,
      verify_token: verifyToken,
      business_phone_number: exchange.business_phone_number || prev.business_phone_number,
    }));

    setSuccess(
      exchange.saved
        ? 'WhatsApp connected and configuration saved via Meta wizard.'
        : 'Meta wizard completed. Review the imported values before saving.'
    );
  };

  const openMetaWhatsAppWizard = async () => {
    if (!form.widget_id) {
      setError('Please select a widget before connecting WhatsApp.');
      return;
    }

    const metaAppId = getMetaAppId();
    const configId = getMetaEmbeddedSignupConfigId();
    const fallbackUrl = getMetaWhatsAppEmbeddedSignupUrl();

    if (!metaAppId || !configId) {
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        setError('Meta SDK env is missing. Opened fallback URL from env. Set VITE_META_APP_ID and VITE_META_EMBEDDED_SIGNUP_CONFIG_ID.');
        return;
      }
      setError('Set VITE_META_APP_ID and VITE_META_EMBEDDED_SIGNUP_CONFIG_ID in frontend .env.');
      return;
    }

    try {
      setMetaConnecting(true);
      setError('');
      if (metaSdkFailed) {
        openMetaOAuthFallback(metaAppId, configId);
        setError('Meta SDK failed to load. Opened fallback signup window.');
        return;
      }

      if (!metaSdkReady) {
        setError('Meta SDK is still loading. Please wait a moment and click Connect WhatsApp again.');
        return;
      }

      const code = await launchWhatsAppEmbeddedSignup(configId);
      await handleMetaAuthCode(code, 'sdk');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Meta signup failed.');
    } finally {
      setMetaConnecting(false);
    }
  };

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

  useEffect(() => {
    const onMetaMessage = async (event: MessageEvent) => {
      const payload = event.data as any;
      if (!payload || payload.type !== 'META_WHATSAPP_EMBEDDED_SIGNUP') {
        return;
      }

      if (payload.error) {
        setError(`Meta signup failed: ${payload.error}`);
        return;
      }

      const code = (payload.code || '').trim();
      const source = payload.source === 'redirect' ? 'redirect' : 'sdk';
      if (!code) {
        return;
      }

      try {
        setMetaConnecting(true);
        setError('');
        await handleMetaAuthCode(code, source);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Meta signup exchange failed.');
      } finally {
        setMetaConnecting(false);
      }
    };

    window.addEventListener('message', onMetaMessage);
    return () => window.removeEventListener('message', onMetaMessage);
  }, [form.business_phone_number, form.is_active, form.verify_token, form.widget_id]);

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
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.6 },
            mb: 3,
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
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            WhatsApp Integration
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Connect Meta WhatsApp Cloud API and send chatbot replies to mobile users.
          </Typography>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={openMetaWhatsAppWizard} disabled={metaConnecting}>
              {metaConnecting ? 'Connecting...' : metaSdkReady ? 'Connect WhatsApp' : 'Loading Meta SDK...'}
            </Button>
          }
        >
          Open Meta embedded signup popup and auto-import Phone Number ID and access token.
        </Alert>

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
                {widgets?.length ? (
                  widgets.map((widget) => (
                    <MenuItem key={widget.widget_id} value={widget.widget_id}>
                      {widget.name} ({widget.widget_id})
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>No widgets available</MenuItem>
                )}
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


