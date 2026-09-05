'use client';

import { Suspense } from 'react';
import { ExpiryWatchClient } from '@/components/expiry/expiry-watch-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function ExpiryWatchSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                ))}
            </div>
            <div className="space-y-4 pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

export default function ExpiryWatchPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
       <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
                    <Eye className="mr-3 h-6 w-6 sm:h-8 sm:w-8 text-primary" strokeWidth={3} />
                    Expiry Watch
                </h1>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] ml-1 opacity-40">Systematic Long-Term Tracking</p>
            </div>
       </div>

      <Suspense fallback={<ExpiryWatchSkeleton />}>
        {isCacheReady ? (
            <ExpiryWatchClient />
        ) : (
            <ExpiryWatchSkeleton />
        )}
      </Suspense>
    </div>
  );
}
