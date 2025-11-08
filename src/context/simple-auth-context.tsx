
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SimpleAuthContextType {
  isAuthenticated: boolean;
  login: (username?: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const SimpleAuthContext = createContext<SimpleAuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'simpleAuthStatus';

export function SimpleAuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true to check localStorage
  const router = useRouter();

  useEffect(() => {
    try {
      const storedAuthStatus = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedAuthStatus === 'true') {
        setIsAuthenticated(true);
      }
    } catch (error) {
      // localStorage might not be available (e.g. SSR, or restricted environment)
      console.warn('localStorage not available for auth status');
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username?: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    if (username === 'admin' && password === 'admin') {
      setIsAuthenticated(true);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      } catch (error) {
         console.warn('localStorage not available for auth status');
      }
      setIsLoading(false);
      return true;
    }
    setIsAuthenticated(false);
    setIsLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn('localStorage not available for auth status');
    }
    router.push('/login');
  }, [router]);

  return (
    <SimpleAuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </SimpleAuthContext.Provider>
  );
}

export function useSimpleAuth() {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider');
  }
  return context;
}
