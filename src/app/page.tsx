
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; 
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); 
  const { permissions, isInitialized } = useAccessControl();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    // Show a retry button if stuck for more than 8 seconds
    const timer = setTimeout(() => setShowRetry(true), 8000);

    if (!loading && isInitialized) {
      if (user) {
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    }

    return () => clearTimeout(timer);
  }, [user, loading, role, router, permissions, isInitialized]);

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
        Initializing secure environment...
      </p>

      {showRetry && (
        <div className="mt-12 space-y-4 max-w-xs animate-fade-in">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Initialization is taking longer than expected.
          </div>
          <Button 
            variant="outline" 
            className="w-full font-bold" 
            onClick={() => window.location.reload()}
          >
            Refresh Application
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-xs text-muted-foreground" 
            onClick={() => router.push('/login')}
          >
            Force Go to Login
          </Button>
        </div>
      )}
    </div>
  );
}
