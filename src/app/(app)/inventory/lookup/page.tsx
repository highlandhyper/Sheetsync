
'use client';

import { Suspense } from 'react';
import { InventoryBarcodeLookupClient } from '@/components/inventory/inventory-barcode-lookup-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function LookupSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 w-full" /> {/* Search card */}
            <div className="text-center py-12">
                <Search className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">Loading Lookup Tool...</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Please wait a moment.
                </p>
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
