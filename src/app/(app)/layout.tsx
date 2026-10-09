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
        {/* ATMOSPHERIC LAYER */}
        <div className="absolute inset-0 bg-tech-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000 ease-out">
            <div className="p-6 bg-primary/5 rounded-[2.5rem] border border-primary/10 mb-8 relative">
                <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] animate-ping opacity-10" />
                <ShieldCheck className="h-14 w-14 text-primary relative z-10" strokeWidth={1.2} />
            </div>
            
            <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-2">Secure Handshake</h1>
            <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
            </div>
            
            <p className="mt-10 text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground/30 animate-pulse">Establishing Industrial Registry Link</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground animate-fade-in p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-tech-grid opacity-30" />
        <div className="relative z-10 flex flex-col items-center">
            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 shadow-none mb-8 animate-in zoom-in-95 duration-500">
                <ShieldCheck className="h-16 w-16 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 text-center tracking-tighter uppercase leading-none">
                Welcome back
            </h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">Administrator Session Active</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar className="noprint" />
        <SidebarInset className="flex min-w-0 flex-col relative overflow-hidden bg-background">
          {/* ATMOSPHERIC LAYER */}
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-tech-grid opacity-[0.2]" />
            <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
          </div>

          <Header className="noprint relative z-10" onManualLock={handleLock} />
          
          <main className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto relative z-10",
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