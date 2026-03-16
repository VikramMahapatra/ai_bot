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
};

const USER_ICON_GLYPHS: Record<string, string> = {
  'user-person': '👤',
  'user-smile': '🙂',
  'user-chat': '💬',
  'user-brief': '🧑‍💼',
};

const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const APPOINTMENT_FORM_PROMPT =
  'If you would like to set a meeting, please fill this short form and I will set it up for you.';

const getDefaultAppointmentDateTime = () => {
  const seed = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(seed.getTime() - seed.getTimezoneOffset() * 60000).toISOString();
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
  };
};

const ChatWidget: React.FC<WidgetConfig> = ({
  widgetId,
  apiUrl,
  name = 'AI Assistant',
  welcomeMessage = 'Hi! How can I help you?',
  primaryColor = '#269b9f',
  secondaryColor = '#34d399',
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

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

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
    setAppointmentForm({
      name: '',
      email: '',
      appointment_date: '',
      appointment_time: '',
    });
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    if (!overrideText) {
      setInput('');
    }
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const response = await chatAPI.current.sendMessage(
        text,
        sessionId,
        widgetId,
        shopDomain,
        customerId ? String(customerId) : undefined
      );

      const rawAssistantText = response?.response || 'I could not generate a response right now.';
      const shouldOpenAppointmentForm = response?.ui_action === 'open_appointment_form';
      const assistantText = shouldOpenAppointmentForm ? APPOINTMENT_FORM_PROMPT : rawAssistantText;

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantText,
        },
      ]);

      if (shouldOpenAppointmentForm) {
        openAppointmentForm();
      }

      try {
        const shouldCapture = await chatAPI.current.shouldCaptureLead(sessionId, widgetId);
        if (shouldCapture && !leadSubmitted) {
          setShowLeadForm(true);
        }
      } catch {
        // Ignore lead-capture check failures.
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Thanks. Your details have been received.' },
      ]);
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
          <div className="chatbot-widget-header" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
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
            <div className="chatbot-inline-card chatbot-fade-in">
              <div className="chatbot-inline-title">Stay in touch</div>
              <input
                type="text"
                className="chatbot-inline-input"
                placeholder="Name"
                value={leadForm.name}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                type="email"
                className="chatbot-inline-input"
                placeholder="Email"
                value={leadForm.email}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                type="tel"
                className="chatbot-inline-input"
                placeholder="Phone"
                value={leadForm.phone}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <input
                type="text"
                className="chatbot-inline-input"
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
