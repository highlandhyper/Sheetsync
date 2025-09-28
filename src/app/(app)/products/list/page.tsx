

import { ProductListClient } from '@/components/products/product-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';

function ProductListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-full sm:w-[180px]" /> {/* Sort Select */}
            <Skeleton className="h-10 w-44" /> {/* Add Product Button */}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card className="w-full" key={index}>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-14 w-14 rounded-md" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                </div>
                 <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
    </div>
  );
}


export default function ProductsListPage() { 
  return (
    <div className="container mx-auto py-2">
       <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <Package className="mr-3 h-8 w-8" />
        Product Catalog
      </h1>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductListClient />
      </Suspense>
    </div>
  );
}

export const revalidate = 0; // Revalidate on every request
