import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../components/Layout/AdminLayout';
import api from '../services/api';
import { knowledgeService } from '../services/knowledgeService';
import { launchWhatsAppEmbeddedSignup, loadFacebookSdk } from '../services/metaEmbeddedSignup';
import { whatsappService } from '../services/whatsappService';
import {
  buildApiUrl,
  buildPublicUrl,
  getMetaAppId,
  getMetaEmbeddedSignupConfigId,
  getMetaWhatsAppEmbeddedSignupUrl,
} from '../config/env';
import type { CrawlJobStatus } from '../types';
import { FEATURE_CODES, CREDIT_ERRORS } from "../types/creditModules";
import { useCredits } from "../context/CreditsContext";
import { useDateFormatter } from '../hooks/useDateFormatter';

interface WidgetConfig {
  widget_id: string;
  name: string;
  welcome_message?: string;
  system_prompt?: string;
  escalation_contact_level_1?: string;
  escalation_contact_level_2?: string;
  primary_color: string;
  secondary_color: string;
  chat_header_font_color?: string;
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

interface IconOption {
  id: string;
  label: string;
  glyph: string;
}

interface CrawlPreviewItem {
  url: string;
  depth: number;
  selected: boolean;
}

const initialWhatsAppForm: WhatsAppFormState = {
  phone_number_id: '',
  waba_id: '',
  access_token: '',
  verify_token: '',
  business_phone_number: '',
  is_active: true,
};

const BOT_ICON_OPTIONS: IconOption[] = [
  { id: 'bot-robot', label: 'Robot', glyph: '🤖' },
  { id: 'bot-spark', label: 'Spark', glyph: '✨' },
  { id: 'bot-brain', label: 'Brain', glyph: '🧠' },
  { id: 'bot-guide', label: 'Guide', glyph: '🛰️' },
  { id: 'bot-helper', label: 'Helper', glyph: '🧑‍🔧' },
  { id: 'bot-assistant', label: 'Assistant', glyph: '🤝' },
  { id: 'bot-shield', label: 'Shield', glyph: '🛡️' },
  { id: 'bot-light', label: 'Light', glyph: '💡' },
];

const USER_ICON_OPTIONS: IconOption[] = [
  { id: 'user-person', label: 'Person', glyph: '👤' },
  { id: 'user-smile', label: 'Smile', glyph: '🙂' },
  { id: 'user-chat', label: 'Chat', glyph: '💬' },
  { id: 'user-brief', label: 'Work', glyph: '🧑‍💼' },
  { id: 'user-student', label: 'Student', glyph: '🧑‍🎓' },
  { id: 'user-creative', label: 'Creative', glyph: '🎨' },
  { id: 'user-tech', label: 'Tech', glyph: '🧑‍💻' },
  { id: 'user-star', label: 'Star', glyph: '🌟' },
];

const getIconGlyph = (iconId: string, role: 'bot' | 'user'): string => {
  const source = role === 'bot' ? BOT_ICON_OPTIONS : USER_ICON_OPTIONS;
  return source.find((item) => item.id === iconId)?.glyph || source[0].glyph;
};

const parseStyleSelection = (leadFieldsRaw?: string): { botIcon?: string; userIcon?: string; chatHeaderFontColor?: string } => {
  if (!leadFieldsRaw) return {};
  try {
    const parsed = JSON.parse(leadFieldsRaw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return {
      botIcon: typeof (parsed as any).bot_icon === 'string' ? (parsed as any).bot_icon : undefined,
      userIcon: typeof (parsed as any).user_icon === 'string' ? (parsed as any).user_icon : undefined,
      chatHeaderFontColor:
        typeof (parsed as any).chat_header_font_color === 'string'
          ? (parsed as any).chat_header_font_color
          : undefined,
    };
  } catch {
    return {};
  }
};

const CreateChatAgentPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { widgetId: routeWidgetId } = useParams<{ widgetId?: string }>();
  const isEditMode = Boolean(routeWidgetId?.trim());
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [initializingEdit, setInitializingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [widget, setWidget] = useState<WidgetConfig>({
    widget_id: `widget_${Date.now()}`,
    name: '',
    welcome_message: 'Hi! How can I help you?',
    system_prompt: '',
    escalation_contact_level_1: '',
    escalation_contact_level_2: '',
    primary_color: '#2f6bff',
    secondary_color: '#36c4ff',
    chat_header_font_color: '',
    position: 'bottom-right',
    lead_capture_enabled: true,
    lead_fields: '',
  });

  const [errors, setErrors] = useState({
      name: "",
    });

  const [createdWidgetId, setCreatedWidgetId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareLinkExpiresAt, setShareLinkExpiresAt] = useState('');
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [knowledgeUrl, setKnowledgeUrl] = useState('');
  const [crawlMaxPages, setCrawlMaxPages] = useState(10);
  const [crawlMaxDepth, setCrawlMaxDepth] = useState(2);
  const [knowledgeTitle, setKnowledgeTitle] = useState('FAQ and Product Knowledge');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [crawlPreviewItems, setCrawlPreviewItems] = useState<CrawlPreviewItem[]>([]);
  const [crawlJobStatus, setCrawlJobStatus] = useState<CrawlJobStatus | null>(null);
  const [refreshingCrawlStatus, setRefreshingCrawlStatus] = useState(false);
  const [previewCrawling, setPreviewCrawling] = useState(false);
  const [knowledgeActionsDone, setKnowledgeActionsDone] = useState(0);
  const [knowledgeFlowStep, setKnowledgeFlowStep] = useState(0);

  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState<WhatsAppFormState>(initialWhatsAppForm);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaSdkReady, setMetaSdkReady] = useState(false);
  const [metaSdkFailed, setMetaSdkFailed] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testToNumber, setTestToNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Zentrixel WhatsApp bot');
  const [showWidgetPreview, setShowWidgetPreview] = useState(true);
  const [botIcon, setBotIcon] = useState('bot-robot');
  const [userIcon, setUserIcon] = useState('user-person');
  const { getRequiredCreditInfo, totalCredits, deductCredits } = useCredits();
  const formatDisplayDate = useDateFormatter()

  const integrationSteps = useMemo(
    () => [isEditMode ? 'Update Widget' : 'Create Widget', 'Add Knowledge Base', 'Integrations', 'Share Test Link'],
    [isEditMode]
  );

  const stepDescriptions = useMemo(
    () => [
      isEditMode
        ? 'Refine brand, style, and conversation personality for this existing agent.'
        : 'Define brand, style, and conversation personality.',
      'Train your agent with website pages, docs, and internal knowledge.',
      'Connect external channels and automation-ready integrations.',
      'Share a live test URL and hand over for stakeholder review.',
    ],
    [isEditMode]
  );

  const stepProgress = useMemo(
    () => ((activeStep + 1) / integrationSteps.length) * 100,
    [activeStep, integrationSteps.length]
  );

  const selectedPreviewCount = useMemo(
    () => crawlPreviewItems.filter((item) => item.selected).length,
    [crawlPreviewItems]
  );

  const crawlJobActive = useMemo(
    () => Boolean(crawlJobStatus && (crawlJobStatus.status === 'queued' || crawlJobStatus.status === 'running')),
    [crawlJobStatus]
  );

  const knowledgeEditingLocked = crawlJobActive;
  const canAdvanceToStepB = selectedPreviewCount > 0;
  const canAdvanceToStepC = crawlJobStatus?.status === 'completed';
  const embedJobCompleted = crawlJobStatus?.status === 'completed';
  const canRunEmbedSelected = !busy && !crawlJobActive && selectedPreviewCount > 0 && !embedJobCompleted;

  const goBackStep = () => {
    setActiveStep((prev) => Math.max(0, prev - 1));
    setError('');
  };

  const previewGradient = useMemo(
    () => `linear-gradient(120deg, ${widget.primary_color || '#2f6bff'} 0%, ${widget.secondary_color || widget.primary_color || '#36c4ff'} 100%)`,
    [widget.primary_color, widget.secondary_color]
  );

  const previewHeaderTextColor = useMemo(() => {
    const configured = (widget.chat_header_font_color || '').trim();
    return configured || '#ffffff';
  }, [widget.chat_header_font_color]);

  const previewPositionSx = useMemo(() => {
    if (widget.position === 'bottom-left') return { left: { xs: 8, md: 16 }, bottom: { xs: 8, md: 16 } };
    if (widget.position === 'top-right') return { right: { xs: 8, md: 16 }, top: { xs: 8, md: 16 } };
    if (widget.position === 'top-left') return { left: { xs: 8, md: 16 }, top: { xs: 8, md: 16 } };
    return { right: { xs: 8, md: 16 }, bottom: { xs: 8, md: 16 } };
  }, [widget.position]);

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

  const modernStepCardSx = {
    ...sectionPanelSx,
    borderRadius: '22px',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
    background: `linear-gradient(152deg, ${alpha(theme.palette.common.white, 0.82)} 0%, ${alpha(
      theme.palette.background.paper,
      0.9
    )} 64%, ${alpha('#d7e7fb', 0.85)} 100%)`,
    boxShadow: `0 18px 34px ${alpha(theme.palette.primary.dark, 0.18)}`,
    transition: 'transform 220ms ease, box-shadow 220ms ease',
  } as const;

  const accentPanelSx = {
    borderRadius: '16px',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
    background: `linear-gradient(145deg, ${alpha('#ffffff', 0.86)} 0%, ${alpha('#ecf3ff', 0.92)} 100%)`,
    p: 1.7,
    transition: 'border-color 220ms ease, box-shadow 220ms ease, transform 220ms ease',
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.34),
      boxShadow: `0 12px 26px ${alpha(theme.palette.primary.dark, 0.11)}`,
    },
  } as const;

  const stepActionBarSx = {
    borderRadius: '14px',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    background: `linear-gradient(145deg, ${alpha('#ffffff', 0.78)} 0%, ${alpha('#eaf2ff', 0.82)} 100%)`,
    px: 1.4,
    py: 1.1,
    backdropFilter: 'blur(6px)',
  } as const;

  const stepTransitionSx = {
    animation: 'wizardStepReveal 360ms cubic-bezier(0.22, 1, 0.36, 1)',
    transformOrigin: '50% 24%',
    '@keyframes wizardStepReveal': {
      '0%': {
        opacity: 0,
        transform: 'translateY(12px) scale(0.992)',
      },
      '100%': {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
      },
    },
  } as const;

  const integrationCardSx = {
    ...accentPanelSx,
    p: 0,
    height: '100%',
    minHeight: { xs: 'auto', md: 234 },
    '&:hover': {
      transform: { md: 'translateY(-3px)' },
      borderColor: alpha(theme.palette.primary.main, 0.4),
      boxShadow: `0 16px 30px ${alpha(theme.palette.primary.dark, 0.15)}`,
    },
  } as const;

  const stepReadiness = useMemo(() => {
    if (activeStep === 0) {
      const checks = [widget.name.trim(), widget.welcome_message?.trim(), widget.primary_color, widget.position];
      return Math.round((checks.filter(Boolean).length / checks.length) * 100);
    }
    if (activeStep === 1) {
      return Math.min(100, knowledgeActionsDone * 35);
    }
    if (activeStep === 2) {
      return whatsappConfigured ? 100 : 60;
    }
    return createdWidgetId ? 100 : 70;
  }, [activeStep, widget.name, widget.welcome_message, widget.primary_color, widget.position, knowledgeActionsDone, whatsappConfigured, createdWidgetId]);

  const fetchShareLink = useCallback(async (targetWidgetId: string): Promise<string> => {
    if (!targetWidgetId) {
      setShareLink('');
      setShareLinkExpiresAt('');
      return '';
    }

    setShareLinkLoading(true);
    try {
      const response = await api.get(`/api/admin/widget/test-link/${encodeURIComponent(targetWidgetId)}`);
      const token = String(response?.data?.token || '').trim();
      if (!token) {
        throw new Error('Missing test link token');
      }

      const url = buildPublicUrl(`/agent-test/${encodeURIComponent(targetWidgetId)}?token=${encodeURIComponent(token)}`);
      setShareLink(url);
      setShareLinkExpiresAt(typeof response?.data?.expires_at === 'string' ? response.data.expires_at : '');
      return url;
    } catch (err: any) {
      setShareLink('');
      setShareLinkExpiresAt('');
      setError(err?.response?.data?.detail || 'Failed to generate expiring test link.');
      return '';
    } finally {
      setShareLinkLoading(false);
    }
  }, []);

  const webhookUrl = useMemo(() => buildApiUrl('/api/channels/whatsapp/webhook'), []);
  const metaRedirectUri = useMemo(
    () => buildApiUrl(`/api/admin/whatsapp/embedded/callback`),
    []
  );

  useEffect(() => {
    if (!createdWidgetId) {
      setShareLink('');
      setShareLinkExpiresAt('');
      return;
    }

    fetchShareLink(createdWidgetId);
  }, [createdWidgetId, fetchShareLink]);

  useEffect(() => {
    if (!isEditMode || !routeWidgetId?.trim()) {
      return;
    }

    let active = true;

    const loadWidgetForEdit = async () => {
      try {
        setInitializingEdit(true);
        setError('');
        const resolvedWidgetId = routeWidgetId.trim();
        const response = await api.get(`/api/admin/widget/config/${encodeURIComponent(resolvedWidgetId)}`);
        if (!active) return;

        const config = response?.data || {};
        const loadedWidgetId = (config.widget_id || resolvedWidgetId).toString();

        setWidget((prev) => ({
          ...prev,
          widget_id: loadedWidgetId,
          name: config.name || prev.name,
          welcome_message: config.welcome_message || prev.welcome_message,
          system_prompt: config.system_prompt || '',
          escalation_contact_level_1:
            typeof config.escalation_contact_level_1 === 'string'
              ? config.escalation_contact_level_1
              : prev.escalation_contact_level_1,
          escalation_contact_level_2:
            typeof config.escalation_contact_level_2 === 'string'
              ? config.escalation_contact_level_2
              : prev.escalation_contact_level_2,
          primary_color: config.primary_color || prev.primary_color,
          secondary_color: config.secondary_color || prev.secondary_color,
          position: config.position || prev.position,
          lead_capture_enabled:
            typeof config.lead_capture_enabled === 'boolean' ? config.lead_capture_enabled : prev.lead_capture_enabled,
          lead_fields: typeof config.lead_fields === 'string' ? config.lead_fields : prev.lead_fields,
        }));

        const styleSelection = parseStyleSelection(typeof config.lead_fields === 'string' ? config.lead_fields : undefined);
        if (styleSelection.botIcon) setBotIcon(styleSelection.botIcon);
        if (styleSelection.userIcon) setUserIcon(styleSelection.userIcon);
        if (styleSelection.chatHeaderFontColor) {
          setWidget((prev) => ({ ...prev, chat_header_font_color: styleSelection.chatHeaderFontColor }));
        }

        setCreatedWidgetId(loadedWidgetId);
        setSuccess('Loaded existing agent configuration for editing.');
      } catch (err: any) {
        if (!active) return;
        setError(err.response?.data?.detail || 'Failed to load agent for editing.');
      } finally {
        if (active) setInitializingEdit(false);
      }
    };

    loadWidgetForEdit();

    return () => {
      active = false;
    };
  }, [isEditMode, routeWidgetId]);

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

  const openMetaOAuthFallback = (metaAppId: string) => {
    const state = `wa_${Date.now()}`;
    const oauthUrl =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(metaAppId)}` +
      `&redirect_uri=${encodeURIComponent(metaRedirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('business_management,whatsapp_business_management,whatsapp_business_messaging')}` +
      `&state=${encodeURIComponent(state)}`;

    const popup = window.open(oauthUrl, 'meta_whatsapp_oauth', 'width=980,height=760,resizable=yes,scrollbars=yes');
    if (!popup) {
      window.location.assign(oauthUrl);
      setError('Popup blocked. Opened Meta signup in current tab.');
    } else {
      setSuccess('Meta signup opened via OAuth fallback. Complete setup in popup.');
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      setMetaConnecting(true);
      await whatsappService.disconnectWhatsApp();
      setWhatsappForm(initialWhatsAppForm);
      setWhatsappConfigured(false);
      setSuccess("WhatsApp disconnected successfully");
    } catch (error: any) {
      setError(
        error?.response?.data?.detail ||
        error.message
      );
    } finally {
      setMetaConnecting(false);
    }
  };

  const handleMetaAuthCode = useCallback(async (code: string, source: 'sdk' | 'redirect' = 'sdk') => {
    if (!createdWidgetId) {
      throw new Error('Save agent profile first before connecting WhatsApp.');
    }

    const exchange = await whatsappService.exchangeEmbeddedSignupCode({
      code,
      redirect_uri: source === 'redirect' ? metaRedirectUri : undefined,
      widget_id: createdWidgetId,
      business_phone_number: (whatsappForm.business_phone_number || '').trim() || undefined,
      is_active: true,
      auto_save: true,
    });

    setSuccess(
      exchange.saved
        ? 'WhatsApp connected and saved successfully via Meta wizard.'
        : 'Meta wizard completed. Review values and save configuration.'
    );

    const config = await whatsappService.getConfig(createdWidgetId);

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
  }, [createdWidgetId, metaRedirectUri, whatsappForm.business_phone_number, whatsappForm.verify_token]);

  const openMetaWhatsAppWizard = async () => {
    if (!createdWidgetId) {
      setError('Save agent profile first before connecting WhatsApp.');
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
        openMetaOAuthFallback(metaAppId);
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

  useEffect(() => {

    const onMetaMessage = async (
      event: MessageEvent
    ) => {

      if (
        event.origin !==
        "https://www.facebook.com" &&
        event.origin !==
        "https://web.facebook.com"
      ) {
        return;
      }

      let payload: any;

      try {

        payload =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;

      } catch {
        return;
      }

      if (
        payload?.type !==
        "WA_EMBEDDED_SIGNUP"
      ) {
        return;
      }

      if (
        payload?.event !== "FINISH"
      ) {
        return;
      }

      const data = payload?.data;

      if (!data?.phone_number_id || !data?.waba_id) {
        return;
      }

      try {

        setMetaConnecting(true);

        await whatsappService.saveConfig({
          widget_id: createdWidgetId,
          phone_number_id: data.phone_number_id,
          waba_id: data.waba_id
        });

        setSuccess(
          "WhatsApp configuration saved successfully"
        );

      } catch (err: any) {
        setError(
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to save WhatsApp config"
        );
      } finally {
        setMetaConnecting(false);
      }
    };

    window.addEventListener(
      "message",
      onMetaMessage
    );

    return () =>
      window.removeEventListener(
        "message",
        onMetaMessage
      );

  }, [createdWidgetId]);

  useEffect(() => {
    if (!createdWidgetId || activeStep !== 2) return;

    let active = true;

    const loadWhatsAppConfig = async () => {
      try {
        const config = await whatsappService.getConfig(createdWidgetId);
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

  useEffect(() => {
    if (!createdWidgetId || activeStep !== 1) return;
    if (crawlJobStatus?.job_id) return;

    let active = true;

    const hydrateLatestActiveCrawlJob = async () => {
      try {
        const latestJob = await knowledgeService.getLatestActiveCrawlWebsiteJob(createdWidgetId);
        if (!active) return;
        if (latestJob?.job_id) {
          setCrawlJobStatus(latestJob);
        }
      } catch (err: any) {
        // Ignore when there is no active crawl job (404) and avoid noisy errors during edit flow.
        if (!active) return;
        const statusCode = err?.response?.status;
        if (statusCode && statusCode !== 404) {
          setError(err.response?.data?.detail || 'Failed to load active crawl/embed progress.');
        }
      }
    };

    hydrateLatestActiveCrawlJob();

    return () => {
      active = false;
    };
  }, [activeStep, createdWidgetId, crawlJobStatus?.job_id]);

  useEffect(() => {
    if (!crawlJobStatus?.job_id) return;
    if (crawlJobStatus.status !== 'queued' && crawlJobStatus.status !== 'running') return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextStatus = await knowledgeService.getCrawlWebsiteJobStatus(crawlJobStatus.job_id);
        if (cancelled) return;

        setCrawlJobStatus(nextStatus);

        if (nextStatus.status === 'completed') {
          if (nextStatus.chunks_embedded > 0) {
            console.log("total chunks", nextStatus?.chunks_embedded);
            deductCredits(FEATURE_CODES.KB_CHUNK, nextStatus.chunks_embedded, "crawling", crawlJobStatus.job_id)
          }
          setKnowledgeActionsDone((v) => v + 1);
          setSuccess(nextStatus.message || 'Website knowledge embedded successfully.');
          setError('');
        } else if (nextStatus.status === 'failed') {
          setError(nextStatus.error || nextStatus.message || 'Background crawl/embed failed.');
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'Failed to fetch crawl/embed progress.');
        setCrawlJobStatus((prev) => (prev ? { ...prev } : prev));
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [crawlJobStatus]);

  useEffect(() => {
    if (activeStep !== 1) return;

    if (crawlJobStatus?.status === 'completed') {
      setKnowledgeFlowStep(2);
      return;
    }

    if (crawlJobStatus?.status === 'queued' || crawlJobStatus?.status === 'running' || crawlPreviewItems.length > 0) {
      setKnowledgeFlowStep(1);
      return;
    }

    setKnowledgeFlowStep(0);
  }, [activeStep]);

  const buildWidgetPayload = () => {
    let leadFieldMetadata: Record<string, any> = {};
    const rawLeadFields = (widget.lead_fields || '').trim();
    if (rawLeadFields) {
      try {
        const parsed = JSON.parse(rawLeadFields);
        if (Array.isArray(parsed)) {
          leadFieldMetadata = { lead_fields: parsed };
        } else if (parsed && typeof parsed === 'object') {
          leadFieldMetadata = parsed;
        }
      } catch {
        leadFieldMetadata = { lead_fields_raw: rawLeadFields };
      }
    }

    return {
      ...widget,
      widget_id: widget.widget_id || `widget_${Date.now()}`,
      lead_fields: JSON.stringify({
        ...leadFieldMetadata,
        bot_icon: botIcon,
        user_icon: userIcon,
        ...(widget.chat_header_font_color?.trim()
          ? { chat_header_font_color: widget.chat_header_font_color.trim() }
          : {}),
      }),
    };
  };

  const saveWidgetProfile = async () => {

     const newErrors = {
      name: ""
    }

    if (!widget.name.trim()) {
      newErrors.name = `Please enter a widget name to ${isEditMode ? 'update' : 'create'} your agent.`;
      setErrors(newErrors);
      return;
    }

    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const payload = buildWidgetPayload();

      if (isEditMode) {
        await api.put(`/api/admin/widget/config/${encodeURIComponent(payload.widget_id)}`, payload);
      } else {
        await api.post('/api/admin/widget/config', payload);
      }

      const resolvedWidgetId = payload.widget_id;

      setCreatedWidgetId(resolvedWidgetId);
      setWidget((prev) => ({ ...prev, widget_id: resolvedWidgetId }));
      setSuccess(
        isEditMode
          ? 'Widget updated successfully. Next step: review knowledge base updates.'
          : 'Widget created successfully. Next step: add your knowledge base.'
      );
      setActiveStep(1);
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} widget.`);
    } finally {
      setBusy(false);
    }
  };

  const previewWebsiteLinks = async () => {
    if (!createdWidgetId) {
      setError('Save agent profile first.');
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
      setPreviewCrawling(true);
      setError('');
      setCrawlJobStatus(null);
      const result = await knowledgeService.previewWebsiteLinks({
        url: knowledgeUrl.trim(),
        max_pages: crawlMaxPages,
        max_depth: crawlMaxDepth,
      });

      const items = (result.discovered_urls || []).map((link) => ({
        url: link.url,
        depth: link.depth,
        selected: true,
      }));
      setCrawlPreviewItems(items);

      if (!items.length) {
        setSuccess('No links discovered. Try increasing max pages/depth or verify the URL.');
      } else {
        setSuccess(`Discovered ${items.length} links. Unselect any pages you do not want to embed.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to preview website links.');
    } finally {
      setPreviewCrawling(false);
      setBusy(false);
    }
  };

  const togglePreviewSelection = (url: string) => {
    setCrawlPreviewItems((prev) => prev.map((item) => (item.url === url ? { ...item, selected: !item.selected } : item)));
  };

  const setAllPreviewSelections = (selected: boolean) => {
    setCrawlPreviewItems((prev) => prev.map((item) => ({ ...item, selected })));
  };

  const addWebsiteKnowledge = async () => {
    if (!createdWidgetId) {
      setError('Save agent profile first.');
      return;
    }
    if (!knowledgeUrl.trim()) {
      setError('Please enter a website URL.');
      return;
    }
    if (!crawlPreviewItems.length) {
      setError('Preview links first, then choose which pages to embed.');
      return;
    }

    const selectedUrls = crawlPreviewItems.filter((item) => item.selected).map((item) => item.url);
    if (!selectedUrls.length) {
      setError('Select at least one link to embed.');
      return;
    }

    if (crawlJobActive) {
      setError('A crawl/embed job is already running. Please wait for it to finish.');
      return;
    }

    if (!validateCrawlingCredits()) {
      setError(CREDIT_ERRORS.BELOW_MIN_RESERVED)
      return;
    }

    try {
      setBusy(true);
      setError('');
      const result = await knowledgeService.startCrawlWebsiteJob({
        widget_id: createdWidgetId,
        url: knowledgeUrl.trim(),
        max_pages: selectedUrls.length,
        max_depth: crawlMaxDepth,
        selected_urls: selectedUrls,
      });
      setCrawlJobStatus(result);
      setSuccess(result?.message || `Started embedding ${selectedUrls.length} selected pages in background.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add website knowledge.');
    } finally {
      setBusy(false);
    }
  };

  const refreshCrawlProgress = async () => {
    if (!createdWidgetId) {
      setError('Save agent profile first.');
      return;
    }

    try {
      setRefreshingCrawlStatus(true);
      setError('');

      const previousStatus = crawlJobStatus?.status;
      let nextStatus: CrawlJobStatus | null = null;

      if (crawlJobStatus?.job_id) {
        try {
          nextStatus = await knowledgeService.getCrawlWebsiteJobStatus(crawlJobStatus.job_id);
        } catch (err: any) {
          if (err?.response?.status !== 404) {
            throw err;
          }
        }
      }

      if (!nextStatus) {
        nextStatus = await knowledgeService.getLatestActiveCrawlWebsiteJob(createdWidgetId);
      }

      setCrawlJobStatus(nextStatus);

      if (nextStatus.status === 'completed') {
        if (previousStatus !== 'completed') {
          setKnowledgeActionsDone((v) => v + 1);
        }
        setSuccess(nextStatus.message || 'Website knowledge embedding completed.');
      } else if (nextStatus.status === 'failed') {
        setError(nextStatus.error || nextStatus.message || 'Crawl/embed job failed.');
      } else {
        setSuccess(nextStatus.message || 'Crawl/embed progress refreshed.');
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('No active crawl/embed job found for this agent.');
      } else {
        setError(err.response?.data?.detail || 'Failed to refresh crawl/embed progress.');
      }
    } finally {
      setRefreshingCrawlStatus(false);
    }
  };

  const addTextKnowledge = async () => {
    if (knowledgeEditingLocked) {
      setError('Website embedding is in progress. Please wait before adding text knowledge.');
      return;
    }
    if (!createdWidgetId) {
      setError('Save agent profile first.');
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
    if (knowledgeEditingLocked) {
      setError('Website embedding is in progress. Please wait before uploading a document.');
      return;
    }
    if (!createdWidgetId) {
      setError('Save agent profile first.');
      return;
    }
    if (uploadFiles.length === 0) {
      setError('Please choose one or more files first (PDF, DOCX, XLSX).');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const uploads = await Promise.allSettled(
        uploadFiles.map((file) => knowledgeService.uploadDocument(file, createdWidgetId))
      );
      const successCount = uploads.filter((result) => result.status === 'fulfilled').length;
      const failedCount = uploads.length - successCount;

      if (successCount > 0) {
        setKnowledgeActionsDone((v) => v + successCount);
      }

      if (failedCount > 0) {
        setError(`Uploaded ${successCount}/${uploadFiles.length} documents. ${failedCount} failed.`);
      } else {
        setSuccess(`Uploaded ${successCount} document${successCount === 1 ? '' : 's'} successfully.`);
      }

      setUploadFiles([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setBusy(false);
    }
  };

  const copyShareLink = async () => {
    let linkToCopy = shareLink;
    if (!linkToCopy && createdWidgetId) {
      linkToCopy = await fetchShareLink(createdWidgetId);
    }
    if (!linkToCopy) {
      setError('Share link is not ready yet. Please try again.');
      return;
    }

    try {
      await navigator.clipboard.writeText(linkToCopy);
      setSuccess('Share link copied to clipboard.');
    } catch {
      setError('Could not copy link. Please copy it manually.');
    }
  };

  const moveToIntegrationStep = () => {
    if (knowledgeEditingLocked) {
      setError('Please wait for website crawling/embedding to finish before continuing to integrations.');
      return;
    }
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
      setError('Save agent profile first.');
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
      setError(err.response?.data?.detail || err?.detail || 'Failed to send WhatsApp test message.');
    } finally {
      setWhatsappTesting(false);
    }
  };

  const validateCrawlingCredits = () => {
    const credits = getRequiredCreditInfo(FEATURE_CODES.KB_CHUNK);

    if (credits.minReservedCredits != null && totalCredits < credits.minReservedCredits) {
      setError(CREDIT_ERRORS.BELOW_MIN_RESERVED);
      return false;
    }

    return true;
  };

  if (isEditMode && initializingEdit) {
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
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      color: 'text.primary',
                      mb: 0.8,
                      letterSpacing: '-0.025em',
                      fontSize: { xs: '1.7rem', md: '2.15rem' },
                      lineHeight: 1.14,
                    }}
                  >
                    {isEditMode ? 'Edit Chat Agent' : 'Create Chat Agent'}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {isEditMode
                      ? 'Guided editing flow to refine your existing AI agent with updated profile, knowledge, and integrations.'
                      : 'Guided setup flow to launch a polished AI agent with knowledge, integrations, and share-ready testing.'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label="4-Step Wizard" color="primary" variant="outlined" />
                  <Chip label={isEditMode ? 'Edit Mode' : 'Knowledge Ready'} color="secondary" variant="outlined" />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ ...sectionPanelSx, borderRadius: '20px' }}>
            <CardContent>
              <Stack spacing={2.1}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.2}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Box>
                    <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                      Wizard Progress
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Step {activeStep + 1} of {integrationSteps.length}: {integrationSteps[activeStep]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stepDescriptions[activeStep]}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Chip
                        size="small"
                        label={`Readiness ${stepReadiness}%`}
                        color={stepReadiness >= 80 ? 'success' : 'primary'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={activeStep === integrationSteps.length - 1 ? 'Final Step' : 'In Progress'}
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                  <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/widgets')}>
                    Exit Wizard
                  </Button>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={stepProgress}
                  sx={{
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: alpha(theme.palette.primary.main, 0.14),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 999,
                      background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(
                        theme.palette.primary.dark,
                        0.94
                      )} 100%)`,
                    },
                  }}
                />

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
              </Stack>
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
            <Card sx={{ ...modernStepCardSx, ...stepTransitionSx }}>
              <CardContent sx={{ p: { xs: 2, md: 2.6 } }}>
                <Grid container spacing={2.2}>
                  <Grid item xs={12} md={7}>
                    <Stack spacing={2}>
                      <Box sx={accentPanelSx}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.2}>
                          <Box>
                            <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                              Step 1
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.015em', fontSize: { xs: '1.03rem', md: '1.12rem' } }}>
                              {isEditMode ? 'Update Widget Identity' : 'Create Widget Identity'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {isEditMode
                                ? 'Refine voice, visuals, and placement for this live agent.'
                                : 'Set voice, visuals, and placement before creating the live agent.'}
                            </Typography>
                          </Box>
                          <Chip size="small" label={`Readiness ${stepReadiness}%`} color={stepReadiness >= 80 ? 'success' : 'primary'} />
                        </Stack>
                      </Box>

                      <TextField
                        required
                        label="Agent Name"
                        value={widget.name}
                        error={!!errors.name}
                        helperText={errors.name}
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
                        helperText="Override the default prompt for this specific agent."
                        sx={fieldSx}
                      />

                      <TextField
                        label="Escalation Contact Level 1"
                        value={widget.escalation_contact_level_1 || ''}
                        onChange={(e) => setWidget((prev) => ({ ...prev, escalation_contact_level_1: e.target.value }))}
                        fullWidth
                        placeholder="Support Team: support@example.com | +1-555-0101"
                        helperText="Used when the bot escalates conversations to first-level human support."
                        sx={fieldSx}
                      />

                      <TextField
                        label="Escalation Contact Level 2"
                        value={widget.escalation_contact_level_2 || ''}
                        onChange={(e) => setWidget((prev) => ({ ...prev, escalation_contact_level_2: e.target.value }))}
                        fullWidth
                        placeholder="Escalation Manager: escalation@example.com | +1-555-0102"
                        helperText="Fallback contact shown after Level 1 for escalated conversations."
                        sx={fieldSx}
                      />

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                        <TextField
                          label="Primary Color"
                          value={widget.primary_color}
                          onChange={(e) => setWidget((prev) => ({ ...prev, primary_color: e.target.value }))}
                          sx={fieldSx}
                        />
                        <TextField
                          label="Secondary Color"
                          value={widget.secondary_color}
                          onChange={(e) => setWidget((prev) => ({ ...prev, secondary_color: e.target.value }))}
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

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                        <TextField
                          label="Chat Header Font Color (Optional)"
                          value={widget.chat_header_font_color || ''}
                          onChange={(e) => setWidget((prev) => ({ ...prev, chat_header_font_color: e.target.value }))}
                          placeholder="Leave empty to use default white"
                          sx={fieldSx}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setWidget((prev) => ({ ...prev, chat_header_font_color: '' }))}
                          >
                            Use Default Header Font
                          </Button>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                        <Box sx={accentPanelSx}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
                            Primary Color Picker
                          </Typography>
                          <Box
                            component="input"
                            type="color"
                            value={widget.primary_color}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setWidget((prev) => ({ ...prev, primary_color: e.target.value }))
                            }
                            sx={{
                              width: '100%',
                              height: 44,
                              borderRadius: '10px',
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                              backgroundColor: alpha(theme.palette.common.white, 0.86),
                              p: 0.4,
                            }}
                          />
                        </Box>
                        <Box sx={accentPanelSx}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
                            Secondary Color Picker
                          </Typography>
                          <Box
                            component="input"
                            type="color"
                            value={widget.secondary_color}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setWidget((prev) => ({ ...prev, secondary_color: e.target.value }))
                            }
                            sx={{
                              width: '100%',
                              height: 44,
                              borderRadius: '10px',
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                              backgroundColor: alpha(theme.palette.common.white, 0.86),
                              p: 0.4,
                            }}
                          />
                        </Box>
                        <Box sx={accentPanelSx}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
                            Header Font Color Picker (Optional)
                          </Typography>
                          <Box
                            component="input"
                            type="color"
                            value={(widget.chat_header_font_color || '').trim() || '#ffffff'}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setWidget((prev) => ({ ...prev, chat_header_font_color: e.target.value }))
                            }
                            sx={{
                              width: '100%',
                              height: 44,
                              borderRadius: '10px',
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                              backgroundColor: alpha(theme.palette.common.white, 0.86),
                              p: 0.4,
                            }}
                          />
                        </Box>
                      </Box>

                      <Box sx={accentPanelSx}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Bot Icon (Predefined)
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {BOT_ICON_OPTIONS.map((option) => (
                            <Button
                              key={option.id}
                              variant={botIcon === option.id ? 'contained' : 'outlined'}
                              onClick={() => setBotIcon(option.id)}
                              sx={{ minWidth: 56, height: 44, borderRadius: '12px', fontSize: '1.2rem' }}
                              title={option.label}
                            >
                              {option.glyph}
                            </Button>
                          ))}
                        </Stack>

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, mt: 1.5 }}>
                          User Icon (Predefined)
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {USER_ICON_OPTIONS.map((option) => (
                            <Button
                              key={option.id}
                              variant={userIcon === option.id ? 'contained' : 'outlined'}
                              onClick={() => setUserIcon(option.id)}
                              sx={{ minWidth: 56, height: 44, borderRadius: '12px', fontSize: '1.2rem' }}
                              title={option.label}
                            >
                              {option.glyph}
                            </Button>
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={5}>
                    <Stack spacing={1.8}>
                      <Box sx={{ ...accentPanelSx, p: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            Live Widget Preview
                          </Typography>
                          <Button size="small" variant="outlined" onClick={() => setShowWidgetPreview((prev) => !prev)}>
                            {showWidgetPreview ? 'Hide' : 'Show'}
                          </Button>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.2 }}>
                          Instantly see how your style choices look for real users.
                        </Typography>

                        {showWidgetPreview && (
                          <Box
                            sx={{
                              position: 'relative',
                              height: { xs: 300, md: 360 },
                              borderRadius: '12px',
                              border: `1px dashed ${alpha(theme.palette.primary.main, 0.26)}`,
                              background:
                                'radial-gradient(circle at 18% 14%, rgba(111,165,229,0.16) 0%, transparent 32%), radial-gradient(circle at 82% 84%, rgba(79,182,241,0.16) 0%, transparent 34%), linear-gradient(180deg, #f8fbff 0%, #edf4ff 100%)',
                              overflow: 'hidden',
                            }}
                          >
                            <Box sx={{ position: 'absolute', ...previewPositionSx }}>
                              <Box
                                sx={{
                                  width: { xs: 252, md: 300 },
                                  height: { xs: 222, md: 260 },
                                  borderRadius: '14px',
                                  overflow: 'hidden',
                                  border: '1px solid rgba(148,163,184,0.38)',
                                  boxShadow: '0 20px 32px rgba(15,23,42,0.24)',
                                  bgcolor: '#ffffff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                              >
                                <Box sx={{ background: previewGradient, color: previewHeaderTextColor, py: 1, px: 1.25, fontWeight: 700, fontSize: '0.9rem' }}>
                                  {widget.name.trim() || 'AI Assistant'}
                                </Box>
                                <Box sx={{ flex: 1, p: { xs: 0.85, md: 1.1 }, bgcolor: '#f8fafc' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.8, mb: 1 }}>
                                    <Box sx={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#ffffff', fontSize: '0.95rem' }}>
                                      {getIconGlyph(botIcon, 'bot')}
                                    </Box>
                                    <Box sx={{ maxWidth: '82%', p: { xs: 0.85, md: 1 }, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', color: '#1e293b', fontSize: { xs: '0.76rem', md: '0.84rem' } }}>
                                      {(widget.welcome_message || 'Hi! How can I help you?').trim() || 'Hi! How can I help you?'}
                                    </Box>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 0.8 }}>
                                    <Box sx={{ maxWidth: '74%', p: { xs: 0.8, md: 1 }, borderRadius: 1.5, bgcolor: alpha(widget.primary_color || '#2f6bff', 0.95), color: '#fff', fontSize: { xs: '0.74rem', md: '0.82rem' } }}>
                                      Tell me about your pricing plans.
                                    </Box>
                                    <Box sx={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#ffffff', fontSize: '0.95rem' }}>
                                      {getIconGlyph(userIcon, 'user')}
                                    </Box>
                                  </Box>
                                </Box>
                                <Box sx={{ p: { xs: 0.8, md: 1 }, borderTop: '1px solid #e2e8f0', bgcolor: '#ffffff', display: 'flex', gap: 0.8 }}>
                                  <Box sx={{ flex: 1, px: 1, py: { xs: 0.65, md: 0.85 }, borderRadius: 1.2, border: '1px solid #cbd5e1', color: '#94a3b8', fontSize: { xs: '0.7rem', md: '0.78rem' } }}>
                                    Type your message...
                                  </Box>
                                  <Box sx={{ px: { xs: 1.1, md: 1.4 }, py: { xs: 0.65, md: 0.85 }, borderRadius: 1.2, color: '#fff', fontSize: { xs: '0.7rem', md: '0.78rem' }, background: previewGradient }}>
                                    Send
                                  </Box>
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Box>

                      <Box sx={accentPanelSx}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          Quick Checklist
                        </Typography>
                        <Typography variant="body2" color="text.secondary">1. Name and welcome tone are clear.</Typography>
                        <Typography variant="body2" color="text.secondary">2. Colors match your brand and dashboard.</Typography>
                        <Typography variant="body2" color="text.secondary">3. Widget position suits your website layout.</Typography>
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" sx={stepActionBarSx}>
                      <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/widgets')}>
                        Back to Agent Management
                      </Button>
                      <Button
                        variant="contained"
                        onClick={saveWidgetProfile}
                        disabled={busy}
                        sx={{
                          borderRadius: '12px',
                          px: 2.8,
                          boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                          background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                        }}
                      >
                        {busy ? <CircularProgress size={20} /> : isEditMode ? 'Update Agent and Continue' : 'Create Agent and Continue'}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {activeStep === 1 && (
            <Card sx={{ ...modernStepCardSx, ...stepTransitionSx }}>
              <CardContent sx={{ p: { xs: 2, md: 2.6 } }}>
                <Grid container spacing={2.2}>
                  <Grid item xs={12}>
                    <Box sx={accentPanelSx}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                        <Box>
                          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                            Step 2
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.015em', fontSize: { xs: '1.03rem', md: '1.12rem' } }}>
                            Add Knowledge Base
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Agent ID: <strong>{createdWidgetId}</strong>
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                          <Chip label={`Knowledge Actions ${knowledgeActionsDone}`} color={knowledgeActionsDone > 0 ? 'success' : 'default'} />
                          <Chip
                            label={`Chunks Embedded ${crawlJobStatus?.chunks_embedded || 0}`}
                            color={(crawlJobStatus?.chunks_embedded || 0) > 0 ? 'success' : 'default'}
                            variant="outlined"
                          />
                          {knowledgeEditingLocked && <Chip label="Embedding in Progress" color="warning" variant="outlined" />}
                        </Stack>
                      </Stack>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={7}>
                    <Stack spacing={2}>
                      <Box sx={accentPanelSx}>
                        <Stack spacing={1.4}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Website Crawl Workflow</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Optional path: use Step A to Step B to Step C for website crawl, or skip directly to FAQ text and document upload.
                          </Typography>

                          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                            <Chip label="Step A" color={knowledgeFlowStep === 0 ? 'primary' : knowledgeFlowStep > 0 ? 'success' : 'default'} variant={knowledgeFlowStep === 0 ? 'filled' : 'outlined'} />
                            <Chip label="Step B" color={knowledgeFlowStep === 1 ? 'primary' : knowledgeFlowStep > 1 ? 'success' : 'default'} variant={knowledgeFlowStep === 1 ? 'filled' : 'outlined'} />
                            <Chip label="Step C" color={knowledgeFlowStep === 2 ? 'primary' : 'default'} variant={knowledgeFlowStep === 2 ? 'filled' : 'outlined'} />
                          </Stack>

                          {knowledgeEditingLocked && (
                            <Alert severity="info">
                              Website embedding is running. To avoid conflicts, Continue to Integrations, Document Upload, and Add Text Knowledge are temporarily disabled.
                            </Alert>
                          )}

                          {knowledgeFlowStep === 0 && (
                            <Box
                              sx={{
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                borderRadius: '12px',
                                p: 1.2,
                                background: alpha(theme.palette.common.white, 0.72),
                              }}
                            >
                              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                                Step A
                              </Typography>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Preview Crawled Links
                              </Typography>

                              <Stack spacing={1.2}>
                                <TextField
                                  label="Website URL"
                                  value={knowledgeUrl}
                                  onChange={(e) => {
                                    setKnowledgeUrl(e.target.value);
                                    setCrawlPreviewItems([]);
                                  }}
                                  placeholder="https://example.com"
                                  fullWidth
                                  disabled={knowledgeEditingLocked}
                                  sx={fieldSx}
                                />
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                                  <TextField
                                    label="Max Pages"
                                    type="number"
                                    value={crawlMaxPages}
                                    onChange={(e) => {
                                      setCrawlMaxPages(Math.max(1, Number(e.target.value) || 1));
                                      setCrawlPreviewItems([]);
                                    }}
                                    inputProps={{ min: 1 }}
                                    fullWidth
                                    disabled={knowledgeEditingLocked}
                                    sx={fieldSx}
                                  />
                                  <TextField
                                    label="Max Depth"
                                    type="number"
                                    value={crawlMaxDepth}
                                    onChange={(e) => {
                                      setCrawlMaxDepth(Math.max(1, Number(e.target.value) || 1));
                                      setCrawlPreviewItems([]);
                                    }}
                                    inputProps={{ min: 1 }}
                                    fullWidth
                                    disabled={knowledgeEditingLocked}
                                    sx={fieldSx}
                                  />
                                </Box>

                                <Button variant="outlined" onClick={previewWebsiteLinks} disabled={previewCrawling || crawlJobActive}>
                                  {previewCrawling ? 'Preview Crawling...' : 'Preview Crawled Links'}
                                </Button>

                                {previewCrawling && (
                                  <Box
                                    sx={{
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                                      borderRadius: '10px',
                                      p: 1,
                                      background: alpha(theme.palette.common.white, 0.8),
                                    }}
                                  >
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                      <Typography variant="caption" color="text.secondary">
                                        Crawling website links for preview. Please wait...
                                      </Typography>
                                      <CircularProgress size={16} />
                                    </Stack>
                                    <LinearProgress sx={{ mt: 0.7, height: 7, borderRadius: 999 }} />
                                  </Box>
                                )}

                                {crawlPreviewItems.length > 0 ? (
                                  <Box
                                    sx={{
                                      mt: 0.2,
                                      border: `1px solid ${alpha(theme.palette.divider, 0.42)}`,
                                      borderRadius: '10px',
                                      p: 0.9,
                                      background: alpha(theme.palette.common.white, 0.86),
                                    }}
                                  >
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                      <Typography variant="caption" color="text.secondary">
                                        Discovered {crawlPreviewItems.length} links. Selected {selectedPreviewCount}.
                                      </Typography>
                                      <Stack direction="row" spacing={0.8}>
                                        <Button size="small" variant="text" onClick={() => setAllPreviewSelections(true)} disabled={knowledgeEditingLocked}>
                                          Select All
                                        </Button>
                                        <Button size="small" variant="text" onClick={() => setAllPreviewSelections(false)} disabled={knowledgeEditingLocked}>
                                          Unselect All
                                        </Button>
                                      </Stack>
                                    </Stack>

                                    <Box
                                      sx={{
                                        mt: 1,
                                        maxHeight: 240,
                                        overflowY: 'auto',
                                        borderRadius: '10px',
                                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                        p: 0.8,
                                        background: alpha(theme.palette.common.white, 0.9),
                                      }}
                                    >
                                      {crawlPreviewItems.map((item) => (
                                        <Box
                                          key={item.url}
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 0.8,
                                            px: 0.4,
                                            py: 0.45,
                                            borderRadius: '8px',
                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                          }}
                                        >
                                          <Checkbox
                                            size="small"
                                            checked={item.selected}
                                            disabled={knowledgeEditingLocked}
                                            onChange={() => togglePreviewSelection(item.url)}
                                            sx={{ mt: -0.3 }}
                                          />
                                          <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                              {item.url}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              Depth {item.depth}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))}
                                    </Box>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    Preview links to continue.
                                  </Typography>
                                )}

                                <Stack direction="row" justifyContent="flex-end">
                                  <Button
                                    variant="contained"
                                    onClick={() => setKnowledgeFlowStep(1)}
                                    disabled={!canAdvanceToStepB || knowledgeEditingLocked}
                                    sx={{
                                      position: 'relative',
                                      overflow: 'hidden',
                                      animation: canAdvanceToStepB && !knowledgeEditingLocked ? 'nextStepButtonGlow 2.2s ease-in-out infinite' : 'none',
                                      '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        top: '-25%',
                                        left: '-42%',
                                        width: '36%',
                                        height: '150%',
                                        transform: 'skewX(-18deg)',
                                        background: `linear-gradient(110deg, ${alpha('#ffffff', 0)} 0%, ${alpha('#ffffff', 0.32)} 50%, ${alpha('#ffffff', 0)} 100%)`,
                                        opacity: canAdvanceToStepB && !knowledgeEditingLocked ? 1 : 0,
                                        animation: canAdvanceToStepB && !knowledgeEditingLocked ? 'nextStepButtonSweep 2.6s linear infinite' : 'none',
                                        pointerEvents: 'none',
                                      },
                                      '@keyframes nextStepButtonGlow': {
                                        '0%': {
                                          boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.32)}`,
                                        },
                                        '50%': {
                                          boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0)}, 0 0 14px ${alpha(theme.palette.primary.light, 0.28)}`,
                                        },
                                        '100%': {
                                          boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}`,
                                        },
                                      },
                                      '@keyframes nextStepButtonSweep': {
                                        '0%': {
                                          left: '-45%',
                                        },
                                        '100%': {
                                          left: '112%',
                                        },
                                      },
                                    }}
                                  >
                                    Next: Step B
                                  </Button>
                                </Stack>
                              </Stack>
                            </Box>
                          )}

                          {knowledgeFlowStep === 1 && (
                            <Box
                              sx={{
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                borderRadius: '12px',
                                p: 1.2,
                                background: alpha(theme.palette.common.white, 0.72),
                              }}
                            >
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                <Box>
                                  <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                                    Step B
                                  </Typography>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Embed Crawled Pages
                                  </Typography>
                                </Box>
                                <Button
                                  variant="contained"
                                  onClick={addWebsiteKnowledge}
                                  disabled={!canRunEmbedSelected}
                                  sx={{
                                    background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    isolation: 'isolate',
                                    transform: canRunEmbedSelected ? 'translateZ(0)' : 'none',
                                    animation: canRunEmbedSelected ? 'embedButtonGlow 1.5s ease-in-out infinite' : 'none',
                                    '&::before': {
                                      content: '""',
                                      position: 'absolute',
                                      inset: '22% 10%',
                                      borderRadius: '999px',
                                      background: `radial-gradient(circle, ${alpha('#ffffff', 0.48)} 0%, ${alpha('#ffffff', 0)} 70%)`,
                                      opacity: canRunEmbedSelected ? 0.95 : 0,
                                      animation: canRunEmbedSelected ? 'embedButtonInnerGlow 1.4s ease-in-out infinite' : 'none',
                                      pointerEvents: 'none',
                                      zIndex: 0,
                                    },
                                    '&::after': {
                                      content: '""',
                                      position: 'absolute',
                                      top: '-30%',
                                      left: '-45%',
                                      width: '42%',
                                      height: '160%',
                                      background: `linear-gradient(110deg, ${alpha('#ffffff', 0)} 0%, ${alpha('#ffffff', 0.5)} 50%, ${alpha('#ffffff', 0)} 100%)`,
                                      transform: 'skewX(-20deg)',
                                      opacity: canRunEmbedSelected ? 1 : 0,
                                      animation: canRunEmbedSelected ? 'embedButtonInnerSweep 1.9s linear infinite' : 'none',
                                      pointerEvents: 'none',
                                      zIndex: 0,
                                    },
                                    '@keyframes embedButtonGlow': {
                                      '0%': {
                                        boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.58)}, 0 0 0 0 ${alpha(theme.palette.primary.light, 0.38)}`,
                                        filter: 'brightness(1)',
                                      },
                                      '50%': {
                                        boxShadow: `0 0 0 12px ${alpha(theme.palette.primary.main, 0)}, 0 0 22px ${alpha(theme.palette.primary.light, 0.65)}`,
                                        filter: 'brightness(1.08)',
                                      },
                                      '100%': {
                                        boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}, 0 0 0 ${alpha(theme.palette.primary.light, 0)}`,
                                        filter: 'brightness(1)',
                                      },
                                    },
                                    '@keyframes embedButtonInnerGlow': {
                                      '0%': {
                                        transform: 'scale(0.92)',
                                        opacity: 0.5,
                                      },
                                      '50%': {
                                        transform: 'scale(1.06)',
                                        opacity: 0.95,
                                      },
                                      '100%': {
                                        transform: 'scale(0.92)',
                                        opacity: 0.5,
                                      },
                                    },
                                    '@keyframes embedButtonInnerSweep': {
                                      '0%': {
                                        left: '-50%',
                                      },
                                      '100%': {
                                        left: '115%',
                                      },
                                    },
                                  }}
                                >
                                  <Box component="span" sx={{ position: 'relative', zIndex: 1 }}>
                                    {embedJobCompleted ? 'Embed Completed' : `Embed Selected (${selectedPreviewCount})`}
                                  </Box>
                                </Button>
                              </Stack>

                              <LinearProgress
                                variant="determinate"
                                value={Math.max(0, Math.min(100, crawlJobStatus?.progress || 0))}
                                sx={{ mt: 1, height: 8, borderRadius: 999 }}
                              />

                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mt: 0.8 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Step B Progress: {Math.max(0, Math.min(100, crawlJobStatus?.progress || 0))}%
                                </Typography>
                                <Button
                                  variant="text"
                                  onClick={refreshCrawlProgress}
                                  disabled={refreshingCrawlStatus || !createdWidgetId}
                                  startIcon={refreshingCrawlStatus ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
                                >
                                  {refreshingCrawlStatus ? 'Refreshing...' : 'Refresh Progress'}
                                </Button>
                              </Stack>

                              {crawlJobStatus ? (
                                <Box sx={{ mt: 0.8 }}>
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                    <Stack direction="row" spacing={0.8} alignItems="center">
                                      <Chip
                                        size="small"
                                        label={crawlJobStatus.status.toUpperCase()}
                                        color={
                                          crawlJobStatus.status === 'completed'
                                            ? 'success'
                                            : crawlJobStatus.status === 'failed'
                                              ? 'error'
                                              : 'primary'
                                        }
                                      />
                                      <Typography variant="caption" color="text.secondary">
                                        {crawlJobStatus.stage ? `Stage: ${crawlJobStatus.stage}` : 'Processing'}
                                      </Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                      Job ID: {crawlJobStatus.job_id}
                                    </Typography>
                                  </Stack>

                                  <Typography variant="body2" sx={{ mt: 0.8 }}>
                                    {crawlJobStatus.message || 'Processing website embedding...'}
                                  </Typography>

                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45 }}>
                                    Pages {crawlJobStatus.pages_completed || 0}/{crawlJobStatus.pages_total || selectedPreviewCount} • Crawled {crawlJobStatus.pages_crawled || 0} • Scanned {crawlJobStatus.pages_scanned || 0} • Chunks Embedded {crawlJobStatus.chunks_embedded || 0}
                                  </Typography>

                                  {crawlJobStatus.error && (
                                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.6 }}>
                                      {crawlJobStatus.error}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                                  Start embedding to see Step B progress updates.
                                </Typography>
                              )}

                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mt: 1.2 }}>
                                <Button variant="outlined" onClick={() => setKnowledgeFlowStep(0)}>
                                  Back: Step A
                                </Button>
                                <Button
                                  variant="contained"
                                  onClick={() => setKnowledgeFlowStep(2)}
                                  disabled={!canAdvanceToStepC}
                                  sx={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    animation: canAdvanceToStepC ? 'nextStepButtonGlow 2.2s ease-in-out infinite' : 'none',
                                    '&::after': {
                                      content: '""',
                                      position: 'absolute',
                                      top: '-25%',
                                      left: '-42%',
                                      width: '36%',
                                      height: '150%',
                                      transform: 'skewX(-18deg)',
                                      background: `linear-gradient(110deg, ${alpha('#ffffff', 0)} 0%, ${alpha('#ffffff', 0.32)} 50%, ${alpha('#ffffff', 0)} 100%)`,
                                      opacity: canAdvanceToStepC ? 1 : 0,
                                      animation: canAdvanceToStepC ? 'nextStepButtonSweep 2.6s linear infinite' : 'none',
                                      pointerEvents: 'none',
                                    },
                                    '@keyframes nextStepButtonGlow': {
                                      '0%': {
                                        boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.32)}`,
                                      },
                                      '50%': {
                                        boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0)}, 0 0 14px ${alpha(theme.palette.primary.light, 0.28)}`,
                                      },
                                      '100%': {
                                        boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}`,
                                      },
                                    },
                                    '@keyframes nextStepButtonSweep': {
                                      '0%': {
                                        left: '-45%',
                                      },
                                      '100%': {
                                        left: '112%',
                                      },
                                    },
                                  }}
                                >
                                  Next: Step C
                                </Button>
                              </Stack>
                            </Box>
                          )}

                          {knowledgeFlowStep === 2 && (
                            <Box
                              sx={{
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                borderRadius: '12px',
                                p: 1.2,
                                background: alpha(theme.palette.common.white, 0.72),
                              }}
                            >
                              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                                Step C
                              </Typography>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Embedding Summary
                              </Typography>

                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                                Embedding complete. Review summary and continue.
                              </Typography>

                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                                Chunks Embedded: {crawlJobStatus?.chunks_embedded || 0} • Pages Completed: {crawlJobStatus?.pages_completed || 0}/{crawlJobStatus?.pages_total || selectedPreviewCount}
                              </Typography>

                              <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 1.2 }}>
                                <Button variant="outlined" onClick={() => setKnowledgeFlowStep(1)}>
                                  Back: Step B
                                </Button>
                                <Chip label="Step C Complete" color="success" variant="outlined" />
                              </Stack>
                            </Box>
                          )}
                        </Stack>
                      </Box>

                      <Box sx={accentPanelSx}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.2 }}>Add Text Knowledge (FAQ, policies, notes)</Typography>
                        {knowledgeEditingLocked && (
                          <Alert severity="info" sx={{ mb: 1.2 }}>
                            Disabled while website crawling/embedding is in progress.
                          </Alert>
                        )}
                        <Stack spacing={1.4}>
                          <TextField
                            label="Title"
                            value={knowledgeTitle}
                            onChange={(e) => setKnowledgeTitle(e.target.value)}
                            fullWidth
                            disabled={knowledgeEditingLocked}
                            sx={fieldSx}
                          />
                          <TextField
                            label="Knowledge Content"
                            value={knowledgeText}
                            onChange={(e) => setKnowledgeText(e.target.value)}
                            multiline
                            rows={6}
                            fullWidth
                            disabled={knowledgeEditingLocked}
                            placeholder="Paste FAQs, product details, policies, etc."
                            sx={fieldSx}
                          />
                          <Button variant="outlined" onClick={addTextKnowledge} disabled={busy || knowledgeEditingLocked}>
                            Add Text Knowledge
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={5}>
                    <Stack spacing={2}>
                      <Box sx={accentPanelSx}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.2 }}>Document Upload</Typography>
                        {knowledgeEditingLocked && (
                          <Alert severity="info" sx={{ mb: 1.2 }}>
                            Disabled while website crawling/embedding is in progress.
                          </Alert>
                        )}
                        <Stack spacing={1.4}>
                          <Button variant="outlined" component="label" disabled={busy || knowledgeEditingLocked}>
                            {uploadFiles.length > 0
                              ? `${uploadFiles.length} file${uploadFiles.length === 1 ? '' : 's'} selected`
                              : 'Choose Files (PDF/DOCX/XLSX)'}
                            <input
                              type="file"
                              hidden
                              multiple
                              accept=".pdf,.doc,.docx,.xls,.xlsx"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setUploadFiles(files);
                              }}
                            />
                          </Button>
                          {uploadFiles.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {uploadFiles.map((file) => file.name).join(', ')}
                            </Typography>
                          )}
                          <Button variant="outlined" onClick={addDocumentKnowledge} disabled={busy || knowledgeEditingLocked || uploadFiles.length === 0}>
                            Upload Document Knowledge ({uploadFiles.length})
                          </Button>
                        </Stack>
                      </Box>

                      <Box sx={accentPanelSx}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                          Curation Guidance
                        </Typography>
                        <Typography variant="body2" color="text.secondary">1. Start with high-value pages (pricing, FAQs, policies).</Typography>
                        <Typography variant="body2" color="text.secondary">2. Add internal process docs for support precision.</Typography>
                        <Typography variant="body2" color="text.secondary">3. Keep updates frequent to avoid stale answers.</Typography>
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" sx={stepActionBarSx}>
                      <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={goBackStep}>
                        Back to Agent Setup
                      </Button>
                      <Button
                        variant="contained"
                        onClick={moveToIntegrationStep}
                        disabled={busy || knowledgeEditingLocked}
                        sx={{
                          borderRadius: '12px',
                          px: 2.6,
                          boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                          background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                        }}
                      >
                        Continue to Integrations
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {activeStep === 2 && (
            <Card sx={{ ...modernStepCardSx, ...stepTransitionSx }}>
              <CardContent sx={{ p: { xs: 2, md: 2.6 } }}>
                <Stack spacing={2.2}>
                  <Box sx={accentPanelSx}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                      <Box>
                        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                          Step 3
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.015em', fontSize: { xs: '1.03rem', md: '1.12rem' } }}>
                          Integrations
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Connect external channels and prepare your agent for multi-surface conversations.
                        </Typography>
                      </Box>
                      <Chip label={whatsappConfigured ? 'WhatsApp Ready' : 'Channel Setup Pending'} color={whatsappConfigured ? 'success' : 'warning'} />
                    </Stack>
                    <Alert severity="info" sx={{ mt: 1.2 }}>
                      WhatsApp requires plan support (`whatsapp_enabled`) and valid Meta Cloud API credentials.
                    </Alert>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card sx={integrationCardSx}>
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
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}>
                              {!whatsappConfigured ? (
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={openMetaWhatsAppWizard}
                                    disabled={metaConnecting}
                                    sx={{
                                      minWidth: 160,
                                      py: 0.7,
                                      px: 2,
                                      fontWeight: 600,
                                      background: "#25D366",
                                      "&:hover": { background: "#1ebe5d" }
                                    }}
                                  >
                                    {metaConnecting ? 'Connecting...' : metaSdkReady ? 'Connect WhatsApp' : 'Loading Meta SDK...'}
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setIntegrationDialogOpen(true)}
                                    sx={{
                                      minWidth: 110,
                                      py: 0.7,
                                      px: 2
                                    }}
                                  >
                                    Configure
                                  </Button>
                                </Stack>
                              ) : (
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setTestOpen(true)}
                                    sx={{
                                      minWidth: 150,
                                      py: 0.7,
                                      px: 2,
                                      fontWeight: 600,
                                      borderColor: "#25D366",
                                      color: "#25D366",
                                      "&:hover": {
                                        borderColor: "#1ebe5d",
                                        background: "rgba(37, 211, 102, 0.08)"
                                      }
                                    }}
                                  >
                                    Send Test Message
                                  </Button>
                                  <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    onClick={handleDisconnectWhatsApp}
                                    sx={{
                                      minWidth: 120,
                                      py: 0.7,
                                      px: 2,
                                      fontWeight: 600
                                    }}
                                  >
                                    Disconnect
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Card sx={{ ...integrationCardSx, opacity: 0.93 }}>
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
                      <Card sx={{ ...integrationCardSx, opacity: 0.93 }}>
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

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" sx={stepActionBarSx}>
                    <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={goBackStep}>
                      Back to Knowledge
                    </Button>
                    <Button
                      variant="contained"
                      onClick={moveToShareStep}
                      sx={{
                        borderRadius: '12px',
                        px: 2.6,
                        boxShadow: `0 10px 22px ${alpha(theme.palette.primary.dark, 0.2)}`,
                        background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.92)} 100%)`,
                      }}
                    >
                      Continue to Share Link
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeStep === 3 && (
            <Card sx={{ ...modernStepCardSx, ...stepTransitionSx }}>
              <CardContent sx={{ p: { xs: 2, md: 2.6 } }}>
                <Stack spacing={2.2}>
                  <Box sx={accentPanelSx}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                      Step 4
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.015em', fontSize: { xs: '1.03rem', md: '1.12rem' } }}>
                      Share and Validate
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Share this public URL with stakeholders so they can test the chatbot experience instantly.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Chip label="Launch Ready" color="success" />
                      <Chip label="Public Test Link" variant="outlined" />
                    </Stack>
                  </Box>

                  <Box sx={accentPanelSx}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Agent Test URL
                    </Typography>
                    <TextField
                      value={shareLinkLoading ? 'Generating expiring test link...' : shareLink}
                      fullWidth
                      InputProps={{ readOnly: true }}
                      sx={fieldSx}
                    />
                    {shareLinkExpiresAt && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        This test link expires on {formatDisplayDate(shareLinkExpiresAt)}.
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: 'block' }}>
                      Tip: If your backend runs on a different host, set VITE_API_URL in frontend .env before sharing.
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" sx={stepActionBarSx}>
                    <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={goBackStep}>
                      Back to Integrations
                    </Button>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        startIcon={<ContentCopyIcon />}
                        onClick={copyShareLink}
                        disabled={shareLinkLoading || !createdWidgetId}
                        sx={{
                          borderRadius: '12px',
                          px: 2.4,
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
                        disabled={shareLinkLoading || !shareLink}
                      >
                        Open Test Page
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate('/widgets')}
                      >
                        Back to Agent Management
                      </Button>
                    </Stack>
                  </Stack>
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

                <Alert
                  severity="info"
                  action={
                    <Button color="inherit" size="small" onClick={openMetaWhatsAppWizard} disabled={metaConnecting}>
                      {metaConnecting ? 'Connecting...' : metaSdkReady ? 'Connect' : 'Loading SDK...'}
                    </Button>
                  }
                >
                  Use Meta onboarding wizard to auto-import Phone Number ID and access token.
                </Alert>

                <TextField label="Agent ID" value={createdWidgetId} fullWidth disabled />

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Phone Number ID *"
                      value={whatsappForm.phone_number_id}
                      onChange={(e) => handleWhatsAppField('phone_number_id', e.target.value)}
                      fullWidth
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="WABA ID"
                      value={whatsappForm.waba_id}
                      onChange={(e) => handleWhatsAppField('waba_id', e.target.value)}
                      fullWidth
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Business Phone Number"
                      value={whatsappForm.business_phone_number}
                      onChange={(e) => handleWhatsAppField('business_phone_number', e.target.value)}
                      placeholder="+91XXXXXXXXXX"
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

                </Grid>

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
          <Dialog open={testOpen}>
            <DialogTitle>Send WhatsApp Test Message</DialogTitle>

            <DialogContent>
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
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setTestOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={sendWhatsAppTest}>
                Send
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>
    </AdminLayout>
  );
};

export default CreateChatAgentPage;
