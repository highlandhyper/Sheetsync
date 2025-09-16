
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface MultiSelectContextType {
  isMultiSelectEnabled: boolean;
  setIsMultiSelectEnabled: (enabled: boolean) => void;
}

const MultiSelectContext = createContext<MultiSelectContextType | undefined>(undefined);

const MULTI_SELECT_STORAGE_KEY = 'sheetSyncMultiSelectEnabled';

export function MultiSelectProvider({ children }: PropsWithChildren) {
  const [isMultiSelectEnabled, setMultiSelectState] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(MULTI_SELECT_STORAGE_KEY);
      if (storedValue) {
        setMultiSelectState(JSON.parse(storedValue));
      }
    } catch (error) {
      console.warn('Could not access localStorage for multi-select setting.', error);
    }
    setIsInitialized(true);
  }, []);

  const setIsMultiSelectEnabled = useCallback((enabled: boolean) => {
    setMultiSelectState(enabled);
    try {
      localStorage.setItem(MULTI_SELECT_STORAGE_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.warn('Could not save multi-select setting to localStorage.', error);
    }
  }, []);
  
  if (!isInitialized) {
      return null; // or a loading spinner
  }

  return (
    <MultiSelectContext.Provider value={{ isMultiSelectEnabled, setIsMultiSelectEnabled }}>
      {children}
    </MultiSelectContext.Provider>
  );
}

export function useMultiSelect() {
  const context = useContext(MultiSelectContext);
  if (context === undefined) {
    throw new Error('useMultiSelect must be used within a MultiSelectProvider');
  }
  return context;
}
