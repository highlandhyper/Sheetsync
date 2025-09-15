import { AddInventoryItemStepperForm } from '@/components/inventory/add-inventory-item-stepper-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getUniqueLocations, getUniqueStaffNames } from '@/lib/data';

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


export default async function AddInventoryItemPage() { 
  const [uniqueLocations, uniqueStaffNames] = await Promise.all([
    getUniqueLocations(),
    getUniqueStaffNames()
  ]);
  
  return (
    <div className="container mx-auto py-2 p-4 md:p-6 lg:p-8">
      <Suspense fallback={<AddInventoryFormSkeleton />}>
        <AddInventoryItemStepperForm
          uniqueLocations={uniqueLocations || []} 
          uniqueStaffNames={uniqueStaffNames || []}
        />
      </Suspense>
    </div>
  );
}
