'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface GeneralSettings {
  showAdminWelcome: boolean;
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
};

export function GeneralSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedValue) {
        const storedSettings = JSON.parse(storedValue);
        setSettings({ ...defaultSettings, ...storedSettings });
      }
    } catch (error) {
      console.warn('Could not access localStorage for general settings.', error);
    }
    setIsInitialized(true);
  }, []);

  const setSetting = useCallback(<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings(prevSettings => {
      const newSettings = { ...prevSettings, [key]: value };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      } catch (error) {
        console.warn('Could not save general settings to localStorage.', error);
      }
      return newSettings;
    });
  }, []);
  
  if (!isInitialized) {
      return null;
  }

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
