'use client';

import { Suspense } from 'react';
import { Boxes } from 'lucide-react';

import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';

function ProductsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-[520px] w-full rounded-xl" />
    </div>
  );
}

function ProductsWorkspace() {
  const { suppliers, isCacheReady } = useDataCache();

  if (!isCacheReady) return <ProductsSkeleton />;

  return (
    <main className="min-h-full w-full pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <header className="border-b border-border/70 pb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Boxes className="h-4 w-4" />
            <span>Inventory</span>
            <span className="text-border">/</span>
            <span className="text-foreground">Products</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Products
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Enter a barcode or search by product name to create, find, edit, or delete a product.
          </p>
        </header>

        <EditOrCreateProductForm allSuppliers={suppliers} />
      </div>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsWorkspace />
    </Suspense>
  );
}
