'use client';

import { Suspense } from 'react';
import { Package } from 'lucide-react';

import { ProductListClient } from '@/components/products/product-list-client';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-muted/20 p-3 sm:p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11" />

        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-[78%] rounded-md" />
          <Skeleton className="h-3 w-[52%] rounded-md" />
        </div>
      </div>

      <div className="mt-3">
        <Skeleton className="h-[26px] w-full rounded-lg" />
      </div>
    </div>
  );
}

function ProductListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3 px-2 pb-8 sm:space-y-4 sm:px-3 lg:px-4">
      {/* Toolbar skeleton */}
      <div className="rounded-2xl bg-muted/20 p-2.5 sm:p-3">
        <div className="space-y-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-11 min-w-0 flex-1 rounded-xl sm:h-12" />

            <div className="hidden shrink-0 gap-1 rounded-xl bg-background/70 p-1 md:flex">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:justify-end">
            <Skeleton className="h-10 w-full rounded-xl md:h-11 md:w-[190px]" />
            <Skeleton className="h-10 w-24 rounded-xl md:h-11 md:w-32" />
          </div>

          <div className="flex items-center justify-between px-0.5">
            <Skeleton className="h-3 w-32 rounded-md sm:w-44" />
            <Skeleton className="h-6 w-14 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Product card skeletons */}
      <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export default function ProductsListPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="w-full py-1 sm:py-2">
      {/* Page heading */}
      <div className="mx-auto mb-3 flex w-full max-w-[1600px] items-center gap-3 px-3 sm:mb-4 sm:px-4 lg:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
          <Package className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Product Catalog
          </h1>

          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            Search and manage your product registry
          </p>
        </div>
      </div>

      <Suspense fallback={<ProductListSkeleton />}>
        {isCacheReady ? (
          <ProductListClient />
        ) : (
          <ProductListSkeleton />
        )}
      </Suspense>
    </div>
  );
}
