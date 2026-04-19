import React, { createContext, useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
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
import CreateChatAgentPage from './pages/CreateChatAgentPage.tsx';
import AppointmentsPage from './pages/AppointmentsPage';
import CampaignManagementPage from './pages/CampaignManagementPage';
import ReportsPage from './pages/ReportsPage';
import WhatsAppIntegrationPage from './pages/WhatsAppIntegrationPage';
import HandoffInboxPage from './pages/HandoffInboxPage';
import AgentTestPage from './pages/AgentTestPage.tsx';
import SuperAdminLoginPage from './pages/SuperAdminLoginPage';
import SuperAdminBootstrapPage from './pages/SuperAdminBootstrapPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import SuperAdminPriceMatrixPage from './pages/SuperAdminPriceMatrixPage';
import SuperAdminCreditEstimatorPage from './pages/SuperAdminCreditEstimatorPage';
import SuperAdminOrgCreditBillingPage from './pages/SuperAdminOrgCreditBillingPage';
import SuperAdminOrganizationsPage from './pages/SuperAdminOrganizationsPage';
import SuperAdminAnalyticsPage from './pages/SuperAdminAnalyticsPage';
import CallsPage from './pages/CallsPage';
import ProductManagementPage from './pages/ProductManagementPage.tsx';
import SuperAdminOrgCallAnalyticsReport from './pages/SuperAdminOrgCallAnalyticsReport.tsx';
import ContactBookPage from './pages/ContactBookPage.tsx';
import CreditEstimatorSharePage from './pages/CreditEstimatorSharePage';
import CreditsLayout from './components/Layout/CreditsLayout.tsx';
import AdminCreditUsagePage from './pages/AdminCreditUsagePage';
import FollowUpWorkflowPage from './pages/FollowUpWorkflowPage.tsx';
import TemplatePage from './pages/TemplatePage.tsx';

type ColorMode = 'light' | 'dark';

export const ColorModeContext = createContext<{ toggleColorMode: () => void; mode: ColorMode }>({
  toggleColorMode: () => { },
  mode: 'light',
});

function getTheme(mode: ColorMode) {
  const isDark = mode === 'dark';
  const primaryMain = '#3d75d9';
  const primaryDark = '#2751ab';
  const secondaryMain = '#48b8e8';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
        light: '#7ea6ee',
        dark: primaryDark,
        contrastText: '#ffffff',
      },
      secondary: {
        main: secondaryMain,
        light: '#8ad7f3',
        dark: '#2589b4',
        contrastText: '#ffffff',
      },
      success: {
        main: '#4cb59f',
        light: '#7dcdba',
        dark: '#2f8a77',
      },
      warning: {
        main: '#f9b338',
        light: '#ffd07a',
        dark: '#c7871d',
      },
      error: {
        main: '#ef4f6d',
        light: '#f57a91',
        dark: '#c22f4d',
      },
      background: {
        default: isDark ? '#070c1c' : '#dce8f6',
        paper: isDark ? '#101936' : '#eef5ff',
      },
      text: {
        primary: isDark ? '#e8efff' : '#10213f',
        secondary: isDark ? '#a8b7db' : '#526a8f',
      },
      divider: isDark ? alpha('#9ab5ff', 0.22) : alpha('#355ecc', 0.14),
    },
    typography: {
      fontFamily: '"Manrope", "Plus Jakarta Sans", "Segoe UI", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 800,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 800,
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
      button: {
        textTransform: 'none',
        fontWeight: 700,
        letterSpacing: '0.01em',
      },
    },
    shape: {
      borderRadius: 4,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: isDark ? 'dark' : 'light',
          },
          body: {
            backgroundColor: isDark ? '#070c1c' : '#dce8f6',
            backgroundImage: isDark
              ? 'radial-gradient(circle at 10% 10%, rgba(54,108,255,0.22), transparent 38%), radial-gradient(circle at 85% 18%, rgba(54,196,255,0.22), transparent 32%), linear-gradient(180deg, #070c1c 0%, #0c1430 100%)'
              : 'radial-gradient(circle at 8% 8%, rgba(76,138,229,0.18), transparent 33%), radial-gradient(circle at 92% 16%, rgba(80,190,224,0.2), transparent 30%), radial-gradient(circle at 45% 72%, rgba(255,255,255,0.5), transparent 38%), linear-gradient(145deg, rgba(255,255,255,0.28) 12%, rgba(255,255,255,0) 13%), linear-gradient(165deg, #dae7f5 0%, #d4e3f2 56%, #cddcef 100%)',
            backgroundAttachment: 'fixed',
            position: 'relative',
          },
          'body::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            opacity: isDark ? 0.18 : 0.65,
            background: isDark
              ? 'linear-gradient(132deg, transparent 20%, rgba(84,132,255,0.14) 21%, transparent 43%), linear-gradient(34deg, transparent 46%, rgba(70,196,255,0.1) 47%, transparent 69%)'
              : 'linear-gradient(128deg, transparent 20%, rgba(114,157,224,0.22) 21%, transparent 43%), linear-gradient(34deg, transparent 45%, rgba(126,199,224,0.2) 46%, transparent 68%), linear-gradient(153deg, transparent 70%, rgba(255,255,255,0.28) 71%, transparent 86%)',
          },
          '#root': {
            position: 'relative',
            zIndex: 1,
          },
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor:
              isDark ? 'rgba(120,164,255,0.72) rgba(255,255,255,0.10)' : 'rgba(53,96,201,0.62) rgba(53,96,201,0.16)',
          },
          '*::-webkit-scrollbar': {
            width: '10px',
            height: '10px',
          },
          '*::-webkit-scrollbar-track': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(53,96,201,0.12)',
            borderRadius: '10px',
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(120,164,255,0.72)' : 'rgba(53,96,201,0.62)',
            borderRadius: '10px',
            border: isDark ? '1px solid rgba(10,20,45,0.75)' : '1px solid rgba(255,255,255,0.85)',
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor: isDark ? 'rgba(150,188,255,0.90)' : 'rgba(41,79,171,0.88)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            paddingInline: 18,
            transition: 'transform 180ms ease, box-shadow 220ms ease, background 220ms ease',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          containedPrimary: {
            background: 'linear-gradient(135deg, #3d75d9 0%, #4ca2df 55%, #57c4d3 100%)',
            boxShadow: '0 12px 24px rgba(44,101,178,0.26)',
            '&:hover': {
              background: 'linear-gradient(135deg, #325fae 0%, #3f8bc1 55%, #47aab8 100%)',
              boxShadow: '0 14px 30px rgba(44,101,178,0.34)',
            },
          },
          contained: {
            border: `1px solid ${alpha('#ffffff', 0.18)}`,
            '&:hover': {
              boxShadow: '0 10px 20px rgba(15,30,86,0.22)',
            },
          },
          outlined: {
            borderColor: alpha(primaryMain, 0.35),
            '&:hover': {
              borderColor: alpha(primaryMain, 0.55),
              backgroundColor: alpha(primaryMain, 0.08),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'linear-gradient(145deg, rgba(18,30,64,0.92) 0%, rgba(15,24,52,0.88) 100%)'
              : 'linear-gradient(145deg, rgba(241,249,255,0.9) 0%, rgba(224,238,254,0.9) 56%, rgba(206,223,245,0.9) 100%), linear-gradient(146deg, rgba(255,255,255,0.28) 18%, rgba(255,255,255,0) 19%)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${isDark ? alpha('#86a4ff', 0.26) : alpha('#ffffff', 0.52)}`,
            borderRadius: 14,
            boxShadow: isDark
              ? '0 18px 40px rgba(2,8,28,0.45)'
              : '0 16px 36px rgba(35,76,140,0.16)',
            '&:hover': {
              borderColor: isDark ? alpha('#98b2ff', 0.34) : alpha('#3f66d4', 0.25),
              boxShadow: isDark
                ? '0 20px 44px rgba(2,8,28,0.5)'
                : '0 20px 40px rgba(35,76,140,0.22)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 14,
            border: isDark ? `1px solid ${alpha('#89a8f8', 0.2)}` : `1px solid ${alpha('#ffffff', 0.6)}`,
            background: isDark
              ? alpha('#111b3a', 0.86)
              : 'linear-gradient(145deg, rgba(241,249,255,0.9) 0%, rgba(224,238,254,0.9) 56%, rgba(206,223,245,0.9) 100%), linear-gradient(146deg, rgba(255,255,255,0.26) 18%, rgba(255,255,255,0) 19%)',
            backdropFilter: 'blur(12px)',
            boxShadow: isDark ? '0 16px 34px rgba(2,8,28,0.42)' : '0 14px 30px rgba(43,79,139,0.16)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            background: isDark
              ? 'linear-gradient(160deg, rgba(18,30,64,0.96) 0%, rgba(15,24,52,0.95) 100%)'
              : 'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(244,249,255,0.95) 100%)',
            border: `1px solid ${isDark ? alpha('#9ab4ff', 0.24) : alpha('#456ed9', 0.18)}`,
            backdropFilter: 'blur(10px)',
            borderRadius: 18,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${isDark ? alpha('#9ab5ff', 0.16) : alpha('#456ed9', 0.15)}`,
            background: isDark
              ? 'linear-gradient(180deg, rgba(10,16,38,0.95) 0%, rgba(10,16,38,0.9) 100%)'
              : 'linear-gradient(180deg, rgba(245,250,255,0.95) 0%, rgba(236,245,255,0.95) 100%)',
            backdropFilter: 'blur(10px)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 700,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 13,
              backgroundColor: isDark ? alpha('#111d3f', 0.82) : alpha('#ffffff', 0.8),
              transition: 'box-shadow 200ms ease, border-color 200ms ease',
              '&:hover fieldset': {
                borderColor: alpha(primaryMain, 0.55),
              },
              '&.Mui-focused fieldset': {
                borderColor: primaryMain,
                boxShadow: `0 0 0 3px ${alpha(primaryMain, 0.2)}`,
              },
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: `1px solid ${isDark ? alpha('#9ab5ff', 0.2) : alpha('#ffffff', 0.58)}`,
            background: isDark
              ? alpha('#0e1734', 0.72)
              : 'linear-gradient(145deg, rgba(241,249,255,0.88) 0%, rgba(224,238,254,0.88) 56%, rgba(206,223,245,0.88) 100%)',
            backdropFilter: 'blur(8px)',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              fontWeight: 700,
              backgroundColor: isDark ? alpha('#1b2b59', 0.72) : alpha('#dce9f8', 0.88),
            },
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            '& .MuiTableRow-root:nth-of-type(odd) .MuiTableCell-root': {
              backgroundColor: isDark ? alpha('#152345', 0.5) : alpha('#edf4ff', 0.72),
            },
            '& .MuiTableRow-root:nth-of-type(even) .MuiTableCell-root': {
              backgroundColor: isDark ? alpha('#0f1b38', 0.34) : alpha('#f9fcff', 0.64),
            },
            '& .MuiTableRow-hover:hover .MuiTableCell-root': {
              backgroundColor: isDark ? alpha('#2a3c67', 0.5) : alpha('#dfeeff', 0.84),
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: '0 14px 30px rgba(18,40,110,0.18)',
            borderBottom: `1px solid ${isDark ? alpha('#a7beff', 0.2) : alpha('#3f66d4', 0.18)}`,
          },
        },
      },
    },
  });
}

const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll<HTMLElement>('[data-scroll-reset="true"]').forEach((el) => {
        el.scrollTop = 0;
      });
    };

    reset();
    requestAnimationFrame(reset);
  }, [pathname, search]);

  return null;
};


const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'SUPERADMIN' | 'HANDOFF_OPERATOR' | 'ALL';
}> = ({
  children,
  requiredRole = 'ALL'
}) => {
    const { isAuthenticated, userRole, isAuthLoading } = useAuth();

    if (isAuthLoading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!isAuthenticated) {
      if (requiredRole === 'SUPERADMIN') {
        return <Navigate to="/superadmin/login" replace />;
      }
      return <Navigate to="/login" replace />;
    }

    // If admin-only route, check role
    if (requiredRole === 'ADMIN' && userRole !== 'ADMIN') {
      return <Navigate to={userRole === 'USER_HANDOFF' ? '/handoff' : '/chat'} replace />;
    }

    if (requiredRole === 'SUPERADMIN' && userRole !== 'SUPERADMIN') {
      return <Navigate to="/login" replace />;
    }

    if (requiredRole === 'HANDOFF_OPERATOR' && userRole !== 'USER_HANDOFF' && userRole !== 'ADMIN') {
      return <Navigate to="/chat" replace />;
    }

    return <>{children}</>;
  };

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/agent-test/:widgetId" element={<AgentTestPage />} />
      <Route path="/credit-estimator/share/:token" element={<CreditEstimatorSharePage />} />
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
        path="/superadmin/price-matrix"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminPriceMatrixPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/credit-estimator"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminCreditEstimatorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/org-credit-billing"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminOrgCreditBillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/organization-credits"
        element={<Navigate to="/superadmin/org-credit-billing" replace />}
      />
      <Route
        path="/superadmin/billing"
        element={<Navigate to="/superadmin/org-credit-billing" replace />}
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
        path="/superadmin/call-analytics"
        element={
          <ProtectedRoute requiredRole="SUPERADMIN">
            <SuperAdminOrgCallAnalyticsReport />
          </ProtectedRoute>
        }
      />
      <Route element={<CreditsLayout />}>
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
          path="/calls"
          element={
            <ProtectedRoute>
              <CallsPage />
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
          path="/create-chat-agent"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <CreateChatAgentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/widgets/edit/:widgetId"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <CreateChatAgentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <CampaignManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AppointmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/handoff"
          element={
            <ProtectedRoute requiredRole="HANDOFF_OPERATOR">
              <HandoffInboxPage />
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
          path="/integrations/whatsapp"
          element={
            <ProtectedRoute requiredRole="ALL">
              <WhatsAppIntegrationPage />
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
        <Route
          path="/products"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <ProductManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <ContactBookPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits/monthly"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminCreditUsagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/follow-up-workflow"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <FollowUpWorkflowPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <TemplatePage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/admin" />} />
      </Route>
    </Routes>
  );
}


function App() {
  const [mode, setMode] = useState<ColorMode>('light');
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
      mode,
    }),
    [mode]
  );
  const theme = useMemo(() => getTheme(mode), [mode]);
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
