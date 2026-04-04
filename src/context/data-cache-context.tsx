'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction, updateSpecialRequestsAction, saveStaffListAction, saveLocationListAction, addInventoryItemAction, returnInventoryItemAction, saveUserRegistryAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, ReturnedItem, AuditLogEntry, SpecialEntryRequest, OfflineAction, AppUser } from '@/lib/types';
import { useAuth } from './auth-context';

interface AppData {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
  users: AppUser[];
  lastSync: number | null;
}

interface DataCacheContextType extends AppData {
  isCacheReady: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  pendingActions: OfflineAction[];
  updateInventoryItem: (item: Partial<InventoryItem> & { id: string }) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string) => void;
  removeInventoryItems: (itemIds: string[]) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (updatedSupplier: Supplier) => void;
  addProduct: (product: Partial<Product> & { id: string }) => void;
  updateProduct: (updatedProduct: Partial<Product> & { id: string }) => void;
  updateSpecialRequests: (requests: SpecialEntryRequest[]) => Promise<void>;
  updateStaffList: (staff: string[]) => Promise<void>;
  updateLocationList: (locations: string[]) => Promise<void>;
  updateUserRegistry: (users: AppUser[]) => Promise<void>;
  refreshData: () => Promise<void>;
  queueAction: (action: Omit<OfflineAction, 'id' | 'timestamp'>) => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const SYNC_INTERVAL_MS = 30000; 
const OFFLINE_KEY = 'sheetSync_offlineActions';

export function DataCacheProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const { user, loading: authLoading, refreshRegistry } = useAuth();
  const [data, setData] = useState<AppData>({
    inventoryItems: [],
    products: [],
    suppliers: [],
    uniqueLocations: [],
    uniqueStaffNames: [],
    auditLogs: [],
    specialRequests: [],
    users: [],
    lastSync: null,
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const isFetchingRef = useRef(false);
  const isSyncingQueueRef = useRef(false);
  const isCacheReady = data.lastSync !== null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const saved = localStorage.getItem(OFFLINE_KEY);
      if (saved) setPendingActions(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  const fetchDataAndCache = useCallback(async (isBackgroundUpdate: boolean) => {
    if (isFetchingRef.current || !navigator.onLine) return;
    isFetchingRef.current = true;
    setIsSyncing(true);

    try {
      const response = await fetchAllDataAction();
      if (response.success && response.data) {
        setData(prev => ({ ...response.data!, lastSync: Date.now() }));
      }
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, []);

  const processSyncQueue = useCallback(async () => {
    if (isSyncingQueueRef.current || pendingActions.length === 0 || !navigator.onLine) return;
    
    isSyncingQueueRef.current = true;
    const action = pendingActions[0];
    
    try {
        let success = false;
        if (action.type === 'LOG_INVENTORY') {
            const formData = new FormData();
            Object.entries(action.data).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    formData.append(k, String(v));
                }
            });
            const res = await addInventoryItemAction(undefined, formData);
            if (res.success) success = true;
        } else if (action.type === 'PROCESS_RETURN') {
            const { userEmail, itemId, returnedQty, staffName } = action.data;
            const res = await returnInventoryItemAction(userEmail, itemId, returnedQty, staffName);
            if (res.success) success = true;
        }

        if (success) {
            setPendingActions(prev => prev.filter(a => a.id !== action.id));
            toast({ title: "Offline Sync Complete", description: "Successfully pushed saved changes to cloud." });
        }
    } catch (e) {
        console.warn("Queue sync retry failed, will try again later.");
    } finally {
        isSyncingQueueRef.current = false;
    }
  }, [pendingActions, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: "Connection Restored", description: "Detecting network... Syncing pending logs." });
      processSyncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ variant: "destructive", title: "Offline Mode", description: "Working from local cache. Scanning is still enabled." });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processSyncQueue, toast]);

  useEffect(() => {
    const interval = setInterval(processSyncQueue, 15000); 
    return () => clearInterval(interval);
  }, [processSyncQueue]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData({ inventoryItems: [], products: [], suppliers: [], uniqueLocations: [], uniqueStaffNames: [], auditLogs: [], specialRequests: [], users: [], lastSync: null });
      return;
    }
    fetchDataAndCache(false);
    const interval = setInterval(() => fetchDataAndCache(true), SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, authLoading, fetchDataAndCache]);

  const refreshData = useCallback(async () => {
    if (!navigator.onLine) {
        toast({ variant: "destructive", title: "Sync Failed", description: "Check your internet connection." });
        return;
    }
    await fetchDataAndCache(true);
  }, [fetchDataAndCache, toast]);

  const updateSpecialRequests = useCallback(async (requests: SpecialEntryRequest[]) => {
      setData(prev => ({ ...prev, specialRequests: requests }));
      if (navigator.onLine) {
          await updateSpecialRequestsAction(requests);
      }
  }, []);

  const updateStaffList = useCallback(async (staff: string[]) => {
      setData(prev => ({ ...prev, uniqueStaffNames: staff }));
      if (navigator.onLine) {
          await saveStaffListAction(staff);
      }
  }, []);

  const updateLocationList = useCallback(async (locations: string[]) => {
      setData(prev => ({ ...prev, uniqueLocations: locations }));
      if (navigator.onLine) {
          await saveLocationListAction(locations);
      }
  }, []);

  const updateUserRegistry = useCallback(async (users: AppUser[]) => {
      setData(prev => ({ ...prev, users }));
      if (navigator.onLine) {
          await saveUserRegistryAction(users);
          await refreshRegistry(); // Keep auth in sync
      }
  }, [refreshRegistry]);

  const queueAction = useCallback((action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
      const newAction: OfflineAction = {
          ...action,
          id: `off_${Date.now()}`,
          timestamp: new Date().toISOString()
      };
      setPendingActions(prev => [...prev, newAction]);
      if (navigator.onLine) processSyncQueue();
  }, [processSyncQueue]);

  const value = useMemo(() => ({
    ...data,
    isCacheReady,
    isSyncing,
    isOnline,
    pendingActions,
    refreshData,
    updateSpecialRequests,
    updateStaffList,
    updateLocationList,
    updateUserRegistry,
    queueAction,
    updateInventoryItem: (i: any) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.map(x => x.id === i.id ? { ...x, ...i } : x) })),
    addInventoryItem: (i: any) => setData(p => ({ ...p, inventoryItems: [i, ...p.inventoryItems] })),
    removeInventoryItem: (id: string) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.filter(x => x.id !== id) })),
    removeInventoryItems: (ids: string[]) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.filter(x => !ids.includes(x.id)) })),
    addSupplier: (s: any) => setData(p => ({ ...p, suppliers: [...p.suppliers, s] })),
    updateSupplier: (s: any) => refreshData(),
    addProduct: (pr: any) => setData(p => ({ ...p, products: [pr, ...p.products] })),
    updateProduct: (pr: any) => {
        setData(p => ({ ...p, products: p.products.map(x => x.id === pr.id ? { ...x, ...pr } : x) }));
        refreshData(); 
    },
  }), [data, isCacheReady, isSyncing, isOnline, pendingActions, refreshData, updateSpecialRequests, updateStaffList, updateLocationList, updateUserRegistry, queueAction]);

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) throw new Error('useDataCache must be used within a DataCacheProvider');
  return context;
}
