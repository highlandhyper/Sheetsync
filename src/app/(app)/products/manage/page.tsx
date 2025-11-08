
'use client';
import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';

function ManageProductFormSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Search Section Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-1/2" /> {/* Title */}
        <Skeleton className="h-6 w-3/4" /> {/* Description */}
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-grow" /> {/* Barcode Input */}
          <Skeleton className="h-10 w-24" /> {/* Search Button */}
        </div>
      </div>
      
      {/* Form Section Skeleton (conditionally shown after search) */}
      <div className="space-y-6">
        <Skeleton className="h-6 w-1/3" /> {/* Form Sub-Title or Status */}
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" /> {/* Supplier Field Skeleton */}
        </div>
        <div className="flex justify-end">
            <Skeleton className="h-10 w-32" /> {/* Submit Button */}
        </div>
      </div>
    </div>
  );
}


export default function ManageProductPage() { 
  const { suppliers, isCacheReady } = useDataCache();
  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<ManageProductFormSkeleton />}>
        {isCacheReady ? (
          <EditOrCreateProductForm allSuppliers={suppliers} />
        ) : (
          <ManageProductFormSkeleton />
        )}
      </Suspense>
    </div>
  );
}

    