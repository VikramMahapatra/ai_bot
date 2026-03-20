import React from 'react';
import { Typography, Box, Card, Chip, Stack, Paper } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AdminLayout from '../components/Layout/AdminLayout';
import ChatInterface from '../components/Chat/ChatInterface';

const ChatPage: React.FC = () => {
  const theme = useTheme();

  return (
    <AdminLayout>
      <Box
        sx={{
          height: { xs: 'calc(100vh - 120px)', md: 'calc(100vh - 132px)' },
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.4, md: 1.7 },
            mb: 1.2,
            flexShrink: 0,
            borderRadius: '16px',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            background: `linear-gradient(125deg, ${alpha('#f8fbff', 0.95)} 0%, ${alpha('#eff6ff', 0.95)} 100%)`,
            boxShadow: `0 10px 24px ${alpha(theme.palette.primary.dark, 0.08)}`,
            '& > *': {
              position: 'relative',
              zIndex: 1,
            },
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.2, letterSpacing: '-0.01em' }}>
                AI Chat
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 640 }}>
                Chat with your assistant using selected widget knowledge and live streaming responses.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<SmartToyIcon />}
                label="Live assistant"
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                }}
              />
              <Chip
                icon={<AutoAwesomeIcon />}
                label="Streaming"
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                }}
              />
            </Stack>
          </Stack>
        </Paper>
        <Card
          sx={{
            boxShadow: `0 14px 32px ${alpha(theme.palette.primary.dark, 0.1)}`,
            p: { xs: 0.9, md: 1.1 },
            borderRadius: 2.5,
            flexGrow: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            background: `linear-gradient(180deg, ${alpha('#f8fbff', 0.98)} 0%, ${alpha('#f3f8ff', 0.96)} 100%)`,
          }}
        >
          <ChatInterface />
        </Card>
      </Box>
    </AdminLayout>
  );
};

export default ChatPage;


