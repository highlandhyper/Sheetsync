'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';

import { ProductListClient } from '@/components/products/product-list-client';
import { EditOrCreateProductForm } from '@/components/products/create-product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ProductsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3 px-2 sm:px-3 lg:px-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function ProductManagementContent() {
  const { suppliers, isCacheReady } = useDataCache();

  if (!isCacheReady) return <ProductsSkeleton />;

  return (
    <EditOrCreateProductForm allSuppliers={suppliers} />
  );
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'catalog' | 'manage'>(() =>
    searchParams.get('tab') === 'manage' ? 'manage' : 'catalog',
  );

  return (
    <div className="w-full space-y-4 py-1 sm:py-2">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Products
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            Search, add and update your product registry
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'catalog' | 'manage')}
        className="mx-auto w-full max-w-[1600px]"
      >
        <div className="px-2 sm:px-3 lg:px-4">
          <TabsList className="grid h-11 w-full max-w-sm grid-cols-2 rounded-xl">
            <TabsTrigger value="catalog" className="rounded-lg">Product Catalogue</TabsTrigger>
            <TabsTrigger value="manage" className="rounded-lg">Add / Manage</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="catalog" className="mt-3">
          <Suspense fallback={<ProductsSkeleton />}>
            <ProductListClient />
          </Suspense>
        </TabsContent>

        <TabsContent value="manage" className="mt-3">
          <Suspense fallback={<ProductsSkeleton />}>
            <ProductManagementContent />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
