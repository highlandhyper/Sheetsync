'use client';

import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

function ManageProductFormSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl sm:shadow-xl">
      <CardHeader className="space-y-3 p-4 sm:space-y-4 sm:p-6">
        {/* Title */}
        <Skeleton className="h-7 w-[65%] max-w-[280px] sm:h-8 sm:w-1/2" />

        {/* Description */}
        <Skeleton className="h-4 w-[90%] max-w-[480px] sm:w-3/4" />

        {/* Search / action area */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:pt-4">
          <Skeleton className="h-11 w-full flex-1 rounded-xl sm:h-10" />
          <Skeleton className="h-11 w-full rounded-xl sm:h-10 sm:w-24" />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 border-t p-4 sm:space-y-6 sm:p-6">
        {/* Field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
        </div>

        {/* Field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
        </div>

        {/* Two-column fields */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
          </div>
        </div>

        {/* Extra mobile-like fields */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-xl sm:h-10" />
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-border/50 pt-4">
          <div className="flex justify-stretch sm:justify-end">
            <Skeleton className="h-12 w-full rounded-xl sm:h-10 sm:w-36" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManageProductPage() {
  const { suppliers, isCacheReady } = useDataCache();

  return (
    <div className="mx-auto w-full px-2 py-2 sm:px-4 md:px-6 lg:px-8">
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