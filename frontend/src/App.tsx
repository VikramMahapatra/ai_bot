import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ChatPage from './pages/ChatPage';
import KnowledgePage from './pages/KnowledgePage';
import LeadsPage from './pages/LeadsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdvancedAnalyticsPage from './pages/AdvancedAnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import WidgetManagementPage from './pages/WidgetManagementPage';
import ReportsPage from './pages/ReportsPage';
import SuperAdminLoginPage from './pages/SuperAdminLoginPage';
import SuperAdminBootstrapPage from './pages/SuperAdminBootstrapPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import SuperAdminPlansPage from './pages/SuperAdminPlansPage';
import SuperAdminOrganizationsPage from './pages/SuperAdminOrganizationsPage';
import SuperAdminAnalyticsPage from './pages/SuperAdminAnalyticsPage';

// New modern theme based on wastewise-tracker design
const theme = createTheme({
  palette: {
    primary: {
      main: '#269b9f',
      light: '#4db8c9',
      dark: '#156273',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#2db3a0',
      light: '#4db8c9',
      dark: '#157972',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2ba876',
      light: '#4db891',
      dark: '#157e54',
    },
    warning: {
      main: '#ffd700',
      light: '#ffeb66',
      dark: '#ffb700',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    background: {
      default: '#f8fafb',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            borderColor: '#b3dfe9',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: '#269b9f',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#269b9f',
              boxShadow: '0 0 0 3px rgba(38, 155, 159, 0.1)',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: 'ADMIN' | 'SUPERADMIN' | 'ALL' }> = ({ 
  children, 
  requiredRole = 'ALL' 
}) => {
  const { isAuthenticated, userRole } = useAuth();
  
  if (!isAuthenticated) {
    if (requiredRole === 'SUPERADMIN') {
      return <Navigate to="/superadmin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  
  // If admin-only route, check role
  if (requiredRole === 'ADMIN' && userRole !== 'ADMIN') {
    return <Navigate to="/chat" replace />;
  }

  if (requiredRole === 'SUPERADMIN' && userRole !== 'SUPERADMIN') {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
      <Route path="/superadmin/bootstrap" element={<SuperAdminBootstrapPage />} />
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/plans"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminPlansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/organizations"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminOrganizationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/analytics"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <KnowledgePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics/advanced"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdvancedAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/widgets"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <WidgetManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <UserManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/admin" />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
