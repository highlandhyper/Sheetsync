'use client';

import type { PropsWithChildren } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, ShieldCheck, Activity } from 'lucide-react';
import { useGeneralSettings } from '@/context/general-settings-context';
import { InactivityLockScreen } from '@/components/auth/inactivity-lock-screen';
import { cn } from '@/lib/utils';

const LOCK_STORAGE_KEY = 'sheetSync_isLocked';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, loading: authLoading, role } = useAuth();
  const { isAllowed, permissions } = useAccessControl();
  const { settings: generalSettings } = useGeneralSettings();
  const router = useRouter();
  const pathname = usePathname();
  const [showAdminWelcomeScreen, setShowAdminWelcomeScreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout>();

  const loading = authLoading;
  const INACTIVITY_TIMEOUT_MS = (generalSettings.inactivityTimeout || 5) * 60 * 1000;

  const handleLock = useCallback(() => {
    setIsLocked(true);
    localStorage.setItem(LOCK_STORAGE_KEY, 'true');
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(handleLock, INACTIVITY_TIMEOUT_MS);
  }, [handleLock, INACTIVITY_TIMEOUT_MS]);
  
  const handleUnlock = () => {
    setIsLocked(false);
    localStorage.setItem(LOCK_STORAGE_KEY, 'false');
    resetInactivityTimer();
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedLockState = localStorage.getItem(LOCK_STORAGE_KEY);
        if (savedLockState === 'true' && role === 'admin') {
          setIsLocked(true);
        }
      } catch (e) {}
    }
  }, [role]);

  useEffect(() => {
    if (user && !loading && !isLocked && role === 'admin' && generalSettings.isLockOnInactivityEnabled) {
      const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
      const handleActivity = () => resetInactivityTimer();
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetInactivityTimer(); 
      return () => {
        events.forEach(event => window.removeEventListener(event, handleActivity));
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      };
    }
  }, [user, loading, isLocked, resetInactivityTimer, role, generalSettings.isLockOnInactivityEnabled]);

  useEffect(() => {
    if (loading) return; 

    if (!user) {
      router.replace('/login');
      return;
    }

    if (role === 'viewer') {
      const canAccessCurrentPath = isAllowed(role, pathname);
      if (!canAccessCurrentPath) {
        const defaultPathForViewer = permissions.viewerDefaultPath || '/inventory/add';
        router.replace(defaultPathForViewer);
      }
    }
  }, [loading, user, role, router, pathname, isAllowed, permissions]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (!loading && role === 'admin' && generalSettings.showAdminWelcome) {
      const welcomeShownSession = sessionStorage.getItem('adminWelcomeShown');
      if (!welcomeShownSession) {
        setShowAdminWelcomeScreen(true);
        sessionStorage.setItem('adminWelcomeShown', 'true');
        timerId = setTimeout(() => setShowAdminWelcomeScreen(false), 3500); 
      }
    }
    return () => { if (timerId) clearTimeout(timerId); };
  }, [loading, role, generalSettings.showAdminWelcome]); 


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-6 text-center">
        <div className="relative mb-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" strokeWidth={1} />
            <Loader2 className="absolute inset-0 h-16 w-16 animate-[spin_3s_linear_infinite] text-primary" strokeWidth={2} />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.4em] text-primary animate-pulse">Establishing Secure Connection...</p>
      </div>
    );
  }

  if (!user) return null;

  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground animate-fade-in p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-tech-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px]" />
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="p-6 bg-primary/10 rounded-[3rem] border border-primary/20 shadow-2xl mb-8 animate-in zoom-in-50 duration-700">
                <ShieldCheck className="h-20 w-20 text-primary animate-pulse" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 text-center tracking-tighter uppercase leading-none">
                Welcome back, <span className="text-primary">Chief</span>
            </h1>
            <p className="text-xs sm:text-sm font-black text-muted-foreground uppercase tracking-[0.4em] mb-12 opacity-50">Industrial Hub Active</p>
            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar className="noprint" />
        <SidebarInset className="flex min-w-0 flex-col relative overflow-hidden bg-background">
          {/* GLOBAL ATMOSPHERIC LAYER */}
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-tech-grid opacity-[0.4] dark:opacity-[0.6]" />
            <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[100px]" />
          </div>

          <Header className="noprint relative z-10" onManualLock={handleLock} />
          
          <main className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto relative z-10",
            "p-2 sm:p-4 md:p-6"
          )}>
            <div className="container mx-auto max-w-full lg:max-w-[1700px] animate-in fade-in slide-in-from-bottom-2 duration-700">
                {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
      {isLocked && role === 'admin' && <InactivityLockScreen onUnlock={handleUnlock} />}
    </>
  );
}
