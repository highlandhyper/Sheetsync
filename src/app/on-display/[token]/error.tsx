'use client';

import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-white dark:bg-[#0a0a0f] px-6 py-10">
      {/* Soft spotlight */}
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 55%)',
        }}
      />

      <section className="relative z-10 w-full max-w-[360px]">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10">
            <AlertTriangle
              className="h-6 w-6 text-red-500 dark:text-red-400"
              strokeWidth={1.75}
            />
          </div>
        </div>

        {/* Content */}
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-black dark:text-white">
            Unable to open alert
          </h1>
          <p className="text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            The on-display session could not be loaded. Try again, or return to
            the portal and open the alert link once more.
          </p>
        </div>

        {error.digest && (
          <p className="mb-6 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-4 py-3 font-mono text-[12px] text-neutral-500 dark:text-neutral-400 text-center">
            Reference: {error.digest}
          </p>
        )}

        <Button
          onClick={reset}
          className="h-11 w-full rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all border-none shadow-none"
        >
          <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Try again
        </Button>

        <button
          type="button"
          onClick={() => {
            window.location.href = '/login';
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 py-2 text-[14px] text-neutral-500 dark:text-neutral-400 transition-colors hover:text-black dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Return to portal
        </button>
      </section>
    </main>
  );
}
