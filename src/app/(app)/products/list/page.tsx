'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Boxes, PackagePlus, ScanBarcode } from 'lucide-react';

import { ProductListClient } from '@/components/products/product-list-client';
import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';
import { cn } from '@/lib/utils';

type ProductsView = 'create' | 'catalog';

function ProductsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Skeleton className="h-[520px] rounded-xl" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    </div>
  );
}

function ProductManagementContent() {
  const { suppliers, isCacheReady } = useDataCache();

  if (!isCacheReady) return <ProductsSkeleton />;

  return <EditOrCreateProductForm allSuppliers={suppliers} />;
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<ProductsView>(() =>
    searchParams.get('tab') === 'catalog' ? 'catalog' : 'create',
  );

  return (
    <main className="min-h-full w-full pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pt-5 sm:space-y-7 sm:px-6 sm:pt-7 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end">
          <div className="min-w-0">
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
              Create and maintain product records, or browse the full catalogue.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
            <ScanBarcode className="h-4 w-4 text-primary" />
            Barcode lookup enabled
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70">
          <button
            type="button"
            onClick={() => setActiveView('create')}
            aria-current={activeView === 'create' ? 'page' : undefined}
            className={cn(
              'relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
              activeView === 'create'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <PackagePlus className="h-4 w-4" />
            Create / Update
          </button>
          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            aria-current={activeView === 'catalog' ? 'page' : undefined}
            className={cn(
              'relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
              activeView === 'catalog'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Boxes className="h-4 w-4" />
            Product catalogue
          </button>
        </div>

        <section aria-label={activeView === 'create' ? 'Create or update a product' : 'Product catalogue'} className="min-w-0">
          {activeView === 'create' ? (
            <Suspense fallback={<ProductsSkeleton />}>
              <ProductManagementContent />
            </Suspense>
          ) : (
            <Suspense fallback={<ProductsSkeleton />}>
              <ProductListClient />
            </Suspense>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsPageContent />
    </Suspense>
  );
}
