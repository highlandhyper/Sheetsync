
'use client';
import { AuditLogClient } from '@/components/audit/audit-log-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';


function AuditLogSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Skeleton className="h-10 w-full sm:w-40 flex-1" />
                <Skeleton className="h-10 w-full sm:w-40 flex-1" />
                <Skeleton className="h-10 w-full sm:w-48 flex-1" />
            </div>
        </div>
      </Card>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4 items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

export default function AuditLogPage() {
    const { isCacheReady } = useDataCache();

    return (
        <div className="container mx-auto py-2">
            <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
                <FileText className="mr-3 h-8 w-8" />
                Audit Log
            </h1>
            <Suspense fallback={<AuditLogSkeleton />}>
                {isCacheReady ? (
                    <AuditLogClient />
                ) : (
                    <AuditLogSkeleton />
                )}
            </Suspense>
        </div>
    );
}
