import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatAPI } from './api';
import './styles.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WidgetConfig {
  widgetId: string;
  apiUrl: string;
  name?: string;
  welcomeMessage?: string;
  primaryColor?: string;
  secondaryColor?: string;
  chatHeaderFontColor?: string;
  position?: string;
  botIcon?: string;
  userIcon?: string;
  shop?: any;
  user?: any;
}

const BOT_ICON_GLYPHS: Record<string, string> = {
  'bot-robot': '🤖',
  'bot-spark': '✨',
  'bot-brain': '🧠',
  'bot-guide': '🛰️',
  'bot-helper': '🧑‍🔧',
  'bot-assistant': '🤝',
  'bot-shield': '🛡️',
  'bot-light': '💡',
};

const USER_ICON_GLYPHS: Record<string, string> = {
  'user-person': '👤',
  'user-smile': '🙂',
  'user-chat': '💬',
  'user-brief': '🧑‍💼',
  'user-student': '🧑‍🎓',
  'user-creative': '🎨',
  'user-tech': '🧑‍💻',
  'user-star': '🌟',
};

const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const APPOINTMENT_FORM_PROMPT =
  'If you would like to set a meeting, please fill this short form and I will set it up for you.';

const CHAT_INACTIVITY_TIMEOUT_MS = 120000;
const CHAT_INACTIVITY_CLOSE_MESSAGE = 'Closing this chat session as no activity happened in the last 120 seconds.';
const STREAM_FALLBACK_TIMEOUT_MS = 12000;
const POST_HANDOFF_FOLLOWUP_MESSAGE =
  'Welcome back from live support. Are you satisfied with the help, or should I set up a meeting for you?';

const getDefaultAppointmentDateTime = () => {
  const seed = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(seed.getTime() - seed.getTimezoneOffset() * 60000).toISOString();
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
  };
};

const formatCountdownSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const parseServerDateToMs = (value?: string | null): number | null => {
  if (!value) return null;

  const normalized = String(value).trim().replace(' ', 'T');
  if (!normalized) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  const ms = Date.parse(candidate);
  return Number.isNaN(ms) ? null : ms;
};

const normalizeIntentText = (value: string): string =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2014|\u2013/g, '-');

const wantsMeetingSetup = (value: string): boolean => {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  const tokens = new Set((normalized.match(/[a-z0-9]+/g) || []));
  if (tokens.has('yes') && (tokens.has('meeting') || tokens.has('appointment') || tokens.has('call'))) {
    return true;
  }
  if (tokens.has('book') || tokens.has('schedule') || tokens.has('meeting') || tokens.has('appointment')) {
    return true;
  }
  return false;
};

const isSatisfiedResponse = (value: string): boolean => {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  const affirmative = ['yes', 'satisfied', 'happy', 'resolved', 'all good', 'good now', 'fine now'];
  return affirmative.some((item) => normalized.includes(item));
};

const ChatWidget: React.FC<WidgetConfig> = ({
  widgetId,
  apiUrl,
  name = 'AI Assistant',
  welcomeMessage = 'Hi! How can I help you?',
  primaryColor = '#269b9f',
  secondaryColor = '#34d399',
  chatHeaderFontColor,
  position = 'bottom-right',
  botIcon = 'bot-robot',
  userIcon = 'user-person',
  shop,
  user,
}) => {
  const storageKey = `chatbot_session_id_${widgetId || 'default'}`;

  const [darkMode, setDarkMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    name: '',
    email: '',
    appointment_date: '',
    appointment_time: '',
  });
  const [handoffActive, setHandoffActive] = useState(false);
  const [handoffChatId, setHandoffChatId] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [handoffAfterId, setHandoffAfterId] = useState(0);
  const [handoffError, setHandoffError] = useState('');
  const [handoffWaitCycle, setHandoffWaitCycle] = useState(1);
  const [handoffWaitingExpiresAt, setHandoffWaitingExpiresAt] = useState<string | null>(null);
  const [handoffWaitTimeoutSeconds, setHandoffWaitTimeoutSeconds] = useState(120);
  const [handoffNowMs, setHandoffNowMs] = useState(Date.now());
  const [pendingHandoffAfterLead, setPendingHandoffAfterLead] = useState(false);
  const [awaitingPostHandoffDecision, setAwaitingPostHandoffDecision] = useState(false);
  const handoffSeenIdsRef = useRef<Set<number>>(new Set());
  const handoffPromptedChatIdRef = useRef<string | null>(null);
  const lastHandoffStatusRef = useRef<string | null>(null);

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sessionEngaged, setSessionEngaged] = useState(false);
  const [sessionClosedByInactivity, setSessionClosedByInactivity] = useState(false);
  const [lastActivityAtMs, setLastActivityAtMs] = useState(Date.now());
  const [inactivityNowMs, setInactivityNowMs] = useState(Date.now());

  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const created = createSessionId();
    localStorage.setItem(storageKey, created);
    return created;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatAPI = useRef(new ChatAPI(apiUrl));
  const botIconGlyph = BOT_ICON_GLYPHS[botIcon] || BOT_ICON_GLYPHS['bot-robot'];
  const userIconGlyph = USER_ICON_GLYPHS[userIcon] || USER_ICON_GLYPHS['user-person'];
  const headerTextColor = (chatHeaderFontColor || '').trim() || '#ffffff';

  const shopDomain = useMemo(() => shop?.domain || shop?.shop_domain || undefined, [shop]);
  const customerId = useMemo(() => user?.id || user?.customer_id || undefined, [user]);

  const showSuggestions =
    isOpen &&
    !loading &&
    !showLeadForm &&
    !showEmailForm &&
    !showAppointmentForm &&
    input.trim().length === 0 &&
    messages.length <= 1;

  const inactivityRemainingSeconds = useMemo(() => {
    if (sessionClosedByInactivity || !sessionEngaged) {
      return null;
    }
    const elapsed = inactivityNowMs - lastActivityAtMs;
    return Math.max(0, Math.ceil((CHAT_INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
  }, [sessionClosedByInactivity, sessionEngaged, inactivityNowMs, lastActivityAtMs]);

  const handoffRemainingSeconds = useMemo(() => {
    if (!handoffActive || handoffStatus !== 'waiting_for_agent' || !handoffWaitingExpiresAt) {
      return null;
    }
    const expiresAtMs = parseServerDateToMs(handoffWaitingExpiresAt);
    if (expiresAtMs === null) {
      return null;
    }
    return Math.max(0, Math.ceil((expiresAtMs - handoffNowMs) / 1000));
  }, [handoffActive, handoffStatus, handoffWaitingExpiresAt, handoffNowMs]);

  const handoffCountdownText = useMemo(() => {
    if (handoffStatus !== 'waiting_for_agent') {
      return null;
    }
    if (handoffRemainingSeconds === null) {
      const cycleMinutes = Math.max(1, Math.round(handoffWaitTimeoutSeconds / 60));
      return `Each wait cycle is about ${cycleMinutes} minute${cycleMinutes > 1 ? 's' : ''}.`;
    }
    if (handoffRemainingSeconds <= 0) {
      return 'Checking live user availability...';
    }
    return `Round ${Math.max(1, handoffWaitCycle)} time left: ${formatCountdownSeconds(handoffRemainingSeconds)}`;
  }, [handoffStatus, handoffRemainingSeconds, handoffWaitCycle, handoffWaitTimeoutSeconds]);

  const handoffProgressPercent = useMemo(() => {
    if (handoffStatus !== 'waiting_for_agent' || handoffRemainingSeconds === null || handoffWaitTimeoutSeconds <= 0) {
      return null;
    }
    const ratio = handoffRemainingSeconds / handoffWaitTimeoutSeconds;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, [handoffStatus, handoffRemainingSeconds, handoffWaitTimeoutSeconds]);

  useEffect(() => {
    chatAPI.current = new ChatAPI(apiUrl);
  }, [apiUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showAppointmentForm, loading]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: welcomeMessage,
        },
      ]);
    }
  }, [isOpen, messages.length, welcomeMessage]);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (!isOpen || !widgetId) return;
      setSuggestionsLoading(true);
      try {
        const questions = await chatAPI.current.getSuggestedQuestions(widgetId);
        setSuggestedQuestions(questions);
      } catch {
        setSuggestedQuestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    loadSuggestions();
  }, [isOpen, widgetId]);

  const resetChat = () => {
    const created = createSessionId();
    localStorage.setItem(storageKey, created);
    setSessionId(created);
    setMessages([
      {
        role: 'assistant',
        content: welcomeMessage,
      },
    ]);
    setInput('');
    setShowLeadForm(false);
    setLeadSubmitted(false);
    setShowEmailForm(false);
    setEmailValue('');
    setShowAppointmentForm(false);
    setHandoffActive(false);
    setHandoffChatId(null);
    setHandoffStatus(null);
    setHandoffAfterId(0);
    setHandoffError('');
    setHandoffWaitCycle(1);
    setHandoffWaitingExpiresAt(null);
    setHandoffWaitTimeoutSeconds(120);
    setHandoffNowMs(Date.now());
    setPendingHandoffAfterLead(false);
    setAwaitingPostHandoffDecision(false);
    handoffSeenIdsRef.current.clear();
    handoffPromptedChatIdRef.current = null;
    lastHandoffStatusRef.current = null;
    setSessionEngaged(false);
    setSessionClosedByInactivity(false);
    setLastActivityAtMs(Date.now());
    setAppointmentForm({
      name: '',
      email: '',
      appointment_date: '',
      appointment_time: '',
    });
    return created;
  };

  const loadHandoffSession = async () => {
    if (!widgetId) return;
    try {
      const data = await chatAPI.current.getHandoffSession(sessionId, widgetId, handoffChatId || undefined);
      if (!data?.chat_id) return;
      const nextStatus = data.status || null;
      const wasActive = lastHandoffStatusRef.current === 'waiting_for_agent' || lastHandoffStatusRef.current === 'assigned';
      const isActive = nextStatus === 'waiting_for_agent' || nextStatus === 'assigned';

      setHandoffChatId(data.chat_id);
      setHandoffStatus(nextStatus);
      setHandoffActive(isActive);
      setHandoffWaitCycle(Math.max(1, data.wait_cycle || 1));
      setHandoffWaitingExpiresAt(data.waiting_expires_at || null);
      if (typeof data.wait_timeout_seconds === 'number' && data.wait_timeout_seconds > 0) {
        setHandoffWaitTimeoutSeconds(data.wait_timeout_seconds);
      }
      setHandoffNowMs(Date.now());
      lastHandoffStatusRef.current = nextStatus;

      if (wasActive && !isActive && data.chat_id && handoffPromptedChatIdRef.current !== data.chat_id) {
        handoffPromptedChatIdRef.current = data.chat_id;
        setAwaitingPostHandoffDecision(true);
        setMessages((prev) => [...prev, { role: 'assistant', content: POST_HANDOFF_FOLLOWUP_MESSAGE }]);
      }
      if (isActive) {
        setAwaitingPostHandoffDecision(false);
      }
    } catch {
      // Do not block chat on handoff polling failures.
    }
  };

  const loadHandoffMessages = async (chatId: string, reset = false) => {
    if (!widgetId || !chatId) return;
    try {
      if (reset) {
        handoffSeenIdsRef.current.clear();
        setHandoffAfterId(0);
      }
      const data = await chatAPI.current.getHandoffMessages(chatId, sessionId, widgetId, reset ? 0 : handoffAfterId);
      if (!data) return;

      const nextStatus = data.status || null;
      const wasActive = lastHandoffStatusRef.current === 'waiting_for_agent' || lastHandoffStatusRef.current === 'assigned';
      const isActive = nextStatus === 'waiting_for_agent' || nextStatus === 'assigned';

      setHandoffStatus(nextStatus);
      setHandoffActive(isActive);
      setHandoffWaitCycle(Math.max(1, data.wait_cycle || 1));
      setHandoffWaitingExpiresAt(data.waiting_expires_at || null);
      if (typeof data.wait_timeout_seconds === 'number' && data.wait_timeout_seconds > 0) {
        setHandoffWaitTimeoutSeconds(data.wait_timeout_seconds);
      }
      setHandoffNowMs(Date.now());
      lastHandoffStatusRef.current = nextStatus;

      if (wasActive && !isActive && chatId && handoffPromptedChatIdRef.current !== chatId) {
        handoffPromptedChatIdRef.current = chatId;
        setAwaitingPostHandoffDecision(true);
        setMessages((prev) => [...prev, { role: 'assistant', content: POST_HANDOFF_FOLLOWUP_MESSAGE }]);
      }
      if (isActive) {
        setAwaitingPostHandoffDecision(false);
      }

      const visible = (data.items || []).filter((item) => {
        const isBotUpdate = item.sender_type === 'bot' && !reset;
        if (item.sender_type !== 'agent' && item.sender_type !== 'system' && !isBotUpdate) return false;
        if (handoffSeenIdsRef.current.has(item.id)) return false;
        handoffSeenIdsRef.current.add(item.id);
        return true;
      });

      if (visible.length > 0) {
        setMessages((prev) => [
          ...prev,
          ...visible.map((item) => ({ role: 'assistant' as const, content: item.message })),
        ]);
        setSessionEngaged(true);
        setLastActivityAtMs(Date.now());
      }

      const maxId = (data.items || []).reduce((acc, item) => Math.max(acc, item.id), handoffAfterId);
      setHandoffAfterId(maxId);
      setHandoffError('');
    } catch {
      setHandoffError('Live agent updates are temporarily unavailable.');
    }
  };

  useEffect(() => {
    if (!isOpen || !widgetId) return;
    loadHandoffSession();
  }, [isOpen, widgetId, sessionId]);

  useEffect(() => {
    if (!handoffActive || handoffStatus !== 'waiting_for_agent' || !handoffWaitingExpiresAt) return;
    setHandoffNowMs(Date.now());
    const timer = window.setInterval(() => {
      setHandoffNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [handoffActive, handoffStatus, handoffWaitingExpiresAt]);

  useEffect(() => {
    if (!isOpen || !handoffActive || !handoffChatId) return;

    const timer = window.setInterval(() => {
      loadHandoffSession();
      loadHandoffMessages(handoffChatId, false);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [isOpen, handoffActive, handoffChatId, handoffAfterId]);

  useEffect(() => {
    if (!isOpen || sessionClosedByInactivity || !sessionEngaged || loading) return;

    const timeoutId = window.setTimeout(() => {
      setMessages((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.role === 'assistant' && last.content === CHAT_INACTIVITY_CLOSE_MESSAGE) {
            return prev;
          }
        }
        return [...prev, { role: 'assistant', content: CHAT_INACTIVITY_CLOSE_MESSAGE }];
      });
      setSessionClosedByInactivity(true);
      setSessionEngaged(false);
      setHandoffActive(false);
      setHandoffChatId(null);
      setHandoffStatus(null);
      setHandoffAfterId(0);
      setHandoffError('');
      handoffSeenIdsRef.current.clear();
      setLoading(false);
    }, CHAT_INACTIVITY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, sessionClosedByInactivity, sessionEngaged, loading, lastActivityAtMs]);

  useEffect(() => {
    if (!isOpen || sessionClosedByInactivity || !sessionEngaged) return;

    setInactivityNowMs(Date.now());
    const timer = window.setInterval(() => {
      setInactivityNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, sessionClosedByInactivity, sessionEngaged, lastActivityAtMs]);

  const sendMessage = async (
    overrideText?: string,
    options?: { silentUserMessage?: boolean; skipLeadCaptureCheck?: boolean; forceSessionId?: string }
  ) => {
    const opts = options || {};
    let activeSessionId = opts.forceSessionId || sessionId;
    if (sessionClosedByInactivity) {
      activeSessionId = resetChat();
    }

    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    if (!overrideText) {
      setInput('');
    }

    if (awaitingPostHandoffDecision && !opts.silentUserMessage) {
      if (wantsMeetingSetup(text)) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: APPOINTMENT_FORM_PROMPT },
        ]);
        setAwaitingPostHandoffDecision(false);
        openAppointmentForm();
        return;
      }
      if (isSatisfiedResponse(text)) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: 'Great to hear that. If you need anything else, I am here to help.' },
        ]);
        setAwaitingPostHandoffDecision(false);
        return;
      }
    }

    setLoading(true);
    setSessionEngaged(true);
    setSessionClosedByInactivity(false);
    setLastActivityAtMs(Date.now());
    let assistantIndex = -1;
    if (!opts.silentUserMessage) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
    }

    setMessages((prev) => {
      assistantIndex = prev.length;
      return [...prev, { role: 'assistant', content: '' }];
    });

    const replaceAssistantMessage = (content: string) => {
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex
            ? { ...msg, content }
            : msg
        )
      );
    };

    const appendAssistantToken = (delta: string) => {
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex
            ? { ...msg, content: `${msg.content}${delta}` }
            : msg
        )
      );
    };

    const removeAssistantPlaceholder = () => {
      setMessages((prev) => prev.filter((_, index) => index !== assistantIndex));
    };

    const applyUiAction = (payload?: {
      ui_action?: string;
      handoff_chat_id?: string;
      handoff_status?: string;
      response?: string;
    }) => {
      const shouldOpenAppointmentForm = payload?.ui_action === 'open_appointment_form';
      const shouldOpenHandoff = payload?.ui_action === 'open_human_handoff';
      const shouldOpenLeadForm = payload?.ui_action === 'open_lead_form';

      if (shouldOpenAppointmentForm) {
        replaceAssistantMessage(APPOINTMENT_FORM_PROMPT);
        openAppointmentForm();
      }

      if (shouldOpenLeadForm) {
        setShowLeadForm(true);
        setPendingHandoffAfterLead(true);
      }

      if (shouldOpenHandoff) {
        setPendingHandoffAfterLead(false);
        setShowLeadForm(false);
        setHandoffActive(true);
        if (payload?.handoff_chat_id) {
          const isNewChat = payload.handoff_chat_id !== handoffChatId;
          setHandoffChatId(payload.handoff_chat_id);
          if (isNewChat) {
            setHandoffAfterId(0);
            handoffSeenIdsRef.current.clear();
            loadHandoffMessages(payload.handoff_chat_id, true);
          } else {
            loadHandoffMessages(payload.handoff_chat_id, false);
          }
        }
        if (payload?.handoff_status) {
          setHandoffStatus(payload.handoff_status);
        }
      }
    };

    try {
      let streamDonePayload: any = null;
      let receivedToken = false;

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), STREAM_FALLBACK_TIMEOUT_MS);

        const streamResponse = await chatAPI.current.sendMessageStream(
          text,
          activeSessionId,
          widgetId,
          shopDomain,
          customerId ? String(customerId) : undefined,
          controller.signal
        );

        const reader = streamResponse.body?.getReader();
        if (!reader) {
          throw new Error('Streaming not supported');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const data = line.replace(/^data:\s?/, '');
              if (!data) continue;

              let payload: any;
              try {
                payload = JSON.parse(data);
              } catch {
                continue;
              }

              if (payload?.type === 'ready') {
                window.clearTimeout(timeoutId);
                continue;
              }

              if (payload?.type === 'token' && typeof payload?.text === 'string') {
                if (!receivedToken) {
                  receivedToken = true;
                  window.clearTimeout(timeoutId);
                }
                appendAssistantToken(payload.text);
              }

              if (payload?.type === 'done') {
                streamDonePayload = payload;
              }
            }
          }
        }

        window.clearTimeout(timeoutId);
      } catch {
        const response = await chatAPI.current.sendMessage(
          text,
          activeSessionId,
          widgetId,
          shopDomain,
          customerId ? String(customerId) : undefined
        );

        const hasHandoffMeta = Boolean(response?.handoff_chat_id || response?.handoff_status);
        const rawAssistantText = typeof response?.response === 'string' ? response.response.trim() : '';
        if (!rawAssistantText && hasHandoffMeta && !response?.ui_action) {
          removeAssistantPlaceholder();
        } else {
          replaceAssistantMessage(rawAssistantText || 'I could not generate a response right now.');
        }
        applyUiAction(response);
      }

      applyUiAction(streamDonePayload);

      const streamIndicatesHandoff = Boolean(streamDonePayload?.handoff_chat_id || streamDonePayload?.handoff_status);
      if (!receivedToken && streamDonePayload && !streamDonePayload?.ui_action && streamIndicatesHandoff) {
        removeAssistantPlaceholder();
      } else if (!receivedToken && streamDonePayload && !streamDonePayload?.ui_action && !streamIndicatesHandoff) {
        replaceAssistantMessage('I could not generate a response right now.');
      }

      setLastActivityAtMs(Date.now());

      if (!opts.skipLeadCaptureCheck) {
        try {
          const shouldCapture = await chatAPI.current.shouldCaptureLead(activeSessionId, widgetId);
          if (shouldCapture && !leadSubmitted && !pendingHandoffAfterLead && !handoffActive) {
            setShowLeadForm(true);
          }
        } catch {
          // Ignore lead-capture check failures.
        }
      }
    } catch {
      replaceAssistantMessage('Sorry, something went wrong. Please try again.');
      setLastActivityAtMs(Date.now());
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    sendMessage();
  };

  const handleLeadSubmit = async () => {
    if (leadSubmitting) return;
    if (!leadForm.name.trim() && !leadForm.email.trim() && !leadForm.phone.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please add at least one contact field so we can follow up.' },
      ]);
      return;
    }

    setLeadSubmitting(true);
    try {
      await chatAPI.current.submitLead({
        session_id: sessionId,
        widget_id: widgetId,
        name: leadForm.name.trim() || undefined,
        email: leadForm.email.trim() || undefined,
        phone: leadForm.phone.trim() || undefined,
        company: leadForm.company.trim() || undefined,
      });

      setLeadSubmitted(true);
      setShowLeadForm(false);
      setLeadForm({ name: '', email: '', phone: '', company: '' });

      if (pendingHandoffAfterLead) {
        setPendingHandoffAfterLead(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Thanks, your details are captured. I am now transferring your handoff request to a live agent.' },
        ]);
        await sendMessage('yes connect me', {
          silentUserMessage: true,
          skipLeadCaptureCheck: true,
          forceSessionId: sessionId,
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Thanks. Your details have been received.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, failed to submit your details. Please try again.' },
      ]);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailValue.trim() || emailSending) return;
    setEmailSending(true);
    try {
      await chatAPI.current.emailConversation(sessionId, emailValue.trim(), widgetId);
      setShowEmailForm(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Transcript sent to ${emailValue.trim()}.` },
      ]);
      setEmailValue('');
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, failed to send the transcript. Please try again.' },
      ]);
    } finally {
      setEmailSending(false);
    }
  };

  const openAppointmentForm = () => {
    const defaults = getDefaultAppointmentDateTime();
    setAppointmentForm((prev) => ({
      name: prev.name || leadForm.name || '',
      email: prev.email || leadForm.email || '',
      appointment_date: prev.appointment_date || defaults.date,
      appointment_time: prev.appointment_time || defaults.time,
    }));
    setShowAppointmentForm(true);
  };

  const handleAppointmentSubmit = async () => {
    if (appointmentSubmitting) return;
    if (
      !appointmentForm.name.trim() ||
      !appointmentForm.email.trim() ||
      !appointmentForm.appointment_date ||
      !appointmentForm.appointment_time
    ) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please complete name, email, date, and time to create the meeting.' },
      ]);
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(appointmentForm.email.trim())) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please enter a valid email address so we can confirm the meeting.' },
      ]);
      return;
    }

    const selectedDate = new Date(`${appointmentForm.appointment_date}T${appointmentForm.appointment_time}`);
    if (Number.isNaN(selectedDate.getTime())) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'The selected appointment time is invalid. Please try again.' },
      ]);
      return;
    }

    setAppointmentSubmitting(true);
    try {
      const result = await chatAPI.current.bookAppointment({
        session_id: sessionId,
        widget_id: widgetId,
        appointment_at: selectedDate.toISOString(),
        name: appointmentForm.name.trim(),
        email: appointmentForm.email.trim(),
        timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC').replace('Asia/Calcutta', 'Asia/Kolkata'),
      });

      setShowAppointmentForm(false);
      setAppointmentForm((prev) => ({ ...prev, appointment_date: '', appointment_time: '' }));

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result?.message || `Appointment booked for ${selectedDate.toLocaleString()}.`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, we could not book your appointment right now. Please try again.',
        },
      ]);
    } finally {
      setAppointmentSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`chatbot-widget-container ${position}${darkMode ? ' dark' : ''}`}
      style={{ '--primary-color': primaryColor, '--secondary-color': secondaryColor } as React.CSSProperties}
    >
      {!isOpen && (
        <button
          className="chatbot-widget-button chatbot-fade-in"
          onClick={() => setIsOpen(true)}
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
        >
          💬
        </button>
      )}

      {isOpen && (
        <div className="chatbot-widget-window chatbot-slide-in">
          <div
            className="chatbot-widget-header"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              color: headerTextColor,
            }}
          >
            <h3>{name}</h3>
            <div className="chatbot-widget-header-actions">
              <button className="chatbot-widget-header-btn" onClick={resetChat} title="New chat">⟳</button>
              <button className="chatbot-widget-header-btn" onClick={() => setShowEmailForm((v) => !v)} title="Email this conversation">✉</button>
              <button className="chatbot-widget-header-btn" onClick={openAppointmentForm} title="Book appointment">📅</button>
              <button
                className="chatbot-widget-header-btn"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? 'Light mode' : 'Dark mode'}
                style={{ fontSize: 16 }}
              >
                {darkMode ? '🌙' : '☀'}
              </button>
              <button className="chatbot-widget-close" onClick={() => setIsOpen(false)}>×</button>
            </div>
          </div>

          <div className="chatbot-widget-messages">
            {handoffActive && (
              <div className="chatbot-handoff-banner chatbot-fade-in">
                <div className="chatbot-handoff-title-row">
                  <span className="chatbot-handoff-title">Human handoff in progress</span>
                  <span className={`chatbot-handoff-chip ${handoffStatus === 'assigned' ? 'assigned' : 'waiting'}`}>
                    {handoffStatus === 'assigned' ? 'Agent assigned' : 'Waiting for agent'}
                  </span>
                </div>
                <div className="chatbot-handoff-subtitle">
                  Keep chatting. Your messages are routed to live support.
                </div>
                {handoffCountdownText ? (
                  <div className="chatbot-handoff-countdown">{handoffCountdownText}</div>
                ) : null}
                {handoffStatus === 'waiting_for_agent' && typeof handoffProgressPercent === 'number' ? (
                  <div className="chatbot-handoff-timer-graphic">
                    <div className="chatbot-handoff-timer-row">
                      <span className="chatbot-handoff-timer-seconds">{Math.max(0, handoffRemainingSeconds ?? handoffWaitTimeoutSeconds)} sec</span>
                      <span className="chatbot-handoff-timer-scale">{`${handoffWaitTimeoutSeconds} sec -> 0 sec`}</span>
                    </div>
                    <div className="chatbot-handoff-progress-track">
                      <div className="chatbot-handoff-progress-fill" style={{ width: `${handoffProgressPercent}%` }} />
                    </div>
                  </div>
                ) : null}
                <div className="chatbot-handoff-actions">
                  <button
                    className="chatbot-inline-button secondary"
                    onClick={() => {
                      loadHandoffSession();
                      if (handoffChatId) {
                        loadHandoffMessages(handoffChatId, false);
                      }
                    }}
                  >
                    Refresh status
                  </button>
                  {handoffError ? <span className="chatbot-handoff-error">{handoffError}</span> : null}
                </div>
              </div>
            )}

            {showSuggestions && (suggestionsLoading || suggestedQuestions.length > 0) && (
              <div className="chatbot-suggestions">
                <div className="chatbot-suggestions-title">Try asking</div>
                <div className="chatbot-suggestions-list">
                  {suggestionsLoading && <div className="chatbot-suggestions-loading">Loading suggestions...</div>}
                  {!suggestionsLoading && suggestedQuestions.map((question, index) => (
                    <button
                      key={`${question}-${index}`}
                      className="chatbot-suggestion-chip"
                      onClick={() => sendMessage(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={`chatbot-message ${message.role} chatbot-fade-in`}>
                {message.role === 'assistant' && <div className="chatbot-message-avatar assistant">{botIconGlyph}</div>}
                <div className="chatbot-message-bubble">{message.content}</div>
                {message.role === 'user' && <div className="chatbot-message-avatar user">{userIconGlyph}</div>}
              </div>
            ))}

            {showAppointmentForm && (
              <div className="chatbot-message assistant chatbot-fade-in">
                <div className="chatbot-message-avatar assistant">{botIconGlyph}</div>
                <div className="chatbot-message-bubble chatbot-appointment-bubble">
                  <div className="chatbot-appointment-title">Set up your meeting</div>
                  <div className="chatbot-appointment-subtitle">Please fill this short form and I will set the meeting for you.</div>

                  <input
                    type="text"
                    className="chatbot-inline-input chatbot-appointment-input"
                    placeholder="Full name"
                    value={appointmentForm.name}
                    onChange={(e) => setAppointmentForm((prev) => ({ ...prev, name: e.target.value }))}
                  />

                  <input
                    type="email"
                    className="chatbot-inline-input chatbot-appointment-input"
                    placeholder="Email address"
                    value={appointmentForm.email}
                    onChange={(e) => setAppointmentForm((prev) => ({ ...prev, email: e.target.value }))}
                  />

                  <div className="chatbot-appointment-grid">
                    <label className="chatbot-appointment-field">
                      <span className="chatbot-appointment-label">📅 Date</span>
                      <input
                        type="date"
                        className="chatbot-inline-input chatbot-appointment-input"
                        value={appointmentForm.appointment_date}
                        onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointment_date: e.target.value }))}
                      />
                    </label>

                    <label className="chatbot-appointment-field">
                      <span className="chatbot-appointment-label">⏰ Time</span>
                      <input
                        type="time"
                        className="chatbot-inline-input chatbot-appointment-input"
                        value={appointmentForm.appointment_time}
                        onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointment_time: e.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="chatbot-inline-actions chatbot-appointment-actions">
                    <button
                      className="chatbot-inline-button"
                      onClick={handleAppointmentSubmit}
                      disabled={appointmentSubmitting}
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                    >
                      {appointmentSubmitting ? 'Creating...' : 'Create meeting'}
                    </button>
                    <button
                      className="chatbot-inline-button secondary"
                      onClick={() => setShowAppointmentForm(false)}
                      disabled={appointmentSubmitting}
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="chatbot-message assistant chatbot-fade-in">
                <div className="chatbot-message-avatar assistant">{botIconGlyph}</div>
                <div className="chatbot-message-bubble">
                  <div className="chatbot-typing">
                    <div className="chatbot-typing-dot"></div>
                    <div className="chatbot-typing-dot"></div>
                    <div className="chatbot-typing-dot"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-widget-input-container">
            <input
              type="text"
              className="chatbot-widget-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setLastActivityAtMs(Date.now());
              }}
              onKeyDown={handleKeyPress}
              placeholder={
                sessionClosedByInactivity
                  ? 'Session closed due to inactivity. Type a message to start a new session...'
                  : 'Type your message...'
              }
              disabled={loading}
              ref={inputRef}
            />
            <button
              className="chatbot-widget-send"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            >
              Send
            </button>
          </div>
          {typeof inactivityRemainingSeconds === 'number' ? (
            <div className={`chatbot-inactivity-countdown${inactivityRemainingSeconds <= 15 ? ' warning' : ''}`}>
              Session auto-closes in {formatCountdownSeconds(inactivityRemainingSeconds)} if no activity.
            </div>
          ) : null}

          {showEmailForm && (
            <div className="chatbot-inline-card chatbot-fade-in">
              <div className="chatbot-inline-title">Email Conversation</div>
              <input
                type="email"
                className="chatbot-inline-input"
                placeholder="you@example.com"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />
              <div className="chatbot-inline-actions">
                <button
                  className="chatbot-inline-button"
                  onClick={handleEmailSubmit}
                  disabled={emailSending || !emailValue.trim()}
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                  {emailSending ? 'Sending...' : 'Send'}
                </button>
                <button
                  className="chatbot-inline-button secondary"
                  onClick={() => setShowEmailForm(false)}
                  disabled={emailSending}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showLeadForm && (
            <div className="chatbot-inline-card chatbot-lead-card chatbot-fade-in">
              <div className="chatbot-inline-title chatbot-lead-title">Quick contact form</div>
              <div className="chatbot-lead-subtitle">Small details now help us connect you faster with live support.</div>
              <input
                type="text"
                className="chatbot-inline-input chatbot-lead-input"
                placeholder="Name"
                value={leadForm.name}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                type="email"
                className="chatbot-inline-input chatbot-lead-input"
                placeholder="Email"
                value={leadForm.email}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                type="tel"
                className="chatbot-inline-input chatbot-lead-input"
                placeholder="Phone"
                value={leadForm.phone}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <input
                type="text"
                className="chatbot-inline-input chatbot-lead-input"
                placeholder="Company"
                value={leadForm.company}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, company: e.target.value }))}
              />
              <div className="chatbot-inline-actions">
                <button
                  className="chatbot-inline-button"
                  onClick={handleLeadSubmit}
                  disabled={leadSubmitting}
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                  {leadSubmitting ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  className="chatbot-inline-button secondary"
                  onClick={() => setShowLeadForm(false)}
                  disabled={leadSubmitting}
                >
                  Later
                </button>
              </div>
            </div>
          )}

          <div className="chatbot-widget-footer">Powered by Zentrixel AI</div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
