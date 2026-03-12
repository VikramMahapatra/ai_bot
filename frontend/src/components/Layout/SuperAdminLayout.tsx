import React, { useState } from 'react';
import { Box, AppBar, Toolbar, IconButton, Tooltip, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { ColorModeContext } from '../../App';
import { useAuth } from '../../context/AuthContext';
import SuperAdminSidebar from '../Common/SuperAdminSidebar';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const colorMode = useContext(ColorModeContext);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/superadmin/login');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        position: 'relative',
        overflowX: 'clip',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -200,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(54,127,255,0.22) 0%, rgba(54,127,255,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <SuperAdminSidebar mobileOpen={mobileOpen} onMobileClose={handleDrawerToggle} />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            backdropFilter: 'blur(12px)',
            background: (theme) =>
              `linear-gradient(120deg, ${alpha(theme.palette.background.paper, 0.82)} 0%, ${alpha(
                theme.palette.primary.main,
                0.12
              )} 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
            boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.primary.dark, 0.18)}`,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 66, md: 72 }, px: { xs: 1, sm: 1.6, md: 2.2 }, gap: 0.6, overflowX: 'hidden' }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ flexGrow: 1, minWidth: 0 }} />

            <Chip
              label="Super Admin"
              color="primary"
              variant="outlined"
              sx={{ mr: 1.5, fontWeight: 700 }}
            />
            <Tooltip title={colorMode.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton onClick={colorMode.toggleColorMode} color="primary" sx={{ mr: 2 }}>
                {colorMode.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} color="error">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          className="page-reveal layered-admin-surfaces"
          data-scroll-reset="true"
          sx={{
            flexGrow: 1,
            px: { xs: 1.5, sm: 2.5, md: 4 },
            py: { xs: 2, sm: 3, md: 3.5 },
            overflowX: 'clip',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default SuperAdminLayout;
