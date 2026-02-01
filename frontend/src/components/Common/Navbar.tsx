import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Tooltip, IconButton, Avatar, Chip } from '@mui/material';
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
    <AppBar position="static" color="default" sx={{ background: 'linear-gradient(90deg, #e0f2f7 0%, #f8fafb 100%)', borderBottom: '1px solid #e2e8f0' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 40, height: 40 }}>
            <SmartToyIcon fontSize="medium" />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1 }}>
              Zentrixel AI
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Conversational Intelligence Platform
            </Typography>
          </Box>
        </Box>
        {isAuthenticated && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {organizationName && (
              <Chip 
                label={organizationName}
                color="primary"
                variant="outlined"
                sx={{ mr: 1, fontWeight: 600 }}
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
