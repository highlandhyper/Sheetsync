'use client';

import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OnDisplayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('On-display staff page failed to load:', error);
  }, [error]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)]" />
      <section className="relative z-10 w-full max-w-[360px] animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900/80 text-zinc-400 ring-1 ring-white/5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <span className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Industrial Protocol
          </span>
        </div>

        <div className="mb-8 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-red-500/15 bg-red-500/[0.08] text-red-400 shadow-inner">
            <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <p className="pt-5 text-[10px] font-black uppercase tracking-[0.4em] text-red-400">Connection Interrupted</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Unable to open alert</h1>
          <p className="text-sm font-medium leading-6 text-zinc-500">
            The on-display session could not be loaded. Try again, or return to the portal and open the alert link once more.
          </p>
        </div>

        {error.digest && (
          <p className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 font-mono text-[10px] text-zinc-600">
            Reference: {error.digest}
          </p>
        )}

        <Button
          onClick={reset}
          className="h-14 w-full rounded-lg bg-emerald-600 text-[10px] font-black uppercase tracking-[0.25em] text-white shadow-md shadow-emerald-500/10 transition-all hover:bg-emerald-500 active:scale-[0.98]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>

        <button
          type="button"
          onClick={() => { window.location.href = '/login'; }}
          className="mt-6 flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Portal
        </button>

        <div className="mt-10 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-800">
          <ShieldAlert className="h-3.5 w-3.5" />
          Secure session recovery
        </div>
      </section>
    </main>
  );
}
