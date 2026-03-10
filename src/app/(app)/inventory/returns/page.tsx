
'use client';
import { ReturnLogListClient } from '@/components/inventory/return-log-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';


function ReturnLogSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow">
        <Skeleton className="h-10 w-full sm:max-w-md" />
      </Card>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4 items-center">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-24 ml-auto" />
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
      <h1 className="text-3xl font-bold mb-8 text-primary">Return Log</h1>
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
