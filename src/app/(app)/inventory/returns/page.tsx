
import { getReturnedItems } from '@/lib/data';
import { ReturnLogListClient } from '@/components/inventory/return-log-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';


function ReturnLogSkeleton() {
  return (
    <div className="space-y-6">
       <Skeleton className="h-10 w-1/2 mb-4" /> {/* Page Title Skeleton */}
      <Card className="shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Returned Qty</TableHead>
              <TableHead>Return Date</TableHead>
              <TableHead>Original Location</TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead>Item Type</TableHead>
              <TableHead>Expiry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


export default async function ReturnLogPage() {
  const initialReturnedItems = await getReturnedItems();

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8 text-primary">Return Log</h1>
      <Suspense fallback={<ReturnLogSkeleton />}>
        <ReturnLogListClient initialReturnedItems={initialReturnedItems || []} />
      </Suspense>
    </div>
  );
}

export const revalidate = 0;
