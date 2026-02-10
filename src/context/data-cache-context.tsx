'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, ReturnedItem } from '@/lib/types';
import { useAuth } from './auth-context';

interface AppData {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  lastSync: number | null;
}

interface DataCacheContextType {
  inventoryItems: InventoryItem[];
  products: Product[];
  suppliers: Supplier[];
  returnedItems: ReturnedItem[];
  uniqueLocations: string[];
  uniqueStaffNames: string[];
  isCacheReady: boolean;
  isSyncing: boolean;
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
    lastSync: null,
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitializedRef = useRef(false);
  const isCacheReady = data.lastSync !== null;

  const fetchDataAndCache = useCallback(async (isBackgroundUpdate: boolean) => {
    if (isSyncing) {
        return;
    }
    setIsSyncing(true);

    try {
      const response = await fetchAllDataAction();
      if (response.success && response.data) {
        const now = Date.now();
        const newData: AppData = { ...response.data, lastSync: now };
        
        let shouldToast = false;
        setData(prevData => {
            const hasChanges = JSON.stringify(prevData.inventoryItems) !== JSON.stringify(newData.inventoryItems) ||
                JSON.stringify(prevData.products) !== JSON.stringify(newData.products) ||
                JSON.stringify(prevData.suppliers) !== JSON.stringify(newData.suppliers) ||
                JSON.stringify(prevData.returnedItems) !== JSON.stringify(newData.returnedItems);

            if (hasChanges) {
                 if (isBackgroundUpdate && isInitializedRef.current) {
                    shouldToast = true;
                }
                return newData;
            }
            return { ...prevData, lastSync: now };
        });

        if (shouldToast) {
            toast({ title: 'Data Updated' });
        }


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
    }
  }, [toast, isSyncing]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setData({ inventoryItems: [], products: [], suppliers: [], returnedItems: [], uniqueLocations: [], uniqueStaffNames: [], lastSync: null });
      isInitializedRef.current = false;
      return;
    }
    
    let isMounted = true;

    const initialize = async () => {
      try {
        const db = await openDB();
        const cachedData = await getFromDB(db);
        db.close();
        if (isMounted && cachedData) {
          setData(cachedData);
        }
      } catch (error) {
        console.warn("DataCache: Could not load from IndexedDB.", error);
      }
      
      await fetchDataAndCache(false);
    };

    initialize();

    const handleFocus = () => {
      fetchDataAndCache(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            handleFocus();
        }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
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
    isCacheReady,
    isSyncing,
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
    