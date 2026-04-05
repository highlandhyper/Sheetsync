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
        // AGGRESSIVE REDIRECTION: Don't hang if role is null but user exists
        // Redirect to a safe default while role is confirming
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        } else {
          // If we have a user but role is still initializing, move to Log New Item
          // which is the most common entry point and safer than a white screen.
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
        Verifying Security Credentials...
      </p>
    </div>
  );
}
