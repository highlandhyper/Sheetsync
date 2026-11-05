'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  Boxes,
  PackagePlus,
  ScanBarcode,
} from 'lucide-react';

import { ProductListClient } from '@/components/products/product-list-client';
import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';
import { cn } from '@/lib/utils';

type ProductsView = 'create' | 'catalog';

function ProductsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 px-3 pb-8 sm:px-5 lg:px-7">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-[460px] rounded-2xl" />
        <Skeleton className="h-[460px] rounded-2xl" />
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
  // Product creation is the primary workflow. Catalogue opens only when requested.
  const [activeView, setActiveView] = useState<ProductsView>(() =>
    searchParams.get('tab') === 'catalog' ? 'catalog' : 'create',
  );

  return (
    <main className="min-h-full w-full pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="mx-auto w-full max-w-[1680px] space-y-5 px-3 pt-3 sm:space-y-6 sm:px-5 sm:pt-5 lg:px-7">
        <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:rounded-3xl">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="relative flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-7">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm sm:h-14 sm:w-14">
                <Boxes className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Inventory workspace</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span className="text-[10px] font-medium text-muted-foreground">Highland Hypermarket</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Product management</h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
                  Create product records, update barcode details and manage your product catalogue.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-border/70 bg-background/70 px-3 py-2 sm:self-center">
              <ScanBarcode className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground">Barcode-first workflow</span>
            </div>
          </div>
        </header>

        <nav aria-label="Product workspace views" className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-muted/35 p-1.5 sm:gap-3 sm:p-2">
          <button
            type="button"
            onClick={() => setActiveView('create')}
            aria-current={activeView === 'create' ? 'page' : undefined}
            className={cn(
              'group flex min-h-[66px] min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:min-h-[76px] sm:px-4',
              activeView === 'create'
                ? 'border-primary/25 bg-card shadow-sm'
                : 'border-transparent bg-transparent hover:bg-background/70',
            )}
          >
            <span className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-10 sm:w-10',
              activeView === 'create' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground group-hover:text-foreground',
            )}>
              <PackagePlus className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-xs font-bold sm:text-sm', activeView === 'create' ? 'text-foreground' : 'text-muted-foreground')}>Create / Update</span>
              <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">Register a product or edit by barcode</span>
            </span>
            {activeView === 'create' && <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            aria-current={activeView === 'catalog' ? 'page' : undefined}
            className={cn(
              'group flex min-h-[66px] min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:min-h-[76px] sm:px-4',
              activeView === 'catalog'
                ? 'border-primary/25 bg-card shadow-sm'
                : 'border-transparent bg-transparent hover:bg-background/70',
            )}
          >
            <span className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-10 sm:w-10',
              activeView === 'catalog' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground group-hover:text-foreground',
            )}>
              <Boxes className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-xs font-bold sm:text-sm', activeView === 'catalog' ? 'text-foreground' : 'text-muted-foreground')}>Product catalogue</span>
              <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">Search, filter and review registered products</span>
            </span>
            {activeView === 'catalog' && <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        </nav>

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
