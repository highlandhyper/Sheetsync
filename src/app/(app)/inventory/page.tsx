
'use client';
import { InventoryListClient } from '@/components/inventory/inventory-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';


function InventoryListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 p-4 border rounded-lg shadow bg-card">
        <Skeleton className="h-10 w-full" /> {/* Search Input */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Skeleton className="h-10 w-full sm:min-w-40 flex-1" /> {/* Supplier Filter */}
            <Skeleton className="h-10 w-full sm:min-w-40 flex-1" /> {/* Type Filter */}
            <Skeleton className="h-10 w-full sm:min-w-48 flex-1" /> {/* Date Range Filter */}
            <div className="flex gap-2 w-full sm:w-auto">
                <Skeleton className="h-10 w-32" /> {/* Export Button */}
                <Skeleton className="h-10 w-24" /> {/* Print Button */}
            </div>
        </div>
      </div>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-24 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

export default function InventoryPage() {
    const { isCacheReady } = useDataCache();

    return (
        <div className="container mx-auto py-2 printable-area">
            <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight noprint">
                <ClipboardList className="mr-3 h-8 w-8" />
                Inventory Overview
            </h1>
            <Suspense fallback={<InventoryListSkeleton />}>
                {!isCacheReady ? (
                    <InventoryListSkeleton />
                ) : (
                    <InventoryListClient />
                )}
            </Suspense>
        </div>
    );
}
