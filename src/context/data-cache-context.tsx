
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

const CACHE_KEY = 'sheetSyncDataCache';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export function DataCacheProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const { user } = useAuth();
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
      const newData = { ...response.data, lastSync: now };
      setData(newData);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
        toast({ title: 'Sync Complete', description: 'Your local data is now up-to-date.' });
      } catch (error) {
        console.error("Failed to save to localStorage:", error);
        toast({ title: 'Cache Warning', description: 'Could not save data to local cache.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Sync Failed', description: response.message || 'Could not fetch data from the server.', variant: 'destructive' });
    }
    setIsSyncing(false);
  }, [toast]);
  
  useEffect(() => {
    if (!user) { // Don't try to load cache if not logged in
        setIsInitialized(true);
        return;
    };

    const loadCache = () => {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const parsedData: AppData = JSON.parse(cachedData);
          if (parsedData.lastSync && (Date.now() - parsedData.lastSync < CACHE_EXPIRATION_MS)) {
            setData(parsedData);
            setIsInitialized(true);
            return;
          }
        }
      } catch (error) {
        console.error("Failed to load from localStorage:", error);
      }
      // If no valid cache, fetch fresh data
      refreshData().finally(() => setIsInitialized(true));
    };

    loadCache();
  }, [user, refreshData]);

  // --- Local Data Mutation Helpers ---
  const addInventoryItem = (item: InventoryItem) => {
    setData(prev => ({
      ...prev,
      inventoryItems: [item, ...prev.inventoryItems],
    }));
  };

  const updateInventoryItem = (updatedItem: InventoryItem) => {
    setData(prev => ({
      ...prev,
      inventoryItems: prev.inventoryItems.map(item => item.id === updatedItem.id ? updatedItem : item),
    }));
  };

  const removeInventoryItem = (itemId: string) => {
    setData(prev => ({
      ...prev,
      inventoryItems: prev.inventoryItems.filter(item => item.id !== itemId),
    }));
  };

  const addSupplier = (supplier: Supplier) => {
    setData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, supplier].sort((a,b) => a.name.localeCompare(b.name)),
      uniqueStaffNames: [...new Set([...prev.uniqueStaffNames, supplier.name])].sort()
    }));
  };

  const updateSupplier = (updatedSupplier: Supplier) => {
    setData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s),
    }));
  };
  
  const addProduct = (product: Product) => {
      setData(prev => ({
          ...prev,
          products: [product, ...prev.products]
      }));
  }
  
  const updateProduct = (updatedProduct: Product) => {
      setData(prev => ({
          ...prev,
          products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
      }))
  }

  const addReturnedItem = (item: ReturnedItem) => {
    setData(prev => ({
      ...prev,
      returnedItems: [item, ...prev.returnedItems],
    }));
  };

  const contextValue = useMemo(() => ({
    ...data,
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
  }), [data, isCacheReady, isSyncing, refreshData]);

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

    