'use client';

import { AuditLogClient } from '@/components/audit/audit-log-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { FileText, ShieldCheck } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function AuditLogSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={index}
            className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm sm:p-4"
          >
            <Skeleton className="h-3 w-20 rounded-lg" />
            <Skeleton className="mt-2 h-7 w-14 rounded-lg" />
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="space-y-3 p-3.5 sm:p-4">
          <Skeleton className="h-10 w-full rounded-xl" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      </Card>

      <div className="space-y-2.5 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card
            key={index}
            className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-4 w-28 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-lg" />
                </div>
                <Skeleton className="h-3 w-24 rounded-lg" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-3 w-5/6 rounded-lg" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
        <div className="divide-y divide-border/50">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[150px_180px_180px_220px_minmax(0,1fr)] items-center gap-4 p-4"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24 rounded-lg" />
              <Skeleton className="h-4 w-36" />
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
    <div className="mx-auto w-full min-w-0 max-w-[1680px] overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 md:px-5 lg:px-6 lg:pb-8">
      <header className="mb-4 min-w-0 sm:mb-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
            <FileText className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Audit Log
            </h1>

            <p className="mt-0.5 max-w-2xl text-[9px] font-medium leading-4 text-muted-foreground sm:text-[10px]">
              Review account activity, inventory changes, and system security events.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[8px] font-semibold text-muted-foreground sm:flex">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Secure history
          </div>
        </div>
      </header>

      <Suspense fallback={<AuditLogSkeleton />}>
        {isCacheReady ? <AuditLogClient /> : <AuditLogSkeleton />}
      </Suspense>
    </div>
  );
}
