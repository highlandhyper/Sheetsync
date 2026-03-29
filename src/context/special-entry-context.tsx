'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren, useMemo, useRef } from 'react';
import type { SpecialEntryRequest, InventoryItem } from '@/lib/types';
import { useAuth } from './auth-context';
import { useDataCache } from './data-cache-context';
import { SpecialEntryActivationDialog } from '@/components/auth/special-entry-activation-dialog';
import { useToast } from '@/hooks/use-toast';

interface SpecialEntryContextType {
  pendingRequests: SpecialEntryRequest[];
  processedRequests: SpecialEntryRequest[];
  activeSessions: SpecialEntryRequest[];
  activeSession: SpecialEntryRequest | null;
  pendingActivationSession: SpecialEntryRequest | null;
  isActivationDialogOpen: boolean;
  setActivationDialogOpen: (open: boolean) => void;
  requestSpecialEntry: (staffName: string, type: 'single' | 'timed' | 'product_add', reason?: string) => Promise<void>;
  requestInventoryEdit: (item: InventoryItem, updatedValues: Partial<InventoryItem>) => Promise<void>;
  grantProactiveEntry: (staffName: string, durationMinutes?: number) => Promise<void>;
  approveRequest: (id: string, durationMinutes?: number) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  revokeRequest: (id: string) => Promise<void>;
  consumeSpecialEntry: () => void;
  activateSession: (id: string, otp: string) => boolean;
}

const SpecialEntryContext = createContext<SpecialEntryContextType | undefined>(undefined);

const ACTIVATED_STORAGE_KEY = 'sheetSync_activatedSessionId';

const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

export function SpecialEntryProvider({ children }: PropsWithChildren) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { specialRequests, updateSpecialRequests } = useDataCache();
  
  const [activeSession, setActiveSession] = useState<SpecialEntryRequest | null>(null);
  const [pendingActivationSession, setPendingActivationSession] = useState<SpecialEntryRequest | null>(null);
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [activatedSessionId, setActivatedSessionId] = useState<string | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const prevApprovedCountRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setActivatedSessionId(localStorage.getItem(ACTIVATED_STORAGE_KEY));
        setIsInitialized(true);
    }
  }, []);

  const pendingRequestsList = useMemo(() => 
    specialRequests.filter(r => r.status === 'pending')
  , [specialRequests]);

  const processedRequestsList = useMemo(() => 
    specialRequests.filter(r => r.status !== 'pending').slice(0, 50)
  , [specialRequests]);

  const activeSessionsList = useMemo(() => {
    const now = new Date();
    return specialRequests.filter(r => 
        r.status === 'approved' && 
        (r.type === 'single' || r.type === 'timed') &&
        (!r.expiresAt || new Date(r.expiresAt) > now)
    );
  }, [specialRequests]);

  useEffect(() => {
    if (!isInitialized || !user || !user.email) return;

    const currentEmail = user.email.toLowerCase().trim();

    const myApprovedSessions = specialRequests.filter(r => 
      (r.userEmail?.toLowerCase().trim() === currentEmail) && 
      r.status === 'approved' && 
      (!r.expiresAt || new Date(r.expiresAt) > new Date())
    );

    if (myApprovedSessions.length > prevApprovedCountRef.current && role === 'viewer') {
        toast({
            title: "Request Updated!",
            description: "An administrator has processed your request. Check notifications for details.",
        });
    }
    prevApprovedCountRef.current = myApprovedSessions.length;

    const currentActive = myApprovedSessions.find(r => r.id === activatedSessionId);
    const firstUnactivated = myApprovedSessions.find(r => r.id !== activatedSessionId && (r.type === 'single' || r.type === 'timed'));

    if (currentActive) {
        setActiveSession(currentActive);
        setPendingActivationSession(null);
    } else if (firstUnactivated) {
        setPendingActivationSession(firstUnactivated);
        setActiveSession(null);
    } else {
        setActiveSession(null);
        setPendingActivationSession(null);
    }
  }, [specialRequests, user, activatedSessionId, isInitialized, role, toast]);

  const requestSpecialEntry = useCallback(async (staffName: string, type: 'single' | 'timed' | 'product_add', reason?: string) => {
    if (!user) return;
    const newRequest: SpecialEntryRequest = {
      id: `req_${Date.now()}`,
      userEmail: user.email!.toLowerCase().trim(),
      staffName: staffName.toUpperCase(),
      reason,
      status: 'pending',
      type,
      durationMinutes: type === 'timed' ? 5 : undefined,
      requestedAt: new Date().toISOString(),
    };
    await updateSpecialRequests([newRequest, ...specialRequests]);
  }, [user, specialRequests, updateSpecialRequests]);

  const requestInventoryEdit = useCallback(async (item: InventoryItem, updatedValues: Partial<InventoryItem>) => {
    if (!user) return;
    const newRequest: SpecialEntryRequest = {
      id: `edit_${Date.now()}`,
      userEmail: user.email!.toLowerCase().trim(),
      staffName: item.staffName || 'VIEWER',
      status: 'pending',
      type: 'inventory_edit',
      requestedAt: new Date().toISOString(),
      originalDetails: {
        location: item.location,
        itemType: item.itemType,
        quantity: item.quantity,
        expiryDate: item.expiryDate
      },
      editDetails: {
        itemId: item.id,
        productName: item.productName,
        location: updatedValues.location || item.location,
        itemType: updatedValues.itemType || item.itemType,
        quantity: updatedValues.quantity !== undefined ? updatedValues.quantity : item.quantity,
        expiryDate: updatedValues.expiryDate || item.expiryDate
      }
    };
    await updateSpecialRequests([newRequest, ...specialRequests]);
  }, [user, specialRequests, updateSpecialRequests]);

  const grantProactiveEntry = useCallback(async (staffName: string, durationMinutes?: number) => {
    if (!user) return;
    
    const existingReq = specialRequests.find(r => r.staffName.toUpperCase() === staffName.toUpperCase());
    const targetEmail = existingReq?.userEmail?.toLowerCase().trim() || "viewer@example.com"; 

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
        type: r.type === 'inventory_edit' || r.type === 'product_add' ? r.type : (isTimed ? 'timed' : 'single'), 
        expiresAt: expiresAt,
        otp: otp,
      };
    });
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests]);

  const rejectRequest = useCallback(async (id: string) => {
    const updated = specialRequests.map(r => r.id === id ? { ...r, status: 'rejected' as const, approvedAt: new Date().toISOString() } : r);
    await updateSpecialRequests(updated);
  }, [specialRequests, updateSpecialRequests]);

  const revokeRequest = useCallback(async (id: string) => {
    const updated = specialRequests.map(r => r.id === id ? { ...r, status: 'expired' as const } : r);
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
          setPendingActivationSession(null);
          return true;
      }
      return false;
  }, [specialRequests, activatedSessionId]);

  const value = useMemo(() => ({ 
    pendingRequests: pendingRequestsList, 
    processedRequests: processedRequestsList,
    activeSessions: activeSessionsList,
    activeSession, 
    pendingActivationSession,
    isActivationDialogOpen,
    setActivationDialogOpen: setIsActivationDialogOpen,
    requestSpecialEntry, 
    requestInventoryEdit,
    grantProactiveEntry, 
    approveRequest, 
    rejectRequest, 
    revokeRequest,
    consumeSpecialEntry,
    activateSession
  }), [pendingRequestsList, processedRequestsList, activeSessionsList, activeSession, pendingActivationSession, isActivationDialogOpen, requestSpecialEntry, requestInventoryEdit, grantProactiveEntry, approveRequest, rejectRequest, revokeRequest, consumeSpecialEntry, activateSession]);

  return (
    <SpecialEntryContext.Provider value={value}>
        {children}
        {pendingActivationSession && (
            <SpecialEntryActivationDialog 
                session={pendingActivationSession} 
                onActivate={(otp) => activateSession(pendingActivationSession.id, otp)}
                isOpen={isActivationDialogOpen}
                onOpenChange={setIsActivationDialogOpen}
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
