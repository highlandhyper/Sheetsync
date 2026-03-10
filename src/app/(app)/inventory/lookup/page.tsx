
'use client';

import { Suspense } from 'react';
import { InventoryBarcodeLookupClient } from '@/components/inventory/inventory-barcode-lookup-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { Card } from '@/components/ui/card';

function LookupSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="p-4 shadow-md">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Skeleton className="h-10 flex-grow" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </Card>
            <div className="text-center py-12 space-y-4">
                <Skeleton className="mx-auto h-16 w-16 rounded-full" />
                <Skeleton className="mx-auto h-6 w-48" />
                <Skeleton className="mx-auto h-4 w-64" />
            </div>
        </div>
    );
}

export default function InventoryLogLookupPage() {
  const { uniqueLocations, isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
       <h1 className="text-3xl font-bold mb-8 text-primary">Barcode Log Lookup</h1>
      <Suspense fallback={<LookupSkeleton />}>
        {isCacheReady ? (
            <InventoryBarcodeLookupClient uniqueLocations={uniqueLocations} />
        ) : (
            <LookupSkeleton />
        )}
      </Suspense>
    </div>
  );
}
