'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; 
import { useAccessControl } from '@/context/access-control-context';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); 
  const { permissions, isInitialized } = useAccessControl();

  useEffect(() => {
    if (!loading && isInitialized) {
      if (user) {
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          // Dynamic redirect based on settings
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, role, router, permissions, isInitialized]);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg">Loading SheetSync...</p>
    </div>
  );
}
