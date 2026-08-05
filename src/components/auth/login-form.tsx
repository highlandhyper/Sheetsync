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
import { Loader2, Eye, EyeOff, ShieldCheck, Mail, KeyRound, ChevronRight, Binary, Activity } from 'lucide-react';
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
      let description = 'Handshake verified. Access granted.';
      if (determinedRole === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/inventory/add');
      }
      toast({ title: 'Auth Success', description: description });
    } else {
      toast({
        title: 'Access Denied',
        description: error || 'Handshake failed. Invalid credentials.',
        variant: 'destructive',
      });
    }
    setFormIsSubmitting(false);
  };

  const isLoading = authIsLoading || formIsSubmitting;

  return (
    <Card className="w-full border-2 border-slate-200 dark:border-zinc-800 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden transition-all duration-500">
      {/* SYSTEM PROGRESS BAR */}
      <div className="h-1.5 w-full bg-primary/10">
         <div className={cn("h-full bg-primary transition-all duration-1000 ease-in-out", isLoading ? "w-full animate-pulse" : "w-1/3")} />
      </div>
      
      <CardHeader className="text-center pb-8 pt-10 px-8">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5 border-2 border-primary/20 shadow-inner">
            <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">
            Authentication Hub
        </CardTitle>
        <CardDescription className="flex items-center justify-center gap-2 mt-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black px-2 py-0.5 uppercase tracking-widest">
                <Activity className="h-2.5 w-2.5 mr-1 animate-pulse" /> System Active
            </Badge>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-50 flex items-center gap-1">
                <Binary className="h-2.5 w-2.5" /> SECURE PORT 9002
            </span>
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6 pt-2 px-8">
          {/* IDENTITY FIELD */}
          <div className="space-y-2 group">
            <div className="flex justify-between items-center px-1">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Operator Identity
                </Label>
                {errors.email && <span className="text-[9px] text-destructive font-black uppercase">Required</span>}
            </div>
            <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@enterprise.com"
                  {...register('email')}
                  className={cn(
                      "bg-slate-50 dark:bg-zinc-800/50 border-2 border-transparent h-14 pl-12 rounded-2xl font-bold transition-all focus:bg-white dark:focus:bg-zinc-800 focus:border-primary/20 focus:ring-4 focus:ring-primary/5 text-base",
                      errors.email && 'border-destructive/20 focus:ring-destructive/5'
                  )}
                />
            </div>
          </div>

          {/* ACCESS KEY FIELD */}
          <div className="space-y-2 group">
             <div className="flex justify-between items-center px-1">
                <Label htmlFor="password" id="pass-label" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Secure Access Key
                </Label>
                {errors.password && <span className="text-[9px] text-destructive font-black uppercase">Invalid</span>}
            </div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={cn(
                    "bg-slate-50 dark:bg-zinc-800/50 border-2 border-transparent h-14 pl-12 pr-12 rounded-2xl font-bold transition-all focus:bg-white dark:focus:bg-zinc-800 focus:border-primary/20 focus:ring-4 focus:ring-primary/5 text-base",
                    errors.password && 'border-destructive/20 focus:ring-destructive/5'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-6 pb-12 pt-8 px-8">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-16 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground text-sm group"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Validating...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Initiate Session</span>
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>
          
          <div className="flex items-center justify-center gap-3 opacity-30 group">
             <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800 group-hover:bg-primary/50 transition-colors" />
             <span className="text-[8px] font-black uppercase tracking-[0.4em] whitespace-nowrap">Encryption Active v4.2</span>
             <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800 group-hover:bg-primary/50 transition-colors" />
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function Badge({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'outline' }) {
    return (
        <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
            variant === 'outline' ? "border border-input" : "bg-primary text-primary-foreground",
            className
        )}>
            {children}
        </span>
    );
}
