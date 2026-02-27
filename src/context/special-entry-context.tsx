'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren, useMemo } from 'react';
import type { SpecialEntryRequest } from '@/lib/types';
import { useAuth } from './auth-context';
import { useNotifications } from './notification-context';
import { useDataCache } from './data-cache-context';

interface SpecialEntryContextType {
  pendingRequests: SpecialEntryRequest[];
  activeSession: SpecialEntryRequest | null;
  requestSpecialEntry: (staffName: string, type: 'single' | 'timed', reason?: string) => Promise<void>;
  approveRequest: (id: string, durationMinutes?: number) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  consumeSpecialEntry: () => void;
}

const SpecialEntryContext = createContext<SpecialEntryContextType | undefined>(undefined);

const STORAGE_KEY = 'sheetSyncSpecialRequests';

export function SpecialEntryProvider({ children }: PropsWithChildren) {
  const { user, role } = useAuth();
  const { addNotification } = useNotifications();
  const [requests, setRequests] = useState<SpecialEntryRequest[]>([]);
  const [activeSession, setActiveSession] = useState<SpecialEntryRequest | null>(null);

  // Sync with local storage for demo purposes
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRequests(parsed);
      } catch (e) {
        console.warn('SpecialEntryContext: Failed to parse stored requests.');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    
    if (user && !activeSession) {
      const approved = requests.find(r => 
        r.userEmail === user.email && 
        r.status === 'approved' && 
        (!r.expiresAt || new Date(r.expiresAt) > new Date())
      );
      if (approved) setActiveSession(approved);
    }
  }, [requests, user, activeSession]);

  const requestSpecialEntry = useCallback(async (staffName: string, type: 'single' | 'timed', reason?: string) => {
    if (!user) return;
    
    const newRequest: SpecialEntryRequest = {
      id: `req_${Date.now()}`,
      userEmail: user.email!,
      staffName,
      reason,
      status: 'pending',
      type,
      durationMinutes: type === 'timed' ? 5 : undefined,
      requestedAt: new Date().toISOString(),
    };

    setRequests(prev => [newRequest, ...prev]);
  }, [user]);

  const approveRequest = useCallback(async (id: string, durationMinutes: number = 5) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();

    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const approved: SpecialEntryRequest = {
          ...r,
          status: 'approved',
          approvedAt: now.toISOString(),
          expiresAt: r.type === 'timed' ? expiresAt : undefined,
        };
        
        addNotification({
          title: 'Special Entry Approved',
          message: `Your request for a ${r.type === 'single' ? 'single log' : '5-minute session'} has been approved.`,
          type: 'success',
          link: '/inventory/add'
        });

        return approved;
      }
      return r;
    }));
  }, [addNotification]);

  const rejectRequest = useCallback(async (id: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        addNotification({
          title: 'Special Entry Rejected',
          message: 'Your request for a silent log was declined by an administrator.',
          type: 'error'
        });
        return { ...r, status: 'rejected' };
      }
      return r;
    }));
  }, [addNotification]);

  const consumeSpecialEntry = useCallback(() => {
    if (!activeSession) return;

    if (activeSession.type === 'single') {
      setRequests(prev => prev.map(r => r.id === activeSession.id ? { ...r, status: 'used' } : r));
      setActiveSession(null);
    }
  }, [activeSession]);

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);

  const value = useMemo(() => ({ 
    pendingRequests, 
    activeSession, 
    requestSpecialEntry, 
    approveRequest, 
    rejectRequest,
    consumeSpecialEntry 
  }), [pendingRequests, activeSession, requestSpecialEntry, approveRequest, rejectRequest, consumeSpecialEntry]);

  return (
    <SpecialEntryContext.Provider value={value}>
      {children}
    </SpecialEntryContext.Provider>
  );
}

export function useSpecialEntry() {
  const context = useContext(SpecialEntryContext);
  if (context === undefined) {
    throw new Error('useSpecialEntry must be used within a SpecialEntryProvider');
  }
  return context;
}
