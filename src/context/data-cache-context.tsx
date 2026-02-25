
'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, ReturnedItem, AuditLogEntry } from '@/lib/types';
import { useAuth } from './auth-context';

interface AppData {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  lastSync: number | null;
}

interface DataCacheContextType {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  auditLogs: AuditLogEntry[];
  isCacheReady: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  updateInventoryItem: (item: InventoryItem) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (updatedSupplier: Supplier) => void;
  addProduct: (product: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  addReturnedItem: (item: ReturnedItem) => void;
  refreshData: () => Promise<void>;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const DB_NAME = 'SheetSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'appDataCache';
const CACHE_KEY = 'sheetSyncDataCache';

// --- IndexedDB Helper Functions ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getFromDB(db: IDBDatabase): Promise<AppData | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(CACHE_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

async function setToDB(db: IDBDatabase, data: AppData): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, CACHE_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}


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
    lastSync: null,
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitializedRef = useRef(false);
  const isFetchingRef = useRef(false); // Ref to prevent concurrent fetches
  const isCacheReady = data.lastSync !== null;

  const fetchDataAndCache = useCallback(async (isBackgroundUpdate: boolean) => {
    if (isFetchingRef.current) {
        return;
    }
    isFetchingRef.current = true;
    setIsSyncing(true);

    try {
      const response = await fetchAllDataAction();
      if (response.success && response.data) {
        const now = Date.now();
        const newData: AppData = { ...response.data, lastSync: now };
        
        // Only show toast on background updates, not the initial load.
        if (isBackgroundUpdate && isInitializedRef.current) {
             toast({ title: 'Data Synced' });
        }
        
        setData(newData);

        isInitializedRef.current = true;

        try {
          const db = await openDB();
          await setToDB(db, newData);
          db.close();
        } catch (dbError) {
          console.error("Failed to save to IndexedDB:", dbError);
          toast({ title: 'Cache Write Warning', variant: 'destructive' });
        }
      } else {
        console.warn("DataCache: Fetch all data action failed.", response.message);
      }
    } catch (fetchError) {
      console.error("DataCacheProvider: An error occurred during fetch", fetchError);
    } finally {
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Clear data and state on logout
      setData({ inventoryItems: [], products: [], suppliers: [], returnedItems: [], uniqueLocations: [], uniqueStaffNames: [], auditLogs: [], lastSync: null });
      isInitializedRef.current = false;
      return;
    }

    // This check ensures we only run the initial, non-background fetch once per app load.
    // isInitializedRef is set to true inside fetchDataAndCache upon success.
    if (!isInitializedRef.current) {
        fetchDataAndCache(false);
    }
    
    const handleDataRefresh = () => {
        // The visibility check prevents fetching data when the tab is in the background.
        if (document.visibilityState === 'visible') {
            fetchDataAndCache(true);
        }
    };

    window.addEventListener('focus', handleDataRefresh);
    window.addEventListener('visibilitychange', handleDataRefresh);

    return () => {
      window.removeEventListener('focus', handleDataRefresh);
      window.removeEventListener('visibilitychange', handleDataRefresh);
    };
  }, [user, authLoading, fetchDataAndCache]);

  const manualRefreshData = useCallback(async () => {
    toast({ title: 'Syncing Data...' });
    await fetchDataAndCache(true);
    toast({ title: 'Sync Complete' });
  }, [fetchDataAndCache, toast]);

  const addInventoryItem = useCallback((item: InventoryItem) => {
    setData(prev => ({ ...prev, inventoryItems: [item, ...prev.inventoryItems] }));
  }, []);

  const updateInventoryItem = useCallback((updatedItem: InventoryItem) => {
    setData(prev => ({ ...prev, inventoryItems: prev.inventoryItems.map(item => item.id === updatedItem.id ? updatedItem : item) }));
  }, []);

  const removeInventoryItem = useCallback((itemId: string) => {
    setData(prev => ({ ...prev, inventoryItems: prev.inventoryItems.filter(item => item.id !== itemId) }));
  }, []);

  const addSupplier = useCallback((supplier: Supplier) => {
    setData(prev => ({ ...prev, suppliers: [...prev.suppliers, supplier].sort((a,b) => a.name.localeCompare(b.name)) }));
  }, []);

  const updateSupplier = useCallback((updatedSupplier: Supplier) => {
    manualRefreshData();
  }, [manualRefreshData]);
  
  const addProduct = useCallback((product: Product) => {
      setData(prev => ({ ...prev, products: [product, ...prev.products] }));
  }, [])
  
  const updateProduct = useCallback((updatedProduct: Product) => {
      setData(prev => ({ ...prev, products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p) }));
  }, [])

  const addReturnedItem = useCallback((item: ReturnedItem) => {
    setData(prev => ({ ...prev, returnedItems: [item, ...prev.returnedItems] }));
  }, []);

  const contextValue = useMemo(() => ({
    inventoryItems: data.inventoryItems,
    products: data.products,
    suppliers: data.suppliers,
    returnedItems: data.returnedItems,
    uniqueLocations: data.uniqueLocations,
    uniqueStaffNames: data.uniqueStaffNames,
    auditLogs: data.auditLogs,
    isCacheReady,
    isSyncing,
    lastSync: data.lastSync,
    refreshData: manualRefreshData,
    updateInventoryItem,
    addInventoryItem,
    removeInventoryItem,
    addSupplier,
    updateSupplier,
    addProduct,
    updateProduct,
    addReturnedItem,
  }), [
      data, isCacheReady, isSyncing, manualRefreshData, updateInventoryItem, addInventoryItem, 
      removeInventoryItem, addSupplier, updateSupplier, addProduct, updateProduct, addReturnedItem
  ]);

  return (
    <DataCacheContext.Provider value={contextValue}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}
    

    