
'use client';

import { InvoiceGenerator } from '@/components/invoice/invoice-generator';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

function InvoicePageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </div>
      <div className="space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-10 w-32" />
      </div>
       <div className="flex justify-end gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
        </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <div className="container mx-auto py-2">
      <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <FileText className="mr-3 h-8 w-8" />
        Invoice Generator
      </h1>
      <Suspense fallback={<InvoicePageSkeleton />}>
        <InvoiceGenerator />
      </Suspense>
    </div>
  );
}
