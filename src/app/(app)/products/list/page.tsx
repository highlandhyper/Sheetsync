
'use client';
import { ProductListClient } from '@/components/products/product-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function ProductListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-full sm:w-[180px]" />
            <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card className="w-full flex flex-col h-full" key={index}>
              <div className="p-6 pb-2 space-y-4">
                <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
              </div>
              <div className="px-6 pt-2 pb-6 flex-grow">
                 <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
    </div>
  );
}


export default function ProductsListPage() { 
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
       <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <Package className="mr-3 h-8 w-8" />
        Product Catalog
      </h1>
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
