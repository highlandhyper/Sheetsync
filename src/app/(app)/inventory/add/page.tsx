
'use client';
import { AddInventoryItemStepperForm } from '@/components/inventory/add-inventory-item-stepper-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';

function AddInventoryFormSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-10 w-1/2" /> {/* Title */}
      <Skeleton className="h-6 w-3/4" /> {/* Description */}
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="flex justify-end">
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}


export default function AddInventoryItemPage() { 
  const { uniqueLocations, uniqueStaffNames, isCacheReady } = useDataCache();
  
  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<AddInventoryFormSkeleton />}>
        {isCacheReady ? (
          <AddInventoryItemStepperForm
            uniqueLocations={uniqueLocations} 
            uniqueStaffNames={uniqueStaffNames}
          />
        ) : (
          <AddInventoryFormSkeleton />
        )}
      </Suspense>
    </div>
  );
}

    