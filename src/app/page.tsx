'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; 
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); 
  const { permissions } = useAccessControl();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    // Show escape button if stuck for more than 4 seconds
    const timer = setTimeout(() => setShowRetry(true), 4000);

    if (!loading) {
      if (user) {
        // If we have a user and a role (even if cached), route them.
        if (role === 'admin') {
          router.replace('/dashboard');
        } else if (role === 'viewer') {
          const defaultPath = permissions.viewerDefaultPath || '/inventory/add';
          router.replace(defaultPath);
        } else {
          // If we have a user but role fetch is slow, wait for sync
          // but show the retry options.
        }
      } else {
        router.replace('/login');
      }
    }

    return () => clearTimeout(timer);
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

      {showRetry && (
        <div className="mt-12 space-y-4 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/10 text-primary text-sm font-medium">
            <AlertCircle className="h-5 w-5 shrink-0" />
            Registry sync is slow due to large data volumes.
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {user && (
                <Button 
                    variant="default" 
                    className="w-full font-black h-12 rounded-xl shadow-lg shadow-primary/20"
                    onClick={() => router.replace('/dashboard')}
                >
                    Continue anyway <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            )}
            
            <Button 
                variant="outline" 
                className="w-full font-bold h-12 rounded-xl" 
                onClick={() => window.location.reload()}
            >
                Retry Connection
            </Button>
            
            <Button 
                variant="ghost" 
                className="w-full text-xs text-muted-foreground" 
                onClick={() => router.push('/login')}
            >
                Back to Login
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
