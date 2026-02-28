'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction, updateSpecialRequestsAction, saveStaffListAction, saveLocationListAction, addInventoryItemAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, ReturnedItem, AuditLogEntry, SpecialEntryRequest, OfflineAction } from '@/lib/types';
import { useAuth } from './auth-context';

interface AppData {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
  lastSync: number | null;
}

interface DataCacheContextType extends AppData {
  isCacheReady: boolean;
  isSyncing: boolean;
  pendingActions: OfflineAction[];
  updateInventoryItem: (item: Partial<InventoryItem> & { id: string }) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (updatedSupplier: Supplier) => void;
  addProduct: (product: Partial<Product> & { id: string }) => void;
  updateProduct: (updatedProduct: Partial<Product> & { id: string }) => void;
  addReturnedItem: (item: ReturnedItem) => void;
  updateSpecialRequests: (requests: SpecialEntryRequest[]) => Promise<void>;
  updateStaffList: (staff: string[]) => Promise<void>;
  updateLocationList: (locations: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
  queueAction: (action: Omit<OfflineAction, 'id' | 'timestamp'>) => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const SYNC_INTERVAL_MS = 30000; 
const OFFLINE_KEY = 'sheetSync_offlineActions';

export function DataCacheProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AppData>({
    inventoryItems: [],
    products: [],
    suppliers: [],
    returnedItems: [],
    uniqueLocations: [],
    uniqueStaffNames: [],
    auditLogs: [],
    specialRequests: [],
    lastSync: null,
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const isFetchingRef = useRef(false);
  const isSyncingQueueRef = useRef(false);
  const isCacheReady = data.lastSync !== null;

  // Load offline queue on mount
  useEffect(() => {
    const saved = localStorage.getItem(OFFLINE_KEY);
    if (saved) setPendingActions(JSON.parse(saved));
  }, []);

  // Persist offline queue
  useEffect(() => {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  const fetchDataAndCache = useCallback(async (isBackgroundUpdate: boolean) => {
    if (isFetchingRef.current) return;
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

  // Offline Sync Processor
  const processSyncQueue = useCallback(async () => {
    if (isSyncingQueueRef.current || pendingActions.length === 0 || !navigator.onLine) return;
    
    isSyncingQueueRef.current = true;
    const action = pendingActions[0];
    
    try {
        let success = false;
        if (action.type === 'LOG_INVENTORY') {
            const formData = new FormData();
            Object.entries(action.data).forEach(([k, v]) => formData.append(k, String(v)));
            const res = await addInventoryItemAction(undefined, formData);
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
    const interval = setInterval(processSyncQueue, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [processSyncQueue]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData({ inventoryItems: [], products: [], suppliers: [], returnedItems: [], uniqueLocations: [], uniqueStaffNames: [], auditLogs: [], specialRequests: [], lastSync: null });
      return;
    }
    fetchDataAndCache(false);
    const interval = setInterval(() => fetchDataAndCache(true), SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, authLoading, fetchDataAndCache]);

  const refreshData = useCallback(async () => {
    toast({ title: 'Syncing...', description: 'Fetching latest data.' });
    await fetchDataAndCache(true);
  }, [fetchDataAndCache, toast]);

  const updateSpecialRequests = useCallback(async (requests: SpecialEntryRequest[]) => {
      setData(prev => ({ ...prev, specialRequests: requests }));
      await updateSpecialRequestsAction(requests);
  }, []);

  const updateStaffList = useCallback(async (staff: string[]) => {
      setData(prev => ({ ...prev, uniqueStaffNames: staff }));
      const response = await saveStaffListAction(staff);
      if (response.success) {
          toast({ title: 'Success', description: 'Staff list updated.' });
      }
  }, [toast]);

  const updateLocationList = useCallback(async (locations: string[]) => {
      setData(prev => ({ ...prev, uniqueLocations: locations }));
      const response = await saveLocationListAction(locations);
      if (response.success) {
          toast({ title: 'Success', description: 'Location list updated.' });
      }
  }, [toast]);

  const queueAction = useCallback((action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
      const newAction: OfflineAction = {
          ...action,
          id: `off_${Date.now()}`,
          timestamp: new Date().toISOString()
      };
      setPendingActions(prev => [...prev, newAction]);
      toast({ title: "Stored Offline", description: "Internet connection unstable. Data will sync once back online." });
  }, [toast]);

  const value = useMemo(() => ({
    ...data,
    isCacheReady,
    isSyncing,
    pendingActions,
    refreshData,
    updateSpecialRequests,
    updateStaffList,
    updateLocationList,
    queueAction,
    updateInventoryItem: (i: any) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.map(x => x.id === i.id ? { ...x, ...i } : x) })),
    addInventoryItem: (i: any) => setData(p => ({ ...p, inventoryItems: [i, ...p.inventoryItems] })),
    removeInventoryItem: (id: string) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.filter(x => x.id !== id) })),
    addSupplier: (s: any) => setData(p => ({ ...p, suppliers: [...p.suppliers, s] })),
    updateSupplier: (s: any) => refreshData(),
    addProduct: (pr: any) => setData(p => ({ ...p, products: [pr, ...p.products] })),
    updateProduct: (pr: any) => setData(p => ({ ...p, products: p.products.map(x => x.id === pr.id ? { ...x, ...pr } : x) })),
    addReturnedItem: (r: any) => setData(p => ({ ...p, returnedItems: [r, ...p.returnedItems] })),
  }), [data, isCacheReady, isSyncing, pendingActions, refreshData, updateSpecialRequests, updateStaffList, updateLocationList, queueAction]);

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
