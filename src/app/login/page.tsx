'use client';

import { LoginForm } from '@/components/auth/login-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Activity, Network, Fingerprint, LockKeyhole } from 'lucide-react';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md space-y-10 p-4">
      <div className="space-y-4">
        <Skeleton className="h-20 w-20 rounded-[2.5rem] mx-auto" />
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
        
        {/* LEFT PANEL: SYSTEM STATUS (Hidden on mobile) */}
        <div className="hidden lg:flex flex-col space-y-10 max-w-sm animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                    <Activity className="h-3 w-3 animate-pulse" /> System Active
                </div>
                <h2 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                    Sheet<span className="text-primary">Sync</span><br/>Inventory
                </h2>
                <p className="text-base text-muted-foreground font-medium leading-relaxed opacity-70">
                    Real-time cloud synchronization for industrial asset management. High-performance, zero-latency registry hub.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {[
                    { label: 'Network', value: 'Encrypted', icon: Network },
                    { label: 'Security', value: 'Verified', icon: Fingerprint },
                ].map((stat, i) => (
                    <div key={i} className="p-5 rounded-[2rem] bg-white/40 dark:bg-white/5 backdrop-blur-sm shadow-sm">
                        <stat.icon className="h-5 w-5 text-primary mb-3" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{stat.label}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    </div>
                ))}
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">
                <LockKeyhole className="h-3 w-3" />
                <span>SSL Secured Handshake v4.1</span>
            </div>
        </div>

        {/* RIGHT PANEL: AUTHENTICATION */}
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700 ease-out">
            {/* MOBILE ONLY BRANDING */}
            <div className="lg:hidden text-center mb-10 space-y-3">
                <h1 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">
                    Sheet<span className="text-primary">Sync</span>
                </h1>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em] opacity-50">Industrial Hub</p>
            </div>

            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginForm />
            </Suspense>
            
            {/* COMPLIANCE FOOTER */}
            <p className="mt-12 text-center text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/20">
                End-to-End Enterprise Cryptography
            </p>
        </div>
      </div>
    </div>
  );
}
