
import { InventoryBarcodeLookupClient } from '@/components/inventory/inventory-barcode-lookup-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { getUniqueLocations } from '@/lib/data';

function BarcodeLookupSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg shadow bg-card">
        <Skeleton className="h-10 w-full sm:flex-grow" /> {/* Barcode Input */}
        <Skeleton className="h-10 w-full sm:w-28" /> {/* Search Button */}
      </div>
      <Card className="shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Staff Name</TableHead>
              <TableHead>Logged At</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default async function InventoryLogLookupPage() {
  const uniqueLocations = await getUniqueLocations();

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8 text-primary">Inventory Log Lookup</h1>
      <Suspense fallback={<BarcodeLookupSkeleton />}>
        <InventoryBarcodeLookupClient uniqueLocations={uniqueLocations || []} />
      </Suspense>
    </div>
  );
}
