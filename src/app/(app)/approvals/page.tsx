'use client';

import { ApprovalCenterClient } from '@/components/approvals/approval-center-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function ApprovalCenterSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex gap-4 overflow-hidden">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-64 animate-pulse">
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ApprovalCenterPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-extrabold text-primary flex items-center tracking-tight">
          <ShieldCheck className="mr-3 h-8 w-8" />
          Approval Center
        </h1>
      </div>
      
      <Suspense fallback={<ApprovalCenterSkeleton />}>
        {isCacheReady ? (
          <ApprovalCenterClient />
        ) : (
          <ApprovalCenterSkeleton />
        )}
      </Suspense>
    </div>
  );
}
