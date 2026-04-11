'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction, updateSpecialRequestsAction, saveStaffListAction, saveLocationListAction, addInventoryItemAction, returnInventoryItemAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, AuditLogEntry, SpecialEntryRequest, OfflineAction } from '@/lib/types';
import { useAuth } from './auth-context';
import { saveInventory, getInventory, saveAuditLogs, getAuditLogs, saveProducts, getProducts } from '@/lib/db';

interface AppData {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  specialRequests: SpecialEntryRequest[];
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
  removeProducts: (barcodes: string[]) => void;
  updateSpecialRequests: (requests: SpecialEntryRequest[]) => Promise<void>;
  updateStaffList: (staff: string[]) => Promise<void>;
  updateLocationList: (locations: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
  queueAction: (action: Omit<OfflineAction, 'id' | 'timestamp'>) => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const SYNC_INTERVAL_MS = 45000;
const DATA_CACHE_KEY = 'sheetSync_metaCache_v3';
const OFFLINE_KEY = 'sheetSync_offlineActions_v3';

const initialEmptyData: AppData = {
  inventoryItems: [],
  products: [],
  suppliers: [],
  uniqueLocations: [],
  uniqueStaffNames: [],
  auditLogs: [],
  specialRequests: [],
  lastSync: null,
};

export function DataCacheProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // 1. BOOTSTRAP METADATA FROM LOCALSTORAGE (Small data only)
  const [data, setData] = useState<AppData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DATA_CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...initialEmptyData, ...parsed, inventoryItems: [], products: [], auditLogs: [] };
        }
      } catch (e) {
        console.warn("DataCache: Meta-cache failed.");
      }
    }
    return initialEmptyData;
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  
  const isFetchingRef = useRef(false);
  const processingQueueRef = useRef(false);
  const isDbLoadingRef = useRef(false);
  
  // Cache is ready if we have a lastSync OR we have some data in memory
  const isCacheReady = data.lastSync !== null || data.inventoryItems.length > 0;

  // 2. LOAD LARGE DATA FROM INDEXED-DB ON STARTUP
  useEffect(() => {
    if (isDbLoadingRef.current) return;
    isDbLoadingRef.current = true;

    async function loadIndexedDB() {
      try {
        const [inventory, logs, products] = await Promise.all([
          getInventory(),
          getAuditLogs(),
          getProducts()
        ]);

        setData(prev => ({
          ...prev,
          inventoryItems: inventory || [],
          auditLogs: logs || [],
          products: products || []
        }));
      } catch (e) {
        console.error('DataCache: IndexedDB load failed', e);
      } finally {
        isDbLoadingRef.current = false;
      }
    }

    if (typeof window !== 'undefined') {
        loadIndexedDB();
        setIsOnline(navigator.onLine);
        const saved = localStorage.getItem(OFFLINE_KEY);
        if (saved) {
            try { setPendingActions(JSON.parse(saved)); } catch (e) { localStorage.removeItem(OFFLINE_KEY); }
        }
    }
  }, []);

  // 3. PERSIST LARGE DATA TO INDEXED-DB (Debounced)
  useEffect(() => {
    if (!data.lastSync) return;

    const timeout = setTimeout(() => {
      saveInventory(data.inventoryItems);
      saveAuditLogs(data.auditLogs);
      saveProducts(data.products);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [data.inventoryItems, data.auditLogs, data.products, data.lastSync]);

  // 4. PERSIST METADATA TO LOCALSTORAGE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(pendingActions));
      if (data.lastSync) {
        try {
          const { inventoryItems, products, auditLogs, ...metaOnly } = data;
          localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(metaOnly));
        } catch (e) {
          console.error("DataCache: Local storage update failed.", e);
        }
      }
    }
  }, [pendingActions, data]);

  const fetchDataAndCache = useCallback(async () => {
    if (isFetchingRef.current || !navigator.onLine || !user) return;
    
    isFetchingRef.current = true;
    setIsSyncing(true);

    const safetyTimeout = setTimeout(() => { isFetchingRef.current = false; }, 30000);

    try {
      const response = await fetchAllDataAction();
      if (response.success && response.data) {
        setData(prev => ({ 
          ...response.data!, 
          lastSync: Date.now() 
        }));
      }
    } catch (e) {
      console.error("Data Sync: Global fetch failed.", e);
    } finally {
      clearTimeout(safetyTimeout);
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  const processSyncQueue = useCallback(async () => {
    if (processingQueueRef.current || pendingActions.length === 0 || !navigator.onLine) return;
    
    processingQueueRef.current = true;
    setIsQueueProcessing(true);
    
    const actionsToProcess = [...pendingActions];
    const successfullySyncedIds: string[] = [];

    for (const action of actionsToProcess) {
        if (!navigator.onLine) break;

        try {
            let success = false;
            if (action.type === 'LOG_INVENTORY') {
                const formData = new FormData();
                Object.entries(action.data).forEach(([k, v]) => { 
                    if (v !== null && v !== undefined) formData.append(k, String(v)); 
                });
                const res = await addInventoryItemAction(undefined, formData);
                if (res.success) success = true;
            } else if (action.type === 'PROCESS_RETURN') {
                const { userEmail, itemId, returnedQty, staffName } = action.data;
                const res = await returnInventoryItemAction(userEmail, itemId, returnedQty, staffName);
                if (res.success) success = true;
            }

            if (success) successfullySyncedIds.push(action.id);
        } catch (e) {
            console.error(`Sync: Action ${action.id} failed.`, e);
            break; 
        }
    }

    if (successfullySyncedIds.length > 0) {
        setPendingActions(prev => prev.filter(a => !successfullySyncedIds.includes(a.id)));
        toast({ title: "Queue Synced", description: `Successfully pushed ${successfullySyncedIds.length} offline records.` });
        fetchDataAndCache();
    }

    setIsQueueProcessing(false);
    processingQueueRef.current = false;
  }, [pendingActions, toast, fetchDataAndCache]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); processSyncQueue(); };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => { if (user && !isFetchingRef.current) fetchDataAndCache(); };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    
    return () => { 
        window.removeEventListener('online', handleOnline); 
        window.removeEventListener('offline', handleOffline); 
        window.removeEventListener('focus', handleFocus);
    };
  }, [processSyncQueue, fetchDataAndCache, user]);

  // FIXED: Removed data.lastSync from dependencies to stop the infinite loop
  useEffect(() => {
    if (!user) {
      if (data.lastSync) {
        setData(initialEmptyData);
        localStorage.removeItem(DATA_CACHE_KEY);
      }
      return;
    }
    
    fetchDataAndCache();
    const interval = setInterval(fetchDataAndCache, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchDataAndCache]);

  const refreshData = useCallback(async () => {
    if (!navigator.onLine) {
        toast({ title: "No Connection", description: "Refresh unavailable while offline.", variant: "destructive" });
        return;
    }
    await fetchDataAndCache();
  }, [fetchDataAndCache, toast]);

  const updateSpecialRequests = useCallback(async (requests: SpecialEntryRequest[]) => {
      setData(prev => ({ ...prev, specialRequests: requests }));
      if (navigator.onLine) await updateSpecialRequestsAction(requests);
  }, []);

  const updateStaffList = useCallback(async (staff: string[]) => {
      setData(prev => ({ ...prev, uniqueStaffNames: staff }));
      if (navigator.onLine) await saveStaffListAction(staff);
  }, []);

  const updateLocationList = useCallback(async (locations: string[]) => {
      setData(prev => ({ ...prev, uniqueLocations: locations }));
      if (navigator.onLine) await saveLocationListAction(locations);
  }, []);

  const queueAction = useCallback((action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
      const newAction: OfflineAction = { 
          ...action, 
          id: `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
          timestamp: new Date().toISOString() 
      };
      setPendingActions(prev => [...prev, newAction]);
      if (navigator.onLine) setTimeout(processSyncQueue, 100);
  }, [processSyncQueue]);

  const contextValue = useMemo(() => ({
    ...data,
    isCacheReady,
    isSyncing: isSyncing || isQueueProcessing,
    isOnline,
    pendingActions,
    refreshData,
    updateSpecialRequests,
    updateStaffList,
    updateLocationList,
    queueAction,
    updateInventoryItem: (i: any) => setData(p => ({ 
        ...p, 
        inventoryItems: p.inventoryItems.map(x => x.id === i.id ? { ...x, ...i } : x) 
    })),
    addInventoryItem: (i: any) => setData(p => ({ 
        ...p, 
        inventoryItems: [i, ...p.inventoryItems] 
    })),
    removeInventoryItem: (id: string) => setData(p => ({ 
        ...p, 
        inventoryItems: p.inventoryItems.filter(x => x.id !== id) 
    })),
    removeInventoryItems: (ids: string[]) => setData(p => ({ 
        ...p, 
        inventoryItems: p.inventoryItems.filter(x => !ids.includes(x.id)) 
    })),
    addSupplier: (s: any) => setData(p => ({ ...p, suppliers: [...p.suppliers, s] })),
    updateSupplier: () => { refreshData(); },
    addProduct: (pr: any) => setData(p => ({ ...p, products: [pr, ...p.products] })),
    updateProduct: (pr: any) => {
        setData(p => ({ 
            ...p, 
            products: p.products.map(x => x.barcode === pr.barcode ? { ...x, ...pr } : x),
            inventoryItems: p.inventoryItems.map(item => 
                item.barcode === pr.barcode 
                ? { ...item, productName: pr.productName, supplierName: pr.supplierName } 
                : item
            )
        }));
    },
    removeProducts: (barcodes: string[]) => setData(p => ({ 
        ...p, 
        products: p.products.filter(x => !barcodes.includes(x.barcode)) 
    })),
  }), [data, isCacheReady, isSyncing, isQueueProcessing, isOnline, pendingActions, refreshData, updateSpecialRequests, updateStaffList, updateLocationList, queueAction]);

  return (
    <DataCacheContext.Provider value={contextValue}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) throw new Error('useDataCache must be used within a DataCacheProvider');
  return context;
}
