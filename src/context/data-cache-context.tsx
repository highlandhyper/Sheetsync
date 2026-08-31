
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
  updateSupplier: (oldName: string, newName: string) => void;
  addProduct: (product: Partial<Product> & { id: string }) => void;
  updateProduct: (updatedProduct: Partial<Product> & { id: string }) => void;
  removeProducts: (barcodes: string[]) => void;
  updateSpecialRequests: (requests: SpecialEntryRequest[]) => Promise<void>;
  updateStaffList: (staff: string[]) => Promise<void>;
  updateLocationList: (locations: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
  queueAction: (action: Omit<OfflineAction, 'id' | 'timestamp'>) => void;
  updateOfflineAction: (id: string, data: any) => void;
  removeOfflineAction: (id: string) => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const SYNC_INTERVAL_MS = 15000; 
const PRODUCT_SYNC_INTERVAL_MS = 900000; 

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
  
  const [data, setData] = useState<AppData>(initialEmptyData);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const isFetchingRef = useRef(false);
  const processingQueueRef = useRef(false);
  const isDbLoadingRef = useRef(false);
  const lastProductSyncRef = useRef<number>(0);
  const syncFailureCountRef = useRef(0);
  
  const isCacheReady = isInitialized;

  useEffect(() => {
    if (isDbLoadingRef.current) return;
    isDbLoadingRef.current = true;

    async function bootstrap() {
      if (typeof window === 'undefined') return;
      setIsOnline(navigator.onLine);
      let metaData = initialEmptyData;
      try {
        const saved = localStorage.getItem(DATA_CACHE_KEY);
        if (saved) metaData = JSON.parse(saved);
      } catch (e) {}

      try {
        const [inventory, logs, products] = await Promise.all([
          getInventory(),
          getAuditLogs(),
          getProducts()
        ]);
        setData({
          ...metaData,
          inventoryItems: inventory || [],
          auditLogs: logs || [],
          products: products || []
        });
      } catch (e) {
        setData(metaData);
      }
      const savedOffline = localStorage.getItem(OFFLINE_KEY);
      if (savedOffline) {
          try { setPendingActions(JSON.parse(savedOffline)); } catch (e) { localStorage.removeItem(OFFLINE_KEY); }
      }
      setIsInitialized(true);
      isDbLoadingRef.current = false;
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const timeout = setTimeout(() => {
      saveInventory(data.inventoryItems);
      saveAuditLogs(data.auditLogs);
      saveProducts(data.products);
      const { inventoryItems, auditLogs, products, ...metaOnly } = data;
      localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(metaOnly));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [data, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(pendingActions));
    }
  }, [pendingActions, isInitialized]);

  const fetchDataAndCache = useCallback(async (forceProducts: boolean = false) => {
    if (isFetchingRef.current || !navigator.onLine || !user) return;
    
    const now = Date.now();
    const shouldSkipProducts = !forceProducts && (now - lastProductSyncRef.current < PRODUCT_SYNC_INTERVAL_MS) && data.products.length > 0;
    
    isFetchingRef.current = true;
    setIsSyncing(true);
    const safetyTimeout = setTimeout(() => { isFetchingRef.current = false; }, 45000);

    try {
      const response = await fetchAllDataAction(shouldSkipProducts);
      if (response.success && response.data) {
        syncFailureCountRef.current = 0;
        if (!shouldSkipProducts) {
            lastProductSyncRef.current = now;
        }
        
        setData(prev => ({ 
            ...prev, 
            ...response.data!, 
            products: response.data!.products && response.data!.products.length > 0 
                ? response.data!.products 
                : prev.products,
            suppliers: response.data!.suppliers && response.data!.suppliers.length > 0 
                ? response.data!.suppliers 
                : prev.suppliers,
            lastSync: now 
        }));
      } else {
          syncFailureCountRef.current++;
          if (syncFailureCountRef.current >= 3) {
              toast({ 
                  variant: "destructive", 
                  title: "Registry Sync Alert", 
                  description: response.message || "Failed to establish industrial handshake with Google Sheets." 
              });
          }
      }
    } catch (e) {
      console.warn("Data Sync Background Error:", e);
    } finally {
      clearTimeout(safetyTimeout);
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, [user, data.products.length, data.suppliers.length, toast]);

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
            break; 
        }
    }

    if (successfullySyncedIds.length > 0) {
        setPendingActions(prev => prev.filter(a => !successfullySyncedIds.includes(a.id)));
        toast({ title: "Queue Synced", description: `${successfullySyncedIds.length} records pushed.` });
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

  useEffect(() => {
    if (!user || !isInitialized) return;
    fetchDataAndCache();
    const interval = setInterval(fetchDataAndCache, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, isInitialized, fetchDataAndCache]);

  const refreshData = useCallback(async () => {
    if (!navigator.onLine) {
        toast({ title: "No Connection", description: "Refresh unavailable while offline.", variant: "destructive" });
        return;
    }
    await fetchDataAndCache(true);
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

  const updateOfflineAction = useCallback((id: string, updatedData: any) => {
    setPendingActions(prev => prev.map(a => a.id === id ? { ...a, data: { ...a.data, ...updatedData } } : a));
    toast({ title: "Action Updated", description: "The pending log has been modified." });
  }, [toast]);

  const removeOfflineAction = useCallback((id: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== id));
    toast({ title: "Action Purged", description: "Transmission canceled." });
  }, [toast]);

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
    updateOfflineAction,
    removeOfflineAction,
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
    updateSupplier: (oldName: string, newName: string) => {
        setData(p => ({
            ...p,
            suppliers: p.suppliers.map(s => s.name === oldName ? { ...s, name: newName } : s),
            products: p.products.map(pr => pr.supplierName === oldName ? { ...pr, supplierName: newName } : pr),
            inventoryItems: p.inventoryItems.map(i => i.supplierName === oldName ? { ...i, supplierName: newName } : i)
        }));
    },
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
  }), [data, isCacheReady, isSyncing, isQueueProcessing, isOnline, pendingActions, refreshData, updateSpecialRequests, updateStaffList, updateLocationList, queueAction, updateOfflineAction, removeOfflineAction]);

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
