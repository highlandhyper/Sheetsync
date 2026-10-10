'use client';

import { useState, Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';
import { SmartphoneNfc, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

function LoginFormSkeleton() {
  return (
    <div className="w-full space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
        <Skeleton className="h-11 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/80" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
        <Skeleton className="h-11 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/80" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

export default function LoginPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="relative min-h-[100dvh] bg-white dark:bg-[#0a0a0f] overflow-hidden">
      {/* ========== DESKTOP LAYOUT (≥ lg) ========== */}
      <div className="hidden lg:flex min-h-[100dvh] flex-col items-center justify-center relative">
        {/* Soft spotlight from top */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,0,0,0.04) 0%, transparent 60%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 dark:block hidden"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 55%)',
          }}
        />

        {/* Centered content */}
        <div className="relative z-10 w-full max-w-[400px] px-6">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/40">
              <Image
                src="/logo-pwa.jpg"
                alt="SheetSync"
                width={48}
                height={48}
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white">
              Welcome back
            </h1>
            <p className="mt-2 text-[14px] text-neutral-500 dark:text-neutral-400">
              Sign in to your SheetSync account
            </p>
          </div>

          {/* Form */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm desktop />
          </Suspense>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[12px]">
              <span className="bg-white dark:bg-[#0a0a0f] px-3 text-neutral-400 dark:text-neutral-500">
                or
              </span>
            </div>
          </div>

          {/* Staff Handshake */}
          <Button
            variant="ghost"
            asChild
            className="h-11 w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all text-[13px] font-medium"
          >
            <Link href="/on-display/handshake">
              <SmartphoneNfc className="mr-2 h-4 w-4" />
              Staff Manual Handshake
            </Link>
          </Button>

          {/* Footer note */}
          <p className="mt-10 text-center text-[12px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Secure industrial inventory access.
            <br />
            End-to-end encrypted session.
          </p>
        </div>
      </div>

      {/* ========== MOBILE LAYOUT (< lg) ========== */}
      <div className="lg:hidden relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-white dark:bg-neutral-950" />

        <div className="relative z-10 w-full max-w-[1200px] flex flex-col items-center justify-center px-6">
          {!showForm ? (
            <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-8">
                <div className="mx-auto w-20 h-20 overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm mb-6">
                  <Image
                    src="/logo-pwa.jpg"
                    alt="Project Logo"
                    width={80}
                    height={80}
                    className="object-cover"
                    priority
                  />
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-white">
                  SheetSync
                </h1>
                <p className="mt-2 text-[13px] font-medium text-neutral-400 dark:text-neutral-500 tracking-wide">
                  Industrial Inventory
                </p>
              </div>

              <div className="w-full space-y-3 mt-6">
                <Button
                  onClick={() => setShowForm(true)}
                  className="w-full h-12 text-[15px] font-medium rounded-2xl bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black group border-none shadow-none"
                >
                  Log In
                  <ChevronRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>

                <div className="pt-5">
                  <Button
                    variant="ghost"
                    asChild
                    className="h-11 w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-black dark:hover:text-white transition-all text-[13px] font-medium"
                  >
                    <Link href="/on-display/handshake">
                      <SmartphoneNfc className="mr-2 h-4 w-4" />
                      Staff Handshake
                    </Link>
                  </Button>
                </div>
              </div>

              <p className="mt-12 text-[11px] font-medium tracking-wide text-neutral-300 dark:text-neutral-600">
                Secure Registry Terminal
              </p>
            </div>
          ) : (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <div
                className="absolute inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={() => setShowForm(false)}
              />
              <div className="relative w-full max-w-md mx-auto bg-white dark:bg-neutral-950 rounded-t-[1.75rem] shadow-[0_-12px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom duration-400 ease-out flex flex-col max-h-[90vh]">
                <div className="mx-auto w-10 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full mt-3 mb-1 shrink-0" />
                <div className="overflow-y-auto">
                  <Suspense fallback={<LoginFormSkeleton />}>
                    <LoginForm onBack={() => setShowForm(false)} />
                  </Suspense>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
