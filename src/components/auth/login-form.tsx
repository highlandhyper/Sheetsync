'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
      toast({ title: 'Authentication Successful', description: 'Session initialized. Welcome back.' });
    } else {
      toast({
        title: 'Access Denied',
        description: error || 'Invalid credentials. Please verify your identity.',
        variant: 'destructive',
      });
    }
    setFormIsSubmitting(false);
  };

  const isLoading = authIsLoading || formIsSubmitting;

  return (
    <Card className="w-full border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden transition-all duration-500">
      <CardHeader className="text-center pb-8 pt-12 px-8">
        <div className="mx-auto w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center mb-6 border border-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            SheetSync Hub
        </CardTitle>
        <CardDescription className="text-base font-medium text-slate-500 mt-2">
            Secure enterprise portal access
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 px-8">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
                Username / Email
            </Label>
            <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@enterprise.com"
                  {...register('email')}
                  className={cn(
                      "bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 h-14 pl-12 rounded-2xl font-medium transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 text-base",
                      errors.email && 'border-destructive/40 focus:ring-destructive/5'
                  )}
                />
            </div>
            {errors.email && <p className="text-[10px] text-destructive font-bold ml-1">Valid email required</p>}
          </div>

          <div className="space-y-1.5">
             <Label htmlFor="password" id="pass-label" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
                Access Key
            </Label>
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={cn(
                    "bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 h-14 pl-12 pr-12 rounded-2xl font-medium transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/5 text-base",
                    errors.password && 'border-destructive/40 focus:ring-destructive/5'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="text-[10px] text-destructive font-bold ml-1">Password required</p>}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch pb-12 pt-8 px-8">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-16 text-lg font-bold rounded-2xl shadow-2xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground group"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifying...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Sign In</span>
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>
          
          <div className="flex flex-col items-center gap-2 mt-8 opacity-40">
             <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <Activity className="h-3 w-3 animate-pulse" />
                <span>Secure Cloud Interface Active</span>
             </div>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}