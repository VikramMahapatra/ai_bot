import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
  Collapse,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random()}`);
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
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognition && !!window.speechSynthesis);

    const loadFeatures = async () => {
      try {
        const features = await chatService.getFeatureFlags();
        setVoiceEnabled(!!features.voice_chat_enabled);
        setMultilingualTextEnabled(!!features.multilingual_text_enabled);
      } catch (err) {
        setVoiceEnabled(false);
        setMultilingualTextEnabled(false);
      }
    };

    loadFeatures();
  }, []);

  const checkLeadCapture = async () => {
    try {
      const shouldCapture = await chatService.shouldCaptureLead(sessionId, selectedWidgetId);
      if (shouldCapture && !showLeadForm) {
        setShowLeadForm(true);
      }
    } catch (err) {
      console.error('Failed to check lead capture', err);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText ?? input).trim();
    if (!textToSend) return;
    if (!selectedWidgetId) {
      setWidgetError('Please select a widget before starting a chat.');
      return;
    }
    setWidgetError('');

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
      let assistantIndex = -1;
      setMessages((prev) => {
        assistantIndex = prev.length;
        return [...prev, { role: 'assistant', content: '', sources: [] }];
      });
      setStreaming(true);

      const showLimitDialog = (detail?: string, tokensUsed?: number, tokenLimit?: number) => {
        const messageText = detail || 'Your plan limit has been reached. Please upgrade or try again later.';
        setLimitDialogMessage(messageText);
        setLimitDialogTokensUsed(typeof tokensUsed === 'number' ? tokensUsed : null);
        setLimitDialogTokenLimit(typeof tokenLimit === 'number' ? tokenLimit : null);
        setLimitDialogOpen(true);
      };

      const replaceAssistantWith = (text: string) => {
        setMessages((prev) =>
          prev.map((msg, index) =>
            index === assistantIndex
              ? { ...msg, content: text }
              : msg
          )
        );
      };

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);
        let receivedToken = false;

        const streamResponse = await chatService.sendMessageStream({
          message: translatedMessage || userMessage,
          retrieval_message: translatedMessage ? userMessage : undefined,
          session_id: sessionId,
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
          session_id: sessionId,
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

      await checkLeadCapture();
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

  return (
    <Box sx={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '700px' }}>
      {widgetError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {widgetError}
        </Alert>
      )}
      <Paper sx={{ flexGrow: 1, overflow: 'auto', p: 2, mb: 2, background: 'linear-gradient(135deg, #e0f2f7 0%, #f8fafb 100%)' }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 3,
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'linear-gradient(135deg, #e0f2f7 0%, #f8fafb 100%)',
          py: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
              <SmartToyIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>Zentrixel AI Chat</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Ask anything, get instant answers.</Typography>
            </Box>
          </Box>
          <FormControl size="small" sx={{ minWidth: 220 }}>
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
          {(multilingualTextEnabled || voiceEnabled) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 170 }}>
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
              {voiceEnabled && (
                <>
                  <Tooltip title={listening ? 'Stop voice input' : 'Start voice input'}>
                    <span>
                      <IconButton
                        onClick={listening ? stopListening : startListening}
                        disabled={!voiceSupported}
                        sx={{ bgcolor: listening ? 'rgba(239,68,68,0.1)' : 'rgba(45,179,160,0.1)' }}
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
                        sx={{ bgcolor: speakReplies ? 'rgba(59,130,246,0.1)' : 'transparent' }}
                      >
                        <VolumeUpIcon color={speakReplies ? 'primary' : 'inherit'} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
            </Box>
          )}
          {messages.length > 0 && (
            <Tooltip title="Email this conversation" placement="left">
              <Button
                onClick={handleEmailConversation}
                startIcon={<EmailIcon />}
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  px: 2.5,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #5568d3 0%, #6a4290 100%)',
                    boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Email Chat
              </Button>
            </Tooltip>
          )}
        </Box>
        {!multilingualTextEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Multilingual text support is disabled for this plan.
          </Alert>
        )}
        {voiceEnabled && !voiceSupported && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Voice chat isn’t supported in this browser.
          </Alert>
        )}
        {voiceError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {voiceError}
          </Alert>
        )}
        {messages.length === 0 && (suggestionsLoading || suggestedQuestions.length > 0 || suggestionsError) && (
          <Box sx={{ mb: 2 }}>
            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(45, 179, 160, 0.15)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(224, 231, 255, 0.7) 45%, rgba(209, 250, 229, 0.6) 100%)',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)'
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.08em',
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
                  {suggestedQuestions.map((question, idx) => (
                    <Chip
                      key={`${question}-${idx}`}
                      label={question}
                      onClick={() => handleSend(question)}
                      sx={(theme) => ({
                        fontSize: '0.78rem',
                        fontStyle: 'italic',
                        borderRadius: '12px',
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.16),
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
          <Typography color="text.secondary" align="center">
            Start a conversation...
          </Typography>
        )}
        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              mb: 2,
              display: 'flex',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}
          >
            <Tooltip title={message.role === 'user' ? 'You' : 'AI'} placement={message.role === 'user' ? 'right' : 'left'}>
              <Avatar sx={{ 
                bgcolor: message.role === 'user' ? '#4db8c9' : '#ffffff', 
                ml: message.role === 'user' ? 2 : 0, 
                mr: message.role === 'user' ? 0 : 2,
                border: message.role === 'assistant' ? '2px solid #e0f2f7' : 'none',
                color: message.role === 'assistant' ? '#2db3a0' : 'white',
                mt: 0.5,
              }}>
                {message.role === 'user' ? <PersonIcon /> : <SmartToyIcon />}
              </Avatar>
            </Tooltip>
            <Box sx={{ maxWidth: '70%' }}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: message.role === 'user' 
                    ? 'linear-gradient(135deg, #80ccd9 0%, #4db8c9 100%)' 
                    : '#ffffff',
                  background: message.role === 'user' 
                    ? 'linear-gradient(135deg, #80ccd9 0%, #4db8c9 100%)' 
                    : '#ffffff',
                  color: message.role === 'user' ? 'white' : '#1e293b',
                  borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  boxShadow: message.role === 'user' 
                    ? '0 4px 12px 0 rgba(77,184,201,0.3)' 
                    : '0 2px 8px 0 rgba(0,0,0,0.08)',
                  border: message.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                }}
              >
                {message.role === 'assistant' ? (
                  <MarkdownRenderer content={message.content} isUserMessage={false} />
                ) : (
                  <Typography variant="body1">{message.content}</Typography>
                )}
              </Paper>

              {/* Feedback + Sources row - Only for Assistant Messages */}
              {message.role === 'assistant' && (
                <Box sx={{ mt: 1, ml: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <MessageFeedback 
                    messageIndex={index} 
                    sessionId={sessionId}
                    onFeedbackSubmitted={() => {
                      // Optional: refresh analytics or show notification
                    }}
                  />
                  {message.sources && message.sources.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => {
                        setExpandedSources((prev) => {
                          const newSet = new Set(prev);
                          const sourceKey = index;
                          if (newSet.has(sourceKey)) {
                            newSet.delete(sourceKey);
                          } else {
                            newSet.add(sourceKey);
                          }
                          return newSet;
                        });
                      }}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.875rem',
                        color: '#2db3a0',
                        p: 0.5,
                        minWidth: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        '&:hover': {
                          background: 'rgba(45, 179, 160, 0.08)'
                        }
                      }}
                      startIcon={
                        <ExpandMoreIcon 
                          sx={{
                            fontSize: '1.2rem',
                            transform: expandedSources.has(index) ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }}
                        />
                      }
                    >
                      <InfoIcon sx={{ fontSize: '1rem' }} />
                      <span style={{ marginLeft: '4px' }}>Sources ({message.sources.length})</span>
                    </Button>
                  )}
                </Box>
              )}

              {/* Sources Section - Only for Assistant Messages */}
              {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                <Collapse in={expandedSources.has(index)} timeout="auto">
                  <Box sx={{
                    mt: 1,
                    p: 1.5,
                    bgcolor: '#f8fafb',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                  }}>
                    {message.sources.map((source) => (
                      <Box
                          key={source.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 1,
                            bgcolor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', mb: 0.25 }}>
                              {source.name}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Chip
                                label={source.type}
                                size="small"
                                sx={{
                                  height: '20px',
                                  bgcolor: '#e0f2f7',
                                  color: '#2db3a0',
                                  fontWeight: 600,
                                  fontSize: '0.75rem'
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
                                    color: '#667eea',
                                    textDecoration: 'none',
                                    '&:hover': {
                                      textDecoration: 'underline'
                                    }
                                  }}
                                >
                                  {new URL(source.url).hostname}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
              )}
            </Box>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper sx={{ p: 2 }}>
              <CircularProgress size={20} />
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Paper>

      <Dialog 
        open={showLeadForm} 
        onClose={() => setShowLeadForm(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafb 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
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
              background: 'linear-gradient(135deg, #2db3a0 0%, #1b9a7f 100%)',
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
            background: 'linear-gradient(135deg, #e0f2f7 0%, #f0f9fb 100%)',
            borderRadius: '12px',
            p: 2,
            mb: 3,
            border: '1px solid #d1e7ed'
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
              <SecurityIcon sx={{ color: '#2db3a0', mt: 0.5, fontSize: 20 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1b9a7f', mb: 0.5 }}>
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
                      borderColor: '#2db3a0',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2db3a0',
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
                      borderColor: '#2db3a0',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2db3a0',
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
                      borderColor: '#2db3a0',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2db3a0',
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
                      borderColor: '#2db3a0',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2db3a0',
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
                background: 'linear-gradient(135deg, #2db3a0 0%, #1b9a7f 100%)',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '14px',
                py: 1.25,
                boxShadow: '0 4px 12px rgba(45, 179, 160, 0.3)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(45, 179, 160, 0.4)',
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #6a4290 100%)',
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

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={loading}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          endIcon={<SendIcon />}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default ChatInterface;
