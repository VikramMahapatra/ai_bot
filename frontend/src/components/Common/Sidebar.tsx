import React, { useEffect, useState } from 'react';
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
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CallIcon from '@mui/icons-material/Call';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { chatService } from '../../services/chatService';

const drawerWidth = 280;

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  requiredRole?: 'ADMIN' | 'USER' | 'USER_HANDOFF' | 'ADMIN_OR_HANDOFF' | 'ALL';
  featureKey?:
    | 'module_knowledge_enabled'
    | 'module_leads_enabled'
    | 'module_analytics_enabled'
    | 'module_advanced_analytics_enabled'
    | 'module_reports_enabled'
    | 'module_campaigns_enabled'
    | 'module_appointments_enabled'
    | 'module_products_enabled'
    | 'module_users_enabled'
    | 'human_handoff_enabled';
}

const allMenuItems: MenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin', requiredRole: 'ADMIN' },
  { text: 'Agent Management', icon: <WidgetsIcon />, path: '/widgets', requiredRole: 'ADMIN' },
  { text: 'Chat', icon: <ChatBubbleIcon />, path: '/chat', requiredRole: 'ALL' },
  { text: 'Calls', icon: <CallIcon />, path: '/calls', requiredRole: 'ALL' },
  { text: 'Knowledge Base', icon: <MenuBookIcon />, path: '/knowledge', requiredRole: 'ADMIN', featureKey: 'module_knowledge_enabled' },
  { text: 'Leads', icon: <PeopleAltIcon />, path: '/leads', requiredRole: 'ADMIN', featureKey: 'module_leads_enabled' },
  { text: 'Analytics', icon: <TrendingUpIcon />, path: '/analytics', requiredRole: 'ADMIN', featureKey: 'module_analytics_enabled' },
  { text: 'Advanced Analytics', icon: <InsightsIcon />, path: '/analytics/advanced', requiredRole: 'ADMIN', featureKey: 'module_advanced_analytics_enabled' },
  { text: 'Reports', icon: <AssignmentIcon />, path: '/reports', requiredRole: 'ADMIN', featureKey: 'module_reports_enabled' },
  { text: 'Campaigns', icon: <CampaignIcon />, path: '/campaigns', requiredRole: 'ADMIN', featureKey: 'module_campaigns_enabled' },
  { text: 'Appointments', icon: <CalendarMonthIcon />, path: '/appointments', requiredRole: 'ADMIN', featureKey: 'module_appointments_enabled' },
  { text: 'Human Handoff', icon: <SupportAgentIcon />, path: '/handoff', requiredRole: 'ADMIN_OR_HANDOFF', featureKey: 'human_handoff_enabled' },
  { text: 'Product Management', icon: <Inventory2Icon />, path: '/products', requiredRole: 'ADMIN', featureKey: 'module_products_enabled' },
  { text: 'User Management', icon: <GroupIcon />, path: '/users', requiredRole: 'ADMIN', featureKey: 'module_users_enabled' },
];

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user } = useAuth();
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    const loadFeatures = async () => {
      try {
        const data = await chatService.getFeatureFlags();
        if (!isMounted) return;
        setFeatureFlags(
          Object.entries(data || {}).reduce<Record<string, boolean>>((acc, [key, value]) => {
            acc[key] = Boolean(value);
            return acc;
          }, {})
        );
      } catch {
        if (!isMounted) return;
        setFeatureFlags({});
      }
    };

    loadFeatures();
    return () => {
      isMounted = false;
    };
  }, []);

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
    if (item.featureKey && featureFlags[item.featureKey] === false) return false;
    if (item.requiredRole === 'ALL') return true;
    if (item.requiredRole === 'ADMIN_OR_HANDOFF') return userRole === 'ADMIN' || userRole === 'USER_HANDOFF';
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
              {user?.email || 'No email'}
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
