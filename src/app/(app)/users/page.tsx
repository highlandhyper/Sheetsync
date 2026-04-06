
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * User management has been deprecated in favor of a hardcoded security model.
 * Redirecting users back to the main dashboard.
 */
export default function DeprecatedUserManagementPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg mt-4 text-muted-foreground">User Management is now handled by the system core. Redirecting...</p>
    </div>
  );
}
