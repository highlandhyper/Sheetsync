
'use client';
import { SupplierListClient } from '@/components/suppliers/supplier-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Building } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function SupplierListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="w-full flex flex-col h-full">
                <CardHeader className="pb-3">
                    <Skeleton className="h-32 w-full rounded-t-lg -mt-6 -mx-6 mb-4" />
                    <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
                <div className="p-4 pt-0">
                    <Skeleton className="h-9 w-full" />
                </div>
            </Card>
        ))}
      </div>
    </div>
  );
}

export default function SuppliersPage() { 
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <Building className="mr-3 h-8 w-8" />
        Manage Suppliers
      </h1>
      <Suspense fallback={<SupplierListSkeleton />}>
        {isCacheReady ? (
          <SupplierListClient />
        ) : (
          <SupplierListSkeleton />
        )}
      </Suspense>
    </div>
  );
}
