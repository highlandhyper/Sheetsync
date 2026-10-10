'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { loginSchema, type LoginFormValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  onBack?: () => void;
}

export function LoginForm({ onBack }: LoginFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { login, loading: authIsLoading } = useAuth();
  const [formIsSubmitting, setFormIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const passwordValue = watch('password');

  const onSubmit = async (data: LoginFormValues) => {
    setFormIsSubmitting(true);
    const { success, error, role: determinedRole } = await login(data);
    if (success) {
      if (determinedRole === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/inventory/add');
      }
      toast({ title: 'Success', description: 'Logged in successfully.' });
    } else {
      toast({
        title: 'Access Denied',
        description: error || 'Invalid credentials.',
        variant: 'destructive',
      });
    }
    setFormIsSubmitting(false);
  };

  const isLoading = authIsLoading || formIsSubmitting;

  return (
    <div className="w-full px-6 pb-10 pt-1 bg-white dark:bg-neutral-950 text-black dark:text-white">
      {/* Close button */}
      <div className="mb-8">
        <button
          onClick={onBack}
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Header */}
      <div className="mb-9">
        <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white leading-none">
          Log In
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500 dark:text-neutral-400">
          Add your email and password.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400"
          >
            Your email
          </Label>
          <input
            id="email"
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            {...register('email')}
            className={cn(
              'w-full h-12 rounded-2xl border-0 px-4 text-[15px]',
              'bg-neutral-100 dark:bg-neutral-900',
              'text-black dark:text-white',
              'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
              'outline-none transition-all',
              'focus:bg-white dark:focus:bg-neutral-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10',
              errors.email && 'ring-2 ring-black/15 dark:ring-white/15'
            )}
          />
          {errors.email && (
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              Please enter a valid email
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400"
          >
            Your password
          </Label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className={cn(
                'w-full h-12 rounded-2xl border-0 pl-4 pr-20 text-[15px]',
                'bg-neutral-100 dark:bg-neutral-900',
                'text-black dark:text-white',
                'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                'outline-none transition-all',
                'focus:bg-white dark:focus:bg-neutral-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10',
                errors.password && 'ring-2 ring-black/15 dark:ring-white/15'
              )}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
              {passwordValue && (
                <button
                  type="button"
                  onClick={() => setValue('password', '')}
                  className="p-2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                  aria-label="Clear password"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
          {errors.password && (
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              Password is required
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-2xl bg-black dark:bg-white text-[15px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all border-none shadow-none"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Log In'
            )}
          </Button>
        </div>

        {/* Forgot password */}
        <div className="pt-1 text-center">
          <button
            type="button"
            className="text-[13px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
          >
            Forgot your password?
          </button>
        </div>
      </form>
    </div>
  );
}
