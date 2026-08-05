'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, KeyRound, Eye, EyeOff, Activity, ChevronRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const lockScreenSchema = z.object({
  password: z.string().min(1, "Password is required."),
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
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsSubmitting(false);

    if (isAuthorized) {
      toast({
        title: "Unlocked",
        description: `Welcome back, ${user?.email?.split('@')[0] || 'user'}!`,
      });
      onUnlock();
    } else {
      setError("password", { type: "manual", message: "Verification failed." });
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "The local administrator key provided is incorrect.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 dark:bg-zinc-950/95 backdrop-blur-xl animate-fade-in overflow-hidden p-4">
        {/* TECHNICAL LAYER: Grid & Spotlights */}
        <div className="absolute inset-0 bg-tech-grid z-0 opacity-100" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]" />
        
        {/* DYNAMIC ACCENTS */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm space-y-10 animate-in fade-in zoom-in-95 duration-700 ease-out">
            <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/5 transition-transform hover:scale-105 duration-500">
                    <LockKeyhole className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                    Security <span className="text-primary">Gate</span>
                </h1>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">
                    Protocol: Inactivity Lock
                </p>
                <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">
                        Admin Session: <span className="text-foreground font-black">{user?.email}</span>
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-1.5">
                    <Label htmlFor="lock-password" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">
                        Local Access Key
                    </Label>
                    <div className="relative group">
                        <KeyRound className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-all duration-300" />
                        <Input 
                            id="lock-password" 
                            type={showPassword ? 'text' : 'password'}
                            {...register('password')}
                            className={cn(
                                "bg-transparent border-0 border-b-2 border-slate-200 dark:border-zinc-800 h-12 pl-7 pr-10 rounded-none font-bold transition-all focus:border-primary focus:ring-0 text-base placeholder:text-muted-foreground/20",
                                errors.password && 'border-destructive'
                            )} 
                            placeholder="••••••••"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                            aria-label={showPassword ? "Hide access key" : "Show access key"}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4 opacity-40" /> : <Eye className="h-4 w-4 opacity-40" />}
                        </button>
                    </div>
                    {errors.password && <p className="text-[9px] text-destructive font-bold uppercase tracking-tighter ml-0.5">Key Verification Required</p>}
                </div>

                <div className="pt-2 space-y-6">
                    <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full h-14 text-base font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground group border-none"
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-3">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Decrypting...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <span>Verify & Resume</span>
                                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        )}
                    </Button>
                    
                    <div className="flex flex-col items-center gap-2 opacity-40">
                        <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                            <Activity className="h-2.5 w-2.5 animate-pulse" />
                            <span>Security Handshake Active</span>
                        </div>
                    </div>
                </div>
            </form>

            <div className="pt-12 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/20">
                    End-to-End Encryption Hub v4.1
                </p>
            </div>
        </div>
    </div>
  );
}
