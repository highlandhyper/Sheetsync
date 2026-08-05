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
import { Loader2, LogIn, Eye, EyeOff, ShieldCheck, Mail, KeyRound, ChevronRight } from 'lucide-react';
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
      let description = 'Establishing secure handshake...';
      if (determinedRole === 'admin') {
        description = 'Welcome back, Chief! Administrative console active.';
        router.push('/dashboard');
      } else if (determinedRole === 'viewer') {
        router.push('/inventory/add');
      } else {
        router.push('/dashboard');
      }
      toast({ title: 'Authentication Verified', description: description });
    } else {
      toast({
        title: 'Access Denied',
        description: error || 'Verification failed. Please check credentials.',
        variant: 'destructive',
      });
    }
    setFormIsSubmitting(false);
  };

  const isLoading = authIsLoading || formIsSubmitting;

  return (
    <Card className="w-full border-white/20 dark:border-white/10 shadow-2xl bg-white/60 dark:bg-slate-950/40 backdrop-blur-2xl rounded-3xl overflow-hidden animate-in slide-in-from-bottom-6 duration-1000 ease-out">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
      
      <CardHeader className="text-center pb-4 pt-8">
        <CardTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase flex items-center justify-center gap-2">
            System Authentication
        </CardTitle>
        <CardDescription className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            Enterprise Asset Management v4
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 pt-2">
          <div className="space-y-2 group">
            <div className="flex justify-between items-center ml-1">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Operational ID
                </Label>
                {errors.email && <span className="text-[9px] text-destructive font-black uppercase tracking-tight">{errors.email.message}</span>}
            </div>
            <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                id="email"
                type="email"
                placeholder="you@enterprise.com"
                {...register('email')}
                className={cn(
                    "bg-white/50 dark:bg-slate-900/50 border-white/40 dark:border-slate-800 h-13 pl-11 rounded-2xl font-bold transition-all focus:ring-4 focus:ring-primary/10 text-base",
                    errors.email && 'border-destructive focus:ring-destructive/10'
                )}
                />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
                <Label htmlFor="password" id="pass-label" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Access Key
                </Label>
                {errors.password && <span className="text-[9px] text-destructive font-black uppercase tracking-tight">{errors.password.message}</span>}
            </div>
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={cn(
                    "bg-white/50 dark:bg-slate-900/50 border-white/40 dark:border-slate-800 h-13 pl-11 pr-12 rounded-2xl font-bold transition-all focus:ring-4 focus:ring-primary/10 text-base",
                    errors.password && 'border-destructive focus:ring-destructive/10'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-4 pb-8 pt-4">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground group"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="animate-pulse">Authorizing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Secure Login</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>
          
          <div className="flex items-center justify-center gap-1.5 opacity-50">
             <ShieldCheck className="h-3 w-3 text-primary" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em]">End-to-End Encryption Active</span>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
