'use client';

import type { PropsWithChildren } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, ShieldCheck } from 'lucide-react';
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
        timerId = setTimeout(() => setShowAdminWelcomeScreen(false), 2500); 
      }
    }
    return () => { if (timerId) clearTimeout(timerId); };
  }, [loading, role, generalSettings.showAdminWelcome]); 


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background overflow-hidden relative">
        <div className="relative z-10 flex flex-col items-center animate-in fade-in duration-700">
            <div className="p-5 bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-100 dark:border-white/5 mb-8">
                <ShieldCheck className="h-10 w-10 text-neutral-400 dark:text-neutral-500" strokeWidth={1.5} />
            </div>
            
            <h1 className="text-xl font-semibold tracking-tight text-foreground mb-4">Secure handshake</h1>
            
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-300 dark:text-neutral-700" strokeWidth={2.5} />
                <p className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500">Establishing registry link...</p>
            </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground animate-fade-in p-4 overflow-hidden relative">
        <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-500">
            <div className="p-5 bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-100 dark:border-white/5 mb-8">
                <ShieldCheck className="h-12 w-12 text-neutral-800 dark:text-neutral-200" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2 text-center">
                Welcome back
            </h1>
            <p className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 opacity-60">Administrator session active</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar className="noprint" />
        <SidebarInset className="flex min-w-0 flex-col relative overflow-hidden bg-background">
          <Header className="noprint relative z-10" onManualLock={handleLock} />
          
          <main className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto relative z-10 bg-background",
            "p-4 sm:p-6 md:p-8",
            "pb-32 md:pb-8",
            "animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out" 
          )}>
            <div className="container mx-auto max-w-full lg:max-w-[1700px]">
                {children}
            </div>
          </main>
          
          <BottomNav />
        </SidebarInset>
      </SidebarProvider>
      {isLocked && role === 'admin' && <InactivityLockScreen onUnlock={handleUnlock} />}
    </>
  );
}
