'use client';

import { ReturnableInventoryByStaffClient } from '@/components/inventory/returnable-inventory-by-staff-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';

function ReturnableInventoryByStaffSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters / actions */}
      <Card className="rounded-2xl p-3 shadow-sm sm:p-4 sm:shadow-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <Skeleton className="h-10 w-full md:w-[320px]" />

          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
            <Skeleton className="h-10 w-full md:w-32" />
            <Skeleton className="h-10 w-full md:w-24" />
          </div>
        </div>
      </Card>

      {/* Mobile skeleton */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card
            key={index}
            className="rounded-2xl p-4 shadow-sm"
          >
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/4" />

              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop / tablet skeleton */}
      <Card className="hidden overflow-hidden rounded-2xl shadow-md md:block">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4"
            >
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
    <div className="printable-area mx-auto w-full max-w-full lg:max-w-[1700px] px-0 py-1 sm:py-2">
      <div className="noprint mb-4 sm:mb-8 px-2 sm:px-0">
        <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tighter text-primary truncate leading-none">
          Return Inventory by Staff
        </h1>

        <p className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-40">
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
