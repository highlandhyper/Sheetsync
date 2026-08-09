'use client';

import { LoginForm } from '@/components/auth/login-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Activity, Network, Fingerprint, LockKeyhole } from 'lucide-react';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md space-y-10 p-4">
      <div className="space-y-4">
        <Skeleton className="h-20 w-20 rounded-2xl mx-auto" />
        <Skeleton className="h-10 w-2/3 mx-auto" />
        <Skeleton className="h-4 w-1/3 mx-auto" />
      </div>
      <div className="space-y-8 pt-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 overflow-hidden p-4">
      {/* TECHNICAL LAYER: Grid & Spotlights */}
      <div className="absolute inset-0 bg-tech-grid z-0 opacity-100" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      
      {/* DYNAMIC ACCENTS */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-[1200px] flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-32 px-4 sm:px-6">
        
        {/* LEFT PANEL: Branding (Hidden on mobile) */}
        <div className="hidden lg:flex flex-col space-y-8 max-w-sm animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="space-y-4">
                <h2 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                    Sheet<span className="text-primary">Sync</span><br/>Inventory
                </h2>
                <p className="text-lg text-muted-foreground font-medium leading-relaxed opacity-60">
                    High-performance cloud synchronization for industrial asset registries. Real-time warehouse intelligence.
                </p>
            </div>

            <div className="flex items-center gap-4">
                <div className="h-1 w-12 bg-primary rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">Secure Access Portal</span>
            </div>
        </div>

        {/* RIGHT PANEL: AUTHENTICATION */}
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700 ease-out">
            {/* MOBILE ONLY BRANDING */}
            <div className="lg:hidden text-center mb-10 space-y-3">
                <h1 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">
                    Sheet<span className="text-primary">Sync</span>
                </h1>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">System Login</p>
            </div>

            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginForm />
            </Suspense>
            
            {/* COMPLIANCE FOOTER */}
            <p className="mt-12 text-center text-[8px] font-black uppercase tracking-[0.5em] text-muted-foreground/10">
                End-to-End Enterprise Encryption
            </p>
        </div>
      </div>
    </div>
  );
}