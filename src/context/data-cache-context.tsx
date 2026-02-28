'use client';

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllDataAction, updateSpecialRequestsAction, saveStaffListAction } from '@/app/actions';
import type { Product, Supplier, InventoryItem, ReturnedItem, AuditLogEntry, SpecialEntryRequest } from '@/lib/types';
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
  updateInventoryItem: (item: InventoryItem) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (updatedSupplier: Supplier) => void;
  addProduct: (product: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  addReturnedItem: (item: ReturnedItem) => void;
  updateSpecialRequests: (requests: SpecialEntryRequest[]) => Promise<void>;
  updateStaffList: (staff: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const SYNC_INTERVAL_MS = 30000; // Poll every 30 seconds for real-time requests

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
  const isFetchingRef = useRef(false);
  const isCacheReady = data.lastSync !== null;

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
          toast({ title: 'Success', description: 'Staff list updated successfully.' });
      } else {
          toast({ title: 'Error', description: response.message || 'Failed to update staff list.', variant: 'destructive' });
      }
  }, [toast]);

  const value = useMemo(() => ({
    ...data,
    isCacheReady,
    isSyncing,
    refreshData,
    updateSpecialRequests,
    updateStaffList,
    updateInventoryItem: (i: any) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.map(x => x.id === i.id ? i : x) })),
    addInventoryItem: (i: any) => setData(p => ({ ...p, inventoryItems: [i, ...p.inventoryItems] })),
    removeInventoryItem: (id: string) => setData(p => ({ ...p, inventoryItems: p.inventoryItems.filter(x => x.id !== id) })),
    addSupplier: (s: any) => setData(p => ({ ...p, suppliers: [...p.suppliers, s] })),
    updateSupplier: (s: any) => refreshData(),
    addProduct: (pr: any) => setData(p => ({ ...p, products: [pr, ...p.products] })),
    updateProduct: (pr: any) => setData(p => ({ ...p, products: p.products.map(x => x.id === pr.id ? pr : x) })),
    addReturnedItem: (r: any) => setData(p => ({ ...p, returnedItems: [r, ...p.returnedItems] })),
  }), [data, isCacheReady, isSyncing, refreshData, updateSpecialRequests, updateStaffList]);

  return (
    <DataCacheContext.Provider value={{...value, uniqueStaffNames: data.uniqueStaffNames}}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) throw new Error('useDataCache must be used within a DataCacheProvider');
  return context;
}
