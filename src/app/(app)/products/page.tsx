
'use client';
import { ReturnableInventoryByStaffClient } from '@/components/inventory/returnable-inventory-by-staff-client'; 
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'; 
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';

// Skeleton for the Return by Staff page
function ReturnableInventoryByStaffSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center gap-4 p-4 border rounded-lg shadow bg-card mb-6">
        <Skeleton className="h-10 w-full md:max-w-lg" /> {/* Staff Combobox Skeleton */}
        <Skeleton className="h-10 w-28" /> {/* Clear Button Skeleton */}
        <Skeleton className="h-10 w-28" /> {/* Print Button Skeleton */}
        <Skeleton className="h-6 w-32 md:ml-auto" /> {/* Item Count Skeleton */}
      </div>
      <Card className="shadow-md">
        <Table>{/*
          Ensure no leading/trailing whitespace for TableHeader/TableBody children of Table
        */}<TableHeader>
            <TableRow>{/*
             */}<TableHead className="w-20 text-center">Return</TableHead>{/*
             */}<TableHead className="w-20 text-center">Details</TableHead>{/*
             */}<TableHead>Product Name</TableHead>{/*
             */}<TableHead>Barcode</TableHead>{/*
             */}<TableHead>Supplier</TableHead>{/*
             */}<TableHead className="text-right">In Stock</TableHead>{/*
             */}<TableHead>Expiry</TableHead>{/*
             */}<TableHead>Location</TableHead>{/*
             */}<TableHead>Type</TableHead>{/*
             */}<TableHead className="w-20 text-center">Edit</TableHead>{/* New Edit column
           */}</TableRow>
          </TableHeader>{/*
          Ensure no whitespace between TableHeader and TableBody
        */}<TableBody>
            {Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={index}>{/*
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell className="text-right"><Skeleton className="h-5 w-1/2 ml-auto" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/*
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/* Edit button skeleton
              */}</TableRow>
            ))}
          </TableBody>{/*
        Ensure no trailing whitespace before closing Table tag
      */}</Table>
      </Card>
    </div>
  );
}

export default function ReturnByStaffPage() { 
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8 text-primary">Return Inventory by Staff</h1>
      <Suspense fallback={<ReturnableInventoryByStaffSkeleton />}>
        {!isCacheReady ? (
          <ReturnableInventoryByStaffSkeleton />
        ) : (
          <ReturnableInventoryByStaffClient />
        )}
      </Suspense>
    </div>
  );
}

    
