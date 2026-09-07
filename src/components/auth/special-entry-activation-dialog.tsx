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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  KeyRound,
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
      timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
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
        className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl sm:max-w-[440px]"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        {/* Header */}
        <div className="border-b border-border/50 bg-muted/20 px-4 py-4 sm:px-5 sm:py-5">
          <DialogHeader className="space-y-0 text-left">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Verify access
                </DialogTitle>

                <DialogDescription className="mt-1 text-[10px] font-medium leading-4 text-muted-foreground sm:text-[11px]">
                  Enter the 4-digit security key sent to the authorized mobile number.
                </DialogDescription>
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[8px] font-semibold text-emerald-600 sm:flex">
                <LockKeyhole className="h-3 w-3" />
                Secure
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* Session identity */}
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <UserRound className="h-3 w-3" />
                Personnel
              </div>

              <p className="mt-1 truncate text-[10px] font-semibold text-foreground sm:text-[11px]">
                {displayStaffName}
              </p>
            </div>

            <div className="min-w-0 rounded-xl bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Smartphone className="h-3 w-3" />
                Delivery
              </div>

              <p className="mt-1 truncate text-[10px] font-semibold text-foreground sm:text-[11px]">
                SMS Gateway
              </p>
            </div>
          </div>

          {/* OTP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="special-entry-otp"
                className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Security key
              </Label>

              <span className="text-[8px] font-medium text-muted-foreground">
                4 digits
              </span>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />

              <Input
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
                  if (
                    event.key === 'Enter' &&
                    otp.length === 4 &&
                    !isBusy
                  ) {
                    handleActivate();
                  }
                }}
                placeholder="••••"
                autoFocus
                className={cn(
                  'h-14 rounded-xl border-border/60 bg-background pl-10 pr-3 text-center font-mono text-2xl font-bold tracking-[0.35em] shadow-none',
                  'placeholder:tracking-[0.35em] placeholder:text-muted-foreground/30',
                  isError
                    ? 'border-destructive bg-destructive/[0.025] text-destructive focus-visible:ring-destructive/20'
                    : 'focus-visible:border-primary focus-visible:ring-primary/15'
                )}
              />
            </div>

            {isError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                <div className="min-w-0">
                  <p className="text-[9px] font-semibold">
                    Security key not accepted
                  </p>
                  <p className="mt-0.5 text-[8px] leading-3.5 opacity-80">
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
                'flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5',
                verificationAttempts >= 2
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              )}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold">
                  Attempt {verificationAttempts} of 3
                </p>
                <p className="mt-0.5 text-[8px] leading-3.5 opacity-80">
                  Access is blocked after 3 failed verification attempts.
                </p>
              </div>
            </div>
          )}

          {/* Verify */}
          <Button
            onClick={handleActivate}
            disabled={otp.length < 4 || isBusy}
            className="h-11 w-full rounded-xl text-[10px] font-semibold shadow-none"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify & activate
              </>
            )}
          </Button>

          {/* Resend */}
          <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/50 pt-3">
            <div className="min-w-0">
              <p className="text-[9px] font-medium text-muted-foreground">
                Didn’t receive the key?
              </p>

              {resendCooldown > 0 && (
                <p className="mt-0.5 text-[8px] text-muted-foreground/70">
                  New key available in {resendCooldown}s
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={
                resendCooldown > 0 ||
                isResending ||
                isVerifying
              }
              onClick={handleResend}
              className="h-9 shrink-0 rounded-lg px-3 text-[9px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
            >
              {isResending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw
                  className={cn(
                    'mr-1.5 h-3.5 w-3.5',
                    resendCooldown > 0 && 'opacity-30'
                  )}
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
