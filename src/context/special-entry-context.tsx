
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren, useMemo, useRef } from 'react';
import type { SpecialEntryRequest } from '@/lib/types';
import { useAuth } from './auth-context';
import { useNotifications } from './notification-context';
import { useDataCache } from './data-cache-context';

interface SpecialEntryContextType {
  pendingRequests: SpecialEntryRequest[];
  activeSession: SpecialEntryRequest | null;
  requestSpecialEntry: (staffName: string, type: 'single' | 'timed', reason?: string) => Promise<void>;
  grantProactiveEntry: (staffName: string) => Promise<void>;
  approveRequest: (id: string, durationMinutes?: number) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  consumeSpecialEntry: () => void;
}

const SpecialEntryContext = createContext<SpecialEntryContextType | undefined>(undefined);

export function SpecialEntryProvider({ children }: PropsWithChildren) {
  const { user, role } = useAuth();
  const { addNotification } = useNotifications();
  const { specialRequests, updateSpecialRequests } = useDataCache();
  
  const [activeSession, setActiveSession] = useState<SpecialEntryRequest | null>(null);
  const lastPendingCountRef = useRef(0);
  const processedApprovalIdsRef = useRef<Set<string>>(new Set());

  const pendingRequests = useMemo(() => 
    specialRequests.filter(r => r.status === 'pending')
  , [specialRequests]);

  // Admin Notification Logic
  useEffect(() => {
    if (role === 'admin' && pendingRequests.length > lastPendingCountRef.current) {
      addNotification({
        title: 'New Special Entry Request',
        message: `${pendingRequests[pendingRequests.length - 1].staffName} is requesting silent access.`,
        type: 'request',
        link: '/dashboard'
      });
    }
    lastPendingCountRef.current = pendingRequests.length;
  }, [pendingRequests, role, addNotification]);

  // Viewer Notification & Session Logic
  useEffect(() => {
    if (!user) return;

    // A session is active if it's approved and either not timed (single entry) or within expiry
    const myApproved = specialRequests.find(r => 
      // Proactive grants don't have userEmail initially or it's set by admin. 
      // For viewer to see it, it must match their staffName context or explicit email.
      // Assuming for MVP that proactive grants are matched by staffName if email is missing.
      (r.userEmail === user.email) && 
      r.status === 'approved' && 
      (!r.expiresAt || new Date(r.expiresAt) > new Date())
    );

    if (myApproved) {
      if (!processedApprovalIdsRef.current.has(myApproved.id)) {
        addNotification({
          title: 'Special Entry Approved',
          message: `Authorization granted for ${myApproved.type === 'single' ? '1 entry' : 'the requested duration'}. Silent mode active.`,
          type: 'success',
          link: '/inventory/add'
        });
        processedApprovalIdsRef.current.add(myApproved.id);
      }
      setActiveSession(myApproved);
    } else {
      setActiveSession(null);
    }
  }, [specialRequests, user, addNotification]);

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
    await updateSpecialRequests([newRequest, ...specialRequests]);
  }, [user, specialRequests, updateSpecialRequests]);

  const grantProactiveEntry = useCallback(async (staffName: string) => {
    if (!user) return;
    // For proactive grants, we create an already approved 'single' request.
    // Note: In this MVP, we map this to the staff member's email if possible, 
    // or just store the staff name. Since viewer users login with email, 
    // we ideally need the target email. 
    // We'll search for existing requests with this staffName to find the email.
    const existingReq = specialRequests.find(r => r.staffName.toUpperCase() === staffName.toUpperCase());
    const targetEmail = existingReq?.userEmail || "viewer@example.com"; // Fallback for simulation

    const newRequest: SpecialEntryRequest = {
      id: `grant_${Date.now()}`,
      userEmail: targetEmail,
      staffName: staffName.toUpperCase(),
      status: 'approved',
      type: 'single',
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      grantedByAdmin: true,
    };
    await updateSpecialRequests([newRequest, ...specialRequests]);
  }, [user, specialRequests, updateSpecialRequests]);

  const approveRequest = useCallback(async (id: string, durationMinutes?: number) => {
    const now = new Date();
    const isTimed = typeof durationMinutes === 'number' && durationMinutes > 0;
    const expiresAt = isTimed ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : undefined;
    
    const updated = specialRequests.map(r => {
      if (r.id !== id) return r;
      return {
        ...r, 
        status: 'approved' as const, 
        approvedAt: now.toISOString(), 
        type: isTimed ? 'timed' : 'single', 
        expiresAt: expiresAt
      };
    });
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests]);

  const rejectRequest = useCallback(async (id: string) => {
    const updated = specialRequests.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r);
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests]);

  const consumeSpecialEntry = useCallback(() => {
    if (activeSession?.type === 'single') {
      const updated = specialRequests.map(r => r.id === activeSession.id ? { ...r, status: 'used' as const } : r);
      updateSpecialRequests(updated);
      setActiveSession(null);
    }
  }, [activeSession, specialRequests, updateSpecialRequests]);

  const value = useMemo(() => ({ 
    pendingRequests, activeSession, requestSpecialEntry, grantProactiveEntry, approveRequest, rejectRequest, consumeSpecialEntry 
  }), [pendingRequests, activeSession, requestSpecialEntry, grantProactiveEntry, approveRequest, rejectRequest, consumeSpecialEntry]);

  return <SpecialEntryContext.Provider value={value}>{children}</SpecialEntryContext.Provider>;
}

export function useSpecialEntry() {
  const context = useContext(SpecialEntryContext);
  if (context === undefined) throw new Error('useSpecialEntry must be used within a SpecialEntryProvider');
  return context;
}
