'use client';

import { ApprovalCenterClient } from '@/components/approvals/approval-center-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  ShieldCheck,
  Clock3,
  UserRoundCheck,
  Activity,
} from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function ApprovalCenterSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Summary skeleton */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card
            key={index}
            className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4"
          >
            <Skeleton className="h-3 w-16 rounded-lg" />
            <Skeleton className="mt-2 h-7 w-14 rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Tabs / controls */}
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="space-y-3 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
            <Skeleton className="h-3 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </Card>

      {/* Approval cards */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card
            key={index}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
          >
            <div className="space-y-3 p-3.5 sm:p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />

                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                  <Skeleton className="h-3 w-1/2 rounded-lg" />
                </div>

                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>

              <Skeleton className="h-12 rounded-xl" />

              <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                <Skeleton className="h-9 rounded-xl" />
                <Skeleton className="h-9 rounded-xl" />
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
    <div className="mx-auto w-full min-w-0 max-w-[1680px] overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 md:px-5 lg:px-6 lg:pb-8">
      <header className="mb-4 min-w-0 sm:mb-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
            <ShieldCheck className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Approval Center
            </h1>

            <p className="mt-0.5 max-w-2xl text-[9px] font-medium leading-4 text-muted-foreground sm:text-[10px]">
              Review, authorize, and track special access requests.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[8px] font-semibold text-muted-foreground sm:flex">
            <Activity className="h-3 w-3 text-emerald-500" />
            Live approvals
          </div>
        </div>
      </header>

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
