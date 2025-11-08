
'use client';
import { InventoryListClient } from '@/components/inventory/inventory-list-client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { fetchInventoryListDataAction } from '@/app/actions';
import type { InventoryItem, Supplier } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


function InventoryListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border rounded-lg shadow bg-card">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <Skeleton className="h-10 w-full sm:max-w-[200px]" /> {/* Supplier Filter */}
        <Skeleton className="h-10 w-full sm:max-w-[200px]" /> {/* Date Range Filter */}
        <Skeleton className="h-10 w-28" /> {/* Print Button Skeleton */}
      </div>
      <Card className="shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center print-show-table-cell">No.</TableHead>
              <TableHead className="w-auto sm:w-36 text-center noprint">Actions</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell className="text-center print-show-table-cell">
                  <Skeleton className="h-5 w-4 mx-auto" />
                </TableCell>
                <TableCell className="noprint">
                  <div className="flex gap-2 justify-center">
                    <Skeleton className="h-8 w-8" /> <Skeleton className="h-8 w-8" /> <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

interface InventoryPageData {
    inventoryItems: InventoryItem[];
    suppliers: Supplier[];
    uniqueLocations: string[];
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchInventoryListDataAction();
      if (response.success && response.data) {
          setData(response.data);
      } else {
          setError(response.message || "An unknown error occurred while fetching inventory data.");
      }
    } catch (e: any) {
        setError(e.message || "A network error occurred.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <ClipboardList className="mr-3 h-8 w-8" />
        Inventory Overview
      </h1>
      <Suspense fallback={<InventoryListSkeleton />}>
        {isLoading && !data ? ( // Show skeleton only on initial load
          <InventoryListSkeleton />
        ) : error ? (
           <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Inventory</AlertTitle>
                <AlertDescription>
                    {error} <Button variant="link" onClick={loadData}>Try again</Button>
                </AlertDescription>
            </Alert>
        ) : data ? (
          <InventoryListClient 
            initialInventoryItems={data.inventoryItems} 
            suppliers={data.suppliers} 
            uniqueDbLocations={data.uniqueLocations}
            onDataNeeded={loadData} // Pass the loadData function directly
          />
        ) : (
             <InventoryListSkeleton /> // Fallback skeleton
        )}
      </Suspense>
    </div>
  );
}
