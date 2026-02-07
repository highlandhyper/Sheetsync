'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  refreshData: () => Promise<void>;
  updateInventoryItem: (item: InventoryItem) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (updatedSupplier: Supplier) => void;
  addProduct: (product: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  addReturnedItem: (item: ReturnedItem) => void;
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
  const [isSyncing, setIsSyncing] = useState(true); // Start true, set to false after initial load/sync
  const [isInitialized, setIsInitialized] = useState(false);

  const isCacheReady = isInitialized;

  const fetchDataAndCache = useCallback(async (isManualSync: boolean, wasAlreadyInitialized: boolean) => {
    setIsSyncing(true);
    if (isManualSync) {
      toast({ title: 'Syncing Data...' });
    }

    try {
      const response = await fetchAllDataAction();
      if (response.success && response.data) {
        const now = Date.now();
        const newData: AppData = { ...response.data, lastSync: now };
        setData(newData);

        try {
          const db = await openDB();
          await setToDB(db, newData);
          db.close();
        } catch (dbError) {
          console.error("Failed to save to IndexedDB:", dbError);
          toast({ title: 'Cache Warning', variant: 'destructive' });
        }

        if (isManualSync) {
          toast({ title: 'Sync Complete' });
        } else if (wasAlreadyInitialized) {
          toast({ title: 'Data Updated' });
        }
      } else {
        if (isManualSync) {
          toast({ title: 'Sync Failed', variant: 'destructive' });
        }
      }
    } catch (fetchError) {
      console.error("DataCacheProvider: An error occurred during fetch", fetchError);
      if (isManualSync) {
        toast({ title: 'Sync Error', variant: 'destructive' });
      }
    } finally {
      setIsSyncing(false);
      // This is the crucial part: mark the app as "initialized" after the very first data-loading attempt.
      if (!wasAlreadyInitialized) {
        setIsInitialized(true);
      }
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      // On logout, clear everything and reset state
      setData({ inventoryItems: [], products: [], suppliers: [], returnedItems: [], uniqueLocations: [], uniqueStaffNames: [], lastSync: null });
      setIsInitialized(false);
      setIsSyncing(true);
      return;
    }

    // This is the main effect that runs once on login
    const initializeApp = async () => {
      let appWasInitialized = false;
      try {
        const db = await openDB();
        const cachedData = await getFromDB(db);
        db.close();
        if (cachedData) {
          setData(cachedData);
          setIsInitialized(true); // App is ready to use with cached data
          appWasInitialized = true;
          console.log("DataCache: Loaded data from IndexedDB cache.");
        }
      } catch (error) {
        console.warn("DataCache: Could not load from IndexedDB.", error);
      }

      // Now, trigger the background sync. It will know if the app was already showing data.
      await fetchDataAndCache(false, appWasInitialized);
    };

    initializeApp();
  }, [user, authLoading, fetchDataAndCache]);

  const manualRefreshData = useCallback(async () => {
    // A manual refresh always happens after the app is initialized.
    await fetchDataAndCache(true, true);
  }, [fetchDataAndCache]);


  // --- Local Data Mutation Helpers ---
  const addInventoryItem = useCallback((item: InventoryItem) => {
    setData(prev => ({
      ...prev,
      inventoryItems: [item, ...prev.inventoryItems],
    }));
  }, []);

  const updateInventoryItem = useCallback((updatedItem: InventoryItem) => {
    setData(prev => ({
      ...prev,
      inventoryItems: prev.inventoryItems.map(item => item.id === updatedItem.id ? updatedItem : item),
    }));
  }, []);

  const removeInventoryItem = useCallback((itemId: string) => {
    setData(prev => ({
      ...prev,
      inventoryItems: prev.inventoryItems.filter(item => item.id !== itemId),
    }));
  }, []);

  const addSupplier = useCallback((supplier: Supplier) => {
    setData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, supplier].sort((a,b) => a.name.localeCompare(b.name)),
    }));
  }, []);

  const updateSupplier = useCallback((updatedSupplier: Supplier) => {
    // This action requires a full refresh because supplier name is denormalized.
    // The calling component (`edit-supplier-dialog`) is responsible for triggering the full `refreshData()`
  }, []);
  
  const addProduct = useCallback((product: Product) => {
      setData(prev => ({
          ...prev,
          products: [product, ...prev.products]
      }));
  }, [])
  
  const updateProduct = useCallback((updatedProduct: Product) => {
      setData(prev => ({
          ...prev,
          products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
      }))
  }, [])

  const addReturnedItem = useCallback((item: ReturnedItem) => {
    setData(prev => ({
      ...prev,
      returnedItems: [item, ...prev.returnedItems],
    }));
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
      data, 
      isCacheReady, 
      isSyncing, 
      manualRefreshData, 
      updateInventoryItem, 
      addInventoryItem, 
      removeInventoryItem, 
      addSupplier, 
      updateSupplier, 
      addProduct, 
      updateProduct, 
      addReturnedItem
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
