import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AdminLayout from '../components/Layout/AdminLayout';
import { handoffService, HandoffMessageItem, HandoffSessionItem } from '../services/handoffService';
import { useAuth } from '../context/AuthContext';

const statusColor = (status: string): 'default' | 'warning' | 'success' | 'error' | 'info' => {
  if (status === 'waiting_for_agent') return 'warning';
  if (status === 'assigned') return 'success';
  if (status === 'closed') return 'default';
  if (status === 'bot_active') return 'info';
  return 'default';
};

const HandoffInboxPage: React.FC = () => {
  const { userId } = useAuth();
  const [items, setItems] = useState<HandoffSessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [messages, setMessages] = useState<HandoffMessageItem[]>([]);
  const [messageError, setMessageError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const afterIdRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedSession = useMemo(
    () => items.find((row) => row.chat_id === selectedChatId) || null,
    [items, selectedChatId]
  );

  const refreshRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await handoffService.listRequests(undefined, mineOnly);
      setItems(rows);
      if (!selectedChatId && rows.length > 0) {
        setSelectedChatId(rows[0].chat_id);
      }
      if (selectedChatId && rows.every((row) => row.chat_id !== selectedChatId)) {
        setSelectedChatId(rows[0]?.chat_id || '');
      }
    } catch {
      setError('Failed to load handoff requests.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string, reset = false) => {
    if (!chatId) return;
    setMessageError('');
    try {
      const data = await handoffService.listMessages(chatId, reset ? 0 : afterIdRef.current);
      if (reset) {
        setMessages(data.items);
      } else if (data.items.length > 0) {
        setMessages((prev) => [...prev, ...data.items]);
      }

      const newest = data.items[data.items.length - 1];
      if (newest) {
        afterIdRef.current = Math.max(afterIdRef.current, newest.id);
      }

      setItems((prev) =>
        prev.map((row) =>
          row.chat_id === chatId
            ? { ...row, status: data.status || row.status, assigned_agent_id: data.assigned_agent_id }
            : row
        )
      );
    } catch {
      setMessageError('Failed to load conversation messages.');
    }
  };

  useEffect(() => {
    refreshRequests();
  }, [mineOnly]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      afterIdRef.current = 0;
      return;
    }
    afterIdRef.current = 0;
    loadMessages(selectedChatId, true);
  }, [selectedChatId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshRequests();
      if (selectedChatId) {
        loadMessages(selectedChatId, false);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedChatId, mineOnly]);

  useEffect(() => {
    const ws = handoffService.connectNotifications((payload) => {
      if (!payload || typeof payload !== 'object') return;
      refreshRequests();
      if (selectedChatId && payload.chat_id === selectedChatId) {
        loadMessages(selectedChatId, false);
      }
    });

    wsRef.current = ws;
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [selectedChatId, mineOnly]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'auto',
      });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, selectedChatId]);

  const handleAccept = async () => {
    if (!selectedChatId) return;
    try {
      await handoffService.accept(selectedChatId);
      await refreshRequests();
      await loadMessages(selectedChatId, true);
    } catch {
      setMessageError('Failed to accept this handoff. Another admin may have assigned it first.');
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!selectedChatId || !text || sending) return;
    setSending(true);
    try {
      await handoffService.sendMessage(selectedChatId, text);
      setDraft('');
      await loadMessages(selectedChatId, false);
    } catch {
      setMessageError('Failed to send message. Make sure this chat is assigned to you.');
    } finally {
      setSending(false);
    }
  };

  const handleReturnToBot = async () => {
    if (!selectedChatId) return;
    try {
      await handoffService.returnToBot(selectedChatId);
      await refreshRequests();
      await loadMessages(selectedChatId, true);
    } catch {
      setMessageError('Failed to return this chat to bot.');
    }
  };

  const handleClose = async () => {
    if (!selectedChatId) return;
    try {
      await handoffService.close(selectedChatId);
      await refreshRequests();
      await loadMessages(selectedChatId, true);
    } catch {
      setMessageError('Failed to close this handoff chat.');
    }
  };

  const canReply = Boolean(
    selectedSession && selectedSession.status === 'assigned' && selectedSession.assigned_agent_id === userId
  );

  return (
    <AdminLayout>
      <Stack spacing={2.2} sx={{ height: { xs: 'auto', md: 'calc(100vh - 164px)' }, minHeight: 0 }}>
        <Paper sx={{ p: 2.2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SupportAgentIcon color="primary" /> Human Handoff Inbox
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Accept waiting chats, reply as a live agent, or return sessions back to bot automation.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant={mineOnly ? 'contained' : 'outlined'}
                onClick={() => setMineOnly((prev) => !prev)}
              >
                {mineOnly ? 'Showing Mine Only' : 'Show Mine Only'}
              </Button>
              <Button startIcon={<RefreshIcon />} variant="outlined" onClick={refreshRequests} disabled={loading}>
                Refresh
              </Button>
            </Stack>
          </Stack>
          {error && <Alert severity="error" sx={{ mt: 1.2 }}>{error}</Alert>}
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
            gap: 2,
            minHeight: 0,
            flexGrow: 1,
          }}
        >
          <Paper sx={{ p: 1.2, borderRadius: 3, overflowY: 'auto', minHeight: 0 }}>
            {loading && items.length === 0 ? (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : items.length === 0 ? (
              <Typography sx={{ p: 2, color: 'text.secondary' }}>No active handoff requests right now.</Typography>
            ) : (
              <Stack spacing={1}>
                {items.map((item) => (
                  <Paper
                    key={item.chat_id}
                    onClick={() => setSelectedChatId(item.chat_id)}
                    sx={{
                      p: 1.2,
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: selectedChatId === item.chat_id ? '1px solid #3d75d9' : '1px solid transparent',
                    }}
                  >
                    <Stack spacing={0.7}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.widget_id}</Typography>
                        <Chip size="small" color={statusColor(item.status)} label={item.status.replace(/_/g, ' ')} />
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Session: {item.session_id}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.handoff_reason || 'Fallback triggered'}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 1.4, borderRadius: 3, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!selectedSession ? (
              <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Select a handoff request to view conversation.</Typography>
              </Box>
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography sx={{ fontWeight: 700 }}>Chat {selectedSession.chat_id}</Typography>
                    <Chip size="small" color={statusColor(selectedSession.status)} label={selectedSession.status.replace(/_/g, ' ')} />
                    {selectedSession.assigned_agent_id ? (
                      <Chip size="small" icon={<AssignmentTurnedInIcon />} label={`Assigned: ${selectedSession.assigned_agent_id}`} />
                    ) : null}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {selectedSession.status === 'waiting_for_agent' ? (
                      <Button variant="contained" startIcon={<CheckCircleOutlineIcon />} onClick={handleAccept}>
                        Accept
                      </Button>
                    ) : null}
                    {selectedSession.status !== 'closed' ? (
                      <Button variant="outlined" startIcon={<SwapHorizIcon />} onClick={handleReturnToBot}>
                        Return to Bot
                      </Button>
                    ) : null}
                    {selectedSession.status !== 'closed' ? (
                      <Button variant="outlined" color="error" onClick={handleClose}>
                        Close
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>

                {messageError && <Alert severity="error" sx={{ mb: 1 }}>{messageError}</Alert>}

                <Box
                  ref={messagesContainerRef}
                  sx={{
                    flexGrow: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    border: '1px solid #dbe6f5',
                    borderRadius: 2,
                    p: 1.2,
                    bgcolor: '#f8fbff',
                  }}
                >
                  <Stack spacing={1}>
                    {messages.map((row) => (
                      <Box
                        key={row.id}
                        sx={{
                          alignSelf: row.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                          maxWidth: '84%',
                          px: 1.2,
                          py: 0.9,
                          borderRadius: 1.5,
                          bgcolor: row.sender_type === 'agent' ? '#2f6bff' : '#ffffff',
                          color: row.sender_type === 'agent' ? '#ffffff' : '#0f172a',
                          border: row.sender_type === 'agent' ? 'none' : '1px solid #dbe6f5',
                        }}
                      >
                        <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mb: 0.3 }}>
                          {row.sender_type}
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{row.message}</Typography>
                      </Box>
                    ))}
                    {messages.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', p: 1 }}>No messages yet.</Typography>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </Stack>
                </Box>

                <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={canReply ? 'Write a reply as live agent...' : 'Accept this chat to start replying'}
                    disabled={!canReply || sending}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    endIcon={<SendRoundedIcon />}
                    onClick={handleSend}
                    disabled={!canReply || !draft.trim() || sending}
                  >
                    Send
                  </Button>
                </Stack>
              </>
            )}
          </Paper>
        </Box>
      </Stack>
    </AdminLayout>
  );
};

export default HandoffInboxPage;
