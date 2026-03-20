import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AdminLayout from '../components/Layout/AdminLayout';
import { twilioSmsService } from '../services/twilioSmsService';

const DEFAULT_TWILIO_ACCOUNT_SID = 'ACb6df90735425e0809d1457366c6d5623xxxxx';
const DEFAULT_TWILIO_FROM_NUMBER = '+18126125486';
const DEFAULT_TWILIO_INBOUND_NUMBER = '(812) 612-5486';
const DEFAULT_TWILIO_LOCATION_LABEL = 'Mccutchanville, IN, US';
const DEFAULT_TWILIO_VOICE_WEBHOOK = 'https://demo.twilio.com/welcome/voice/';
const DEFAULT_TWILIO_MESSAGE_WEBHOOK = 'https://demo.twilio.com/welcome/sms/reply/';

type TwilioFormState = {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  inboundPhoneNumber: string;
  locationLabel: string;
  voiceWebhookUrl: string;
  messagingWebhookUrl: string;
  isActive: boolean;
  testToNumber: string;
  testMessage: string;
};

const buildDefaultTwilioState = (): TwilioFormState => ({
  accountSid: DEFAULT_TWILIO_ACCOUNT_SID,
  authToken: '',
  fromPhoneNumber: DEFAULT_TWILIO_FROM_NUMBER,
  inboundPhoneNumber: DEFAULT_TWILIO_INBOUND_NUMBER,
  locationLabel: DEFAULT_TWILIO_LOCATION_LABEL,
  voiceWebhookUrl: DEFAULT_TWILIO_VOICE_WEBHOOK,
  messagingWebhookUrl: DEFAULT_TWILIO_MESSAGE_WEBHOOK,
  isActive: true,
  testToNumber: '',
  testMessage: 'Hello from AI Bot SMS Campaign!',
});

const SettingsPage: React.FC = () => {
  const theme = useTheme();
  const [twilioForm, setTwilioForm] = useState<TwilioFormState>(buildDefaultTwilioState);
  const [twilioLoading, setTwilioLoading] = useState(false);
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioHasAuthToken, setTwilioHasAuthToken] = useState(false);
  const [twilioError, setTwilioError] = useState('');
  const [twilioSuccess, setTwilioSuccess] = useState('');

  useEffect(() => {
    const loadTwilioConfig = async () => {
      setTwilioLoading(true);
      setTwilioError('');
      try {
        const config = await twilioSmsService.getConfig();
        setTwilioForm((prev) => ({
          ...prev,
          accountSid: config.account_sid || DEFAULT_TWILIO_ACCOUNT_SID,
          authToken: '',
          fromPhoneNumber: config.from_phone_number || DEFAULT_TWILIO_FROM_NUMBER,
          inboundPhoneNumber: config.inbound_phone_number || DEFAULT_TWILIO_INBOUND_NUMBER,
          locationLabel: config.location_label || DEFAULT_TWILIO_LOCATION_LABEL,
          voiceWebhookUrl: config.voice_webhook_url || DEFAULT_TWILIO_VOICE_WEBHOOK,
          messagingWebhookUrl: config.messaging_webhook_url || DEFAULT_TWILIO_MESSAGE_WEBHOOK,
          isActive: config.is_active ?? true,
        }));
        setTwilioHasAuthToken(Boolean(config.has_auth_token));
      } catch (err: any) {
        setTwilioError(err?.response?.data?.detail || 'Failed to load Twilio settings');
      } finally {
        setTwilioLoading(false);
      }
    };

    loadTwilioConfig();
  }, []);

  const handleTwilioFieldChange = <K extends keyof TwilioFormState>(key: K, value: TwilioFormState[K]) => {
    setTwilioForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveTwilioSettings = async () => {
    setTwilioError('');
    setTwilioSuccess('');
    setTwilioSaving(true);

    try {
      const response = await twilioSmsService.upsertConfig({
        account_sid: twilioForm.accountSid.trim(),
        auth_token: twilioForm.authToken.trim() || undefined,
        from_phone_number: twilioForm.fromPhoneNumber.trim(),
        inbound_phone_number: twilioForm.inboundPhoneNumber.trim() || undefined,
        location_label: twilioForm.locationLabel.trim() || undefined,
        voice_webhook_url: twilioForm.voiceWebhookUrl.trim() || undefined,
        messaging_webhook_url: twilioForm.messagingWebhookUrl.trim() || undefined,
        is_active: twilioForm.isActive,
      });

      setTwilioHasAuthToken(Boolean(response.has_auth_token));
      setTwilioForm((prev) => ({ ...prev, authToken: '' }));
      setTwilioSuccess('Twilio SMS settings saved successfully.');
    } catch (err: any) {
      setTwilioError(err?.response?.data?.detail || 'Failed to save Twilio settings');
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleSendTwilioTestSms = async () => {
    setTwilioError('');
    setTwilioSuccess('');
    setTwilioTesting(true);

    try {
      await twilioSmsService.sendTestMessage(twilioForm.testToNumber, twilioForm.testMessage);
      setTwilioSuccess('Twilio test SMS sent successfully.');
    } catch (err: any) {
      setTwilioError(err?.response?.data?.detail || 'Failed to send Twilio test SMS');
    } finally {
      setTwilioTesting(false);
    }
  };

  return (
    <AdminLayout>
      <Box>
        <Card
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
            Settings
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Configure your AI platform preferences and system settings.
          </Typography>
        </Card>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  General Settings
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Enable email notifications" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Auto-save conversations" 
                  />
                  <FormControlLabel 
                    control={<Switch />} 
                    label="Dark mode" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Show analytics dashboard" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  AI Configuration
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Enable RAG (Retrieval-Augmented Generation)" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Use semantic search" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Auto-vectorize documents" 
                  />
                  <FormControlLabel 
                    control={<Switch />} 
                    label="Enable debugging mode" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Lead Capture Settings
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Automatically capture leads after 3 messages" 
                  />
                  <FormControlLabel 
                    control={<Switch defaultChecked />} 
                    label="Require email for lead capture" 
                  />
                  <FormControlLabel 
                    control={<Switch />} 
                    label="Send lead notifications to admin" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Twilio SMS Integration
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  Configure Twilio for SMS campaigns from Campaign Management.
                </Typography>

                {twilioError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {twilioError}
                  </Alert>
                )}
                {twilioSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {twilioSuccess}
                  </Alert>
                )}

                {twilioLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Loading Twilio configuration...
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Twilio Account SID"
                          value={twilioForm.accountSid}
                          onChange={(e) => handleTwilioFieldChange('accountSid', e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Twilio Auth Token"
                          type="password"
                          value={twilioForm.authToken}
                          onChange={(e) => handleTwilioFieldChange('authToken', e.target.value)}
                          size="small"
                          helperText={
                            twilioHasAuthToken
                              ? 'Leave empty to keep existing token, or enter a new one to rotate it.'
                              : 'Required to send SMS via Twilio.'
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Twilio Sender Number (From)"
                          value={twilioForm.fromPhoneNumber}
                          onChange={(e) => handleTwilioFieldChange('fromPhoneNumber', e.target.value)}
                          size="small"
                          helperText="Use E.164 format, e.g. +18126125486"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Inbound Number"
                          value={twilioForm.inboundPhoneNumber}
                          onChange={(e) => handleTwilioFieldChange('inboundPhoneNumber', e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Location"
                          value={twilioForm.locationLabel}
                          onChange={(e) => handleTwilioFieldChange('locationLabel', e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ pt: 1 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={twilioForm.isActive}
                                onChange={(e) => handleTwilioFieldChange('isActive', e.target.checked)}
                              />
                            }
                            label="Enable Twilio SMS Channel"
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Voice Webhook URL"
                          value={twilioForm.voiceWebhookUrl}
                          onChange={(e) => handleTwilioFieldChange('voiceWebhookUrl', e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Messaging Webhook URL"
                          value={twilioForm.messagingWebhookUrl}
                          onChange={(e) => handleTwilioFieldChange('messagingWebhookUrl', e.target.value)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          variant="contained"
                          onClick={handleSaveTwilioSettings}
                          disabled={twilioSaving}
                        >
                          {twilioSaving ? 'Saving...' : 'Save Twilio SMS Settings'}
                        </Button>
                      </Grid>
                    </Grid>

                    <Divider sx={{ my: 2.5 }} />

                    <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Send Test SMS
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Recipient Number"
                          placeholder="+1XXXXXXXXXX"
                          value={twilioForm.testToNumber}
                          onChange={(e) => handleTwilioFieldChange('testToNumber', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Test Message"
                          value={twilioForm.testMessage}
                          onChange={(e) => handleTwilioFieldChange('testMessage', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <Button
                          fullWidth
                          variant="outlined"
                          disabled={twilioTesting}
                          onClick={handleSendTwilioTestSms}
                        >
                          {twilioTesting ? 'Sending...' : 'Send Test'}
                        </Button>
                      </Grid>
                    </Grid>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ boxShadow: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Email SMTP Configuration
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  Configure SMTP settings for sending conversation transcripts via email
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Host"
                      defaultValue="smtp.office365.com"
                      size="small"
                      helperText="e.g., smtp.gmail.com, smtp.office365.com"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Port"
                      defaultValue="25"
                      size="small"
                      type="number"
                      helperText="Common: 25, 587, 465"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Username"
                      defaultValue="smtp@sales-arm.com"
                      size="small"
                      helperText="Your SMTP authentication username"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SMTP Password"
                      defaultValue="••••••••••"
                      size="small"
                      type="password"
                      helperText="App password or SMTP password"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Email Sender"
                      defaultValue="noreply@sales-arm.com"
                      size="small"
                      helperText="From email address"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ pt: 1 }}>
                      <FormControlLabel 
                        control={<Switch />} 
                        label="Use SSL/TLS" 
                      />
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Note: These settings are configured in the backend .env file. Changes here are for display only.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
};

export default SettingsPage;


