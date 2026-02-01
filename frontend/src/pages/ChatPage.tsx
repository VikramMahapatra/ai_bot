import React from 'react';
import { Container, Typography, Box, Card } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import ChatInterface from '../components/Chat/ChatInterface';

const ChatPage: React.FC = () => {
  return (
    <AdminLayout>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            AI Chat
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Have a conversation with your AI assistant powered by your knowledge base.
          </Typography>
        </Box>
        <Card sx={{ boxShadow: 2, p: 2 }}>
          <ChatInterface />
        </Card>
      </Box>
    </AdminLayout>
  );
};

export default ChatPage;
