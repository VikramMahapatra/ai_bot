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
          height: { xs: 'calc(100vh - 138px)', md: 'calc(100vh - 154px)' },
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.3 },
            mb: 2.2,
            flexShrink: 0,
            borderRadius: '22px',
            border: `1px solid ${alpha(theme.palette.common.white, 0.65)}`,
            background: `linear-gradient(125deg, ${alpha('#deebfb', 0.92)} 0%, ${alpha(
              theme.palette.background.paper,
              0.84
            )} 72%, ${alpha('#a9bfdc', 0.98)} 100%)`,
            boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.24)}`,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)',
              pointerEvents: 'none',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-24%',
              right: '-6%',
              width: '42%',
              height: '150%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 72%)',
              pointerEvents: 'none',
            },
            '& > *': {
              position: 'relative',
              zIndex: 1,
            },
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.8 }}>
            AI Chat
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1.6 }}>
            Have a conversation with your AI assistant powered by your knowledge base.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip icon={<SmartToyIcon />} label="Real-time assistant" size="small" variant="outlined" />
            <Chip icon={<AutoAwesomeIcon />} label="Streaming responses" size="small" variant="outlined" />
          </Stack>
        </Paper>
        <Card
          sx={{
            boxShadow: 3,
            p: { xs: 1.1, md: 1.4 },
            borderRadius: 2.5,
            flexGrow: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ChatInterface />
        </Card>
      </Box>
    </AdminLayout>
  );
};

export default ChatPage;


