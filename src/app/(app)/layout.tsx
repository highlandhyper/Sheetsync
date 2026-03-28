'use client';

import type { PropsWithChildren } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { Loader2, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { useGeneralSettings } from '@/context/general-settings-context';
import { InactivityLockScreen } from '@/components/auth/inactivity-lock-screen';
import { Button } from '@/components/ui/button';

const LOCK_STORAGE_KEY = 'sheetSync_isLocked';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, loading: authLoading, role } = useAuth();
  const { isAllowed, isInitialized: permissionsInitialized, permissions } = useAccessControl();
  const { settings: generalSettings, isInitialized: settingsInitialized } = useGeneralSettings();
  const router = useRouter();
  const pathname = usePathname();
  const [showAdminWelcomeScreen, setShowAdminWelcomeScreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showSafetyButton, setShowSafetyButton] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout>();

  const loading = authLoading || !permissionsInitialized || !settingsInitialized;
  const INACTIVITY_TIMEOUT_MS = (generalSettings.inactivityTimeout || 5) * 60 * 1000;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowSafetyButton(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

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
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium text-muted-foreground animate-pulse">Establishing connection...</p>
        
        {showSafetyButton && (
          <div className="mt-8 animate-fade-in space-y-6 max-w-sm border-t pt-8">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-destructive/10 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm font-semibold text-destructive">
                Sync mismatch or network delay detected.
              </p>
              <p className="text-xs text-muted-foreground">
                Your browser is struggling to fetch the latest application chunks. A hard refresh is recommended.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                variant="default" 
                className="w-full font-black h-12 shadow-lg shadow-primary/20"
                onClick={() => {
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      for (let name of names) caches.delete(name);
                    });
                  }
                  window.location.reload(true);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Force Clean Reload
              </Button>
              <Button variant="ghost" className="text-xs" onClick={() => router.push('/login')}>
                Go to Login Page
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) return null;

  if (role === 'admin' && showAdminWelcomeScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground animate-fade-in p-4">
        <ShieldCheck className="h-20 w-20 text-primary mb-6 animate-pulse" strokeWidth={1.5} />
        <h1 className="text-4xl font-bold text-primary mb-3 text-center tracking-tighter">Welcome back, Chief!</h1>
        <p className="text-xl text-muted-foreground mb-8 text-center">Your command center is ready.</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  return (
    <>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar className="noprint" />
        <SidebarInset className="flex min-w-0 flex-col">
          <Header className="noprint" onManualLock={handleLock} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      {isLocked && role === 'admin' && <InactivityLockScreen onUnlock={handleUnlock} />}
    </>
  );
}
