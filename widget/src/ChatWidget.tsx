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
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('chatbot_session_id');
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random()}`;
    localStorage.setItem('chatbot_session_id', newId);
    return newId;
  });

  console.log('shop:', shop);
  console.log('user:', user);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAPI = useRef(new ChatAPI(apiUrl));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0 && welcomeMessage) {
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    }
  }, [isOpen, welcomeMessage]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await chatAPI.current.sendMessage(
        userMessage,
        sessionId,
        widgetId
      );

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.response },
      ]);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
            <button
              className="chatbot-widget-close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="chatbot-widget-messages">
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

          <div className="chatbot-widget-footer">
            Powered by Zentrixel AI
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
