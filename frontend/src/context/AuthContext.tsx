import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

export type UserRole = 'ADMIN' | 'USER';

export interface AuthUser extends User {
  role: UserRole;
  organization_id?: number;
  user_id?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  organizationId: number | null;
  organizationName: string | null;
  userId: number | null;
  isAdmin: boolean;
  login: (username: string, password: string, organizationId: number) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const token = authService.getToken();
    const storedRole = authService.getUserRole() as UserRole | null;
    const storedOrgId = authService.getOrganizationId();
    const storedUserId = authService.getUserId();
    const storedOrgName = authService.getOrganizationName();
    
    if (token && storedRole) {
      setIsAuthenticated(true);
      setUserRole(storedRole);
      setOrganizationId(storedOrgId);
      setOrganizationName(storedOrgName || null);
      setUserId(storedUserId);
      
      // Reconstruct user object from stored data
      const username = localStorage.getItem('username') || 'user';
      setUser({
        username,
        email: '',
        role: storedRole,
        organization_id: storedOrgId || undefined,
        user_id: storedUserId || undefined,
      });
    }
  }, []);

  const login = async (username: string, password: string, organizationId: number) => {
    const response = await authService.login({ username, password, organization_id: organizationId });
    const role = authService.getUserRole() as UserRole || 'USER';
    const orgId = authService.getOrganizationId();
    const uId = authService.getUserId();
    const orgName = authService.getOrganizationName();
    
    setIsAuthenticated(true);
    setUserRole(role);
    setOrganizationId(orgId);
    setOrganizationName(orgName || null);
    setUserId(uId);
    setUser({
      username,
      email: '',
      role,
      organization_id: orgId || undefined,
      user_id: uId || undefined,
    });
    
    // Store additional user info
    localStorage.setItem('username', username);
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setUserRole(null);
    setOrganizationId(null);
    setUserId(null);
    localStorage.removeItem('username');
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        userRole,
        organizationId,
        organizationName,
        userId,
        isAdmin: userRole === 'ADMIN',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
