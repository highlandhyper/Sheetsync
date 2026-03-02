'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Credentials {
  username?: string;
  password?: string;
  quickAuthPin?: string;
}

interface LocalSettingsAuthContextType {
  credentials: Credentials;
  isInitialized: boolean;
  updateCredentials: (username?: string, password?: string, quickAuthPin?: string) => void;
  verifyCredentials: (username?: string, password?: string) => boolean;
  verifyPin: (pin: string) => boolean;
}

const LocalSettingsAuthContext = createContext<LocalSettingsAuthContextType | undefined>(undefined);

const CREDENTIALS_STORAGE_KEY = 'sheetSyncLocalAdminCreds';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin';
const DEFAULT_PIN = '1234';

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
        setCredentials({ username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD, quickAuthPin: DEFAULT_PIN });
      }
    } catch (error) {
      console.warn('Could not access localStorage. Using default credentials for this session.', error);
      setCredentials({ username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD, quickAuthPin: DEFAULT_PIN });
    }
    setIsInitialized(true);
  }, []);

  const updateCredentials = useCallback((username?: string, password?: string, quickAuthPin?: string) => {
    const newCredentials = { username, password, quickAuthPin };
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

  const verifyPin = useCallback((pin: string): boolean => {
    if (!isInitialized) return false;
    const actualPin = credentials.quickAuthPin || DEFAULT_PIN;
    return pin === actualPin;
  }, [credentials.quickAuthPin, isInitialized]);

  return (
    <LocalSettingsAuthContext.Provider value={{ credentials, isInitialized, updateCredentials, verifyCredentials, verifyPin }}>
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
