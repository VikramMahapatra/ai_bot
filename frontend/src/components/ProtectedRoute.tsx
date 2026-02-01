import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'USER' | 'AUTHENTICATED';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole = 'AUTHENTICATED',
}) => {
  const { isAuthenticated, userRole } = useAuth();

  // Show loading spinner while auth state is being determined
  if (!isAuthenticated && !userRole) {
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

  // Check role-based access
  if (requiredRole === 'ADMIN' && userRole !== 'ADMIN') {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
};
