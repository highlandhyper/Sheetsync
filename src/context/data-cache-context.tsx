
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
const CACHE_KEY = 'sheetSyncDataCache'; // This key is used inside the object store
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

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
  const [isInitialized, setIsInitialized] = useState(false);

  const isCacheReady = isInitialized && !isSyncing;

  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    toast({ title: 'Syncing Data...', description: 'Fetching the latest data from Google Sheets.' });

    const response = await fetchAllDataAction();

    if (response.success && response.data) {
      const now = Date.now();
      const newData: AppData = { ...response.data, lastSync: now };
      setData(newData);
      try {
        const db = await openDB();
        await setToDB(db, newData);
        db.close();
        toast({ title: 'Sync Complete', description: 'Your local data is now up-to-date.' });
      } catch (error) {
        console.error("Failed to save to IndexedDB:", error);
        toast({ title: 'Cache Warning', description: 'Could not save data to the local browser database.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Sync Failed', description: response.message || 'Could not fetch data from the server.', variant: 'destructive' });
    }
    setIsSyncing(false);
  }, [toast]);
  
  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) {
        setIsInitialized(true); // If not loading and no user, we are "initialized" with no data.
      }
      return;
    }

    const loadCache = async () => {
      try {
        const db = await openDB();
        const cachedData = await getFromDB(db);
        db.close();

        const now = Date.now();
        if (cachedData && cachedData.lastSync && (now - cachedData.lastSync < CACHE_EXPIRATION_MS)) {
          setData(cachedData);
          setIsInitialized(true);
        } else {
          // If cache is stale or doesn't exist, fetch fresh data
          await refreshData();
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Failed to load from IndexedDB, fetching fresh data:", error);
        await refreshData();
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      loadCache();
    }
  }, [user, authLoading, isInitialized, refreshData]);

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
      uniqueStaffNames: [...new Set([...prev.uniqueStaffNames, supplier.name])].sort()
    }));
  }, []);

  const updateSupplier = useCallback((updatedSupplier: Supplier) => {
    setData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s),
    }));
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
    refreshData,
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
      refreshData, 
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

    