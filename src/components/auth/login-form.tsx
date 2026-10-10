
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, X, ArrowLeft, KeyRound, Mail } from 'lucide-react';
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
    <div className="w-full px-6 pb-12 pt-4 bg-black text-white">
      {/* DISMISS BUTTON */}
      <div className="mb-8">
        <button
          onClick={onBack}
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/60 text-zinc-400 transition-all hover:text-white active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* HEADER */}
      <div className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Registry Entry</h1>
        <p className="text-sm font-medium text-zinc-500">Provide account credentials to synchronize.</p>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
          {/* EMAIL FIELD */}
          <div className="space-y-2.5">
            <Label htmlFor="email" className="ml-1 text-[10px] font-black uppercase tracking-widest text-zinc-700">
                Personnel email
            </Label>
            <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  {...register('email')}
                  className={cn(
                      "w-full h-14 bg-zinc-900/40 border-zinc-800 border rounded-2xl pl-11 pr-5 font-bold transition-all focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 text-white placeholder:text-zinc-800",
                      errors.email && 'border-destructive/40 bg-destructive/5'
                  )}
                />
            </div>
            {errors.email && <p className="text-[9px] text-destructive font-bold uppercase tracking-tight ml-1">Valid identity required</p>}
          </div>

          {/* PASSWORD FIELD */}
          <div className="space-y-2.5">
             <Label htmlFor="password" className="ml-1 text-[10px] font-black uppercase tracking-widest text-zinc-700">
                Access password
            </Label>
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700 group-focus-within:text-emerald-500 transition-colors" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={cn(
                    "w-full h-14 bg-zinc-900/40 border-zinc-800 border rounded-2xl pl-11 pr-12 font-bold transition-all focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 text-white placeholder:text-zinc-800",
                    errors.password && 'border-destructive/40 bg-destructive/5'
                )}
              />
              
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-700 hover:text-white transition-colors p-2"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
              </div>
            </div>
            {errors.password && <p className="text-[9px] text-destructive font-bold uppercase tracking-tight ml-1">Security key required</p>}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="pt-4 space-y-6">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-16 text-xs font-black uppercase tracking-[0.2em] rounded-full shadow-2xl shadow-emerald-500/10 bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-[0.98] border-none"
          >
            {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
                "Authorize Session"
            )}
          </Button>

          <div className="text-center">
              <button type="button" className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">
                  Identity Handshake Help
              </button>
          </div>
        </div>
      </form>
    </div>
  );
}
