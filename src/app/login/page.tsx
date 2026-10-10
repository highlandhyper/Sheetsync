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
    <div className="w-full space-y-6 px-6 pt-4 pb-10 bg-white">
      <div className="space-y-2">
        <Skeleton className="h-8 w-24 rounded-lg bg-neutral-200" />
        <Skeleton className="h-4 w-48 rounded-lg bg-neutral-100" />
      </div>
      <div className="space-y-5 pt-2">
        <Skeleton className="h-12 w-full rounded-2xl bg-neutral-100" />
        <Skeleton className="h-12 w-full rounded-2xl bg-neutral-100" />
      </div>
      <Skeleton className="h-12 w-full rounded-2xl bg-neutral-200" />
    </div>
  );
}

export default function LoginPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-white overflow-hidden">
      {/* Soft background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.015)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-[1200px] flex flex-col items-center justify-center px-6">
        {/* Landing view */}
        {!showForm ? (
          <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
            {/* Logo */}
            <div className="mb-8">
              <div className="mx-auto w-20 h-20 overflow-hidden rounded-3xl border border-neutral-200 shadow-sm mb-6">
                <Image
                  src="/logo-pwa.jpg"
                  alt="Project Logo"
                  width={80}
                  height={80}
                  className="object-cover"
                  priority
                />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-black">
                SheetSync
              </h1>
              <p className="mt-2 text-[13px] font-medium text-neutral-400 tracking-wide">
                Industrial Inventory
              </p>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3 mt-6">
              <Button
                onClick={() => setShowForm(true)}
                className="w-full h-12 text-[15px] font-medium rounded-2xl bg-black hover:bg-neutral-800 text-white group border-none shadow-none"
              >
                Log In
                <ChevronRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>

              <div className="pt-5">
                <Button
                  variant="ghost"
                  asChild
                  className="h-11 w-full rounded-2xl border border-neutral-200 bg-transparent text-neutral-500 hover:bg-neutral-50 hover:text-black transition-all text-[13px] font-medium"
                >
                  <Link href="/on-display/handshake">
                    <SmartphoneNfc className="mr-2 h-4 w-4" />
                    Staff Handshake
                  </Link>
                </Button>
              </div>
            </div>

            <p className="mt-12 text-[11px] font-medium tracking-wide text-neutral-300">
              Secure Registry Terminal
            </p>
          </div>
        ) : (
          /* Slide-up form sheet */
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/25 backdrop-blur-[2px] animate-in fade-in duration-300"
              onClick={() => setShowForm(false)}
            />

            {/* Sheet */}
            <div className="relative w-full max-w-md mx-auto bg-white rounded-t-[1.75rem] shadow-[0_-12px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-400 ease-out flex flex-col max-h-[90vh]">
              {/* Pull handle */}
              <div className="mx-auto w-10 h-1 bg-neutral-200 rounded-full mt-3 mb-1 shrink-0" />

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
  );
}
