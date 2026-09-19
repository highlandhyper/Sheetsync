'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-border/50">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-black uppercase tracking-tight text-foreground">Unable to open alert</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Please refresh the page and enter the access key again. If the problem continues, ask an administrator to send a new alert link.</p>
        <Button onClick={reset} className="mt-6 h-12 w-full rounded-xl text-xs font-black uppercase tracking-widest">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </section>
    </main>
  );
}
