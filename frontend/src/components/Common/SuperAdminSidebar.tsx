import React from 'react';
import { alpha } from '@mui/material/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Typography,
  Avatar,
  Tooltip,
  Chip,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import InsightsIcon from '@mui/icons-material/Insights';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import TableChartIcon from '@mui/icons-material/TableChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const drawerWidth = 274;

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

const menuItems: MenuItem[] = [
  { text: 'Overview', icon: <DashboardIcon />, path: '/superadmin' },
  { text: 'Plans', icon: <LocalOfferIcon />, path: '/superadmin/plans' },
  { text: 'Price Matrix', icon: <TableChartIcon />, path: '/superadmin/price-matrix' },
  { text: 'Credit Estimator', icon: <CalculateIcon />, path: '/superadmin/credit-estimator' },
  { text: 'Org Credits', icon: <AccountBalanceWalletIcon />, path: '/superadmin/organization-credits' },
  { text: 'Billing', icon: <ReceiptLongIcon />, path: '/superadmin/billing' },
  { text: 'Organizations', icon: <BusinessIcon />, path: '/superadmin/organizations' },
  { text: 'Analytics', icon: <InsightsIcon />, path: '/superadmin/analytics' },
];

const SuperAdminSidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const resetScrollPosition = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll<HTMLElement>('[data-scroll-reset="true"]').forEach((el) => {
      el.scrollTop = 0;
    });
  };

  const handleNavigation = (path: string) => {
    resetScrollPosition();
    if (location.pathname !== path) {
      navigate(path);
    }
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        background: (theme) =>
          `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(
            theme.palette.primary.main,
            0.08
          )} 100%)`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <Box sx={{ p: 2.4, display: 'flex', alignItems: 'center', gap: 1.6 }}>
        <Avatar sx={{ width: 42, height: 42, background: 'linear-gradient(135deg, #366dff 0%, #36c4ff 100%)' }}>
          <AdminPanelSettingsIcon fontSize="large" />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1, fontSize: '1.05rem' }}>
            Zentrixel AI
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
            Super Admin Console
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 1.8, py: 1.4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            {user?.username || 'superadmin'}
          </Typography>
          <Chip
            label="SUPERADMIN"
            size="small"
            variant="outlined"
            color="error"
            sx={{ height: 22 }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {user?.email || 'superadmin@zentrixel.ai'}
        </Typography>
      </Box>

      <Divider />

      <List
        sx={{
          flexGrow: 1,
          minHeight: 0,
          px: 1.8,
          py: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.6,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(54,109,255,0.78) rgba(54,109,255,0.14)',
          '&::-webkit-scrollbar': {
            width: 10,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(54,109,255,0.14)',
            borderRadius: 10,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(54,109,255,0.7)',
            borderRadius: 10,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(54,109,255,0.9)',
          },
        }}
      >
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip key={item.text} title={item.text} placement="right">
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 2.2,
                    border: (theme) =>
                      `1px solid ${isActive ? alpha(theme.palette.primary.main, 0.44) : alpha(theme.palette.primary.main, 0.14)}`,
                    background: isActive
                      ? 'linear-gradient(90deg, rgba(54,109,255,0.18) 0%, rgba(54,196,255,0.18) 100%)'
                      : 'transparent',
                    color: 'text.primary',
                    '&:hover': {
                      background: 'linear-gradient(90deg, rgba(54,109,255,0.12) 0%, rgba(54,196,255,0.14) 100%)',
                      borderColor: 'primary.main',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'text.secondary', minWidth: 38 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.95rem',
                      color: isActive ? 'primary.main' : 'text.primary',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 'none',
          },
        }}
      >
        {drawer}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default SuperAdminSidebar;
