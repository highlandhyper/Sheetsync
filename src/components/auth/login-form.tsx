'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, ShieldCheck, Mail, KeyRound, ChevronRight, Activity } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { loginSchema, type LoginFormValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, loading: authIsLoading } = useAuth();
  const [formIsSubmitting, setFormIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
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
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/5 transition-transform hover:scale-105 duration-500">
            <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
            Welcome <span className="text-primary">Hub</span>
        </h1>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">
            Secure Session Gateway
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">
                Account ID
            </Label>
            <div className="relative group">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30 group-focus-within:text-primary transition-all duration-300" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@enterprise.com"
                  {...register('email')}
                  className={cn(
                      "w-full bg-transparent border-0 border-b-2 border-slate-200 dark:border-zinc-800 h-12 pl-8 rounded-none font-bold transition-all focus:border-primary focus:ring-0 text-base placeholder:text-muted-foreground/20",
                      errors.email && 'border-destructive'
                  )}
                />
            </div>
            {errors.email && <p className="text-[9px] text-destructive font-bold uppercase tracking-tighter ml-0.5">Valid email required</p>}
          </div>

          <div className="space-y-1.5">
             <Label htmlFor="password" id="pass-label" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">
                Access Key
            </Label>
            <div className="relative group">
              <KeyRound className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30 group-focus-within:text-primary transition-all duration-300" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={cn(
                    "w-full bg-transparent border-0 border-b-2 border-slate-200 dark:border-zinc-800 h-12 pl-8 pr-10 rounded-none font-bold transition-all focus:border-primary focus:ring-0 text-base placeholder:text-muted-foreground/20",
                    errors.password && 'border-destructive'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4 opacity-20" /> : <Eye className="h-4 w-4 opacity-20" />}
              </button>
            </div>
            {errors.password && <p className="text-[9px] text-destructive font-bold uppercase tracking-tighter ml-0.5">Key required</p>}
          </div>
        </div>

        <div className="pt-2 space-y-6">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground group border-none"
          >
            {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Sign In</span>
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}