'use client';

import { LoginForm } from '@/components/auth/login-form';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Cpu, Globe, Zap } from 'lucide-react';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md space-y-6">
      <Skeleton className="h-12 w-1/2 mx-auto" />
      <Skeleton className="h-6 w-3/4 mx-auto" />
      <div className="space-y-4 pt-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden login-mesh-bg p-4 selection:bg-primary/30">
      {/* ATMOSPHERIC ADVANCED ELEMENTS */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div 
            className="absolute top-[-15%] left-[-10%] h-[60%] w-[60%] rounded-full bg-primary/20 blur-[120px] animate-pulse"
            style={{ animationDuration: '12s' }}
        />
        <div 
            className="absolute bottom-[-20%] right-[-10%] h-[60%] w-[60%] rounded-full bg-accent/20 blur-[120px] animate-pulse"
            style={{ animationDuration: '15s', animationDelay: '3s' }}
        />
        <div className="absolute top-1/4 right-1/4 h-32 w-32 bg-white/10 rounded-full blur-3xl animate-bounce duration-[8s]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000 ease-out">
        {/* BRAND IDENTITY HUB */}
        <div className="text-center mb-10 space-y-3">
            <div className="flex items-center justify-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 backdrop-blur-sm shadow-xl shadow-primary/10">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
            </div>
            <h1 className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white font-poppins tracking-tighter uppercase drop-shadow-sm">
                Sheet<span className="text-primary">Sync</span>
            </h1>
            <div className="flex items-center justify-center gap-4 text-muted-foreground font-bold tracking-widest text-[10px] uppercase">
                <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Cloud-Ready</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Real-time</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> High-Perf</span>
            </div>
        </div>

        <div className="w-full max-w-sm">
            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginForm />
            </Suspense>
        </div>
        
        {/* FOOTER META */}
        <div className="mt-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 flex items-center gap-2">
            <span>Secure System</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
            <span>v4.0 Enterprise</span>
        </div>
      </div>
    </div>
  );
}
