
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction, updateSpecialRequestsAction, saveStaffListAction, saveLocationListAction, addInventoryItemAction, returnInventoryItemAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, AuditLogEntry, SpecialEntryRequest, OfflineAction } from '@/lib/types';
import { useAuth } from './auth-context';

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

const SYNC_INTERVAL_MS = 45000; // Increased interval for 54k row catalog stability
const OFFLINE_KEY = 'sheetSync_offlineActions';

export function DataCacheProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [data, setData] = useState<AppData>({
    inventoryItems: [],
    products: [],
    suppliers: [],
    uniqueLocations: [],
    uniqueStaffNames: [],
    auditLogs: [],
    specialRequests: [],
    lastSync: null,
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  
  const isFetchingRef = useRef(false);
  const processingQueueRef = useRef(false);
  const isCacheReady = data.lastSync !== null;

  // Persistence: Load queue from LocalStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const saved = localStorage.getItem(OFFLINE_KEY);
      if (saved) {
        try {
          setPendingActions(JSON.parse(saved));
        } catch (e) {
          localStorage.removeItem(OFFLINE_KEY);
        }
      }
    }
  }, []);

  // Persistence: Save queue whenever it changes
  useEffect(() => {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  const fetchDataAndCache = useCallback(async () => {
    if (isFetchingRef.current || !navigator.onLine || !user) return;
    isFetchingRef.current = true;
    setIsSyncing(true);

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

            if (success) {
                successfullySyncedIds.push(action.id);
            } else {
                // If specific action fails, we mark it but keep processing the rest
                console.warn(`Sync: Action ${action.id} rejected by server.`);
            }
        } catch (e) {
            console.error(`Sync: Action ${action.id} execution error.`, e);
            break; // Stop loop on connection/timeout error
        }
    }

    if (successfullySyncedIds.length > 0) {
        setPendingActions(prev => prev.filter(a => !successfullySyncedIds.includes(a.id)));
        toast({ 
            title: "Sync Complete", 
            description: `Successfully synchronized ${successfullySyncedIds.length} records with Google Sheets.` 
        });
        // Trigger a fresh fetch to ensure UI is in absolute sync
        fetchDataAndCache();
    }

    setIsQueueProcessing(false);
    processingQueueRef.current = false;
  }, [pendingActions, toast, fetchDataAndCache]);

  // Online/Offline Listeners
  useEffect(() => {
    const handleOnline = () => { 
        setIsOnline(true); 
        processSyncQueue(); 
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Auto-trigger queue processing if online and items exist
    if (navigator.onLine && pendingActions.length > 0) {
        processSyncQueue();
    }

    return () => { 
        window.removeEventListener('online', handleOnline); 
        window.removeEventListener('offline', handleOffline); 
    };
  }, [processSyncQueue, pendingActions.length]);

  // Initial Data Load & Heartbeat Sync
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData({ inventoryItems: [], products: [], suppliers: [], uniqueLocations: [], uniqueStaffNames: [], auditLogs: [], specialRequests: [], lastSync: null });
      return;
    }
    
    fetchDataAndCache();
    const interval = setInterval(fetchDataAndCache, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, authLoading, fetchDataAndCache]);

  const refreshData = useCallback(async () => {
    if (!navigator.onLine) {
        toast({ title: "Offline", description: "Cannot refresh while disconnected.", variant: "destructive" });
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
      // Attempt immediate sync if online
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
    updateSupplier: (s: any) => {
        // Renaming a supplier is a heavy operation, so we force a refresh to be safe
        refreshData();
    },
    addProduct: (pr: any) => setData(p => ({ ...p, products: [pr, ...p.products] })),
    updateProduct: (pr: any) => {
        setData(p => ({ 
            ...p, 
            products: p.products.map(x => x.id === pr.id ? { ...x, ...pr } : x),
            // PROACTIVE SYNC: Update the name/supplier in local inventory logs immediately
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
