import React from 'react';
import { AppBar, Toolbar, Typography, Box, Tooltip, IconButton, Avatar, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import LogoutIcon from '@mui/icons-material/Logout';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout, organizationName } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        background: (theme) =>
          `linear-gradient(110deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(
            theme.palette.primary.main,
            0.14
          )} 100%)`,
        borderBottom: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 64, md: 70 },
          px: { xs: 1.2, sm: 1.8, md: 2.4 },
          gap: 1,
          overflowX: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 40, height: 40 }}>
            <SmartToyIcon fontSize="medium" />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1 }}>
              Zentrixel AI
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
              Conversational Intelligence Platform
            </Typography>
          </Box>
        </Box>
        {isAuthenticated && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexShrink: 0 }}>
            {organizationName && (
              <Chip 
                label={organizationName}
                color="primary"
                variant="outlined"
                sx={{
                  mr: { xs: 0.2, sm: 0.7 },
                  fontWeight: 700,
                  maxWidth: { xs: 110, sm: 180 },
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            )}
            <Tooltip title="Dashboard">
              <IconButton color="primary" onClick={() => navigate('/admin')} size="large">
                <DashboardIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Chat">
              <IconButton color="primary" onClick={() => navigate('/chat')} size="large">
                <ChatBubbleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton color="error" onClick={handleLogout} size="large">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
