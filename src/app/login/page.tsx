
'use client';

import { useState, Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, SmartphoneNfc, ChevronRight } from 'lucide-react';
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
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-black overflow-hidden">
      {/* ATMOSPHERIC BACKGROUND */}
      <div className="absolute inset-0 bg-tech-grid z-0 opacity-20" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_0%,transparent_70%)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-[1200px] flex flex-col items-center justify-center px-6">
        
        {/* OPENING GATE (INITIAL VIEW) */}
        {!showForm ? (
          <div className="w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700 ease-out">
            <div className="mb-10 space-y-4">
                <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/10 transition-transform hover:scale-105 duration-500 ring-4 ring-emerald-500/5">
                    <ShieldCheck className="h-10 w-10 text-emerald-500" strokeWidth={2} />
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-white uppercase leading-none">
                    Sheet<span className="text-emerald-500">Sync</span>
                </h1>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em] opacity-60">Industrial Inventory</p>
            </div>

            <div className="w-full space-y-4 mt-8">
                <Button 
                    onClick={() => setShowForm(true)}
                    className="w-full h-16 text-lg font-black uppercase tracking-widest rounded-full shadow-2xl shadow-emerald-500/10 bg-emerald-600 hover:bg-emerald-700 text-white group border-none"
                >
                    Log In
                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>

                <div className="pt-8 border-t border-white/5 w-full">
                    <Button variant="ghost" asChild className="h-12 w-full rounded-2xl border border-white/5 bg-zinc-900/30 text-zinc-400 hover:bg-zinc-900/50 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
                        <Link href="/on-display/handshake">
                            <SmartphoneNfc className="mr-2 h-4 w-4" />
                            Staff Handshake
                        </Link>
                    </Button>
                </div>
            </div>

            <p className="mt-12 text-[8px] font-black uppercase tracking-[0.5em] text-zinc-800">
                Secure Registry Terminal v5.0
            </p>
          </div>
        ) : (
          /* SLIDE-UP AUTH TERMINAL */
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop blur for transition focus */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500" 
                onClick={() => setShowForm(false)}
            />
            
            <div className="relative w-full max-w-lg mx-auto bg-black rounded-t-[3rem] border-t border-white/5 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-500 ease-out flex flex-col h-[85vh] sm:h-auto">
                {/* Atmospheric gradient for the form */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.05)_0%,transparent_50%)] pointer-events-none rounded-t-[3rem]" />
                
                {/* Pull handle for mobile affordance */}
                <div className="relative z-10 mx-auto w-12 h-1.5 bg-zinc-800 rounded-full mt-4 mb-2" />
                
                <div className="relative z-10 flex-1 overflow-y-auto">
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
