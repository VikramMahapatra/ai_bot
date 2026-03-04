import React from 'react';
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

const drawerWidth = 260;

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
  { text: 'Knowledge Base', icon: <MenuBookIcon />, path: '/knowledge', requiredRole: 'ADMIN' },
  { text: 'Leads', icon: <PeopleAltIcon />, path: '/leads', requiredRole: 'ADMIN' },
  { text: 'Analytics', icon: <TrendingUpIcon />, path: '/analytics', requiredRole: 'ADMIN' },
  { text: 'Advanced Analytics', icon: <InsightsIcon />, path: '/analytics/advanced', requiredRole: 'ADMIN' },
  { text: 'Reports', icon: <AssignmentIcon />, path: '/reports', requiredRole: 'ADMIN' },
  { text: 'WhatsApp', icon: <WhatsAppIcon />, path: '/integrations/whatsapp', requiredRole: 'ADMIN' },
  { text: 'Widget Management', icon: <WidgetsIcon />, path: '/widgets', requiredRole: 'ADMIN' },
  { text: 'User Management', icon: <GroupIcon />, path: '/users', requiredRole: 'ADMIN' },
];

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
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
      boxShadow: '0 2px 16px 0 rgba(38,155,159,0.04)',
      borderRight: '1.5px solid #e2e8f0',
      px: 0,
      py: 0,
    }}>
      {/* Logo Section */}
      <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <SmartToyIcon fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1, fontSize: '1.05rem' }}>
            Zentrixel
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem', lineHeight: 1 }}>
            AI Platform
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* User Info Section */}
      <Box sx={{ px: 2, py: 0.5, mb: 0.5 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          bgcolor: '#f4f7fa',
          borderRadius: 2,
          px: 1,
          py: 0.7,
        }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.85rem', mr: 1, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.username || 'User'}
          </Typography>
          <Chip
            icon={userRole === 'ADMIN' ? <LockIcon sx={{ fontSize: 14 }} /> : undefined}
            label={userRole || 'USER'}
            size="small"
            variant="outlined"
            color={userRole === 'ADMIN' ? 'error' : 'default'}
            sx={{ height: 18, fontSize: '0.7rem', px: 0.5 }}
          />
          <Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.75rem', ml: 1, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || 'user@example.com'}
          </Typography>
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
      }}>
        <List
          sx={{
            width: '95%',
            bgcolor: '#f8fafb',
            borderRadius: 3,
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 8px 0 rgba(38,155,159,0.04)',
            p: 0.5,
            m: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            maxHeight: 'calc(100vh - 260px)',
            overflowY: 'auto',
            overflowX: 'hidden',
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
                      borderRadius: '50px',
                      border: isActive ? '1.2px solid #269b9f' : '1.2px solid #e2e8f0',
                      bgcolor: isActive
                        ? 'linear-gradient(90deg, #21c8af 0%, #269b9f 100%)'
                        : '#f8fafb',
                      color: 'primary.main',
                      minHeight: 36,
                      height: 36,
                      boxShadow: isActive ? '0 2px 8px 0 rgba(38,155,159,0.08)' : 'none',
                      '&:hover': {
                        bgcolor: isActive
                          ? 'linear-gradient(90deg, #1e7e85 0%, #269b9f 100%)'
                          : '#e0f2f7',
                        color: 'primary.dark',
                        borderColor: '#269b9f',
                      },
                      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                      px: 1.5,
                    }}
                  >
                    <ListItemIcon sx={{ color: 'primary.main', minWidth: 28, fontSize: 18 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.92rem',
                        letterSpacing: 0.1,
                        whiteSpace: 'nowrap',
                        color: 'primary.main',
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
        <Box sx={{ bgcolor: '#f4f7fa', borderRadius: 2, px: 0.5, py: 0.5 }}>
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
                      bgcolor: 'action.hover',
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
            borderRight: '1px solid',
            borderColor: 'divider',
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
