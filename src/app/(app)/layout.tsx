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

  const isLoading = authLoading || !permissionsInitialized;

  useEffect(() => {
    if (isLoading) {
      return; 
    }

    if (!user) {
      router.replace('/login');
      sessionStorage.removeItem('adminWelcomeShown'); 
      setShowAdminWelcomeScreen(false); 
      return;
    }
    
    // This logic is now handled by the main auth context effect
    // but can serve as a backup check.
    const canAccessCurrentPath = isAllowed(role!, pathname);
    if (!canAccessCurrentPath) {
        if (role === 'viewer') {
            router.replace(VIEWER_DEFAULT_PATH);
        } else {
            router.replace('/dashboard');
        }
    }

  }, [isLoading, user, role, router, pathname, isAllowed]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;

    if (!isLoading && role === 'admin') {
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
  }, [isLoading, role]); 


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg mt-4">Loading application, please wait...</p>
      </div>
    );
  }
  
  // This check is important to prevent content flashing while redirecting
  if (!user || (role && !isAllowed(role, pathname))) {
      return (
         <div className="flex flex-col items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg mt-4">Checking credentials...</p>
        </div>
      );
  }


  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground animate-fade-in p-4">
        <ShieldCheck className="h-20 w-20 text-primary mb-6 animate-pulse" strokeWidth={1.5} />
        <h1 className="text-4xl font-bold text-primary mb-3 text-center">Welcome back, Chief!</h1>
        <p className="text-xl text-muted-foreground mb-8 text-center">Your command center is ready. Let's get to work.</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar className="noprint" />
      <SidebarInset className="flex flex-col">
        <Header className="noprint" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
