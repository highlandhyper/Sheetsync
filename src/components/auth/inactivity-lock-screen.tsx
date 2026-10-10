'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, LockKeyhole, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const lockScreenSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

type LockScreenFormValues = z.infer<typeof lockScreenSchema>;

interface InactivityLockScreenProps {
  onUnlock: () => void;
}

export function InactivityLockScreen({ onUnlock }: InactivityLockScreenProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { verifyCredentials, credentials } = useLocalSettingsAuth();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LockScreenFormValues>({
    resolver: zodResolver(lockScreenSchema),
  });

  const onSubmit = async (data: LockScreenFormValues) => {
    setIsSubmitting(true);
    const isAuthorized = verifyCredentials(credentials.username, data.password);

    await new Promise((resolve) => setTimeout(resolve, 300));

    setIsSubmitting(false);

    if (isAuthorized) {
      toast({
        title: 'Unlocked',
        description: 'Session resumed.',
      });
      onUnlock();
    } else {
      setError('password', { type: 'manual', message: 'Verification failed.' });
      toast({
        variant: 'destructive',
        title: 'Invalid Key',
        description: 'The local administrator key is incorrect.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white dark:bg-[#0a0a0f] overflow-hidden p-4">
      {/* Soft spotlight */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,0,0,0.04) 0%, transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 55%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
            <LockKeyhole
              className="h-6 w-6 text-neutral-700 dark:text-neutral-300"
              strokeWidth={1.75}
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white">
            Session locked
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500 dark:text-neutral-400">
            Enter your local access key to continue
          </p>
          {user?.email && (
            <p className="mt-3 text-[12px] text-neutral-400 dark:text-neutral-500">
              {user.email}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="lock-password"
              className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400"
            >
              Access key
            </Label>
            <div className="relative">
              <input
                id="lock-password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                autoFocus
                placeholder="••••••••"
                className={cn(
                  'w-full h-11 rounded-xl border px-4 pr-11 text-[14px]',
                  'bg-neutral-50 dark:bg-white/5',
                  'border-neutral-200 dark:border-white/10',
                  'text-black dark:text-white',
                  'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                  'outline-none transition-all',
                  'focus:border-neutral-400 dark:focus:border-white/25 focus:ring-0',
                  errors.password && 'border-red-400/60 dark:border-red-400/40'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide key' : 'Show key'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-[12px] text-neutral-500">Verification required</p>
            )}
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all border-none shadow-none"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Verify & Resume
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-10 text-center text-[12px] text-neutral-400 dark:text-neutral-500">
          Registry protection is active
        </p>
      </div>
    </div>
  );
}
