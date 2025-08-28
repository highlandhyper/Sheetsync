
'use client';

import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { Loader2, ShieldCheck } from 'lucide-react';

const VIEWER_ALLOWED_PATHS = ['/products', '/inventory/lookup', '/settings'];
const VIEWER_DEFAULT_PATH = '/products';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showAdminWelcomeScreen, setShowAdminWelcomeScreen] = useState(false);

  // Effect for authentication, role-based redirects
  useEffect(() => {
    if (loading) {
      return; // Wait until auth state is resolved
    }

    if (!user) {
      router.replace('/login');
      sessionStorage.removeItem('adminWelcomeShown'); 
      setShowAdminWelcomeScreen(false); 
      return;
    }

    if (role === 'viewer') {
      // Use a strict includes check to prevent access to sub-routes like /products/manage
      const isAllowed = VIEWER_ALLOWED_PATHS.includes(pathname);
      if (!isAllowed) {
        router.replace(VIEWER_DEFAULT_PATH);
      }
      sessionStorage.removeItem('adminWelcomeShown');
      setShowAdminWelcomeScreen(false);
    }
    // Admin specific logic for welcome screen is in the next useEffect

  }, [loading, user, role, router, pathname]);


  // Dedicated Effect for Admin Welcome Screen logic (using sessionStorage)
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
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading application...</p>
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
  
  // Removed redundant redirect block for viewers here.
  // The useEffect above handles the redirect logic more appropriately.

  // Admin Welcome Screen Render Condition
  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
        <ShieldCheck className="h-20 w-20 text-primary mb-6 animate-pulse" strokeWidth={1.5} />
        <h1 className="text-4xl font-bold text-primary mb-3">Welcome back, Chief!</h1>
        <p className="text-xl text-muted-foreground mb-8">Entering the command center...</p>
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
