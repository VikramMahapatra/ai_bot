import React, { useState } from 'react';
import { Box, AppBar, Toolbar, IconButton, Tooltip, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { ColorModeContext } from '../../App';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../Common/Sidebar';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useCredits } from '../../context/CreditsContext';
import CreditSummaryDialog from '../CreditSummaryDialog';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { logout, organizationName } = useAuth();
  const colorMode = useContext(ColorModeContext);
  const { credits, creditMonthlySummary, totalCredits } = useCredits();
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
          top: -180,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(70,130,220,0.26) 0%, rgba(70,130,220,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -180,
          left: -130,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(85,190,210,0.22) 0%, rgba(85,190,210,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleDrawerToggle} />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {/* Top Bar */}
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            pt: { xs: 0.8, md: 1.1 },
            px: { xs: 0.8, sm: 1.4, md: 2.2 },
          }}
        >
          <Toolbar disableGutters sx={{ minHeight: 'auto', overflowX: 'hidden' }}>
            <Box
              sx={{
                minHeight: { xs: 58, md: 64 },
                width: '100%',
                borderRadius: { xs: 3, md: 4 },
                px: { xs: 1.1, sm: 1.5, md: 2.1 },
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                backdropFilter: 'blur(16px)',
                background: (theme) =>
                  `linear-gradient(115deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(
                    theme.palette.primary.light,
                    0.16
                  )} 100%)`,
                border: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.6)}`,
                boxShadow: (theme) => `0 14px 30px ${alpha(theme.palette.primary.dark, 0.14)}`,
              }}
            >
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ display: { md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>

              <Box sx={{ flexGrow: 1, minWidth: 0 }} />

              {organizationName && (
                <Chip
                  label={organizationName}
                  color="primary"
                  variant="outlined"
                  sx={{
                    mr: 0.8,
                    fontWeight: 700,
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
                    backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.55),
                    maxWidth: { xs: 120, sm: 250 },
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  }}
                />
              )}
              {credits !== undefined && (
                <>
                  <Chip
                    icon={<AccountBalanceWalletIcon />}
                    label={`${totalCredits} Credits`}
                    color={totalCredits < 100 ? "warning" : "success"}
                    variant="outlined"
                    onClick={() => setCreditDialogOpen(true)}
                    sx={{
                      mr: 0.8,
                      fontWeight: 700,
                      cursor: "pointer",
                      borderColor: (theme) => alpha(theme.palette.success.main, 0.35),
                      backgroundColor: (theme) =>
                        alpha(theme.palette.background.paper, 0.55),
                    }}
                  />

                  <CreditSummaryDialog
                    open={creditDialogOpen}
                    onClose={() => setCreditDialogOpen(false)}
                    credits={credits}
                    monthlySummary={creditMonthlySummary}
                  />
                </>
              )}
              <Tooltip title={colorMode.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton onClick={colorMode.toggleColorMode} color="primary" sx={{ mr: 0.4 }}>
                  {colorMode.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Logout">
                <IconButton onClick={handleLogout} color="error">
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
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
    </Box >
  );
};

export default AdminLayout;
