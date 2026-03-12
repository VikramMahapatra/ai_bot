import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  Divider,
  Grid,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LaunchIcon from '@mui/icons-material/Launch';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import GroupsIcon from '@mui/icons-material/Groups';
import ForumIcon from '@mui/icons-material/Forum';
import AdminLayout from '../components/Layout/AdminLayout';
import api from '../services/api';
import { knowledgeService } from '../services/knowledgeService';
import { whatsappService } from '../services/whatsappService';
import { buildApiUrl, buildPublicUrl, getMetaWhatsAppEmbeddedSignupUrl } from '../config/env';

interface WidgetConfig {
  widget_id: string;
  name: string;
  welcome_message?: string;
  system_prompt?: string;
  primary_color: string;
  secondary_color: string;
  position: string;
  lead_capture_enabled: boolean;
  lead_fields?: string;
}

interface WhatsAppFormState {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  verify_token: string;
  business_phone_number: string;
  is_active: boolean;
}

const initialWhatsAppForm: WhatsAppFormState = {
  phone_number_id: '',
  waba_id: '',
  access_token: '',
  verify_token: '',
  business_phone_number: '',
  is_active: true,
};

const CreateChatAgentPage: React.FC = () => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [widget, setWidget] = useState<WidgetConfig>({
    widget_id: `widget_${Date.now()}`,
    name: '',
    welcome_message: 'Hi! How can I help you?',
    system_prompt: '',
    primary_color: '#2f6bff',
    secondary_color: '#36c4ff',
    position: 'bottom-right',
    lead_capture_enabled: true,
    lead_fields: '',
  });

  const [createdWidgetId, setCreatedWidgetId] = useState('');
  const [knowledgeUrl, setKnowledgeUrl] = useState('');
  const [crawlMaxPages, setCrawlMaxPages] = useState(10);
  const [crawlMaxDepth, setCrawlMaxDepth] = useState(2);
  const [knowledgeTitle, setKnowledgeTitle] = useState('FAQ and Product Knowledge');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [knowledgeActionsDone, setKnowledgeActionsDone] = useState(0);

  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState<WhatsAppFormState>(initialWhatsAppForm);
  const [testToNumber, setTestToNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Zentrixel WhatsApp bot');

  const integrationSteps = useMemo(
    () => ['Create Widget', 'Add Knowledge Base', 'Integrations', 'Share Test Link'],
    []
  );

  const pageShellSx = {
    maxWidth: 1380,
    mx: 'auto',
    px: { xs: 0, md: 0.5 },
    position: 'relative',
  } as const;

  const sectionPanelSx = {
    borderRadius: '18px',
    border: `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
    background: `linear-gradient(150deg, ${alpha(theme.palette.common.white, 0.7)} 0%, ${alpha(
      theme.palette.background.paper,
      0.82
    )} 68%, ${alpha('#dce8f8', 0.78)} 100%)`,
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
        'linear-gradient(138deg, rgba(255,255,255,0.22) 8%, transparent 24%), linear-gradient(28deg, transparent 56%, rgba(78,137,213,0.14) 57%, transparent 80%)',
    },
    '& > *': {
      position: 'relative',
      zIndex: 1,
    },
  } as const;

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: alpha(theme.palette.common.white, 0.72),
    },
  } as const;

  const shareLink = useMemo(() => {
    if (!createdWidgetId) return '';
    return buildPublicUrl(`/agent-test/${encodeURIComponent(createdWidgetId)}`);
  }, [createdWidgetId]);

  const webhookUrl = useMemo(() => buildApiUrl('/api/channels/whatsapp/webhook'), []);

  const openMetaWhatsAppWizard = () => {
    const wizardUrl = getMetaWhatsAppEmbeddedSignupUrl() || 'https://business.facebook.com/wa/manage/phone-numbers/';

    const popup = window.open(
      wizardUrl,
      'meta_whatsapp_wizard',
      'width=980,height=760,resizable=yes,scrollbars=yes,noopener,noreferrer'
    );

    if (!popup) {
      // Fallback to same-tab navigation when popup is blocked.
      window.location.assign(wizardUrl);
      setError('Popup blocked by browser. Opened Meta setup in the current tab instead.');
      return;
    }

    setError('');
    setSuccess('Meta setup wizard opened. Complete onboarding and paste generated values here.');
  };

  useEffect(() => {
    if (!createdWidgetId || activeStep !== 2) return;

    let active = true;

    const loadWhatsAppConfig = async () => {
      try {
        const config = await whatsappService.getConfig();
        if (!active) return;

        if (config.configured) {
          setWhatsappConfigured(Boolean(config.is_active));
          setWhatsappForm((prev) => ({
            ...prev,
            phone_number_id: config.phone_number_id || '',
            waba_id: config.waba_id || '',
            business_phone_number: config.business_phone_number || '',
            is_active: config.is_active ?? true,
          }));
        }
      } catch {
        // Keep wizard moving even if config preload fails
      }
    };

    loadWhatsAppConfig();

    return () => {
      active = false;
    };
  }, [activeStep, createdWidgetId]);

  const createWidget = async () => {
    if (!widget.name.trim()) {
      setError('Please enter a widget name to create your agent.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const payload = {
        ...widget,
        widget_id: widget.widget_id || `widget_${Date.now()}`,
      };

      const response = await api.post('/api/admin/widget/config', payload);
      const resolvedWidgetId = response?.data?.widget_id || payload.widget_id;

      setCreatedWidgetId(resolvedWidgetId);
      setWidget((prev) => ({ ...prev, widget_id: resolvedWidgetId }));
      setSuccess('Widget created successfully. Next step: add your knowledge base.');
      setActiveStep(1);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create widget.');
    } finally {
      setBusy(false);
    }
  };

  const addWebsiteKnowledge = async () => {
    if (!createdWidgetId) {
      setError('Create widget first.');
      return;
    }
    if (!knowledgeUrl.trim()) {
      setError('Please enter a website URL.');
      return;
    }
    if (!Number.isFinite(crawlMaxPages) || crawlMaxPages < 1) {
      setError('Max pages must be 1 or greater.');
      return;
    }
    if (!Number.isFinite(crawlMaxDepth) || crawlMaxDepth < 1) {
      setError('Max depth must be 1 or greater.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await knowledgeService.crawlWebsite({
        widget_id: createdWidgetId,
        url: knowledgeUrl.trim(),
        max_pages: crawlMaxPages,
        max_depth: crawlMaxDepth,
      });
      setKnowledgeActionsDone((v) => v + 1);
      setSuccess('Website knowledge added successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add website knowledge.');
    } finally {
      setBusy(false);
    }
  };

  const addTextKnowledge = async () => {
    if (!createdWidgetId) {
      setError('Create widget first.');
      return;
    }
    if (!knowledgeText.trim()) {
      setError('Please provide text content.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await knowledgeService.ingestText(createdWidgetId, knowledgeTitle.trim() || 'Knowledge Base', knowledgeText.trim());
      setKnowledgeActionsDone((v) => v + 1);
      setSuccess('Text knowledge added successfully.');
      setKnowledgeText('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add text knowledge.');
    } finally {
      setBusy(false);
    }
  };

  const addDocumentKnowledge = async () => {
    if (!createdWidgetId) {
      setError('Create widget first.');
      return;
    }
    if (!uploadFile) {
      setError('Please choose a file first (PDF, DOCX, XLSX).');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await knowledgeService.uploadDocument(uploadFile, createdWidgetId);
      setKnowledgeActionsDone((v) => v + 1);
      setSuccess('Document uploaded successfully.');
      setUploadFile(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setBusy(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setSuccess('Share link copied to clipboard.');
    } catch {
      setError('Could not copy link. Please copy it manually.');
    }
  };

  const moveToIntegrationStep = () => {
    setActiveStep(2);
    setError('');
    if (knowledgeActionsDone > 0) {
      setSuccess('Knowledge added. Next step: choose integrations.');
    } else {
      setSuccess('You can set integrations now and still add knowledge later.');
    }
  };

  const moveToShareStep = () => {
    setActiveStep(3);
    setError('');
    if (whatsappConfigured) {
      setSuccess('Integrations configured. Your share link is ready.');
    } else {
      setSuccess('You can share and test now, then add integrations later.');
    }
  };

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccess(message);
      setError('');
    } catch {
      setError('Could not copy. Please copy manually.');
    }
  };

  const handleWhatsAppField = (field: keyof WhatsAppFormState, value: string | boolean) => {
    setWhatsappForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveWhatsAppIntegration = async () => {
    if (!createdWidgetId) {
      setError('Create widget first.');
      return;
    }
    if (!whatsappForm.phone_number_id.trim() || !whatsappForm.access_token.trim() || !whatsappForm.verify_token.trim()) {
      setError('Please fill required WhatsApp fields: Phone Number ID, Access Token, and Verify Token.');
      return;
    }

    try {
      setWhatsappSaving(true);
      setError('');

      await whatsappService.saveConfig({
        widget_id: createdWidgetId,
        phone_number_id: whatsappForm.phone_number_id.trim(),
        waba_id: whatsappForm.waba_id.trim() || undefined,
        access_token: whatsappForm.access_token.trim(),
        verify_token: whatsappForm.verify_token.trim(),
        business_phone_number: whatsappForm.business_phone_number.trim() || undefined,
        is_active: whatsappForm.is_active,
      });

      setWhatsappConfigured(whatsappForm.is_active);
      setWhatsappForm((prev) => ({ ...prev, access_token: '' }));
      setSuccess('WhatsApp integration saved successfully.');
      setIntegrationDialogOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save WhatsApp integration.');
    } finally {
      setWhatsappSaving(false);
    }
  };

  const sendWhatsAppTest = async () => {
    if (!testToNumber.trim() || !testMessage.trim()) {
      setError('Enter recipient number and test message.');
      return;
    }

    try {
      setWhatsappTesting(true);
      setError('');
      await whatsappService.sendTestMessage({
        to_number: testToNumber.trim(),
        message: testMessage.trim(),
      });
      setSuccess('WhatsApp test message sent successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send WhatsApp test message.');
    } finally {
      setWhatsappTesting(false);
    }
  };

  return (
    <AdminLayout>
      <Box sx={pageShellSx}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background:
              'linear-gradient(132deg, transparent 16%, rgba(132,172,228,0.2) 17%, transparent 34%), linear-gradient(36deg, transparent 52%, rgba(111,165,229,0.16) 53%, transparent 72%)',
          }}
        />

      <Stack spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
        <Card sx={{ ...sectionPanelSx, borderRadius: '24px' }}>
          <CardContent sx={{ p: { xs: 2, md: 2.6 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.8, letterSpacing: '-0.02em' }}>
                  Create Chat Agent
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Guided setup flow to launch a polished AI agent with knowledge, integrations, and share-ready testing.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="4-Step Wizard" color="primary" variant="outlined" />
                <Chip label="Knowledge Ready" color="secondary" variant="outlined" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ ...sectionPanelSx }}>
          <CardContent>
            <Stepper
              activeStep={activeStep}
              alternativeLabel
              sx={{
                '& .MuiStepLabel-label': { fontWeight: 600 },
                '& .MuiStepIcon-root': {
                  color: alpha(theme.palette.primary.main, 0.24),
                },
                '& .MuiStepIcon-root.Mui-active': {
                  color: theme.palette.primary.main,
                },
                '& .MuiStepIcon-root.Mui-completed': {
                  color: theme.palette.success.main,
                },
              }}
            >
              {integrationSteps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.error.dark, 0.12)}` }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ borderRadius: '14px', boxShadow: `0 10px 18px ${alpha(theme.palette.success.dark, 0.12)}` }}>
            {success}
          </Alert>
        )}

        {activeStep === 0 && (
          <Card sx={{ ...sectionPanelSx }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Step 1: Create Widget (Agent)</Typography>
                <TextField
                  label="Agent Name"
                  value={widget.name}
                  onChange={(e) => setWidget((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Sales Assistant"
                  fullWidth
                  sx={fieldSx}
                />
                <TextField
                  label="Welcome Message"
                  value={widget.welcome_message || ''}
                  onChange={(e) => setWidget((prev) => ({ ...prev, welcome_message: e.target.value }))}
                  fullWidth
                  sx={fieldSx}
                />
                <TextField
                  label="System Prompt (Optional)"
                  value={widget.system_prompt || ''}
                  onChange={(e) => setWidget((prev) => ({ ...prev, system_prompt: e.target.value }))}
                  fullWidth
                  multiline
                  minRows={4}
                  placeholder="Example: You are a concise sales assistant. Ask discovery questions before recommending solutions."
                  helperText="This overrides the default assistant prompt for this agent. Leave empty to use the built-in default."
                  sx={fieldSx}
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Primary Color"
                    value={widget.primary_color}
                    onChange={(e) => setWidget((prev) => ({ ...prev, primary_color: e.target.value }))}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Position"
                    value={widget.position}
                    onChange={(e) => setWidget((prev) => ({ ...prev, position: e.target.value }))}
                    select
                    SelectProps={{ native: true }}
                    sx={fieldSx}
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </TextField>
                </Box>
                <Box>
                  <Button
                    variant="contained"
                    onClick={createWidget}
                    disabled={busy}
                    sx={{
                      borderRadius: '12px',
                      px: 2.2,
                      boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                      background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                    }}
                  >
                    {busy ? <CircularProgress size={20} /> : 'Create Agent'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Card sx={{ ...sectionPanelSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Step 2: Add Knowledge Base</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Agent ID: <strong>{createdWidgetId}</strong>
                  </Typography>
                  <TextField
                    label="Website URL"
                    value={knowledgeUrl}
                    onChange={(e) => setKnowledgeUrl(e.target.value)}
                    placeholder="https://example.com"
                    fullWidth
                    sx={fieldSx}
                  />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      label="Max Pages"
                      type="number"
                      value={crawlMaxPages}
                      onChange={(e) => setCrawlMaxPages(Math.max(1, Number(e.target.value) || 1))}
                      inputProps={{ min: 1 }}
                      fullWidth
                      sx={fieldSx}
                    />
                    <TextField
                      label="Max Depth"
                      type="number"
                      value={crawlMaxDepth}
                      onChange={(e) => setCrawlMaxDepth(Math.max(1, Number(e.target.value) || 1))}
                      inputProps={{ min: 1 }}
                      fullWidth
                      sx={fieldSx}
                    />
                  </Box>
                  <Button variant="outlined" onClick={addWebsiteKnowledge} disabled={busy}>
                    Add Website Knowledge
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ ...sectionPanelSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Upload Document</Typography>
                  <Button variant="outlined" component="label" disabled={busy}>
                    {uploadFile ? `Selected: ${uploadFile.name}` : 'Choose File (PDF/DOCX/XLSX)'}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  <Button variant="outlined" onClick={addDocumentKnowledge} disabled={busy}>
                    Upload Document Knowledge
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ ...sectionPanelSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Add Text Knowledge</Typography>
                  <TextField
                    label="Title"
                    value={knowledgeTitle}
                    onChange={(e) => setKnowledgeTitle(e.target.value)}
                    fullWidth
                    sx={fieldSx}
                  />
                  <TextField
                    label="Knowledge Content"
                    value={knowledgeText}
                    onChange={(e) => setKnowledgeText(e.target.value)}
                    multiline
                    rows={6}
                    fullWidth
                    placeholder="Paste FAQs, product details, policies, etc."
                    sx={fieldSx}
                  />
                  <Button variant="outlined" onClick={addTextKnowledge} disabled={busy}>
                    Add Text Knowledge
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Box>
              <Button
                variant="contained"
                onClick={moveToIntegrationStep}
                disabled={busy}
                sx={{
                  borderRadius: '12px',
                  px: 2.2,
                  boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                  background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                }}
              >
                Continue to Integrations
              </Button>
            </Box>
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            <Card sx={{ ...sectionPanelSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Step 3: Integrations</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose where your agent should work beyond website chat. WhatsApp is fully supported; Teams and Slack are staged next.
                  </Typography>
                  <Alert severity="info">
                    WhatsApp requires plan support (`whatsapp_enabled`) and valid Meta Cloud API credentials.
                  </Alert>
                </Stack>
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card sx={{ ...sectionPanelSx, height: '100%' }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <WhatsAppIcon color="success" />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            WhatsApp (Meta)
                          </Typography>
                        </Stack>
                        <Chip
                          label={whatsappConfigured ? 'Connected' : 'Not Connected'}
                          color={whatsappConfigured ? 'success' : 'default'}
                          size="small"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Connect Meta WhatsApp Cloud API for two-way messaging with the same knowledge base.
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{
                          alignItems: { xs: 'stretch', sm: 'center' },
                          flexWrap: 'wrap',
                        }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={openMetaWhatsAppWizard}
                          sx={{ minWidth: { sm: 128 }, py: 0.55, px: 1.25, whiteSpace: 'nowrap' }}
                        >
                          Launch Meta Wizard
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setIntegrationDialogOpen(true)}
                          sx={{ minWidth: { sm: 102 }, py: 0.55, px: 1.4, whiteSpace: 'nowrap' }}
                        >
                          Configure
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => window.open('/integrations/whatsapp', '_blank', 'noopener,noreferrer')}
                          sx={{ minWidth: { sm: 126 }, py: 0.55, px: 1.25 }}
                        >
                          Open Full Page
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ ...sectionPanelSx, height: '100%', opacity: 0.92 }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <GroupsIcon color="primary" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Microsoft Teams
                        </Typography>
                      </Stack>
                      <Chip label="Coming Soon" size="small" color="warning" sx={{ width: 'fit-content' }} />
                      <Typography variant="body2" color="text.secondary">
                        Teams channel integration is available as a roadmap option and can be enabled in the same flow.
                      </Typography>
                      <Button variant="outlined" disabled>
                        Configure
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ ...sectionPanelSx, height: '100%', opacity: 0.92 }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ForumIcon color="primary" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Slack
                        </Typography>
                      </Stack>
                      <Chip label="Coming Soon" size="small" color="warning" sx={{ width: 'fit-content' }} />
                      <Typography variant="body2" color="text.secondary">
                        Slack bot integration can be added here next with workspace OAuth and event webhook setup.
                      </Typography>
                      <Button variant="outlined" disabled>
                        Configure
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box>
              <Button
                variant="contained"
                onClick={moveToShareStep}
                sx={{
                  borderRadius: '12px',
                  px: 2.2,
                  boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                  background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                }}
              >
                Continue to Share Link
              </Button>
            </Box>
          </Stack>
        )}

        {activeStep === 3 && (
          <Card sx={{ ...sectionPanelSx }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Step 4: Share Test Link</Typography>
                <Typography variant="body2" color="text.secondary">
                  Anyone with this link can open a webpage and test your chatbot in a bottom-right widget.
                </Typography>
                <TextField value={shareLink} fullWidth InputProps={{ readOnly: true }} sx={fieldSx} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyShareLink}
                    sx={{
                      borderRadius: '12px',
                      px: 2.2,
                      boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                      background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                    }}
                  >
                    Copy Link
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<LaunchIcon />}
                    onClick={() => window.open(shareLink, '_blank', 'noopener,noreferrer')}
                  >
                    Open Test Page
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Tip: If your backend is running on a different URL, set `VITE_API_URL` in frontend `.env` before sharing.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={integrationDialogOpen}
          onClose={() => setIntegrationDialogOpen(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{ sx: { ...sectionPanelSx, borderRadius: '18px' } }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            WhatsApp Integration (Meta Cloud API)
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                This popup lets you finish Meta setup directly from the wizard using the newly created agent.
              </Typography>

              <Alert severity="info" action={<Button color="inherit" size="small" onClick={openMetaWhatsAppWizard}>Launch Wizard</Button>}>
                Use Meta onboarding wizard to get Phone Number ID and token faster.
              </Alert>

              <TextField label="Agent ID" value={createdWidgetId} fullWidth disabled />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Phone Number ID *"
                    value={whatsappForm.phone_number_id}
                    onChange={(e) => handleWhatsAppField('phone_number_id', e.target.value)}
                    fullWidth
                    sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="WABA ID"
                    value={whatsappForm.waba_id}
                    onChange={(e) => handleWhatsAppField('waba_id', e.target.value)}
                    fullWidth
                    sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Meta Access Token *"
                    value={whatsappForm.access_token}
                    onChange={(e) => handleWhatsAppField('access_token', e.target.value)}
                    type="password"
                    helperText="Required when saving config"
                    fullWidth
                    sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Webhook Verify Token *"
                    value={whatsappForm.verify_token}
                    onChange={(e) => handleWhatsAppField('verify_token', e.target.value)}
                    fullWidth
                    sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Business Phone Number"
                    value={whatsappForm.business_phone_number}
                    onChange={(e) => handleWhatsAppField('business_phone_number', e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    fullWidth
                    sx={fieldSx}
                  />
                </Grid>
              </Grid>

              <Card sx={{ ...sectionPanelSx, borderRadius: '14px' }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Meta Webhook Setup</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Callback URL: {webhookUrl}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => copyToClipboard(webhookUrl, 'Webhook URL copied.')}
                      >
                        Copy Webhook URL
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => copyToClipboard(whatsappForm.verify_token, 'Verify token copied.')}
                      >
                        Copy Verify Token
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Send Test Message</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Recipient Number"
                      value={testToNumber}
                      onChange={(e) => setTestToNumber(e.target.value)}
                      placeholder="9198XXXXXXXX"
                      fullWidth
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Message"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      fullWidth
                      sx={fieldSx}
                    />
                  </Grid>
                </Grid>
                <Box>
                  <Button variant="outlined" onClick={sendWhatsAppTest} disabled={whatsappTesting}>
                    {whatsappTesting ? 'Sending...' : 'Send Test Message'}
                  </Button>
                </Box>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIntegrationDialogOpen(false)} sx={{ borderRadius: '10px' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={saveWhatsAppIntegration}
              disabled={whatsappSaving}
              sx={{
                borderRadius: '10px',
                background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
              }}
            >
              {whatsappSaving ? 'Saving...' : 'Save WhatsApp Integration'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
      </Box>
    </AdminLayout>
  );
};

export default CreateChatAgentPage;
