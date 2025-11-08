
import { getSuppliers } from '@/lib/data';
import { SupplierListClient } from '@/components/suppliers/supplier-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Building } from 'lucide-react';

function SupplierListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <Skeleton className="h-10 w-36" /> {/* Add Supplier Button */}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="w-full">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
            </Card>
        ))}
      </div>
       {/* Max items warning skeleton */}
      <Skeleton className="h-5 w-3/4 mx-auto" />
    </div>
  );
}

export default async function SuppliersPage() { 
  const initialSuppliers = await getSuppliers();

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <Building className="mr-3 h-8 w-8" />
        Manage Suppliers
      </h1>
      <Suspense fallback={<SupplierListSkeleton />}>
        <SupplierListClient initialSuppliers={initialSuppliers || []} />
      </Suspense>
    </div>
  );
}

export const revalidate = 0; // Revalidate on every request
