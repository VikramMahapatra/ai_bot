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
import BusinessIcon from '@mui/icons-material/Business';
import InsightsIcon from '@mui/icons-material/Insights';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

const drawerWidth = 260;

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
  { text: 'Organizations', icon: <BusinessIcon />, path: '/superadmin/organizations' },
  { text: 'Analytics', icon: <InsightsIcon />, path: '/superadmin/analytics' },
];

const SuperAdminSidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
          <AdminPanelSettingsIcon fontSize="large" />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1 }}>
            Zentrixel AI
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Super Admin Console
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 2 }}>
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

      <List sx={{ flexGrow: 1, px: 2, py: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip key={item.text} title={item.text} placement="right">
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 2,
                    bgcolor: isActive ? 'primary.main' : 'transparent',
                    color: isActive ? 'white' : 'text.primary',
                    '&:hover': {
                      bgcolor: isActive ? 'primary.dark' : 'action.hover',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ListItemIcon sx={{ color: isActive ? 'white' : 'primary.main', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.95rem',
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
            borderRight: '1px solid',
            borderColor: 'divider',
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
