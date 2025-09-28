

import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSuppliers } from '@/lib/data';
import type { Supplier } from '@/lib/types';
import { redirect } from 'next/navigation';

// This page is now replaced by /products/list and /suppliers
export default function ManageProductPageRedirect() {
    redirect('/products/list');
}

/*
// This is the old code, which you can restore if you want to go back to the combined manage page.
export default async function ManageProductPage() { 
  const allSuppliers: Supplier[] = await getSuppliers() || [];
  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<ManageProductFormSkeleton />}>
        <EditOrCreateProductForm allSuppliers={allSuppliers} />
      </Suspense>
    </div>
  );
}

function ManageProductFormSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-6 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-grow" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      
      <div className="space-y-6">
        <Skeleton className="h-6 w-1/3" />
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
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex justify-end">
            <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

export const revalidate = 0;
*/
