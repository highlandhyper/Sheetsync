
'use client';
import { AuditLogClient } from '@/components/audit/audit-log-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';


function AuditLogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border rounded-lg shadow bg-card">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <Skeleton className="h-10 w-full sm:max-w-[200px]" /> {/* User Filter */}
        <Skeleton className="h-10 w-full sm:max-w-[200px]" /> {/* Action Filter */}
        <Skeleton className="h-10 w-full sm:max-w-[200px]" /> {/* Date Range Filter */}
      </div>
      <Card className="shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
