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
import { Loader2, LogIn, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { loginSchema, type LoginFormValues } from '@/lib/schemas';

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
      let description = 'Welcome back!';
      if (determinedRole === 'admin') {
        description = 'Welcome back, Chief!';
        router.push('/dashboard');
      } else if (determinedRole === 'viewer') {
        router.push('/inventory/add');
      } else {
        router.push('/dashboard');
      }
      toast({ title: 'Login Successful', description: description });
    } else {
      toast({
        title: 'Login Failed',
        description: error || 'An unknown error occurred. Please try again.',
        variant: 'destructive',
      });
    }
    setFormIsSubmitting(false);
  };

  const isLoading = authIsLoading || formIsSubmitting;

  return (
    <Card className="w-full max-w-sm border-0 sm:border shadow-none sm:shadow-2xl bg-transparent sm:bg-card/40 sm:backdrop-blur-xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto bg-primary/10 p-3 rounded-2xl w-fit mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-black tracking-tight uppercase">Welcome Back</CardTitle>
        <CardDescription className="font-medium">Enter your credentials to continue</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-4 px-0 sm:px-6">
          <div className="space-y-2 group">
            <Label htmlFor="email" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              className={errors.email ? 'border-destructive bg-background/50 h-12 text-base' : 'bg-background/50 focus:ring-primary/20 h-12 text-base'}
            />
            {errors.email && <p className="text-[10px] text-destructive font-bold mt-1 ml-1">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" id="pass-label" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={errors.password ? 'border-destructive pr-10 bg-background/50 h-12 text-base' : 'pr-10 bg-background/50 focus:ring-primary/20 h-12 text-base'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="text-[10px] text-destructive font-bold mt-1 ml-1">{errors.password.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4 pt-4 px-0 sm:px-6">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-14 sm:h-12 font-black uppercase tracking-tighter shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Logging In...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <LogIn className="h-5 w-5" />
                <span>Login</span>
              </div>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}