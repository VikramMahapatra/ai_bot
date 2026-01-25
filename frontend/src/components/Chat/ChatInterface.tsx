import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { chatService } from '../../services/chatService';
import { leadService } from '../../services/leadService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random()}`);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkLeadCapture = async () => {
    try {
      const shouldCapture = await chatService.shouldCaptureLead(sessionId);
      if (shouldCapture && !showLeadForm) {
        setShowLeadForm(true);
      }
    } catch (err) {
      console.error('Failed to check lead capture', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await chatService.sendMessage({
        message: userMessage,
        session_id: sessionId,
      });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.response },
      ]);

      // Check if we should capture lead
      await checkLeadCapture();
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
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

  const handleLeadSubmit = async (data: any) => {
    try {
      await leadService.createLead({
        session_id: sessionId,
        ...data,
      });
      setShowLeadForm(false);
    } catch (err) {
      console.error('Failed to submit lead', err);
    }
  };

  return (
    <Box sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ flexGrow: 1, overflow: 'auto', p: 2, mb: 2 }}>
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
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Paper
              sx={{
                p: 2,
                maxWidth: '70%',
                bgcolor: message.role === 'user' ? 'primary.main' : 'grey.200',
                color: message.role === 'user' ? 'white' : 'text.primary',
              }}
            >
              <Typography variant="body1">{message.content}</Typography>
            </Paper>
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

      {showLeadForm && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Get in touch
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Name" size="small" />
            <TextField label="Email" size="small" type="email" />
            <TextField label="Phone" size="small" />
            <Button
              variant="contained"
              onClick={() => handleLeadSubmit({ name: '', email: '', phone: '' })}
            >
              Submit
            </Button>
          </Box>
        </Paper>
      )}

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
