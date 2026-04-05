'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; 
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); 
  const { permissions } = useAccessControl();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowRetry(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        // AGGRESSIVE REDIRECTION: Don't hang if role is null but user exists
        // We move to the dashboard if we know they are an admin from cache,
        // otherwise we move to a safe default while the network catches up.
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

      {showRetry && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <p className="text-xs text-muted-foreground mb-4 max-w-[250px] mx-auto">
            The security check is taking longer than expected due to network congestion.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="font-bold text-[10px] uppercase tracking-widest"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh Connection
          </Button>
        </div>
      )}
    </div>
  );
}
