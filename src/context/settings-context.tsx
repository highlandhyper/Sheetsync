
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SettingsContextType {
  isMultiSelectEnabled: boolean;
  setIsMultiSelectEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const MULTI_SELECT_STORAGE_KEY = 'sheetSyncMultiSelectEnabled';

export function SettingsProvider({ children }: PropsWithChildren) {
  const [isMultiSelectEnabled, setMultiSelectState] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(MULTI_SELECT_STORAGE_KEY);
      // Default to true if not set, for a better "out of the box" experience.
      setMultiSelectState(storedValue === null ? true : storedValue === 'true');
    } catch (error) {
      console.warn('Could not access localStorage. Multi-select setting will not be persisted.', error);
      setMultiSelectState(true); // Default to enabled
    }
    setIsInitialized(true);
  }, []);

  const setIsMultiSelectEnabled = useCallback((enabled: boolean) => {
    if (!isInitialized) return;

    setMultiSelectState(enabled);
    try {
      localStorage.setItem(MULTI_SELECT_STORAGE_KEY, String(enabled));
       toast({
        title: 'Setting Updated',
        description: `Multi-select mode has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Could Not Save Setting',
        description: 'Your browser is not allowing this setting to be saved.',
        variant: 'destructive',
      });
    }
  }, [isInitialized, toast]);

  return (
    <SettingsContext.Provider value={{ isMultiSelectEnabled, setIsMultiSelectEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
