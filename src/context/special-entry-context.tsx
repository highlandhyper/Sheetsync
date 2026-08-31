
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type PropsWithChildren, useMemo, useRef } from 'react';
import type { SpecialEntryRequest, InventoryItem } from '@/lib/types';
import { useAuth } from './auth-context';
import { useDataCache } from './data-cache-context';
import { useGeneralSettings } from './general-settings-context';
import { SpecialEntryActivationDialog } from '@/components/auth/special-entry-activation-dialog';
import { useToast } from '@/hooks/use-toast';
import { approveRequestAction, verifyOtpAction, updateSpecialRequestsAction } from '@/app/actions';

interface SpecialEntryContextType {
  pendingRequests: SpecialEntryRequest[];
  processedRequests: SpecialEntryRequest[];
  activeSessions: SpecialEntryRequest[];
  activeSession: SpecialEntryRequest | null;
  pendingActivationSession: SpecialEntryRequest | null;
  isActivationDialogOpen: boolean;
  setActivationDialogOpen: (open: boolean) => void;
  requestSpecialEntry: (staffName: string, type: 'single' | 'timed' | 'product_add', reason?: string, suggestedName?: string) => Promise<void>;
  requestInventoryEdit: (item: InventoryItem, updatedValues: Partial<InventoryItem>) => Promise<void>;
  grantProactiveEntry: (staffName: string, durationMinutes?: number) => Promise<void>;
  approveRequest: (id: string, durationMinutes?: number) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  revokeRequest: (id: string) => Promise<void>;
  consumeSpecialEntry: () => void;
  activateSession: (id: string, otp: string) => Promise<boolean>;
}

const SpecialEntryContext = createContext<SpecialEntryContextType | undefined>(undefined);

const ACTIVATED_STORAGE_KEY = 'sheetSync_activatedSessionId';

export function SpecialEntryProvider({ children }: PropsWithChildren) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { settings } = useGeneralSettings();
  const { specialRequests, updateSpecialRequests, refreshData } = useDataCache();
  
  const [activeSession, setActiveSession] = useState<SpecialEntryRequest | null>(null);
  const [pendingActivationSession, setPendingActivationSession] = useState<SpecialEntryRequest | null>(null);
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [activatedSessionId, setActivatedSessionId] = useState<string | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const prevApprovedCountRef = useRef(0);
  const isFirstLoadRef = useRef(true);

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

    // SESSIONS VISIBLE TO THIS USER: Their own or Global ones
    const sessionsVisibleToMe = specialRequests.filter(r => 
      (r.userEmail?.toLowerCase().trim() === currentEmail || r.staffName === "ALL PERSONNEL (GLOBAL)") && 
      r.status === 'approved' && 
      (!r.expiresAt || new Date(r.expiresAt) > new Date())
    );

    const currentActive = sessionsVisibleToMe.find(r => r.id === activatedSessionId);
    const firstUnactivated = sessionsVisibleToMe.find(r => r.id !== activatedSessionId && (r.type === 'single' || r.type === 'timed'));

    if (sessionsVisibleToMe.length > prevApprovedCountRef.current) {
        if (!isFirstLoadRef.current) {
            toast({
                title: "Security Grant Active",
                description: "New authorization detected. Click 'Activate Silent Mode' to verify with the key sent via SMS.",
            });
        }
    }

    if (currentActive) {
        setActiveSession(currentActive);
        setPendingActivationSession(null);
    } else if (firstUnactivated) {
        setPendingActivationSession(firstUnactivated);
        setActiveSession(null);
    } else {
        setActiveSession(null);
        setPendingActivationSession(null);
        setIsActivationDialogOpen(false);
    }

    prevApprovedCountRef.current = sessionsVisibleToMe.length;
    isFirstLoadRef.current = false;
  }, [specialRequests, user, activatedSessionId, isInitialized, role, toast]);

  const requestSpecialEntry = useCallback(async (staffName: string, type: 'single' | 'timed' | 'product_add', reason?: string, suggestedName?: string) => {
    if (!user) return;
    const newRequest: SpecialEntryRequest = {
      id: `req_${Date.now()}`,
      userEmail: user.email!.toLowerCase().trim(),
      staffName: staffName.toUpperCase(),
      reason,
      suggestedProductName: suggestedName,
      status: 'pending',
      type,
      durationMinutes: type === 'timed' ? 5 : undefined,
      requestedAt: new Date().toISOString(),
      isDismissedByAdmin: false,
      isReadByUser: false,
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
      isDismissedByAdmin: false,
      isReadByUser: false,
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
    if (!user || !user.email) return;
    
    // Proactive grants create a placeholder request then approve it
    const id = `grant_${Date.now()}`;
    const isGlobal = staffName === "ALL PERSONNEL (GLOBAL)";
    const targetEmail = isGlobal ? "broadcast@system.com" : "viewer@example.com";

    const newRequest: SpecialEntryRequest = {
      id,
      userEmail: targetEmail,
      staffName: staffName.toUpperCase(),
      status: 'pending',
      type: 'single',
      requestedAt: new Date().toISOString(),
      isDismissedByAdmin: false,
      isReadByUser: false,
    };

    // Pre-inject into local state for responsiveness
    const updated = [newRequest, ...specialRequests];
    await updateSpecialRequestsAction(updated);
    
    // Call Secure Server Action for OTP generation and SMS dispatch
    await approveRequestAction(id, user.email, durationMinutes);
    await refreshData();
  }, [user, specialRequests, updateSpecialRequestsAction, refreshData]);

  const approveRequest = useCallback(async (id: string, durationMinutes?: number) => {
    if (!user?.email) return;
    const res = await approveRequestAction(id, user.email, durationMinutes);
    if (res.success) {
        await refreshData();
    } else {
        toast({ variant: "destructive", title: "Approval Failed", description: res.message });
    }
  }, [user, refreshData, toast]);

  const rejectRequest = useCallback(async (id: string) => {
    const updated = specialRequests.map(r => r.id === id ? { ...r, status: 'rejected' as const, approvedAt: new Date().toISOString(), isDismissedByAdmin: true } : r);
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

  const activateSession = useCallback(async (id: string, enteredOtp: string) => {
      const res = await verifyOtpAction(id, enteredOtp);
      if (res.success) {
          localStorage.setItem(ACTIVATED_STORAGE_KEY, id);
          setActivatedSessionId(id);
          setPendingActivationSession(null);
          return true;
      } else {
          if (res.message?.includes('block')) {
              await refreshData();
          }
          return false;
      }
  }, [refreshData]);

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
