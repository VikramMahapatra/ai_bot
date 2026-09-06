import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Avatar,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  IconButton,
  Alert,
  Collapse,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { chatService } from '../../services/chatService';
import { leadService } from '../../services/leadService';
import { dashboardService } from '../../services/dashboardService';
import MarkdownRenderer from './MarkdownRenderer';
import MessageFeedback from './MessageFeedback';

interface SourceInfo {
  id: number;
  name: string;
  type: string;
  url?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceInfo[];
}

const CHAT_INACTIVITY_TIMEOUT_MS = 120000;
const CHAT_INACTIVITY_CLOSE_MESSAGE = 'Closing this chat session as no activity happened in the last 120 seconds.';
const createSessionId = () => `session_${Date.now()}_${Math.random()}`;
const STREAM_FALLBACK_TIMEOUT_MS = 12000;
const IST_TIMEZONE = 'Asia/Kolkata';

const getIstDefaultDateTimeLocalValue = (): string => {
  const seed = new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(seed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const parseIstDateTimeLocalValue = (value: string): Date => {
  return new Date(`${value}:00+05:30`);
};

const formatCountdownClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [sessionClosedByInactivity, setSessionClosedByInactivity] = useState(false);
  const [sessionEngaged, setSessionEngaged] = useState(false);
  const [lastActivityAtMs, setLastActivityAtMs] = useState(Date.now());
  const [inactivityNowMs, setInactivityNowMs] = useState(Date.now());
  const [widgets, setWidgets] = useState<{ widget_id: string; name: string }[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState('');
  const [widgetError, setWidgetError] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [submittingLead, setSubmittingLead] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [multilingualTextEnabled, setMultilingualTextEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [speakReplies, setSpeakReplies] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const recognitionRef = useRef<any>(null);
  const listeningDesiredRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitDialogMessage, setLimitDialogMessage] = useState('');
  const [limitDialogTokensUsed, setLimitDialogTokensUsed] = useState<number | null>(null);
  const [limitDialogTokenLimit, setLimitDialogTokenLimit] = useState<number | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<Array<{ question: string; answer: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentName, setAppointmentName] = useState('');
  const [appointmentEmail, setAppointmentEmail] = useState('');
  const [appointmentPhone, setAppointmentPhone] = useState('');
  const [appointmentDateTime, setAppointmentDateTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [bookingAppointment, setBookingAppointment] = useState(false);
  const [appointmentError, setAppointmentError] = useState('');
  const [handoffEnabled, setHandoffEnabled] = useState(false);
  const [handoffChatId, setHandoffChatId] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'none' | 'requested' | 'active' | 'ended' | string>('none');
  const [callMode, setCallMode] = useState<'video' | 'audio'>('video');
  const [callRoomId, setCallRoomId] = useState<string | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [requestingCall, setRequestingCall] = useState(false);
  const [updatingCallMode, setUpdatingCallMode] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [callError, setCallError] = useState('');

  const voiceLanguages = [
    { code: 'en-IN', label: 'English (India)' },
    { code: 'hi-IN', label: 'Hindi (India)' },
    { code: 'bn-IN', label: 'Bengali (India)' },
    { code: 'ta-IN', label: 'Tamil (India)' },
    { code: 'te-IN', label: 'Telugu (India)' },
    { code: 'kn-IN', label: 'Kannada (India)' },
    { code: 'ml-IN', label: 'Malayalam (India)' },
    { code: 'mr-IN', label: 'Marathi (India)' },
    { code: 'gu-IN', label: 'Gujarati (India)' },
    { code: 'pa-IN', label: 'Punjabi (India)' },
    { code: 'ur-IN', label: 'Urdu (India)' },
    { code: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
    { code: 'en-US', label: 'English (US)' },
  ];

  const inactivityRemainingSeconds = useMemo(() => {
    if (sessionClosedByInactivity || !sessionEngaged) {
      return null;
    }
    const elapsed = inactivityNowMs - lastActivityAtMs;
    return Math.max(0, Math.ceil((CHAT_INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
  }, [sessionClosedByInactivity, sessionEngaged, inactivityNowMs, lastActivityAtMs]);

  const selectedWidgetName = useMemo(() => {
    return widgets.find((item) => item.widget_id === selectedWidgetId)?.name || 'No widget selected';
  }, [widgets, selectedWidgetId]);

  const isResponding = loading || streaming;

  const callStatusColor: 'default' | 'warning' | 'success' | 'info' = callStatus === 'active'
    ? 'success'
    : callStatus === 'requested'
      ? 'warning'
      : callStatus === 'ended'
        ? 'default'
        : 'info';

  const getMeetingUrl = (roomId: string, mode: 'video' | 'audio') => {
    const safeRoom = encodeURIComponent(roomId);
    const videoMuted = mode === 'audio' ? 'true' : 'false';
    return `https://meet.jit.si/${safeRoom}#config.prejoinPageEnabled=false&config.startWithVideoMuted=${videoMuted}`;
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'auto',
      });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    if (messages.length === 0) {
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (location.pathname === '/chat') {
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location.pathname]);

  useEffect(() => {
    const loadWidgets = async () => {
      try {
        const data = await dashboardService.getWidgets();
        const widgetItems = data?.widgets || [];
        setWidgets(widgetItems.map((w: any) => ({ widget_id: w.widget_id, name: w.name })));
        if (!selectedWidgetId && widgetItems.length > 0) {
          setSelectedWidgetId(widgetItems[0].widget_id);
        }
      } catch (err) {
        setWidgetError('Failed to load widgets');
      }
    };

    loadWidgets();
  }, []);

  const loadSuggestedQuestions = async (widgetId: string) => {
    if (!widgetId) return;
    setSuggestionsLoading(true);
    setSuggestionsError('');
    try {
      const questions = await chatService.getSuggestedQuestions(widgetId);
      setSuggestedQuestions(questions);
    } catch (err) {
      setSuggestedQuestions([]);
      setSuggestionsError('Failed to load suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedWidgetId) return;
    loadSuggestedQuestions(selectedWidgetId);
  }, [selectedWidgetId]);

  const startFreshSession = () => {
    const nextSession = createSessionId();
    setSessionId(nextSession);
    setMessages([]);
    setShowLeadForm(false);
    setSessionClosedByInactivity(false);
    setSessionEngaged(false);
    setLastActivityAtMs(Date.now());
    return nextSession;
  };

  const handleQuickQuestion = (item: { question: string; answer: string }) => {
    setMessages((prev) => [...prev, { role: 'user', content: item.question }, { role: 'assistant', content: item.answer }]);
    setSessionEngaged(true);
    setLastActivityAtMs(Date.now());
  };

  useEffect(() => {
    if (sessionClosedByInactivity || !sessionEngaged || loading || streaming) return;

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
      listeningDesiredRef.current = false;
      recognitionRef.current?.stop?.();
      setListening(false);
      setLoading(false);
      setStreaming(false);
    }, CHAT_INACTIVITY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [lastActivityAtMs, sessionClosedByInactivity, sessionEngaged, loading, streaming]);

  useEffect(() => {
    if (sessionClosedByInactivity || !sessionEngaged) return;

    setInactivityNowMs(Date.now());
    const timer = window.setInterval(() => {
      setInactivityNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionClosedByInactivity, sessionEngaged, lastActivityAtMs]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognition && !!window.speechSynthesis);

    const loadFeatures = async () => {
      try {
        const features = await chatService.getFeatureFlags();
        setVoiceEnabled(!!features.voice_chat_enabled);
        setMultilingualTextEnabled(!!features.multilingual_text_enabled);
        setHandoffEnabled(!!features.human_handoff_enabled);
      } catch (err) {
        setVoiceEnabled(false);
        setMultilingualTextEnabled(false);
        setHandoffEnabled(false);
      }
    };

    loadFeatures();
  }, []);

  useEffect(() => {
    if (!handoffEnabled || !selectedWidgetId || !sessionId) {
      return;
    }

    let cancelled = false;

    const loadHandoffStatus = async () => {
      try {
        const status = await chatService.getHandoffSessionStatus(sessionId, selectedWidgetId, handoffChatId || undefined);
        if (cancelled) return;
        setHandoffChatId(status.chat_id || null);
        setHandoffStatus(status.status || null);
        setCallStatus(status.call_status || 'none');
        setCallMode((status.call_mode as 'video' | 'audio') || 'video');
        setCallRoomId(status.call_room_id || null);
      } catch {
        if (cancelled) return;
      }
    };

    loadHandoffStatus();
    const intervalId = window.setInterval(loadHandoffStatus, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [handoffEnabled, selectedWidgetId, sessionId, handoffChatId]);

  const handleRequestVideoCall = async () => {
    if (!selectedWidgetId || requestingCall) return;
    setRequestingCall(true);
    setCallError('');
    try {
      const status = await chatService.requestVideoCall(sessionId, selectedWidgetId);
      setHandoffChatId(status.chat_id || null);
      setHandoffStatus(status.status || null);
      setCallStatus(status.call_status || 'requested');
      setCallMode((status.call_mode as 'video' | 'audio') || 'video');
      setCallRoomId(status.call_room_id || null);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Video call request sent to a handoff user. You can join once they start the call.' },
      ]);
    } catch (err: any) {
      setCallError(err?.response?.data?.detail || 'Failed to request video call');
    } finally {
      setRequestingCall(false);
    }
  };

  const handleToggleCallMode = async () => {
    if (!selectedWidgetId || updatingCallMode || callStatus === 'none') return;
    const nextMode: 'video' | 'audio' = callMode === 'video' ? 'audio' : 'video';
    setUpdatingCallMode(true);
    setCallError('');
    try {
      const status = await chatService.setHandoffCallMode(sessionId, selectedWidgetId, nextMode);
      setCallMode((status.call_mode as 'video' | 'audio') || nextMode);
      setCallStatus(status.call_status || callStatus);
    } catch (err: any) {
      setCallError(err?.response?.data?.detail || 'Failed to switch call mode');
    } finally {
      setUpdatingCallMode(false);
    }
  };

  const handleEndLiveCall = async () => {
    if (!selectedWidgetId || endingCall) return;
    setEndingCall(true);
    setCallError('');
    try {
      const status = await chatService.endHandoffCall(sessionId, selectedWidgetId);
      setCallStatus(status.call_status || 'ended');
      setCallDialogOpen(false);
    } catch (err: any) {
      setCallError(err?.response?.data?.detail || 'Failed to end call');
    } finally {
      setEndingCall(false);
    }
  };

  const checkLeadCapture = async (targetSessionId: string = sessionId) => {
    try {
      const shouldCapture = await chatService.shouldCaptureLead(targetSessionId, selectedWidgetId);
      if (shouldCapture && !showLeadForm) {
        setShowLeadForm(true);
      }
    } catch (err) {
      console.error('Failed to check lead capture', err);
    }
  };

  const handleSend = async (overrideText?: string) => {
    let activeSessionId = sessionId;
    if (sessionClosedByInactivity) {
      activeSessionId = startFreshSession();
    }

    const textToSend = (overrideText ?? input).trim();
    if (!textToSend) return;
    if (!selectedWidgetId) {
      setWidgetError('Please select a widget before starting a chat.');
      return;
    }
    setWidgetError('');
    setSessionEngaged(true);
    setLastActivityAtMs(Date.now());

    const effectiveLangCode = multilingualTextEnabled ? selectedLang : 'en-IN';
    const selectedLangLabel = voiceLanguages.find((lang) => lang.code === effectiveLangCode)?.label;

    const userMessage = textToSend;
    const isNonEnglish = !effectiveLangCode.startsWith('en-');
    const isAsciiOnly = /^[\x00-\x7F]*$/.test(userMessage);
    let displayMessage = userMessage;
    let translatedMessage: string | null = null;

    if (!overrideText) {
      setInput('');
    }
    setLoading(true);

    let assistantIndex = -1;
    const showLimitDialog = (detail?: string, tokensUsed?: number, tokenLimit?: number) => {
      const messageText = detail || 'Your plan limit has been reached. Please upgrade or try again later.';
      setLimitDialogMessage(messageText);
      setLimitDialogTokensUsed(typeof tokensUsed === 'number' ? tokensUsed : null);
      setLimitDialogTokenLimit(typeof tokenLimit === 'number' ? tokenLimit : null);
      setLimitDialogOpen(true);
    };

    const replaceAssistantWith = (text: string) => {
      if (assistantIndex < 0) return;
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex
            ? { ...msg, content: text }
            : msg
        )
      );
    };

    try {
      if (multilingualTextEnabled && isNonEnglish && isAsciiOnly) {
        try {
          const translation = await chatService.translateText({
            text: userMessage,
            target_language_code: effectiveLangCode,
            target_language_label: selectedLangLabel,
            widget_id: selectedWidgetId,
          });
          if (translation?.translated_text) {
            translatedMessage = translation.translated_text;
            displayMessage = translatedMessage;
          }
        } catch (translationError) {
          console.error('Failed to translate input', translationError);
        }
      }

      setMessages((prev) => [...prev, { role: 'user', content: displayMessage }]);
      setMessages((prev) => {
        assistantIndex = prev.length;
        return [...prev, { role: 'assistant', content: '', sources: [] }];
      });
      setStreaming(true);

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), STREAM_FALLBACK_TIMEOUT_MS);
        let receivedToken = false;

        const streamResponse = await chatService.sendMessageStream({
          message: translatedMessage || userMessage,
          retrieval_message: translatedMessage ? userMessage : undefined,
          session_id: activeSessionId,
          widget_id: selectedWidgetId,
          language_code: effectiveLangCode,
          language_label: selectedLangLabel,
        }, controller.signal);

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
              const payload = JSON.parse(data);
              if (payload.type === 'ready') {
                window.clearTimeout(timeoutId);
                continue;
              }
              if (payload.type === 'token') {
                if (!receivedToken) {
                  receivedToken = true;
                  window.clearTimeout(timeoutId);
                }
                setMessages((prev) =>
                  prev.map((msg, index) =>
                    index === assistantIndex
                      ? { ...msg, content: `${msg.content}${payload.text}` }
                      : msg
                  )
                );
              }
              if (payload.type === 'done') {
                setMessages((prev) =>
                  prev.map((msg, index) =>
                    index === assistantIndex
                      ? { ...msg, sources: payload.sources || [] }
                      : msg
                  )
                );
              }
            }
          }
        }

        if (!receivedToken) {
          window.clearTimeout(timeoutId);
        }
      } catch (streamError: any) {
        console.error('Streaming failed, falling back to standard response', streamError);
        if (streamError?.status === 403) {
          replaceAssistantWith('Usage limit reached. Please upgrade or try again later.');
          showLimitDialog(streamError?.detail, streamError?.tokensUsed, streamError?.tokenLimit);
          setStreaming(false);
          return;
        }
        const response = await chatService.sendMessage({
          message: translatedMessage || userMessage,
          retrieval_message: translatedMessage ? userMessage : undefined,
          session_id: activeSessionId,
          widget_id: selectedWidgetId,
          language_code: effectiveLangCode,
          language_label: selectedLangLabel,
        });

        setMessages((prev) =>
          prev.map((msg, index) =>
            index === assistantIndex
              ? { ...msg, content: response.response, sources: response.sources || [] }
              : msg
          )
        );
      }

      setStreaming(false);

      await checkLeadCapture(activeSessionId);
      setLastActivityAtMs(Date.now());
    } catch (err: any) {
      console.error('Failed to send message', err);
      if (err?.response?.status === 403) {
        replaceAssistantWith('Usage limit reached. Please upgrade or try again later.');
        const detail = err?.response?.data?.detail;
        const tokensUsed = detail?.tokens_used ?? err?.response?.data?.tokens_used;
        const tokenLimit = detail?.token_limit ?? err?.response?.data?.token_limit;
        const messageText = detail?.message || detail;
        showLimitDialog(messageText, tokensUsed, tokenLimit);
        setStreaming(false);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
      setStreaming(false);
      setLastActivityAtMs(Date.now());
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!voiceSupported || !voiceEnabled) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      setVoiceError('');
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      const result = event.results?.[event.results.length - 1];
      const transcript = result?.[0]?.transcript || '';
      if (transcript) {
        setInput(transcript);
        if (isSpeakingRef.current) {
          window.speechSynthesis?.cancel();
          isSpeakingRef.current = false;
        }
      }
      if (result?.isFinal && transcript && !streaming) {
        handleSend(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event?.error === 'aborted' && (listeningDesiredRef.current || isSpeakingRef.current)) {
        return;
      }
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        setVoiceError('Microphone access blocked. Allow mic permission and try again.');
      } else if (event?.error === 'no-speech') {
        setVoiceError('No speech detected. Please speak clearly.');
      } else {
        setVoiceError(event?.error ? `Voice error: ${event.error}` : 'Voice recognition error');
      }
      setListening(false);
    };

    recognition.onend = () => {
      if (listeningDesiredRef.current) {
        recognition.start();
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    setVoiceError('');
    listeningDesiredRef.current = true;
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    listeningDesiredRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  };

  const speakText = (text: string) => {
    if (!speakReplies || !voiceSupported) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLang;
    utterance.onstart = () => {
      isSpeakingRef.current = true;
    };
    utterance.onend = () => {
      isSpeakingRef.current = false;
    };
    synth.speak(utterance);
  };

  useEffect(() => {
    if (!speakReplies || !messages.length || streaming) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      speakText(last.content);
    }
  }, [messages, speakReplies, selectedLang, streaming]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeadSubmit = async () => {
    try {
      setSubmittingLead(true);
      await leadService.createLead({
        session_id: sessionId,
        widget_id: selectedWidgetId,
        name: leadName,
        email: leadEmail,
        phone: leadPhone,
        company: leadCompany || undefined,
        source: 'chat',
      });
      setShowLeadForm(false);
      setLeadName('');
      setLeadEmail('');
      setLeadPhone('');
      setLeadCompany('');
    } catch (err) {
      console.error('Failed to submit lead', err);
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleEmailConversation = () => {
    if (messages.length === 0) {
      setEmailError('No conversation to send');
      return;
    }
    setShowEmailDialog(true);
    setEmailSuccess(false);
    setEmailError('');
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !/\S+@\S+\.\S+/.test(emailAddress)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setSendingEmail(true);
      setEmailError('');
      await chatService.emailConversation(sessionId, emailAddress);
      setEmailSuccess(true);
      setTimeout(() => {
        setShowEmailDialog(false);
        setEmailAddress('');
        setEmailSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to send email', err);
      setEmailError('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const openAppointmentDialog = () => {
    if (!selectedWidgetId) {
      setWidgetError('Please select a widget before booking an appointment.');
      return;
    }
    if (!appointmentDateTime) {
      setAppointmentDateTime(getIstDefaultDateTimeLocalValue());
    }
    setAppointmentError('');
    setAppointmentDialogOpen(true);
  };

  const handleBookAppointment = async () => {
    if (!selectedWidgetId) {
      setAppointmentError('Please select a widget before booking.');
      return;
    }
    if (!appointmentName.trim()) {
      setAppointmentError('Please provide your name.');
      return;
    }
    if (!appointmentDateTime) {
      setAppointmentError('Please pick a date and time.');
      return;
    }

    if (!appointmentEmail.trim()) {
      setAppointmentError('Please provide your email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(appointmentEmail.trim())) {
      setAppointmentError('Please enter a valid email address.');
      return;
    }

    const dateValue = parseIstDateTimeLocalValue(appointmentDateTime);
    if (Number.isNaN(dateValue.getTime())) {
      setAppointmentError('Invalid appointment date/time.');
      return;
    }

    try {
      setBookingAppointment(true);
      setAppointmentError('');
      const result = await chatService.bookAppointment({
        session_id: sessionId,
        widget_id: selectedWidgetId,
        appointment_at: dateValue.toISOString(),
        name: appointmentName.trim(),
        email: appointmentEmail.trim(),
        phone: appointmentPhone.trim() || undefined,
        notes: appointmentNotes.trim() || undefined,
        timezone: IST_TIMEZONE,
      });

      const istTimeLabel = new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIMEZONE,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(dateValue);

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `Please book an appointment for ${istTimeLabel} (IST).` },
        { role: 'assistant', content: result.message },
      ]);

      setAppointmentDialogOpen(false);
      setAppointmentName('');
      setAppointmentEmail('');
      setAppointmentPhone('');
      setAppointmentNotes('');
    } catch (err: any) {
      setAppointmentError(err?.response?.data?.detail || 'Failed to book appointment. Please try again.');
    } finally {
      setBookingAppointment(false);
    }
  };

  const bubbleAppear = keyframes`
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  `;

  const typingPulse = keyframes`
    0% { transform: translateY(0); opacity: 0.35; }
    50% { transform: translateY(-3px); opacity: 1; }
    100% { transform: translateY(0); opacity: 0.35; }
  `;

  const glassCardBg = 'linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(236,246,255,0.86) 56%, rgba(224,239,255,0.84) 100%)';

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 2.6,
        background:
          'radial-gradient(circle at 12% 0%, rgba(56,189,248,0.08), transparent 34%), radial-gradient(circle at 100% 100%, rgba(37,99,235,0.07), transparent 40%)',
      }}
    >
      {widgetError && (
        <Alert
          severity="warning"
          sx={{
            mb: 1.2,
            borderRadius: 2,
            border: '1px solid rgba(245,158,11,0.35)',
            bgcolor: 'rgba(255,251,235,0.92)',
          }}
        >
          {widgetError}
        </Alert>
      )}
      <Paper
        data-scroll-reset="true"
        ref={messagesContainerRef}
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: { xs: 1, md: 1.25 },
          mb: 0.9,
          borderRadius: 2.7,
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          background: glassCardBg,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 12px 24px rgba(15,23,42,0.08)',
          scrollbarWidth: 'thin',
          scrollbarColor: '#7da2ff rgba(203,213,225,0.45)',
          '&::-webkit-scrollbar': {
            width: '10px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(226,232,240,0.7)',
            borderRadius: '999px',
            margin: '8px 0',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg, rgba(59,130,246,0.82) 0%, rgba(37,99,235,0.82) 100%)',
            borderRadius: '999px',
            border: '2px solid rgba(226,232,240,0.75)',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'linear-gradient(180deg, rgba(37,99,235,0.94) 0%, rgba(30,64,175,0.94) 100%)',
          },
        }}
      >
        <Box
          sx={{
            mb: 1.05,
            position: 'sticky',
            top: 0,
            zIndex: 2,
            p: { xs: 0.85, md: 0.95 },
            borderRadius: 2.2,
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
            background: 'linear-gradient(132deg, rgba(255,255,255,0.97) 0%, rgba(241,248,255,0.96) 100%)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.8,
            boxShadow: '0 8px 18px rgba(15,23,42,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: 'rgba(56,109,255,0.12)',
                  color: 'primary.main',
                  boxShadow: '0 6px 14px rgba(45,122,240,0.2)',
                }}
              >
                <SmartToyIcon />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.05, letterSpacing: '0.01em', fontSize: { xs: '1rem', md: '1.04rem' } }}>
                  Assistant Workspace
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  Grounded responses from your selected widget knowledge.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={isResponding ? 'Replying...' : 'Ready'}
                sx={{
                  fontWeight: 700,
                  bgcolor: isResponding ? 'rgba(251,191,36,0.2)' : 'rgba(34,197,94,0.16)',
                  color: 'text.primary',
                  border: '1px solid rgba(15,23,42,0.08)',
                }}
              />
              <Chip
                size="small"
                label={selectedWidgetName}
                sx={{
                  maxWidth: 230,
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                  bgcolor: 'rgba(56,109,255,0.1)',
                  color: 'primary.main',
                  border: '1px solid rgba(56,109,255,0.2)',
                }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto auto' }, gap: 0.65 }}>
            <FormControl
              size="small"
              sx={{
                minWidth: 220,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.96)',
                },
              }}
            >
              <InputLabel id="chat-widget-select-label">Widget</InputLabel>
              <Select
                labelId="chat-widget-select-label"
                value={selectedWidgetId}
                label="Widget"
                onChange={(e) => setSelectedWidgetId(e.target.value)}
              >
                {widgets.map((widget) => (
                  <MenuItem key={widget.widget_id} value={widget.widget_id}>
                    {widget.name} ({widget.widget_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              onClick={() => {
                startFreshSession();
                setExpandedSources(new Set());
                setInput('');
              }}
              startIcon={<RestartAltIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.8,
                border: '1px solid rgba(56,109,255,0.3)',
                color: 'primary.main',
                bgcolor: 'rgba(255,255,255,0.9)',
                px: 1.4,
                '&:hover': {
                  bgcolor: 'rgba(237,245,255,0.95)',
                },
              }}
            >
              New Session
            </Button>

            <Button
              onClick={openAppointmentDialog}
              startIcon={<CalendarMonthIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.8,
                px: 1.3,
                color: 'white',
                background: 'linear-gradient(135deg, rgba(8,145,178,0.95) 0%, rgba(14,165,233,0.95) 100%)',
                boxShadow: '0 6px 14px rgba(14,165,233,0.28)',
                '&:hover': {
                  background: 'linear-gradient(135deg, rgba(6,112,138,0.98) 0%, rgba(2,132,199,0.98) 100%)',
                },
              }}
            >
              Book
            </Button>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.7, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
              {handoffEnabled && (
                <Chip
                  size="small"
                  label={`Call: ${callStatus}`}
                  color={callStatusColor}
                  variant="outlined"
                />
              )}
              {(multilingualTextEnabled || voiceEnabled) && (
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 172,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.96)',
                    },
                  }}
                >
                  <InputLabel id="voice-lang-label">
                    {multilingualTextEnabled ? 'Language' : 'Voice Language'}
                  </InputLabel>
                  <Select
                    labelId="voice-lang-label"
                    value={selectedLang}
                    label={multilingualTextEnabled ? 'Language' : 'Voice Language'}
                    onChange={(e) => setSelectedLang(e.target.value as string)}
                  >
                    {voiceLanguages.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {voiceEnabled && (
                <>
                  <Tooltip title={listening ? 'Stop voice input' : 'Start voice input'}>
                    <span>
                      <IconButton
                        onClick={listening ? stopListening : startListening}
                        disabled={!voiceSupported}
                        sx={{
                          bgcolor: listening ? 'rgba(239,68,109,0.14)' : 'rgba(56,109,255,0.12)',
                          border: '1px solid rgba(56,109,255,0.2)',
                        }}
                      >
                        {listening ? <MicOffIcon color="error" /> : <MicIcon color="primary" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={speakReplies ? 'Disable voice replies' : 'Enable voice replies'}>
                    <span>
                      <IconButton
                        onClick={() => setSpeakReplies((prev) => !prev)}
                        disabled={!voiceSupported}
                        sx={{
                          bgcolor: speakReplies ? 'rgba(56,109,255,0.18)' : 'transparent',
                          border: '1px solid rgba(56,109,255,0.2)',
                        }}
                      >
                        <VolumeUpIcon color={speakReplies ? 'primary' : 'inherit'} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
            </Box>

            {messages.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                {handoffEnabled && (
                  <>
                    <Button
                      onClick={handleRequestVideoCall}
                      startIcon={<VideocamIcon />}
                      disabled={!selectedWidgetId || requestingCall || callStatus === 'requested' || callStatus === 'active'}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.8,
                        color: 'white',
                        background: 'linear-gradient(135deg, rgba(14,165,233,0.95) 0%, rgba(2,132,199,0.95) 100%)',
                        boxShadow: '0 6px 14px rgba(14,165,233,0.28)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, rgba(8,145,178,0.98) 0%, rgba(3,105,161,0.98) 100%)',
                        },
                      }}
                    >
                      {requestingCall ? 'Requesting...' : 'Video Call'}
                    </Button>
                    <Button
                      onClick={() => setCallDialogOpen(true)}
                      startIcon={callMode === 'audio' ? <PhoneIcon /> : <VideocamIcon />}
                      disabled={callStatus !== 'active' || !callRoomId}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.8,
                        border: '1px solid rgba(14,165,233,0.35)',
                        color: 'info.main',
                        bgcolor: 'rgba(255,255,255,0.9)',
                        '&:hover': {
                          bgcolor: 'rgba(236,254,255,0.95)',
                        },
                      }}
                    >
                      Join Call
                    </Button>
                    <Button
                      onClick={handleToggleCallMode}
                      startIcon={callMode === 'video' ? <PhoneIcon /> : <VideocamIcon />}
                      disabled={(callStatus !== 'active' && callStatus !== 'requested') || updatingCallMode}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 1.8,
                        border: '1px solid rgba(56,109,255,0.3)',
                        color: 'primary.main',
                        bgcolor: 'rgba(255,255,255,0.9)',
                      }}
                    >
                      {updatingCallMode ? 'Switching...' : (callMode === 'video' ? 'Audio Only' : 'Video Mode')}
                    </Button>
                    <Button
                      onClick={handleEndLiveCall}
                      startIcon={<CallEndIcon />}
                      color="error"
                      disabled={callStatus !== 'active' || endingCall}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.8 }}
                    >
                      {endingCall ? 'Ending...' : 'End Call'}
                    </Button>
                  </>
                )}
                <Tooltip title="Email this conversation" placement="left">
                  <Button
                    onClick={handleEmailConversation}
                    startIcon={<EmailIcon />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 1.8,
                      color: 'white',
                      background: 'linear-gradient(135deg, rgba(79,70,229,0.95) 0%, rgba(99,102,241,0.95) 100%)',
                      boxShadow: '0 6px 14px rgba(79,70,229,0.28)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, rgba(67,56,202,0.98) 0%, rgba(79,70,229,0.98) 100%)',
                      },
                    }}
                  >
                    Email Chat
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Box>
          {callError && (
            <Alert severity="error" sx={{ mt: 0.5 }}>
              {callError}
            </Alert>
          )}
        </Box>
        {!multilingualTextEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Multilingual text support is disabled for this plan.
          </Alert>
        )}
        {voiceEnabled && !voiceSupported && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Voice chat isn't supported in this browser.
          </Alert>
        )}
        {voiceError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {voiceError}
          </Alert>
        )}
        {messages.length === 0 && (suggestionsLoading || suggestedQuestions.length > 0 || suggestionsError) && (
          <Box sx={{ mb: 1.2 }}>
            <Paper
              sx={{
                p: 1.35,
                borderRadius: 2,
                border: '1px solid rgba(59,130,246,0.2)',
                background: 'linear-gradient(140deg, rgba(255,255,255,0.95) 0%, rgba(238,246,255,0.92) 100%)',
                boxShadow: '0 8px 16px rgba(15, 23, 42, 0.07)'
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#0f172a',
                }}
              >
                Try asking
              </Typography>
              {suggestionsLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    Loading suggestions…
                  </Typography>
                </Box>
              )}
              {suggestionsError && !suggestionsLoading && (
                <Typography variant="caption" sx={{ color: 'error.main' }}>
                  {suggestionsError}
                </Typography>
              )}
              {!suggestionsLoading && suggestedQuestions.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {suggestedQuestions.map((item, idx) => (
                    <Chip
                      key={`${item.question}-${idx}`}
                      label={item.question}
                      onClick={() => handleQuickQuestion(item)}
                      sx={(theme) => ({
                        fontSize: '0.77rem',
                        borderRadius: '999px',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                        color: theme.palette.primary.dark,
                        fontWeight: 600,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                        }
                      })}
                    />
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        )}
        {messages.length === 0 && (
          <Box
            sx={{
              minHeight: 136,
              display: 'grid',
              placeItems: 'center',
              color: 'text.secondary',
              textAlign: 'center',
              borderRadius: 2.2,
              border: '1px dashed rgba(148,163,184,0.6)',
              background: 'rgba(255,255,255,0.58)',
            }}
          >
            <Typography color="text.secondary" sx={{ px: 2, fontWeight: 500 }}>
              Start a conversation to see responses here.
            </Typography>
          </Box>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <Box
              key={index}
              sx={{
                mb: 1.2,
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 0.72,
                animation: `${bubbleAppear} 320ms ease both`,
                animationDelay: `${Math.min(index * 25, 350)}ms`,
              }}
            >
              <Tooltip title={isUser ? 'You' : 'AI'} placement={isUser ? 'right' : 'left'}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: isUser ? 'primary.main' : 'rgba(255,255,255,0.95)',
                    color: isUser ? 'white' : 'primary.main',
                    border: isUser ? 'none' : '1px solid rgba(54,109,255,0.28)',
                    boxShadow: isUser ? '0 9px 16px rgba(56,109,255,0.3)' : '0 8px 12px rgba(15,23,42,0.08)',
                    mt: 0.45,
                  }}
                >
                  {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                </Avatar>
              </Tooltip>

              <Box sx={{ maxWidth: { xs: '86%', md: '76%' } }}>
                <Paper
                  sx={{
                    px: 1.35,
                    py: 1.02,
                    borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                    background: isUser
                      ? 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 65%, #4bc8ff 100%)'
                      : 'linear-gradient(140deg, rgba(255,255,255,0.96) 0%, rgba(239,246,255,0.96) 100%)',
                    color: isUser ? 'common.white' : 'text.primary',
                    border: isUser ? 'none' : '1px solid rgba(53,108,255,0.2)',
                    boxShadow: isUser ? '0 10px 20px rgba(45,122,240,0.28)' : '0 10px 20px rgba(15,23,42,0.08)',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownRenderer content={message.content} isUserMessage={false} />
                  ) : (
                    <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                      {message.content}
                    </Typography>
                  )}
                </Paper>

                {message.role === 'assistant' && (
                  <Box
                    sx={{
                      mt: 0.65,
                      ml: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <MessageFeedback
                      messageIndex={index}
                      sessionId={sessionId}
                      onFeedbackSubmitted={() => {
                        // Hook preserved for potential analytics updates.
                      }}
                    />
                    {message.sources && message.sources.length > 0 && (
                      <Button
                        size="small"
                        onClick={() => {
                          setExpandedSources((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(index)) {
                              newSet.delete(index);
                            } else {
                              newSet.add(index);
                            }
                            return newSet;
                          });
                        }}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.78rem',
                          color: 'primary.main',
                          p: 0.6,
                          minWidth: 'auto',
                          borderRadius: 1.5,
                          '&:hover': {
                            background: 'rgba(56,109,255,0.1)',
                          },
                        }}
                        startIcon={
                          <ExpandMoreIcon
                            sx={{
                              fontSize: '1.1rem',
                              transform: expandedSources.has(index) ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.25s ease',
                            }}
                          />
                        }
                      >
                        <InfoIcon sx={{ fontSize: '0.95rem' }} />
                        <span style={{ marginLeft: '4px' }}>Sources ({message.sources.length})</span>
                      </Button>
                    )}
                  </Box>
                )}

                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <Collapse in={expandedSources.has(index)} timeout="auto">
                    <Box
                      sx={{
                        mt: 0.9,
                        p: 1.2,
                        borderRadius: 2,
                        border: '1px solid rgba(53,108,255,0.16)',
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,244,255,0.92) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.85,
                      }}
                    >
                      {message.sources.map((source) => (
                        <Box
                          key={source.id}
                          sx={{
                            p: 1,
                            borderRadius: 1.5,
                            border: '1px solid rgba(53,108,255,0.14)',
                            background: 'rgba(255,255,255,0.88)',
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.35 }}>
                            {source.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip
                              label={source.type}
                              size="small"
                              sx={{
                                height: 20,
                                bgcolor: 'rgba(56,109,255,0.12)',
                                color: 'primary.main',
                                fontWeight: 700,
                                fontSize: '0.68rem',
                              }}
                            />
                            {source.url && (
                              <Typography
                                variant="caption"
                                component="a"
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  color: 'primary.main',
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                }}
                              >
                                {new URL(source.url).hostname}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                )}
              </Box>
            </Box>
          );
        })}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: 'rgba(255,255,255,0.95)',
                color: 'primary.main',
                border: '1px solid rgba(54,109,255,0.28)',
                boxShadow: '0 8px 14px rgba(15,23,42,0.08)',
                mt: 0.45,
              }}
            >
              <SmartToyIcon fontSize="small" />
            </Avatar>
            <Paper
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: '18px 18px 18px 6px',
                border: '1px solid rgba(53,108,255,0.2)',
                background: 'linear-gradient(140deg, rgba(255,255,255,0.96) 0%, rgba(239,246,255,0.96) 100%)',
                boxShadow: '0 12px 24px rgba(15,23,42,0.08)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                {[0, 1, 2].map((dot) => (
                  <Box
                    key={dot}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      opacity: 0.45,
                      animation: `${typingPulse} 980ms ease-in-out infinite`,
                      animationDelay: `${dot * 120}ms`,
                    }}
                  />
                ))}
                <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.2 }}>
                  AI is typing...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Paper>

      <Dialog open={callDialogOpen} onClose={() => setCallDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {callMode === 'audio' ? <PhoneIcon color="primary" /> : <VideocamIcon color="primary" />}
            <Typography sx={{ fontWeight: 700 }}>
              Live {callMode === 'audio' ? 'Audio' : 'Video'} Call
            </Typography>
          </Box>
          <Chip size="small" label={`Status: ${callStatus}`} color={callStatusColor} variant="outlined" />
        </DialogTitle>
        <DialogContent>
          {!callRoomId ? (
            <Alert severity="warning">Call room is not available yet.</Alert>
          ) : (
            <Box sx={{ width: '100%', height: { xs: 360, md: 560 }, borderRadius: 2, overflow: 'hidden', border: '1px solid #dbe6f5' }}>
              <iframe
                title="handoff-live-call"
                src={getMeetingUrl(callRoomId, callMode)}
                style={{ width: '100%', height: '100%', border: 0 }}
                allow="camera; microphone; fullscreen; display-capture"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleToggleCallMode} startIcon={callMode === 'video' ? <PhoneIcon /> : <VideocamIcon />} disabled={(callStatus !== 'active' && callStatus !== 'requested') || updatingCallMode}>
            {updatingCallMode ? 'Switching...' : (callMode === 'video' ? 'Switch to Audio' : 'Switch to Video')}
          </Button>
          <Button color="error" onClick={handleEndLiveCall} startIcon={<CallEndIcon />} disabled={callStatus !== 'active' || endingCall}>
            {endingCall ? 'Ending...' : 'End Call'}
          </Button>
          <Button onClick={() => setCallDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={showLeadForm} 
        onClose={() => setShowLeadForm(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f2f8ff 100%)',
            boxShadow: '0 24px 60px rgba(45, 122, 240, 0.2)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 0,
          borderBottom: '1px solid #e2e8f0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <SmartToyIcon sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Let's Connect
            </Typography>
          </Box>
          <IconButton 
            onClick={() => setShowLeadForm(false)}
            size="small"
            sx={{ color: '#64748b' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {/* Trust Badge */}
          <Box sx={{
            background: 'linear-gradient(135deg, #e6f0ff 0%, #f2f8ff 100%)',
            borderRadius: '12px',
            p: 2,
            mb: 3,
            border: '1px solid rgba(53,108,255,0.22)'
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
              <SecurityIcon sx={{ color: '#356dff', mt: 0.5, fontSize: 20 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2456d1', mb: 0.5 }}>
                  Your Privacy is Protected
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.5 }}>
                  We collect your information securely and never share it with third parties. Your data is encrypted and protected under GDPR compliance.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Form Fields */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Name Field */}
            <Box>
              <TextField
                fullWidth
                label="Full Name"
                placeholder="John Doe"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                variant="outlined"
                size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    background: '#ffffff',
                    '&:hover fieldset': {
                      borderColor: '#356dff',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#356dff',
                      borderWidth: '2px'
                    }
                  },
                  '& .MuiOutlinedInput-input': {
                    fontSize: '14px',
                  }
                }}
              />
            </Box>

            {/* Email Field */}
            <Box>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                placeholder="john@example.com"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                variant="outlined"
                size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    background: '#ffffff',
                    '&:hover fieldset': {
                      borderColor: '#356dff',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#356dff',
                      borderWidth: '2px'
                    }
                  }
                }}
              />
            </Box>

            {/* Phone Field */}
            <Box>
              <TextField
                fullWidth
                label="Phone Number"
                placeholder="+1 (555) 123-4567"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                variant="outlined"
                size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    background: '#ffffff',
                    '&:hover fieldset': {
                      borderColor: '#356dff',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#356dff',
                      borderWidth: '2px'
                    }
                  }
                }}
              />
            </Box>

            {/* Company Field */}
            <Box>
              <TextField
                fullWidth
                label="Company Name"
                placeholder="Your Company"
                value={leadCompany}
                onChange={(e) => setLeadCompany(e.target.value)}
                variant="outlined"
                size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    background: '#ffffff',
                    '&:hover fieldset': {
                      borderColor: '#356dff',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#356dff',
                      borderWidth: '2px'
                    }
                  }
                }}
              />
            </Box>
          </Box>

          {/* Privacy Footer */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
              <LockIcon sx={{ color: '#64748b', fontSize: 18 }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                Encrypted & Secure
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', lineHeight: 1.6 }}>
              By submitting this form, you agree to our privacy policy. We'll contact you within 24 hours.
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setShowLeadForm(false)}
              sx={{
                borderRadius: '10px',
                borderColor: '#e2e8f0',
                color: '#64748b',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '14px',
                py: 1.25,
                '&:hover': {
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f8fafc'
                }
              }}
            >
              Maybe Later
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleLeadSubmit}
              disabled={submittingLead || !leadName.trim() || !leadEmail.trim()}
              sx={{
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '14px',
                py: 1.25,
                boxShadow: '0 6px 16px rgba(45, 122, 240, 0.3)',
                '&:hover': {
                  boxShadow: '0 8px 18px rgba(45, 122, 240, 0.36)',
                },
                '&:disabled': {
                  background: '#cbd5e1',
                  boxShadow: 'none'
                }
              }}
            >
              {submittingLead ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ color: 'white' }} />
                  <span>Submitting...</span>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ fontSize: 18 }} />
                  <span>Submit</span>
                </Box>
              )}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Email Conversation Dialog */}
      <Dialog 
        open={showEmailDialog} 
        onClose={() => setShowEmailDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <EmailIcon sx={{ mr: 1 }} />
            <span>Email Conversation</span>
          </Box>
          <IconButton 
            onClick={() => setShowEmailDialog(false)} 
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {emailSuccess ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Email sent successfully to {emailAddress}!
            </Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                Enter your email address to receive a transcript of this conversation.
              </Typography>

              {emailError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {emailError}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="your.email@example.com"
                disabled={sendingEmail}
                sx={{ mb: 3 }}
                autoFocus
              />

              <Button
                fullWidth
                variant="contained"
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailAddress}
                sx={{
                  py: 1.5,
                  background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #2747be 0%, #256fb8 100%)',
                  }
                }}
              >
                {sendingEmail ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} sx={{ color: 'white' }} />
                    <span>Sending...</span>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SendIcon />
                    <span>Send Email</span>
                  </Box>
                )}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={appointmentDialogOpen}
        onClose={() => setAppointmentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: '1px solid rgba(53,108,255,0.2)',
            background: 'linear-gradient(140deg, #ffffff 0%, #f2f8ff 100%)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'primary.main' }}>Book Appointment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {appointmentError && <Alert severity="error">{appointmentError}</Alert>}
            <TextField
              label="Name"
              value={appointmentName}
              onChange={(e) => setAppointmentName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={appointmentEmail}
              onChange={(e) => setAppointmentEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Phone"
              value={appointmentPhone}
              onChange={(e) => setAppointmentPhone(e.target.value)}
              fullWidth
            />
            <TextField
              label="Appointment Date & Time (IST)"
              type="datetime-local"
              value={appointmentDateTime}
              onChange={(e) => setAppointmentDateTime(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="All appointments are scheduled in IST by default."
              required
            />
            <TextField
              label="Notes"
              value={appointmentNotes}
              onChange={(e) => setAppointmentNotes(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setAppointmentDialogOpen(false)}
            disabled={bookingAppointment}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBookAppointment}
            disabled={bookingAppointment}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
            }}
          >
            {bookingAppointment ? 'Booking...' : 'Confirm Appointment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Usage Limit Dialog */}
      <Dialog
        open={limitDialogOpen}
        onClose={() => setLimitDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
            color: 'common.white',
            border: '1px solid rgba(148,163,184,0.2)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Usage limit reached</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.9)' }}>
            {limitDialogMessage}
          </Typography>
          {(limitDialogTokensUsed !== null || limitDialogTokenLimit !== null) && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.9)' }}>
                Tokens used: <strong>{limitDialogTokensUsed ?? '—'}</strong>
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'rgba(148,163,184,0.9)' }}>
                Token limit: <strong>{limitDialogTokenLimit ?? '—'}</strong>
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setLimitDialogOpen(false)}
            variant="outlined"
            sx={{
              borderColor: 'rgba(148,163,184,0.5)',
              color: 'rgba(226,232,240,0.9)',
              '&:hover': { borderColor: 'rgba(226,232,240,0.9)', background: 'rgba(148,163,184,0.1)' },
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: 0.65,
          p: { xs: 0.85, md: 0.95 },
          borderRadius: 2.4,
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(237,246,255,0.95) 100%)',
          boxShadow: '0 10px 22px rgba(15,23,42,0.08)',
        }}
      >
        <TextField
          fullWidth
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setLastActivityAtMs(Date.now());
          }}
          onKeyPress={handleKeyPress}
          placeholder={
            sessionClosedByInactivity
              ? 'Session closed due to inactivity. Type a message to start a new session...'
              : 'Type your message...'
          }
          disabled={loading}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.96)',
              '& fieldset': {
                borderColor: 'rgba(56,109,255,0.28)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(56,109,255,0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'rgba(56,109,255,0.85)',
              },
            },
            '& .MuiOutlinedInput-input': {
              fontSize: '0.94rem',
              py: 1.05,
            },
          }}
        />
        <Button
          variant="contained"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          endIcon={<SendIcon />}
          sx={{
            minWidth: 108,
            py: 0.92,
            px: 1.55,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)',
            boxShadow: '0 8px 16px rgba(45,122,240,0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #2747be 0%, #256fb8 100%)',
            },
          }}
        >
          Send
        </Button>
        {typeof inactivityRemainingSeconds === 'number' ? (
          <Typography
            variant="caption"
            sx={{
              gridColumn: '1 / -1',
              mt: 0.05,
              color: inactivityRemainingSeconds <= 15 ? '#dc2626' : '#475569',
              fontWeight: inactivityRemainingSeconds <= 15 ? 700 : 500,
              letterSpacing: '0.01em',
            }}
          >
            Session auto-closes in {formatCountdownClock(inactivityRemainingSeconds)} if no activity.
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export default ChatInterface;
