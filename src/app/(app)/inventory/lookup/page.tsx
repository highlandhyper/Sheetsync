'use client';

import { Suspense } from 'react';
import { InventoryBarcodeLookupClient } from '@/components/inventory/inventory-barcode-lookup-client';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchCode, Activity, Network } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { Card } from '@/components/ui/card';

function LookupSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="p-6 shadow-xl border-white/10 bg-card/60 backdrop-blur-xl rounded-2xl">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Skeleton className="h-14 flex-grow rounded-xl" />
                    <Skeleton className="h-14 w-full sm:w-32 rounded-xl" />
                    <Skeleton className="h-14 w-full sm:w-40 rounded-xl" />
                </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
            </div>
            <div className="space-y-4 pt-8">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        </div>
    );
}

export default function InventoryLogLookupPage() {
  const { uniqueLocations, isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
       <div className="flex flex-col mb-8 gap-2">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
                <SearchCode className="mr-3 h-8 w-8 text-primary" strokeWidth={3} />
                Asset Identifier
            </h1>
            <div className="flex flex-wrap items-center gap-3">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                    <Activity className="h-3 w-3 animate-pulse" /> Registry Sync: Active
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-muted-foreground/10 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                    <Network className="h-3 w-3" /> Industrial Protocol v4.1
                </div>
            </div>
       </div>

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
