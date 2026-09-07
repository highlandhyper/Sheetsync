'use client';

import ReturnableInventoryByStaffClient from '@/components/inventory/returnable-inventory-by-staff-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';

function ReturnableInventoryByStaffSkeleton() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-none space-y-3 overflow-x-hidden px-3 sm:space-y-4 sm:px-4 md:px-5 lg:px-4 xl:px-5 2xl:px-6">
      <Card className="w-full min-w-0 overflow-hidden rounded-2xl border-0 p-3 shadow-none ring-1 ring-border/50 sm:p-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <Skeleton className="h-11 w-full rounded-xl md:max-w-[320px]" />

          <div className="grid min-w-0 grid-cols-2 gap-2 md:flex md:w-auto">
            <Skeleton className="h-10 w-full rounded-xl md:w-32" />
            <Skeleton className="h-10 w-full rounded-xl md:w-24" />
          </div>
        </div>
      </Card>

      <div className="grid min-w-0 gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={index}
            className="w-full min-w-0 overflow-hidden rounded-2xl border-0 shadow-none ring-1 ring-border/50"
          >
            <div className="space-y-3 p-3">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />

              <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-2">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl max-[360px]:col-span-2" />
              </div>

              <Skeleton className="h-10 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden rounded-2xl border-0 shadow-none ring-1 ring-border/50 md:block">
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 p-4">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="ml-auto h-5 w-16" />
              <Skeleton className="ml-auto h-5 w-20" />
              <Skeleton className="ml-auto h-5 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function ReturnByStaffPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="printable-area mx-auto w-full min-w-0 max-w-[1900px] overflow-x-hidden py-1 sm:py-2">
      <div className="noprint mb-3 min-w-0 px-3 sm:mb-5 sm:px-4 md:px-5 lg:px-4 xl:px-5 2xl:px-6">
        <h1 className="truncate text-xl font-black uppercase leading-none tracking-tighter text-primary sm:text-3xl">
          Return Inventory by Staff
        </h1>

        <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px] sm:tracking-[0.22em]">
          Personnel Audit & Return Protocol
        </p>
      </div>

      <Suspense fallback={<ReturnableInventoryByStaffSkeleton />}>
        {!isCacheReady ? (
          <ReturnableInventoryByStaffSkeleton />
        ) : (
          <ReturnableInventoryByStaffClient />
        )}
      </Suspense>
    </div>
  );
}
