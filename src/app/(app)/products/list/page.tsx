'use client';

import { Suspense, useState } from 'react';
import { Boxes, ScanBarcode } from 'lucide-react';

import { ProductListClient } from '@/components/products/product-list-client';
import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';

function ProductsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-[420px] w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-[360px] w-full rounded-xl" />
    </div>
  );
}

function ProductsWorkspace() {
  const { suppliers, isCacheReady } = useDataCache();
  const [selectedBarcode, setSelectedBarcode] = useState('');
  const [selectionVersion, setSelectionVersion] = useState(0);

  if (!isCacheReady) return <ProductsSkeleton />;

  const handleProductSelect = (barcode: string) => {
    setSelectedBarcode(barcode);
    setSelectionVersion((version) => version + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-full w-full pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-7 px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">
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
              Create, find, and update product records from one workspace.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
            <ScanBarcode className="h-4 w-4 text-primary" />
            Barcode lookup enabled
          </div>
        </header>

        <section aria-label="Product editor" className="scroll-mt-4">
          <EditOrCreateProductForm
            allSuppliers={suppliers}
            selectedBarcode={selectedBarcode}
            selectionVersion={selectionVersion}
          />
        </section>

        <section aria-labelledby="product-catalogue-heading" className="space-y-4 border-t border-border/70 pt-7">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <h2 id="product-catalogue-heading" className="text-lg font-semibold tracking-tight">
                Product catalogue
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select any product below to load it into the editor above.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Select a product to edit</p>
          </div>
          <ProductListClient onProductSelect={handleProductSelect} />
        </section>
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
