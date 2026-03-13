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
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InsightsIcon from '@mui/icons-material/Insights';
import GroupIcon from '@mui/icons-material/Group';
import LockIcon from '@mui/icons-material/Lock';
import WidgetsIcon from '@mui/icons-material/Widgets';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CallIcon from '@mui/icons-material/Call';

const drawerWidth = 280;

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  requiredRole?: 'ADMIN' | 'USER' | 'ALL';
}

const allMenuItems: MenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin', requiredRole: 'ADMIN' },
  { text: 'Chat', icon: <ChatBubbleIcon />, path: '/chat', requiredRole: 'ALL' },
  { text: 'Calls', icon: <CallIcon />, path: '/calls', requiredRole: 'ALL' },
  { text: 'Knowledge Base', icon: <MenuBookIcon />, path: '/knowledge', requiredRole: 'ADMIN' },
  { text: 'Leads', icon: <PeopleAltIcon />, path: '/leads', requiredRole: 'ADMIN' },
  { text: 'Analytics', icon: <TrendingUpIcon />, path: '/analytics', requiredRole: 'ADMIN' },
  { text: 'Advanced Analytics', icon: <InsightsIcon />, path: '/analytics/advanced', requiredRole: 'ADMIN' },
  { text: 'Reports', icon: <AssignmentIcon />, path: '/reports', requiredRole: 'ADMIN' },
  { text: 'Campaigns', icon: <CampaignIcon />, path: '/campaigns', requiredRole: 'ADMIN' },
  { text: 'WhatsApp', icon: <WhatsAppIcon />, path: '/integrations/whatsapp', requiredRole: 'ADMIN' },
  { text: 'Appointments', icon: <CalendarMonthIcon />, path: '/appointments', requiredRole: 'ADMIN' },
  { text: 'Agent Management', icon: <WidgetsIcon />, path: '/widgets', requiredRole: 'ADMIN' },
  { text: 'Create Chat Agent', icon: <AutoAwesomeIcon />, path: '/create-chat-agent', requiredRole: 'ADMIN' },
  { text: 'User Management', icon: <GroupIcon />, path: '/users', requiredRole: 'ADMIN' },
];

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user } = useAuth();

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

  // Filter menu items based on user role
  const visibleMenuItems = allMenuItems.filter((item) => {
    if (item.requiredRole === 'ALL') return true;
    return item.requiredRole === userRole;
  });

  const drawer = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
      background: (theme) =>
        `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(
          theme.palette.primary.main,
          0.1
        )} 100%)`,
      backdropFilter: 'blur(16px)',
      boxShadow: (theme) => `0 18px 34px ${alpha(theme.palette.primary.dark, 0.16)}`,
      borderRight: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
      px: 0,
      py: 0,
    }}>
      {/* Logo Section */}
      <Box sx={{ px: 2.2, pt: 2.2, pb: 1.2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          sx={{
            width: 38,
            height: 38,
            background: 'linear-gradient(135deg, #366dff 0%, #36c4ff 100%)',
            boxShadow: '0 10px 20px rgba(54,109,255,0.28)',
          }}
        >
          <SmartToyIcon fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1, fontSize: '1.04rem' }}>
            Zentrixel
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.74rem', lineHeight: 1 }}>
            AI Platform
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* User Info Section */}
      <Box sx={{ px: 1.8, py: 0.9, mb: 0.2 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.9,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07),
          border: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
          borderRadius: 3,
          px: 1.1,
          py: 0.75,
        }}>
          <Avatar
            sx={{
              width: 31,
              height: 31,
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #3d75d9 0%, #52b8df 100%)',
            }}
          >
            {(user?.username || 'U').charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.82rem', display: 'block', maxWidth: 125, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username || 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block', maxWidth: 125, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || 'user@example.com'}
            </Typography>
          </Box>
          <Chip
            icon={userRole === 'ADMIN' ? <LockIcon sx={{ fontSize: 13 }} /> : undefined}
            label={userRole || 'USER'}
            size="small"
            variant="outlined"
            color={userRole === 'ADMIN' ? 'error' : 'default'}
            sx={{ height: 19, fontSize: '0.64rem', px: 0.2 }}
          />
        </Box>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <Box sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        pt: 1,
        pb: 0.5,
        minHeight: 0,
      }}>
        <List
          sx={{
            width: '93%',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.65),
            borderRadius: 3.5,
            border: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.62)}`,
            boxShadow: (theme) => `0 12px 24px ${alpha(theme.palette.primary.dark, 0.1)}`,
            p: 0.5,
            m: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            flexGrow: 1,
            minHeight: 0,
            maxHeight: '100%',
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
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={item.text} title={item.text} placement="right">
                <ListItem disablePadding sx={{ mb: 0.2 }}>
                  <ListItemButton
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      borderRadius: 2.2,
                      border: (theme) =>
                        `1px solid ${isActive ? alpha(theme.palette.primary.main, 0.44) : alpha(theme.palette.primary.main, 0.14)}`,
                      background: isActive
                        ? 'linear-gradient(90deg, rgba(79,130,212,0.22) 0%, rgba(79,180,214,0.22) 100%)'
                        : 'transparent',
                      color: 'text.primary',
                      minHeight: 42,
                      height: 42,
                      boxShadow: isActive ? '0 8px 18px rgba(50,103,180,0.18)' : 'none',
                      '&:hover': {
                        background: 'linear-gradient(90deg, rgba(79,130,212,0.14) 0%, rgba(79,180,214,0.16) 100%)',
                        borderColor: 'primary.main',
                      },
                      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                      px: 1.5,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive ? 'primary.main' : 'text.secondary',
                        minWidth: 30,
                        fontSize: 18,
                        transition: 'color 180ms ease',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.89rem',
                        letterSpacing: 0.1,
                        whiteSpace: 'nowrap',
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

      <Divider />

      {/* Settings at Bottom */}
      <Box sx={{ width: '100%', px: 2, pb: 2, mt: 'auto' }}>
        <Box
          sx={{
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            borderRadius: 2,
            px: 0.5,
            py: 0.5,
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
          }}
        >
          <List disablePadding sx={{ width: '100%' }}>
            <Tooltip title="Settings" placement="right">
              <ListItem disablePadding sx={{ width: '100%' }}>
                <ListItemButton
                  onClick={() => handleNavigation('/settings')}
                  sx={{
                    borderRadius: 2,
                    pl: 1.5,
                    py: 1,
                    minHeight: 36,
                    justifyContent: 'flex-start',
                    bgcolor: 'transparent',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'text.secondary', minWidth: 28, fontSize: 18 }}>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Settings"
                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.92rem' }}
                  />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          </List>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop Drawer */}
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

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
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

export default Sidebar;
