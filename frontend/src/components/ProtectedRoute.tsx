import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress } from '@mui/material';
import { organizationService } from '../services/organizationService';
import RestrictedFeaturePage from './Common/RestrictedModulePage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'USER' | 'AUTHENTICATED';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole = 'AUTHENTICATED',
}) => {
  const { isAuthenticated, userRole } = useAuth();
  const { pathname } = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [access, setAccess] = React.useState<{ allowed: boolean, module: string }>({
    allowed: true,
    module: ""
  });

  console.log("Procted Route activated")

  React.useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await organizationService.checkFeatureAccess(pathname);
        setAccess(response);
      } catch {
        setAccess({ allowed: false, module: "" });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [pathname]);

  // Show loading spinner while auth state is being determined
  if (!isAuthenticated && !userRole) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (access && !access.allowed) {
    return <RestrictedFeaturePage modulePath={access.module} />
  }


  // Check role-based access
  if (requiredRole === 'ADMIN' && userRole !== 'ADMIN') {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
};
