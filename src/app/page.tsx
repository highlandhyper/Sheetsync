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
    if (!loading) {
      if (user) {
        // AGGRESSIVE REDIRECTION:
        // 1. If we have a role (from cache or server), use it immediately.
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        } else {
          // 2. If user exists but role is still syncing, go to a safe default
          // rather than waiting on the loading screen.
          router.replace('/inventory/add');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, role, router, permissions]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background p-4 text-center">
      <div className="relative mb-6">
        <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" strokeWidth={1} />
        <Loader2 className="absolute inset-0 h-16 w-16 animate-[spin_3s_linear_infinite] text-primary" strokeWidth={2} />
      </div>
      
      <h1 className="text-2xl font-black text-primary tracking-tighter uppercase mb-2">
        SheetSync
      </h1>
      <p className="text-muted-foreground animate-pulse font-medium">
        Verifying Identity & Security Credentials...
      </p>
    </div>
  );
}
