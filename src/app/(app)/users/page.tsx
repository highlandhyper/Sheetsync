'use client';

import { UserManager } from '@/components/settings/user-manager';
import { Users } from 'lucide-react';
import { useDataCache } from '@/context/data-cache-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';

function UserManagementSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-[400px] bg-muted rounded-3xl" />
        <div className="lg:col-span-2 h-[400px] bg-muted rounded-2xl" />
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { isCacheReady } = useDataCache();

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight uppercase">
        <Users className="mr-3 h-8 w-8" />
        User Management
      </h1>
      
      <Suspense fallback={<UserManagementSkeleton />}>
        {isCacheReady ? (
          <UserManager />
        ) : (
          <UserManagementSkeleton />
        )}
      </Suspense>
    </div>
  );
}
