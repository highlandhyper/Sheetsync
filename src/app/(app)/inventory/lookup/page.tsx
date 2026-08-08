'use client';

import { Suspense } from 'react';
import { InventoryBarcodeLookupClient } from '@/components/inventory/inventory-barcode-lookup-client';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchCode } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { Card } from '@/components/ui/card';

function LookupSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="p-6 shadow-xl border-white/10 bg-card/60 backdrop-blur-xl rounded-2xl">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Skeleton className="h-14 flex-grow rounded-2xl" />
                    <Skeleton className="h-14 w-full sm:w-32 rounded-2xl" />
                    <Skeleton className="h-14 w-full sm:w-40 rounded-2xl" />
                </div>
            </Card>
            <div className="space-y-4 pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

export default function InventoryLogLookupPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
       <div className="flex flex-col mb-8 gap-2">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
                <SearchCode className="mr-3 h-8 w-8 text-primary" strokeWidth={3} />
                Asset Identifier
            </h1>
       </div>

      <Suspense fallback={<LookupSkeleton />}>
        {isCacheReady ? (
            <InventoryBarcodeLookupClient />
        ) : (
            <LookupSkeleton />
        )}
      </Suspense>
    </div>
  );
}
