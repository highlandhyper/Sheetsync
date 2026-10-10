'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Smartphone,
  UserRound,
  CheckCircle2,
  LockKeyhole,
} from 'lucide-react';
import type { SpecialEntryRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SpecialEntryActivationDialogProps {
  session: SpecialEntryRequest;
  onActivate: (otp: string) => Promise<boolean>;
  onResend: () => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpecialEntryActivationDialog({
  session,
  onActivate,
  onResend,
  isOpen,
  onOpenChange,
}: SpecialEntryActivationDialogProps) {
  const { toast } = useToast();

  const [otp, setOtp] = useState('');
  const [isError, setIsError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setIsError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleActivate = async () => {
    setIsVerifying(true);
    const success = await onActivate(otp);
    setIsVerifying(false);

    if (success) {
      toast({
        title: 'Silent Mode Activated',
        description: `Authorization confirmed for ${session.staffName}.`,
      });
      onOpenChange(false);
    } else {
      setIsError(true);
      setOtp('');
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    const success = await onResend();
    setIsResending(false);

    if (success) {
      toast({
        title: 'New Key Dispatched',
        description: 'Identity key routed to mobile terminal.',
      });
      setResendCooldown(30);
      setOtp('');
      setIsError(false);
    }
  };

  const verificationAttempts = session.verificationAttempts ?? 0;

  const displayStaffName =
    session.staffName === 'ALL PERSONNEL (GLOBAL)'
      ? 'ALL PERSONNEL'
      : session.staffName;

  const isBusy = isVerifying || isResending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl sm:max-w-[420px]"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Header */}
        <div className="border-b border-neutral-100 dark:border-white/5 px-5 py-5">
          <DialogHeader className="space-y-0 text-left">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                <LockKeyhole
                  className="h-[18px] w-[18px] text-neutral-700 dark:text-neutral-300"
                  strokeWidth={1.75}
                />
              </div>

              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight text-black dark:text-white sm:text-lg">
                  Verify access
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400 leading-snug">
                  Enter the 4-digit security key sent to the authorized mobile
                  number.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-5">
          {/* Session identity */}
          <div className="grid min-w-0 grid-cols-2 gap-2.5">
            <div className="min-w-0 rounded-xl bg-neutral-50 dark:bg-white/5 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <UserRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                Personnel
              </div>
              <p className="mt-1.5 truncate text-[13px] font-medium text-black dark:text-white">
                {displayStaffName}
              </p>
            </div>

            <div className="min-w-0 rounded-xl bg-neutral-50 dark:bg-white/5 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <Smartphone className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delivery
              </div>
              <p className="mt-1.5 truncate text-[13px] font-medium text-black dark:text-white">
                SMS Gateway
              </p>
            </div>
          </div>

          {/* OTP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="special-entry-otp"
                className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400"
              >
                Security key
              </Label>
              <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                4 digits
              </span>
            </div>

            <input
              id="special-entry-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={otp}
              disabled={isBusy}
              onChange={(event) => {
                setIsError(false);
                const value = event.target.value.replace(/[^0-9]/g, '');
                setOtp(value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && otp.length === 4 && !isBusy) {
                  handleActivate();
                }
              }}
              placeholder="••••"
              autoFocus
              className={cn(
                'w-full h-14 rounded-xl border text-center font-mono text-2xl font-semibold tracking-[0.4em]',
                'bg-neutral-50 dark:bg-white/5',
                'border-neutral-200 dark:border-white/10',
                'text-black dark:text-white',
                'placeholder:tracking-[0.4em] placeholder:text-neutral-300 dark:placeholder:text-neutral-600',
                'outline-none transition-all',
                'focus:border-neutral-400 dark:focus:border-white/25 focus:ring-0',
                isError &&
                  'border-red-400/60 dark:border-red-400/40 bg-red-50/50 dark:bg-red-500/5 text-red-600 dark:text-red-400'
              )}
            />

            {isError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 px-3.5 py-3 text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">
                    Security key not accepted
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug opacity-80">
                    Check the latest SMS and enter the current 4-digit key.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Attempts */}
          {verificationAttempts > 0 && !isResending && (
            <div
              className={cn(
                'flex min-w-0 items-center gap-2.5 rounded-xl px-3.5 py-3',
                verificationAttempts >= 2
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
              )}
            >
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  Attempt {verificationAttempts} of 3
                </p>
                <p className="mt-0.5 text-[12px] leading-snug opacity-80">
                  Access is blocked after 3 failed verification attempts.
                </p>
              </div>
            </div>
          )}

          {/* Verify */}
          <Button
            onClick={handleActivate}
            disabled={otp.length < 4 || isBusy}
            className="h-11 w-full rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all border-none shadow-none"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Verify & activate
              </>
            )}
          </Button>

          {/* Resend */}
          <div className="flex min-w-0 items-center justify-between gap-3 border-t border-neutral-100 dark:border-white/5 pt-4">
            <div className="min-w-0">
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                Didn&apos;t receive the key?
              </p>
              {resendCooldown > 0 && (
                <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                  New key available in {resendCooldown}s
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={resendCooldown > 0 || isResending || isVerifying}
              onClick={handleResend}
              className="h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
            >
              {isResending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw
                  className={cn(
                    'mr-1.5 h-3.5 w-3.5',
                    resendCooldown > 0 && 'opacity-30'
                  )}
                  strokeWidth={1.75}
                />
              )}
              {resendCooldown > 0 ? 'Please wait' : 'Resend key'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
