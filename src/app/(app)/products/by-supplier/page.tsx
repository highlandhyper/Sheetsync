import { getInventoryItems, getSuppliers } from '@/lib/data';
import { ReturnableInventoryBySupplierClient } from '@/components/inventory/returnable-inventory-by-supplier-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';


function ReturnableInventorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center gap-4 p-4 border rounded-lg shadow bg-card mb-6">
        <Skeleton className="h-10 w-full md:max-w-lg" /> {/* Supplier Dropdown Skeleton */}
        <Skeleton className="h-10 w-36" /> {/* Clear/Print Button Skeleton */}
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
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/* Return button skeleton
                */}<TableCell><Skeleton className="h-9 w-10 mx-auto" /></TableCell>{/* Details button skeleton
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/* Product Name
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/* Barcode
                */}<TableCell className="text-right"><Skeleton className="h-5 w-1/2 ml-auto" /></TableCell>{/* In Stock
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/* Expiry
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/* Location
                */}<TableCell><Skeleton className="h-5 w-full" /></TableCell>{/* Type
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


export default async function ReturnInventoryBySupplierPage() {
  const [initialInventoryItems, suppliers] = await Promise.all([
    getInventoryItems(),
    getSuppliers()
  ]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">Return Inventory by Supplier</h1>
      <Suspense fallback={<ReturnableInventorySkeleton />}>
        <ReturnableInventoryBySupplierClient
          initialInventoryItems={initialInventoryItems || []}
          allSuppliers={suppliers || []}
        />
      </Suspense>
    </div>
  );
}

export const revalidate = 0;
