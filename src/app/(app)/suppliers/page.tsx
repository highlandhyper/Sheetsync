import { getSuppliers } from '@/lib/data';
import { SupplierListClient } from '@/components/suppliers/supplier-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

function SupplierListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <Skeleton className="h-10 w-36" /> {/* Add Supplier Button */}
      </div>
      <Card className="shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier Name</TableHead>
              <TableHead>ID (Sheet-derived)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
       {/* Max items warning skeleton */}
      <Skeleton className="h-5 w-3/4 mx-auto" />
    </div>
  );
}

export default async function SuppliersPage() { 
  const initialSuppliers = await getSuppliers();

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">Manage Suppliers</h1>
      <Suspense fallback={<SupplierListSkeleton />}>
        <SupplierListClient initialSuppliers={initialSuppliers || []} />
      </Suspense>
    </div>
  );
}

export const revalidate = 0; // Revalidate on every request
