'use client';

import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, ShieldCheck } from 'lucide-react';

const VIEWER_DEFAULT_PATH = '/products';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, loading: authLoading, role } = useAuth();
  const { isAllowed, isInitialized: permissionsInitialized } = useAccessControl();
  const router = useRouter();
  const pathname = usePathname();
  const [showAdminWelcomeScreen, setShowAdminWelcomeScreen] = useState(false);

  const loading = authLoading || !permissionsInitialized;

  useEffect(() => {
    if (loading) {
      return; 
    }

    if (!user) {
      router.replace('/login');
      sessionStorage.removeItem('adminWelcomeShown'); 
      setShowAdminWelcomeScreen(false); 
      return;
    }

    if (role === 'viewer') {
      const canAccessCurrentPath = isAllowed(role, pathname);
      if (!canAccessCurrentPath) {
        const defaultPathForViewer = isAllowed(role, VIEWER_DEFAULT_PATH) ? VIEWER_DEFAULT_PATH : '/login';
        router.replace(defaultPathForViewer);
      }
      sessionStorage.removeItem('adminWelcomeShown');
      setShowAdminWelcomeScreen(false);
    }
  }, [loading, user, role, router, pathname, isAllowed]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;

    if (!loading && role === 'admin') {
      const welcomeShownSession = sessionStorage.getItem('adminWelcomeShown');
      if (!welcomeShownSession) {
        setShowAdminWelcomeScreen(true);
        sessionStorage.setItem('adminWelcomeShown', 'true');
        timerId = setTimeout(() => {
          setShowAdminWelcomeScreen(false);
        }, 3500); // Show for 3.5 seconds
      } else {
        setShowAdminWelcomeScreen(false);
      }
    } else {
      setShowAdminWelcomeScreen(false);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [loading, role]); 


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4">Loading application, please wait...</p>
      </div>
    );
  }

  if (!user) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg">Redirecting to login...</p>
        </div>
    );
  }

  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground animate-fade-in">
        <ShieldCheck className="h-20 w-20 text-primary mb-6 animate-pulse" strokeWidth={1.5} />
        <h1 className="text-4xl font-bold text-primary mb-3">Welcome back, Chief!</h1>
        <p className="text-xl text-muted-foreground mb-8">Your command center is ready. Let's get to work.</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar className="noprint" />
      <SidebarInset className="flex flex-col h-screen overflow-y-auto">
        <Header className="noprint" />
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
