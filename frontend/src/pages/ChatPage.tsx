import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import AdminLayout from '../components/Layout/AdminLayout';
import ChatInterface from '../components/Chat/ChatInterface';

const ChatPage: React.FC = () => {
  return (
    <AdminLayout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Chat with AI
        </Typography>
        <ChatInterface />
      </Box>
    </AdminLayout>
  );
};

export default ChatPage;
