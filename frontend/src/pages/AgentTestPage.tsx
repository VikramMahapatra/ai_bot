import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HubIcon from '@mui/icons-material/Hub';
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt';
import LanguageIcon from '@mui/icons-material/Language';
import InsightsIcon from '@mui/icons-material/Insights';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useParams } from 'react-router-dom';
import { appEnv } from '../config/env';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WidgetPublicConfig {
  name?: string;
  welcome_message?: string;
  primary_color?: string;
  secondary_color?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  lead_fields?: string;
}

const BOT_ICON_GLYPHS: Record<string, string> = {
  'bot-robot': '🤖',
  'bot-spark': '✨',
  'bot-brain': '🧠',
  'bot-guide': '🛰️',
};

const USER_ICON_GLYPHS: Record<string, string> = {
  'user-person': '👤',
  'user-smile': '🙂',
  'user-chat': '💬',
  'user-brief': '🧑‍💼',
};

const parseIconSelection = (leadFieldsRaw?: string): { botIcon?: string; userIcon?: string } => {
  if (!leadFieldsRaw) return {};
  try {
    const parsed = JSON.parse(leadFieldsRaw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return {
      botIcon: typeof (parsed as any).bot_icon === 'string' ? (parsed as any).bot_icon : undefined,
      userIcon: typeof (parsed as any).user_icon === 'string' ? (parsed as any).user_icon : undefined,
    };
  } catch {
    return {};
  }
};

interface ProductTrack {
  title: string;
  description: string;
  outcome: string;
  icon: React.ReactNode;
  accent: string;
}

const productTracks: ProductTrack[] = [
  {
    title: 'Conversational AI Agents',
    description:
      'Multichannel assistants with memory-aware prompts, organization scoping, and escalation handoff to human support.',
    outcome: 'Outcome: faster first response and higher conversion from chat.',
    icon: <PsychologyAltIcon />,
    accent: '#2f6bff',
  },
  {
    title: 'Knowledge Intelligence',
    description:
      'RAG pipelines that ingest websites, files, and operational FAQs with controlled retrieval to keep responses grounded.',
    outcome: 'Outcome: fewer hallucinations and better answer coverage.',
    icon: <HubIcon />,
    accent: '#2d8ef0',
  },
  {
    title: 'Commerce + Support Automation',
    description:
      'Retail and post-purchase automation for order questions, policy explanations, and personalized customer journeys.',
    outcome: 'Outcome: reduced support load and smoother customer experience.',
    icon: <LanguageIcon />,
    accent: '#5e72ff',
  },
  {
    title: 'AI Ops and Insights',
    description:
      'Analytics on response quality, lead capture, conversation outcomes, and performance trends across widgets.',
    outcome: 'Outcome: measurable growth decisions backed by conversation data.',
    icon: <InsightsIcon />,
    accent: '#36a8ff',
  },
];

const deliveryFlow = [
  {
    step: '1. Discover',
    detail: 'Understand your support, sales, and onboarding workflows and identify where AI creates real business lift.',
  },
  {
    step: '2. Build',
    detail: 'Design prompts, retrieval strategy, and integrations that match your organization and brand tone.',
  },
  {
    step: '3. Launch',
    detail: 'Deploy to web, widget, and messaging surfaces with testable links for stakeholders and teams.',
  },
  {
    step: '4. Optimize',
    detail: 'Use analytics and feedback loops to improve coverage, latency, trust, and conversion over time.',
  },
];

const AgentTestPage: React.FC = () => {
  const { widgetId = '' } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetPublicConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentName, setAppointmentName] = useState('');
  const [appointmentEmail, setAppointmentEmail] = useState('');
  const [appointmentPhone, setAppointmentPhone] = useState('');
  const [appointmentDateTime, setAppointmentDateTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const [appointmentError, setAppointmentError] = useState('');

  const apiBaseUrl = appEnv.apiUrl;
  const position = widgetConfig?.position || 'bottom-right';
  const primaryColor = widgetConfig?.primary_color || '#2f6bff';
  const secondaryColor = widgetConfig?.secondary_color || '#2d8ef0';
  const assistantName = widgetConfig?.name?.trim() || 'AI Assistant';
  const welcomeText = (widgetConfig?.welcome_message || 'Hi! How can I help you today?').trim() || 'Hi! How can I help you today?';
  const iconSelection = useMemo(() => parseIconSelection(widgetConfig?.lead_fields), [widgetConfig?.lead_fields]);
  const botIconGlyph = BOT_ICON_GLYPHS[iconSelection.botIcon || 'bot-robot'] || BOT_ICON_GLYPHS['bot-robot'];
  const userIconGlyph = USER_ICON_GLYPHS[iconSelection.userIcon || 'user-person'] || USER_ICON_GLYPHS['user-person'];

  const sessionId = useMemo(() => {
    const key = `public_agent_session_${widgetId || 'unknown'}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, created);
    return created;
  }, [widgetId]);

  useEffect(() => {
    const loadWidgetConfig = async () => {
      if (!widgetId) return;
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/widget/config/${encodeURIComponent(widgetId)}`);
        if (!response.ok) return;
        const config = (await response.json()) as WidgetPublicConfig;
        setWidgetConfig(config);
        setMessages((prev) => {
          if (prev.length === 1 && prev[0]?.role === 'assistant') {
            const resolvedWelcome = (config.welcome_message || '').trim() || 'Hi! How can I help you today?';
            return [{ role: 'assistant', content: resolvedWelcome }];
          }
          return prev;
        });
      } catch {
        // Keep defaults when config fetch fails.
      }
    };

    loadWidgetConfig();
  }, [apiBaseUrl, widgetId]);

  const launcherPositionSx = useMemo(() => {
    if (position === 'bottom-left') return { left: 24, bottom: 24 };
    if (position === 'top-right') return { right: 24, top: 24 };
    if (position === 'top-left') return { left: 24, top: 24 };
    return { right: 24, bottom: 24 };
  }, [position]);

  const panelPositionSx = useMemo(() => {
    if (position === 'bottom-left') return { left: 16, bottom: 16 };
    if (position === 'top-right') return { right: 16, top: 16 };
    if (position === 'top-left') return { left: 16, top: 16 };
    return { right: 16, bottom: 16 };
  }, [position]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !widgetId) return;

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          widget_id: widgetId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from chatbot');
      }

      const data = await response.json();
      const reply = typeof data?.response === 'string' ? data.response : 'I could not generate a response right now.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, the chatbot is temporarily unavailable. Please try again in a moment.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const openAppointmentDialog = () => {
    if (!widgetId) return;
    if (!appointmentDateTime) {
      const seed = new Date(Date.now() + 60 * 60 * 1000);
      const localDate = new Date(seed.getTime() - seed.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setAppointmentDateTime(localDate);
    }
    setAppointmentError('');
    setAppointmentOpen(true);
  };

  const bookAppointment = async () => {
    if (!widgetId) return;
    if (!appointmentName.trim()) {
      setAppointmentError('Please enter your name.');
      return;
    }
    if (!appointmentDateTime) {
      setAppointmentError('Please select date/time.');
      return;
    }

    const dateValue = new Date(appointmentDateTime);
    if (Number.isNaN(dateValue.getTime())) {
      setAppointmentError('Invalid date/time.');
      return;
    }

    try {
      setAppointmentBusy(true);
      setAppointmentError('');
      const response = await fetch(`${apiBaseUrl}/api/chat/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          widget_id: widgetId,
          appointment_at: dateValue.toISOString(),
          name: appointmentName.trim(),
          email: appointmentEmail.trim() || undefined,
          phone: appointmentPhone.trim() || undefined,
          notes: appointmentNotes.trim() || undefined,
          timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC').replace('Asia/Calcutta', 'Asia/Kolkata'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || 'Failed to book appointment');
      }

      const data = await response.json();
      const confirmation = typeof data?.message === 'string' ? data.message : 'Appointment booked successfully.';
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `Please book an appointment for ${dateValue.toLocaleString()}.` },
        { role: 'assistant', content: confirmation },
      ]);
      setAppointmentOpen(false);
      setAppointmentName('');
      setAppointmentEmail('');
      setAppointmentPhone('');
      setAppointmentNotes('');
    } catch (err: any) {
      setAppointmentError(err?.message || 'Failed to book appointment');
    } finally {
      setAppointmentBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f8fbff',
        color: '#0f172a',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: 'Poppins, Manrope, Segoe UI, sans-serif',
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(14,165,233,0.15), transparent 35%), radial-gradient(circle at 80% 20%, rgba(56,109,255,0.14), transparent 34%), linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(54,196,255,0.28) 0%, rgba(54,196,255,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 120,
          left: -120,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          p: { xs: 2.5, md: 6 },
          maxWidth: 1200,
          mx: 'auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: '1px solid rgba(148,163,184,0.25)',
            background:
              'linear-gradient(125deg, rgba(15,23,42,0.95) 0%, rgba(15,118,110,0.9) 35%, rgba(14,116,144,0.88) 100%)',
            color: 'white',
            mb: 3,
            boxShadow: '0 20px 60px rgba(2,6,23,0.25)',
          }}
        >
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Chip
                icon={<AutoAwesomeIcon />}
                label="Live Demo Experience"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.18)',
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' },
                }}
              />
              <Chip
                icon={<VerifiedUserIcon />}
                label="Enterprise-ready AI"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' },
                }}
              />
            </Stack>

            <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '2rem', md: '3rem' } }}>
              Zentrixel AI Platform
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 400, maxWidth: 850, color: 'rgba(236,253,245,0.95)' }}>
              Zentrixel builds practical AI products for support, commerce, and operations.
              This page is a live sandbox where anyone can test your chatbot in a real website layout.
            </Typography>

            <Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<RocketLaunchIcon />}
                onClick={() => setIsOpen(true)}
                sx={{
                  bgcolor: '#f8fafc',
                  color: '#0f172a',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#e2e8f0' },
                }}
              >
                Launch Chat Demo
              </Button>
            </Box>
          </Stack>
        </Paper>

        {!widgetId && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Missing widget ID in URL. Share links should look like `/agent-test/&lt;widgetId&gt;`.
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' },
            gap: 3,
            mb: 3,
          }}
        >
          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid #dbeafe' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
              What Zentrixel Is Building
            </Typography>
            <Typography sx={{ color: '#334155', mb: 2.5 }}>
              Zentrixel focuses on AI systems that deliver business outcomes, not just demos.
              The product philosophy is simple: grounded answers, fast integrations, clear analytics,
              and user experiences people actually enjoy using.
            </Typography>
            <Stack spacing={1.5}>
              {deliveryFlow.map((item) => (
                <Box key={item.step} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{item.step}</Typography>
                  <Typography variant="body2" sx={{ color: '#475569' }}>{item.detail}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: '1px solid #c7d2fe',
              background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Demo Context
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>Widget ID</Typography>
              <Typography sx={{ fontFamily: 'Consolas, Menlo, monospace', wordBreak: 'break-all', color: '#0f172a' }}>
                {widgetId || 'Missing widget ID'}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: '#64748b' }}>API URL</Typography>
              <Typography sx={{ fontFamily: 'Consolas, Menlo, monospace', wordBreak: 'break-all', color: '#0f172a' }}>
                {apiBaseUrl}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: '#64748b' }}>Welcome Message</Typography>
              <Typography sx={{ color: '#0f172a', fontSize: '0.9rem' }}>
                {welcomeText}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ color: '#334155' }}>
                Open the floating chat to interact with the live assistant. Position is set to {position}.
              </Typography>
            </Stack>
          </Paper>
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          AI Product Portfolio
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
            gap: 2,
            mb: 2,
          }}
        >
          {productTracks.map((item) => (
            <Paper
              key={item.title}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                border: `1px solid ${item.accent}33`,
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(6px)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 18px 35px rgba(15,23,42,0.08)',
                },
              }}
            >
              <Box sx={{ color: item.accent, mb: 1 }}>{item.icon}</Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {item.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', mb: 1.2 }}>
                {item.description}
              </Typography>
              <Typography variant="caption" sx={{ color: item.accent, fontWeight: 600 }}>
                {item.outcome}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          variant="contained"
          sx={{
            position: 'fixed',
            ...launcherPositionSx,
            borderRadius: '999px',
            minWidth: 64,
            height: 64,
            fontSize: 28,
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            boxShadow: '0 16px 30px rgba(2,132,199,0.35)',
            '&:hover': {
              opacity: 0.92,
            },
            zIndex: 1200,
          }}
        >
          💬
        </Button>
      )}

      {isOpen && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            ...panelPositionSx,
            width: { xs: 'calc(100vw - 24px)', sm: 412 },
            height: { xs: '72vh', sm: 620 },
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300,
            border: '1px solid #cbd5e1',
            boxShadow: '0 24px 52px rgba(15,23,42,0.24)',
          }}
        >
          <Box sx={{
            background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            color: '#fff',
            p: 1.8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <Box>
              <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{assistantName}</Typography>
              <Typography sx={{ fontSize: '0.76rem', opacity: 0.9, mt: 0.3 }}>
                Live assistant preview
              </Typography>
            </Box>
            <Button size="small" sx={{ color: '#fff' }} onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </Box>

          <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Button
              variant="outlined"
              startIcon={<CalendarMonthIcon />}
              onClick={openAppointmentDialog}
              disabled={!widgetId || sending}
              size="small"
              fullWidth
              sx={{ borderRadius: '10px' }}
            >
              Book Appointment
            </Button>
          </Box>

          <Box sx={{ flex: 1, p: 1.5, overflowY: 'auto', bgcolor: '#f8fafc' }}>
            <Stack spacing={1.2}>
              {messages.map((message, index) => (
                <Box
                  key={`${message.role}-${index}`}
                  sx={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '92%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.9,
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #d1d5db',
                      bgcolor: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.95rem',
                      flex: '0 0 28px',
                    }}
                  >
                    {message.role === 'assistant' ? botIconGlyph : userIconGlyph}
                  </Box>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: message.role === 'user' ? primaryColor : '#fff',
                      color: message.role === 'user' ? '#fff' : '#0f172a',
                      border: message.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.92rem',
                    }}
                  >
                    {message.content}
                  </Box>
                </Box>
              ))}
              {sending && (
                <Box sx={{ alignSelf: 'flex-start', px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 0.9 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #d1d5db',
                      bgcolor: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.95rem',
                    }}
                  >
                    {botIconGlyph}
                  </Box>
                  <CircularProgress size={18} />
                </Box>
              )}
            </Stack>
          </Box>

          <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Stack spacing={0.8}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
              <TextField
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                fullWidth
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                  },
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={sendMessage}
                disabled={!input.trim() || sending || !widgetId}
                sx={{
                  minWidth: 46,
                  width: 46,
                  height: 40,
                  borderRadius: '10px',
                  background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                }}
              >
                <SendRoundedIcon fontSize="small" />
              </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Press Enter to send. Appointment booking is available anytime.
              </Typography>
            </Stack>
          </Box>
        </Paper>
      )}

      <Dialog
        open={appointmentOpen}
        onClose={() => setAppointmentOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: '16px',
            border: '1px solid #dbe3ef',
            boxShadow: '0 20px 42px rgba(15,23,42,0.2)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.2 }}>Book Appointment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {appointmentError && <Alert severity="error">{appointmentError}</Alert>}
            <TextField label="Name" value={appointmentName} onChange={(e) => setAppointmentName(e.target.value)} fullWidth required />
            <TextField label="Email" type="email" value={appointmentEmail} onChange={(e) => setAppointmentEmail(e.target.value)} fullWidth />
            <TextField label="Phone" value={appointmentPhone} onChange={(e) => setAppointmentPhone(e.target.value)} fullWidth />
            <TextField
              label="Appointment Date & Time"
              type="datetime-local"
              value={appointmentDateTime}
              onChange={(e) => setAppointmentDateTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            <TextField label="Notes" value={appointmentNotes} onChange={(e) => setAppointmentNotes(e.target.value)} multiline minRows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppointmentOpen(false)} disabled={appointmentBusy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={bookAppointment}
            disabled={appointmentBusy}
            sx={{
              borderRadius: '10px',
              px: 1.8,
              background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          >
            {appointmentBusy ? 'Booking...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentTestPage;
