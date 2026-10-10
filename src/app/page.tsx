'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const { permissions } = useAccessControl();

  useEffect(() => {
    if (user && role) {
      if (role === 'admin') {
        router.replace('/dashboard');
      } else {
        const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
        router.replace(defaultPath);
      }
      return;
    }

    if (!loading) {
      if (user) {
        if (role === 'admin') {
          router.replace('/dashboard');
        } else {
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, role, router, permissions]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-[#0a0a0f] p-6 text-center">
      <Loader2
        className="h-8 w-8 animate-spin text-neutral-400 dark:text-neutral-500 mb-6"
        strokeWidth={1.75}
      />

      <h1 className="text-[22px] font-semibold tracking-tight text-black dark:text-white mb-1.5">
        SheetSync
      </h1>
      <p className="text-[14px] text-neutral-500 dark:text-neutral-400">
        Authenticating secure session…
      </p>
    </div>
  );
}
