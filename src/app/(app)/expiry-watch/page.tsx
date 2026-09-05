'use client';

import { Suspense } from 'react';
import { ExpiryWatchClient } from '@/components/expiry/expiry-watch-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, ClipboardPlus } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
       <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-2">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
                    <Eye className="mr-3 h-6 w-6 sm:h-8 sm:w-8 text-primary" strokeWidth={3} />
                    Diary Reminder
                </h1>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] ml-1 opacity-40">Industrial Observation Terminal</p>
            </div>
            <Button asChild className="h-11 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hidden sm:flex">
                <Link href="/expiry-watch/add">
                    <ClipboardPlus className="mr-2 h-4 w-4" /> Log New Entry
                </Link>
            </Button>
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
