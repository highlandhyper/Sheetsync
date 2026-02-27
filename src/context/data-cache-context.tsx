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

const SYNC_INTERVAL_MS = 600000; // Background sync every 10 minutes

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
  const isFetchingRef = useRef(false);
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
        
        setData(newData);
        isInitializedRef.current = true;

        if (isBackgroundUpdate) {
          toast({ 
            title: 'Sync Complete', 
            description: `Last synced: ${new Date().toLocaleTimeString()}`
          });
        }
      }
    } catch (fetchError) {
      console.error("DataCacheProvider: An error occurred during fetch", fetchError);
    } finally {
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, [toast]);

  // Initial Load & Hard Refresh Tip
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData({ inventoryItems: [], products: [], suppliers: [], returnedItems: [], uniqueLocations: [], uniqueStaffNames: [], auditLogs: [], lastSync: null });
      isInitializedRef.current = false;
      return;
    }
    if (!isInitializedRef.current) {
        fetchDataAndCache(false);
        // Hint for hard refresh to bypass initial sync issues
        setTimeout(() => {
          toast({
            title: "Data Tip",
            description: "If data looks outdated, use Ctrl+R (or Cmd+R) for a hard refresh.",
          });
        }, 3000);
    }
  }, [user, authLoading, fetchDataAndCache, toast]);

  // Background Polling & Visibility Sync
  useEffect(() => {
    if (!user || authLoading) return;

    const handleDataRefresh = () => {
        if (document.visibilityState === 'visible') {
            fetchDataAndCache(true);
        }
    };

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !isSyncing) {
        fetchDataAndCache(true);
      }
    }, SYNC_INTERVAL_MS);

    window.addEventListener('focus', handleDataRefresh);
    window.addEventListener('visibilitychange', handleDataRefresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleDataRefresh);
      window.removeEventListener('visibilitychange', handleDataRefresh);
    };
  }, [user, authLoading, fetchDataAndCache, isSyncing]);

  const manualRefreshData = useCallback(async () => {
    toast({ title: 'Syncing Data...', description: 'Refreshing from Google Sheets.' });
    await fetchDataAndCache(true);
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