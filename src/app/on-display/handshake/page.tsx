'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyOnDisplayPinOnlyAction } from '@/app/actions';
import {
  Loader2,
  ArrowLeft,
  UserCheck,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function ManualHandshakePage() {
  const router = useRouter();
  const [isVerifying, startTransition] = useTransition();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [identifiedStaff, setIdentifiedStaff] = useState<{
    name: string;
    token: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleVerify = async (val?: string) => {
    const pinToVerify = val || pin;
    if (pinToVerify.length < 4) return;

    setError('');
    startTransition(async () => {
      try {
        const res = await verifyOnDisplayPinOnlyAction(pinToVerify);
        if (res.success && res.data) {
          setIdentifiedStaff({
            name: res.data.staffName,
            token: res.data.token,
          });
        } else {
          setError(res.message || 'Access key rejection.');
          setPin('');
          inputRef.current?.focus();
        }
      } catch {
        setError('Registry handshake failure.');
      }
    });
  };

  const handleProceed = () => {
    if (!identifiedStaff) return;
    router.push(`/on-display/${identifiedStaff.token}?pin=${pin}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setError('');
    if (val.length === 4) {
      handleVerify(val);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0a0a0f] relative overflow-hidden flex flex-col items-center justify-start pt-8 pb-12">
      {/* Soft spotlight */}
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 55%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[360px] px-6 flex flex-col h-full">
        {!identifiedStaff ? (
          <div className="flex-1 flex flex-col">
            {/* Top nav */}
            <div className="flex items-center justify-between mb-12">
              <Link
                href="/login"
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <span className="text-[13px] text-neutral-400 dark:text-neutral-500">
                Help?
              </span>
            </div>

            {/* Header */}
            <div className="space-y-2 mb-10">
              <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white">
                Confirmation
              </h1>
              <p className="text-[14px] text-neutral-500 dark:text-neutral-400">
                Enter the 4-digit code sent to you by SMS.
              </p>
            </div>

            {/* PIN boxes */}
            <div className="relative flex items-center justify-start gap-3 mb-8">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-xl border text-2xl font-semibold transition-all',
                    'bg-neutral-50 dark:bg-white/5 text-black dark:text-white',
                    pin.length === index && !error
                      ? 'border-neutral-400 dark:border-white/30 ring-2 ring-black/5 dark:ring-white/10'
                      : 'border-neutral-200 dark:border-white/10',
                    error &&
                      'border-red-400/60 dark:border-red-400/40 bg-red-50/50 dark:bg-red-500/5'
                  )}
                >
                  {pin[index] ? (
                    <span className="animate-in zoom-in-75 duration-200">
                      {pin[index]}
                    </span>
                  ) : (
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 transition-all',
                        pin.length === index &&
                          'animate-pulse bg-neutral-500 dark:bg-neutral-400'
                      )}
                    />
                  )}
                </div>
              ))}

              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={handleInputChange}
                className="absolute inset-0 h-full w-full opacity-0 cursor-default"
                autoFocus
              />
            </div>

            {isVerifying && (
              <div className="flex items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[13px]">Verifying identity…</span>
              </div>
            )}

            {error && (
              <p className="text-[13px] text-red-500 dark:text-red-400 text-center">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
              <UserCheck
                className="h-7 w-7 text-neutral-700 dark:text-neutral-300"
                strokeWidth={1.75}
              />
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
                Identity confirmed
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
                {identifiedStaff.name}
              </h2>
            </div>

            <div className="w-full p-4 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 flex items-start gap-3 text-left">
              <ShieldCheck
                className="h-5 w-5 text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Authorized session identified. Proceed to load batch items.
              </p>
            </div>

            <Button
              onClick={handleProceed}
              className="w-full h-11 rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all border-none shadow-none"
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Open terminal
              </span>
            </Button>

            <button
              onClick={() => {
                setIdentifiedStaff(null);
                setPin('');
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="text-[13px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManualHandshakePage;
