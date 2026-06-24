import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
import { chatService, FeatureFlags } from '../services/chatService';

export type UserRole = 'ADMIN' | 'USER' | 'USER_HANDOFF' | 'SUPERADMIN';

export interface AuthUser extends User {
  role: UserRole;
  organization_id?: number;
  user_id?: number;
  timezone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  userRole: UserRole | null;
  organizationId: number | null;
  organizationName: string | null;
  userId: number | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (username: string, password: string, organizationId: number) => Promise<void>;
  superadminLogin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  featureFlags: FeatureFlags | null;
  isFeatureLoading: boolean;
  refreshFeatureFlags: () => Promise<void>;
}



const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [isFeatureLoading, setIsFeatureLoading] = useState(true);

  const syncCurrentUserFromApi = async (
    fallbackRole: UserRole | null,
    fallbackOrgId: number | null,
    fallbackUserId: number | null
  ): Promise<boolean> => {
    try {
      const currentUser = await authService.getCurrentUser();
      const resolvedRole = (currentUser?.role as UserRole) || fallbackRole || 'USER';
      const resolvedOrgId = currentUser?.organization_id ?? fallbackOrgId ?? undefined;
      const resolvedUserId = currentUser?.id ?? fallbackUserId ?? undefined;
      const resolvedUsername = currentUser?.username || localStorage.getItem('username') || 'user';
      const resolvedEmail = currentUser?.email || localStorage.getItem('user_email') || '';
      const resolvedTimezone = currentUser?.timezone || "Asia/Kolkata";

      localStorage.setItem('username', resolvedUsername);
      if (resolvedEmail) {
        localStorage.setItem('user_email', resolvedEmail);
      }

      setUserRole(resolvedRole);
      setOrganizationId(resolvedOrgId ?? null);
      setUserId(resolvedUserId ?? null);
      setUser({
        username: resolvedUsername,
        email: resolvedEmail,
        role: resolvedRole,
        organization_id: resolvedOrgId,
        user_id: resolvedUserId,
        timezone: resolvedTimezone
      });
      setIsAuthenticated(true);
      return true;
    } catch {
      // Keep fallback state when profile endpoint is temporarily unavailable.
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // Check if user is already authenticated
      const token = authService.getToken();
      const storedRole = authService.getUserRole() as UserRole | null;
      const storedOrgId = authService.getOrganizationId();
      const storedUserId = authService.getUserId();
      const storedOrgName = authService.getOrganizationName();

      if (!token) {
        setIsAuthLoading(false);
        return;
      }

      if (storedRole) {
        setIsAuthenticated(true);
        setUserRole(storedRole);
        setOrganizationId(storedOrgId);
        setOrganizationName(storedOrgName || null);
        setUserId(storedUserId);

        // Reconstruct user object from stored data
        const username = localStorage.getItem('username') || 'user';
        const email = localStorage.getItem('user_email') || '';
        setUser({
          username,
          email,
          role: storedRole,
          organization_id: storedOrgId || undefined,
          user_id: storedUserId || undefined,
        });

        if (storedRole !== 'SUPERADMIN') {
          await syncCurrentUserFromApi(storedRole, storedOrgId, storedUserId);
        }

        await loadFeatureFlags();
      } else {
        // Legacy tokens without cached role: try hydrating from profile endpoint.
        const restored = await syncCurrentUserFromApi(null, storedOrgId, storedUserId);
        if (!restored) {
          authService.logout();
          setIsAuthenticated(false);
          setUserRole(null);
          setOrganizationId(null);
          setOrganizationName(null);
          setUserId(null);
          setUser(null);
        }
      }

      setIsAuthLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string, organizationId: number) => {
    const loginResponse = await authService.login({ username, password, organization_id: organizationId });
    const role = (loginResponse.role as UserRole) || (authService.getUserRole() as UserRole) || 'USER';
    const orgId = loginResponse.organization_id || authService.getOrganizationId();
    const uId = loginResponse.user_id || authService.getUserId();
    const orgName = authService.getOrganizationName();
    const resolvedTimezone = "Asia/Kolkata";

    setIsAuthenticated(true);
    setUserRole(role);
    setOrganizationId(orgId);
    setOrganizationName(orgName || null);
    setUserId(uId);
    setUser({
      username,
      email: localStorage.getItem('user_email') || '',
      role,
      organization_id: orgId || undefined,
      user_id: uId || undefined,
      timezone: resolvedTimezone
    });

    // Store additional user info
    localStorage.setItem('username', username);
    await syncCurrentUserFromApi(role, orgId, uId);
    setIsAuthLoading(false);
  };

  const superadminLogin = async (username: string, password: string) => {
    await authService.superadminLogin({ username, password });
    const role = authService.getUserRole() as UserRole || 'SUPERADMIN';
    const uId = authService.getUserId();

    setIsAuthenticated(true);
    setUserRole(role);
    setOrganizationId(null);
    setOrganizationName(null);
    setUserId(uId);
    setUser({
      username,
      email: '',
      role,
    });

    localStorage.setItem('username', username);
    setIsAuthLoading(false);
  };

  const logout = () => {
    authService.logout();
    setIsAuthLoading(false);
    setIsAuthenticated(false);
    setUser(null);
    setUserRole(null);
    setOrganizationId(null);
    setUserId(null);
    localStorage.removeItem('username');
    localStorage.removeItem('user_email');
    setFeatureFlags(null);
  };

  const loadFeatureFlags = async () => {
    try {
      console.log("userRole :", userRole)
      if (
        userRole &&
        ['ADMIN', 'USER', 'USER_HANDOFF'].includes(userRole)
      ) {
        const flags = await chatService.getFeatureFlags();
        setFeatureFlags(flags);
      }
    } catch (err) {
      console.error("Failed to load feature flags", err);
    } finally {
      setIsFeatureLoading(false);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAuthLoading,
        userRole,
        organizationId,
        organizationName,
        userId,
        isAdmin: userRole === 'ADMIN',
        isSuperAdmin: userRole === 'SUPERADMIN',
        login,
        superadminLogin,
        logout,
        featureFlags,
        isFeatureLoading,
        refreshFeatureFlags: loadFeatureFlags,
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
