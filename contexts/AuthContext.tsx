/**
 * contexts/AuthContext.tsx — Authentication state management
 *
 * Manages the current user session, login/logout, and session
 * persistence via localStorage.
 *
 * Usage:
 *   const { currentUser, handleLogin, handleLogout } = useAuth();
 *
 * This context is composed inside AppProvider so existing components
 * that use `useApp()` continue to work without changes.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User } from '../types';
import { View } from '../types';
import { logInfo, logWarn } from '../utils/logger';

// ── Context type ────────────────────────────────────────────────────────────

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  handleLogin: (user: User) => void;
  handleRegister: (user: User) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
  /** Called after login to navigate to the appropriate dashboard */
  onLoginNavigate?: (user: User) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  onLoginNavigate,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Restore session from localStorage on mount
    try {
      const saved =
        localStorage.getItem('reRideCurrentUser') ||
        sessionStorage.getItem('currentUser');
      if (!saved) return null;

      const user = JSON.parse(saved);
      if (
        !user?.email ||
        !user?.role ||
        !['customer', 'seller', 'admin'].includes(user.role)
      ) {
        localStorage.removeItem('reRideCurrentUser');
        sessionStorage.removeItem('currentUser');
        return null;
      }

      logInfo('Restoring user session:', user.email);
      return user;
    } catch {
      return null;
    }
  });

  const handleLogin = useCallback(
    (user: User) => {
      setCurrentUser(user);
      try {
        localStorage.setItem('reRideCurrentUser', JSON.stringify(user));
        sessionStorage.setItem('currentUser', JSON.stringify(user));
      } catch {
        logWarn('Failed to persist user session');
      }
      onLoginNavigate?.(user);
    },
    [onLoginNavigate],
  );

  const handleRegister = useCallback(
    (user: User) => {
      // Registration follows the same flow as login
      handleLogin(user);
    },
    [handleLogin],
  );

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('reRideCurrentUser');
      localStorage.removeItem('reRideAccessToken');
      localStorage.removeItem('reRideRefreshToken');
      localStorage.removeItem('reRideActiveChat');
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('accessToken');
    } catch {
      // ignore storage errors
    }
  }, []);

  const value: AuthContextType = {
    currentUser,
    setCurrentUser,
    handleLogin,
    handleRegister,
    handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

