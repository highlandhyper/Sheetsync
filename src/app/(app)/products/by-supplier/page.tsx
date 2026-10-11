'use client';
import { ReturnableInventoryBySupplierClient } from '@/components/inventory/returnable-inventory-by-supplier-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function ReturnableInventorySkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Skeleton className="h-10 w-full md:w-[320px]" />
            <div className="flex gap-2 w-full md:w-auto">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
      </Card>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4 items-center">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}


export default function ReturnInventoryBySupplierPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="w-full max-w-[1700px] mx-auto py-2 printable-area">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 px-3 md:px-0">
          <div className="flex items-center gap-3">
              <Link
                href="/more"
                className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-primary noprint leading-none">Return Inventory by Supplier</h1>
          </div>
      </div>

      <Suspense fallback={<ReturnableInventorySkeleton />}>
        {!isCacheReady ? (
          <ReturnableInventorySkeleton />
        ) : (
          <ReturnableInventoryBySupplierClient />
        )}
      </Suspense>
    </div>
  );
}
