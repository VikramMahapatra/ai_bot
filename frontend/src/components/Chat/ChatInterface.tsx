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

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!selectedWidgetId) {
      setWidgetError('Please select a widget before starting a chat.');
      return;
    }
    setWidgetError('');

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await chatService.sendMessage({
        message: userMessage,
        session_id: sessionId,
        widget_id: selectedWidgetId,
      });

      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: response.response,
          sources: response.sources || []
        },
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
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

              {/* Feedback Component - Only for Assistant Messages */}
              {message.role === 'assistant' && (
                <Box sx={{ mt: 1, ml: 2 }}>
                  <MessageFeedback 
                    messageIndex={index} 
                    sessionId={sessionId}
                    onFeedbackSubmitted={() => {
                      // Optional: refresh analytics or show notification
                    }}
                  />
                </Box>
              )}

              {/* Sources Section - Only for Assistant Messages */}
              {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
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
                </Box>
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
