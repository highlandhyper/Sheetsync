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
    // Show a retry button if stuck for more than 6 seconds
    const timer = setTimeout(() => setShowRetry(true), 6000);

    if (!loading && isInitialized) {
      if (user) {
        // We have a user. If role is still null (first sync), 
        // we wait a moment or fallback to dashboard for admins
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        } else if (role === null && !showRetry) {
          // Still waiting for registry sync... page stays on loader
        } else {
          // If we have a user but no role after 6s, go to login to force re-auth
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    }

    return () => clearTimeout(timer);
  }, [user, loading, role, router, permissions, isInitialized, showRetry]);

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
        Verifying Identity & Role Registry...
      </p>

      {showRetry && (
        <div className="mt-12 space-y-4 max-w-xs animate-fade-in">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Registry sync is taking longer than expected.
          </div>
          <Button 
            variant="outline" 
            className="w-full font-bold" 
            onClick={() => window.location.reload()}
          >
            Force Restart Application
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-xs text-muted-foreground" 
            onClick={() => router.push('/login')}
          >
            Go to Login Page
          </Button>
        </div>
      )}
    </div>
  );
}
