import React, { useState, useEffect, useRef } from 'react';
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
  position?: string;

  shop?: any;
  user?: any;
}

const ChatWidget: React.FC<WidgetConfig> = ({
  widgetId,
  apiUrl,
  name = 'AI Assistant',
  welcomeMessage = 'Hi! How can I help you?',
  primaryColor = '#007bff',
  position = 'bottom-right',
  shop,
  user
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const storageKey = `chatbot_session_id_${widgetId || 'default'}`;
  const createSessionId = () => `session_${Date.now()}_${Math.random()}`;
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const newId = createSessionId();
    localStorage.setItem(storageKey, newId);
    return newId;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatAPI = useRef(new ChatAPI(apiUrl));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0 && welcomeMessage) {
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    }
  }, [isOpen, welcomeMessage]);

  const loadSuggestions = async () => {
    if (!widgetId) return;
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

  useEffect(() => {
    if (!isOpen) return;
    loadSuggestions();
  }, [isOpen, widgetId]);

  useEffect(() => {
    if (!isOpen || loading || showLeadForm || showEmailForm) return;
    inputRef.current?.focus();
  }, [isOpen, loading, showLeadForm, showEmailForm]);

  const resetChat = () => {
    const newId = createSessionId();
    localStorage.setItem(storageKey, newId);
    setSessionId(newId);
    setMessages([]);
    setLeadSubmitted(false);
    setShowLeadForm(false);
    setShowEmailForm(false);
    setEmailValue('');
    setSuggestedQuestions([]);
    if (isOpen) {
      loadSuggestions();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage = text;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await chatAPI.current.sendMessage(
        userMessage,
        sessionId,
        widgetId,
        shop?.domain,
        user?.id
      );

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.response },
      ]);

      if (!leadSubmitted) {
        const shouldCapture = await chatAPI.current.shouldCaptureLead(sessionId, widgetId);
        if (shouldCapture) {
          setShowLeadForm(true);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    await sendMessage(input);
  };

  const handleLeadSubmit = async () => {
    if (leadSubmitting) return;
    setLeadSubmitting(true);
    try {
      await chatAPI.current.submitLead({
        session_id: sessionId,
        widget_id: widgetId,
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone,
        company: leadForm.company,
      });
      setLeadSubmitted(true);
      setShowLeadForm(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Thanks! Your details have been received.' },
      ]);
    } catch (error) {
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
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, failed to send the transcript. Please try again.' },
      ]);
    } finally {
      setEmailSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showSuggestions =
    isOpen &&
    !loading &&
    !showLeadForm &&
    !showEmailForm &&
    input.trim().length === 0 &&
    messages.length <= 1;

  return (
    <div
      className={`chatbot-widget-container ${position}`}
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
    >
      {!isOpen && (
        <button
          className="chatbot-widget-button"
          onClick={() => setIsOpen(true)}
          style={{ background: primaryColor }}
        >
          💬
        </button>
      )}

      {isOpen && (
        <div className="chatbot-widget-window">
          <div
            className="chatbot-widget-header"
            style={{ background: primaryColor }}
          >
            <h3>{name}</h3>
            <div className="chatbot-widget-header-actions">
              <button
                className="chatbot-widget-header-btn"
                onClick={resetChat}
                title="New chat"
              >
                ⟳
              </button>
              <button
                className="chatbot-widget-header-btn"
                onClick={() => setShowEmailForm((v) => !v)}
                title="Email this conversation"
              >
                ✉
              </button>
              <button
                className="chatbot-widget-close"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </div>

          <div className="chatbot-widget-messages">
            {showSuggestions && (suggestionsLoading || suggestedQuestions.length > 0) && (
              <div className="chatbot-suggestions">
                <div className="chatbot-suggestions-title">Try asking</div>
                <div className="chatbot-suggestions-list">
                  {suggestionsLoading && (
                    <div className="chatbot-suggestions-loading">Loading suggestions…</div>
                  )}
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
              <div key={index} className={`chatbot-message ${message.role}`}>
                <div className="chatbot-message-bubble">{message.content}</div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-message assistant">
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
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              ref={inputRef}
            />
            <button
              className="chatbot-widget-send"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{ background: primaryColor }}
            >
              Send
            </button>
          </div>

          {showEmailForm && (
            <div className="chatbot-inline-card">
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
                  style={{ background: primaryColor }}
                >
                  {emailSending ? 'Sending…' : 'Send'}
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
            <div className="chatbot-inline-card">
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
                  style={{ background: primaryColor }}
                >
                  {leadSubmitting ? 'Submitting…' : 'Submit'}
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

          <div className="chatbot-widget-footer">
            Powered by Zentrixel AI
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
