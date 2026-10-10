'use client';

import { useState, Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, SmartphoneNfc, ChevronRight, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function LoginFormSkeleton() {
  return (
    <div className="w-full space-y-8 p-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </div>
      <div className="space-y-6 pt-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-full" />
    </div>
  );
}

export default function LoginPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 overflow-hidden">
      {/* ATMOSPHERIC BACKGROUND */}
      <div className="absolute inset-0 bg-tech-grid z-0 opacity-100" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-[1200px] flex flex-col items-center justify-center px-6">
        
        {/* OPENING GATE (INITIAL VIEW) */}
        {!showForm ? (
          <div className="w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700 ease-out">
            <div className="mb-10 space-y-4">
                <div className="mx-auto w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-primary/10 transition-transform hover:scale-105 duration-500">
                    <ShieldCheck className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                    Sheet<span className="text-primary">Sync</span>
                </h1>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em] opacity-40">Industrial Inventory</p>
            </div>

            <div className="w-full space-y-4 mt-8">
                <Button 
                    onClick={() => setShowForm(true)}
                    className="w-full h-16 text-lg font-black uppercase tracking-widest rounded-full shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground group border-none"
                >
                    Log In
                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>

                <div className="pt-8 border-t border-border/40 w-full">
                    <Button variant="ghost" asChild className="h-12 w-full rounded-2xl border border-primary/10 bg-primary/[0.03] text-primary hover:bg-primary/5 transition-all text-xs font-bold uppercase tracking-wider">
                        <Link href="/on-display/handshake">
                            <SmartphoneNfc className="mr-2 h-4 w-4" />
                            Staff Handshake
                        </Link>
                    </Button>
                </div>
            </div>

            <p className="mt-12 text-[8px] font-black uppercase tracking-[0.5em] text-muted-foreground/20">
                Secure Registry Terminal v5.0
            </p>
          </div>
        ) : (
          /* SLIDE-UP AUTH TERMINAL */
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop blur for transition focus */}
            <div 
                className="absolute inset-0 bg-background/40 backdrop-blur-sm animate-in fade-in duration-500" 
                onClick={() => setShowForm(false)}
            />
            
            <div className="relative w-full max-w-lg mx-auto bg-background rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-500 ease-out flex flex-col h-[85vh] sm:h-auto">
                {/* Pull handle for mobile affordance */}
                <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mt-4 mb-2 opacity-20" />
                
                <div className="flex-1 overflow-y-auto">
                    <Suspense fallback={<LoginFormSkeleton />}>
                        <LoginForm onBack={() => setShowForm(false)} />
                    </Suspense>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
