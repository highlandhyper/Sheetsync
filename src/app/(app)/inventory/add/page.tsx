
import { AddInventoryItemForm } from '@/components/inventory/add-inventory-item-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getUniqueLocations, getUniqueStaffNames } from '@/lib/data';

function AddInventoryFormSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-10 w-1/2" /> {/* Title */}
      <Skeleton className="h-6 w-3/4" /> {/* Description */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
         <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex justify-end">
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}


export default async function AddInventoryItemPage() { 
  const [uniqueLocations, uniqueStaffNames] = await Promise.all([
    getUniqueLocations(),
    getUniqueStaffNames()
  ]);
  
  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<AddInventoryFormSkeleton />}>
        <AddInventoryItemForm 
          uniqueLocations={uniqueLocations || []} 
          uniqueStaffNames={uniqueStaffNames || []}
        />
      </Suspense>
    </div>
  );
}
