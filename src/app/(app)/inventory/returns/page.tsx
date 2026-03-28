'use client';

import { Suspense } from 'react';
import { ReturnLogListClient } from '@/components/inventory/return-log-list-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { History } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function ReturnLogSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <Skeleton className="h-10 w-full" />
      </Card>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4 items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

export default function ReturnLogPage() {
    const { isCacheReady } = useDataCache();

    return (
        <div className="container mx-auto py-2">
            <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
                <History className="mr-3 h-8 w-8" />
                Return History
            </h1>
            <Suspense fallback={<ReturnLogSkeleton />}>
                {isCacheReady ? (
                    <ReturnLogListClient />
                ) : (
                    <ReturnLogSkeleton />
                )}
            </Suspense>
        </div>
    );
}
