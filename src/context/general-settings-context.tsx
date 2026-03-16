'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface GeneralSettings {
  showAdminWelcome: boolean;
  inactivityTimeout: number; // in minutes
  isLockOnInactivityEnabled: boolean;
}

interface GeneralSettingsContextType {
  settings: GeneralSettings;
  setSetting: <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => void;
  isInitialized: boolean;
}

const GeneralSettingsContext = createContext<GeneralSettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'sheetSyncGeneralSettings';

const defaultSettings: GeneralSettings = {
  showAdminWelcome: true,
  inactivityTimeout: 5,
  isLockOnInactivityEnabled: true,
};

export function GeneralSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Safety timeout to prevent stuck loading
    const safetyTimer = setTimeout(() => {
        if (!isInitialized) setIsInitialized(true);
    }, 5000);

    try {
      if (typeof window !== 'undefined') {
        const storedValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedValue) {
          const storedSettings = JSON.parse(storedValue);
          setSettings({ ...defaultSettings, ...storedSettings });
        }
      }
    } catch (error) {
      console.warn('GeneralSettings: Could not access storage.', error);
    } finally {
      clearTimeout(safetyTimer);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const setSetting = useCallback(<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings(prevSettings => {
      const newSettings = { ...prevSettings, [key]: value };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
        }
      } catch (error) {
        console.warn('GeneralSettings: Save failed.', error);
      }
      return newSettings;
    });
  }, []);

  return (
    <GeneralSettingsContext.Provider value={{ settings, setSetting, isInitialized }}>
      {children}
    </GeneralSettingsContext.Provider>
  );
}

export function useGeneralSettings() {
  const context = useContext(GeneralSettingsContext);
  if (context === undefined) {
    throw new Error('useGeneralSettings must be used within a GeneralSettingsProvider');
  }
  return context;
}
