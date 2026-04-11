
'use client';
import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

function ManageProductFormSkeleton() {
  return (
    <Card className="w-full max-w-4xl mx-auto shadow-xl">
      <CardHeader className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <Skeleton className="h-10 flex-grow" />
          <Skeleton className="h-10 w-full sm:w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6 border-t">
        <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
        <div className="flex justify-end pt-4">
            <Skeleton className="h-10 w-full sm:w-36" />
        </div>
      </CardContent>
    </Card>
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
