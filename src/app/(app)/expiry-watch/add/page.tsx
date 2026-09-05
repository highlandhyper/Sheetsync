'use client';

import { AddReminderStepperForm } from '@/components/expiry/add-reminder-stepper-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataCache } from '@/context/data-cache-context';

function AddReminderSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pt-4">
      <div className="flex justify-between items-center mb-8 px-2">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function AddDiaryReminderPage() { 
  const { isCacheReady } = useDataCache();
  
  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<AddReminderSkeleton />}>
        {isCacheReady ? (
          <AddReminderStepperForm />
        ) : (
          <AddReminderSkeleton />
        )}
      </Suspense>
    </div>
  );
}
