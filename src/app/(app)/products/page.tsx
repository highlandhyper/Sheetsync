
'use client';
import { ReturnableInventoryByStaffClient } from '@/components/inventory/returnable-inventory-by-staff-client'; 
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';

function ReturnableInventoryByStaffSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Skeleton className="h-10 w-full md:w-[320px]" />
            <div className="flex gap-2 w-full md:w-auto">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
      </Card>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4 items-center">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
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
    <div className="container mx-auto py-2 printable-area">
      <h1 className="text-3xl font-bold mb-8 text-primary noprint">Return Inventory by Staff</h1>
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
