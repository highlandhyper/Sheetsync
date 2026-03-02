'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren, useMemo, useRef } from 'react';
import type { SpecialEntryRequest } from '@/lib/types';
import { useAuth } from './auth-context';
import { useNotifications } from './notification-context';
import { useDataCache } from './data-cache-context';
import { SpecialEntryActivationDialog } from '@/components/auth/special-entry-activation-dialog';

interface SpecialEntryContextType {
  pendingRequests: SpecialEntryRequest[];
  activeSession: SpecialEntryRequest | null;
  awaitingActivation: SpecialEntryRequest | null;
  requestSpecialEntry: (staffName: string, type: 'single' | 'timed', reason?: string) => Promise<void>;
  grantProactiveEntry: (staffName: string, durationMinutes?: number) => Promise<void>;
  approveRequest: (id: string, durationMinutes?: number) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  consumeSpecialEntry: () => void;
  activateSession: (id: string, otp: string) => boolean;
}

const SpecialEntryContext = createContext<SpecialEntryContextType | undefined>(undefined);

const ACTIVATED_STORAGE_KEY = 'sheetSync_activatedSessionId';

// Helper to generate a random 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

export function SpecialEntryProvider({ children }: PropsWithChildren) {
  const { user, role } = useAuth();
  const { addNotification } = useNotifications();
  const { specialRequests, updateSpecialRequests } = useDataCache();
  
  const [activeSession, setActiveSession] = useState<SpecialEntryRequest | null>(null);
  const [awaitingActivation, setAwaitingActivation] = useState<SpecialEntryRequest | null>(null);
  const [activatedSessionId, setActivatedSessionId] = useState<string | null>(null);
  
  const lastPendingCountRef = useRef(0);
  const processedApprovalIdsRef = useRef<Set<string>>(new Set());

  // Initialize activated session from local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
        setActivatedSessionId(localStorage.getItem(ACTIVATED_STORAGE_KEY));
    }
  }, []);

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

    const myApproved = specialRequests.find(r => 
      (r.userEmail === user.email) && 
      r.status === 'approved' && 
      (!r.expiresAt || new Date(r.expiresAt) > new Date())
    );

    if (myApproved) {
      // 1. Handle notification logic
      if (!processedApprovalIdsRef.current.has(myApproved.id)) {
        addNotification({
          title: 'Silent Access Authorized',
          message: `Special entry granted for ${myApproved.staffName}. USE OTP: ${myApproved.otp || 'NONE'}. Click to activate.`,
          type: 'success',
          link: '/inventory/add'
        });
        processedApprovalIdsRef.current.add(myApproved.id);
      }

      // 2. Handle activation logic
      if (activatedSessionId !== myApproved.id) {
          setAwaitingActivation(myApproved);
          setActiveSession(null);
      } else {
          setAwaitingActivation(null);
          setActiveSession(myApproved);
      }
    } else {
      setActiveSession(null);
      setAwaitingActivation(null);
    }
  }, [specialRequests, user, addNotification, activatedSessionId]);

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

  const grantProactiveEntry = useCallback(async (staffName: string, durationMinutes?: number) => {
    if (!user) return;
    
    const existingReq = specialRequests.find(r => r.staffName.toUpperCase() === staffName.toUpperCase());
    const targetEmail = existingReq?.userEmail || "viewer@example.com"; 

    const now = new Date();
    const isTimed = typeof durationMinutes === 'number' && durationMinutes > 0;
    const expiresAt = isTimed ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : undefined;
    const otp = generateOTP();

    const newRequest: SpecialEntryRequest = {
      id: `grant_${Date.now()}`,
      userEmail: targetEmail,
      staffName: staffName.toUpperCase(),
      status: 'approved',
      type: isTimed ? 'timed' : 'single',
      durationMinutes: durationMinutes,
      requestedAt: now.toISOString(),
      approvedAt: now.toISOString(),
      expiresAt: expiresAt,
      grantedByAdmin: true,
      otp: otp,
    };
    await updateSpecialRequests([newRequest, ...specialRequests]);
  }, [user, specialRequests, updateSpecialRequests]);

  const approveRequest = useCallback(async (id: string, durationMinutes?: number) => {
    const now = new Date();
    const isTimed = typeof durationMinutes === 'number' && durationMinutes > 0;
    const expiresAt = isTimed ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : undefined;
    const otp = generateOTP();
    
    const updated = specialRequests.map(r => {
      if (r.id !== id) return r;
      return {
        ...r, 
        status: 'approved' as const, 
        approvedAt: now.toISOString(), 
        type: isTimed ? 'timed' : 'single', 
        expiresAt: expiresAt,
        otp: otp,
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
      localStorage.removeItem(ACTIVATED_STORAGE_KEY);
      setActivatedSessionId(null);
    }
  }, [activeSession, specialRequests, updateSpecialRequests]);

  const activateSession = useCallback((id: string, enteredOtp: string) => {
      const request = specialRequests.find(r => r.id === id);
      if (request && request.otp === enteredOtp) {
          localStorage.setItem(ACTIVATED_STORAGE_KEY, id);
          setActivatedSessionId(id);
          setAwaitingActivation(null);
          return true;
      }
      return false;
  }, [specialRequests]);

  const value = useMemo(() => ({ 
    pendingRequests, 
    activeSession, 
    awaitingActivation,
    requestSpecialEntry, 
    grantProactiveEntry, 
    approveRequest, 
    rejectRequest, 
    consumeSpecialEntry,
    activateSession
  }), [pendingRequests, activeSession, awaitingActivation, requestSpecialEntry, grantProactiveEntry, approveRequest, rejectRequest, consumeSpecialEntry, activateSession]);

  return (
    <SpecialEntryContext.Provider value={value}>
        {children}
        {awaitingActivation && (
            <SpecialEntryActivationDialog 
                session={awaitingActivation} 
                onActivate={(otp) => activateSession(awaitingActivation.id, otp)} 
            />
        )}
    </SpecialEntryContext.Provider>
  );
}

export function useSpecialEntry() {
  const context = useContext(SpecialEntryContext);
  if (context === undefined) throw new Error('useSpecialEntry must be used within a SpecialEntryProvider');
  return context;
}
