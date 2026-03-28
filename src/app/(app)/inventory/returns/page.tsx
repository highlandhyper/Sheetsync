'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * This page is deprecated. Return history is now managed within the main Audit Log.
 */
export default function DeprecatedReturnLogPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/audit-log');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg mt-4 text-muted-foreground">Redirecting to consolidated Audit Log...</p>
    </div>
  );
}
