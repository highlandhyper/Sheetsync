'use client';

import { InventoryListClient } from '@/components/inventory/inventory-list-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  ClipboardList,
  PackageOpen,
  Wallet,
  Barcode,
  ShieldCheck,
} from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';

function InventoryListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card
            key={index}
            className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4"
          >
            <Skeleton className="h-3 w-16 rounded-lg" />
            <Skeleton className="mt-2 h-7 w-20 rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="space-y-3 p-3 sm:p-4">
          <Skeleton className="h-11 w-full rounded-xl" />

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="col-span-2 h-10 rounded-xl lg:col-span-1" />
            <Skeleton className="col-span-2 h-10 rounded-xl lg:col-span-1" />
          </div>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card
            key={index}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
          >
            <div className="space-y-3 p-3">
              <div className="flex items-start gap-2.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                  <Skeleton className="h-3 w-1/2 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>

              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
        <div className="divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[240px_145px_85px_100px_115px_125px_135px_90px_132px] items-center gap-3 p-4"
            >
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-24 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function InventoryPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="printable-area mx-auto w-full min-w-0 max-w-[1680px] overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-3 md:px-5 lg:px-6 lg:pb-8">
      <header className="noprint mb-4 min-w-0 sm:mb-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
            <ClipboardList className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Inventory Overview
            </h1>

            <p className="mt-0.5 max-w-2xl text-[9px] font-medium leading-4 text-muted-foreground sm:text-[10px]">
              Search, filter, review, and manage active inventory records.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[8px] font-semibold text-muted-foreground sm:flex">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Live registry
          </div>
        </div>
      </header>

      <Suspense fallback={<InventoryListSkeleton />}>
        {!isCacheReady ? <InventoryListSkeleton /> : <InventoryListClient />}
      </Suspense>
    </div>
  );
}
