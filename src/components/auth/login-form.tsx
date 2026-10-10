'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, X, Mail, KeyRound, ChevronRight } from 'lucide-react';
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
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setFormIsSubmitting(true);
    const { success, error, role: determinedRole } = await login(data);
    if (success) {
      if (determinedRole === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/inventory/add');
      }
      toast({ title: 'Success', description: 'Session initialized.' });
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
    <div className="w-full px-6 pb-12 pt-4">
      {/* DISMISS BUTTON */}
      <div className="mb-8">
        <button
          onClick={onBack}
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 text-foreground transition-all hover:bg-muted active:scale-90"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* HEADER */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Log In</h1>
        <p className="text-sm font-medium text-muted-foreground">Add your email and password.</p>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
          {/* EMAIL FIELD */}
          <div className="space-y-2.5">
            <Label htmlFor="email" className="ml-1 text-[11px] font-bold text-muted-foreground/60">
                Your email
            </Label>
            <div className="relative group">
                <input
                  id="email"
                  type="email"
                  placeholder="alexsmith.mobbin+1@gmail.com"
                  {...register('email')}
                  className={cn(
                      "w-full h-14 bg-muted/30 border-0 rounded-2xl px-5 font-medium transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 text-base placeholder:text-muted-foreground/30",
                      errors.email && 'ring-2 ring-destructive/20'
                  )}
                />
            </div>
            {errors.email && <p className="text-[10px] text-destructive font-bold ml-1">Valid email required</p>}
          </div>

          {/* PASSWORD FIELD */}
          <div className="space-y-2.5">
             <Label htmlFor="password" className="ml-1 text-[11px] font-bold text-muted-foreground/60">
                Your password
            </Label>
            <div className="relative group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder=""
                {...register('password')}
                className={cn(
                    "w-full h-14 bg-muted/30 border-0 rounded-2xl px-5 font-medium transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 text-base",
                    errors.password && 'ring-2 ring-destructive/20'
                )}
              />
              
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setValue('password', '')}
                    className="text-muted-foreground/20 hover:text-muted-foreground transition-colors p-1"
                  >
                    <div className="h-5 w-5 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                        <X className="h-3 w-3 text-background" strokeWidth={4} />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground/30 hover:text-primary transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
              </div>
            </div>
            {errors.password && <p className="text-[10px] text-destructive font-bold ml-1">Password required</p>}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="pt-4 space-y-6">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-16 text-lg font-bold rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.98] border-none"
          >
            {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
                "Log In"
            )}
          </Button>

          <div className="text-center">
              <button type="button" className="text-xs font-bold text-muted-foreground/60 underline underline-offset-4 decoration-muted-foreground/20 hover:text-primary transition-colors">
                  Forgot your password?
              </button>
          </div>
        </div>
      </form>
    </div>
  );
}
