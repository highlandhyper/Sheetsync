
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Credentials {
  username?: string;
  password?: string;
}

interface LocalSettingsAuthContextType {
  credentials: Credentials;
  isInitialized: boolean;
  updateCredentials: (username?: string, password?: string) => void;
  verifyCredentials: (username?: string, password?: string) => boolean;
}

const LocalSettingsAuthContext = createContext<LocalSettingsAuthContextType | undefined>(undefined);

const CREDENTIALS_STORAGE_KEY = 'sheetSyncLocalAdminCreds';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin';

export function LocalSettingsAuthProvider({ children }: PropsWithChildren) {
  const [credentials, setCredentials] = useState<Credentials>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedCreds = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
      if (storedCreds) {
        setCredentials(JSON.parse(storedCreds));
      } else {
        // Set default credentials if none are stored
        setCredentials({ username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD });
      }
    } catch (error) {
      console.warn('Could not access localStorage. Using default credentials for this session.', error);
      setCredentials({ username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD });
    }
    setIsInitialized(true);
  }, []);

  const updateCredentials = useCallback((username?: string, password?: string) => {
    const newCredentials = { username, password };
    setCredentials(newCredentials);
    try {
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(newCredentials));
    } catch (error) {
      console.warn('Could not save credentials to localStorage.', error);
    }
  }, []);

  const verifyCredentials = useCallback((username?: string, password?: string): boolean => {
    if (!isInitialized || !credentials.username || !credentials.password) {
      return false; // Not ready or no credentials set
    }
    return username === credentials.username && password === credentials.password;
  }, [credentials, isInitialized]);

  return (
    <LocalSettingsAuthContext.Provider value={{ credentials, isInitialized, updateCredentials, verifyCredentials }}>
      {children}
    </LocalSettingsAuthContext.Provider>
  );
}

export function useLocalSettingsAuth() {
  const context = useContext(LocalSettingsAuthContext);
  if (context === undefined) {
    throw new Error('useLocalSettingsAuth must be used within a LocalSettingsAuthProvider');
  }
  return context;
}
