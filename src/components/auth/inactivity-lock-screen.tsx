'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '@/context/auth-context';

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
      setError("password", { type: "manual", message: "Incorrect password." });
      toast({
        variant: "destructive",
        title: "Unlock Failed",
        description: "The password provided is incorrect.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
        <Card className="w-full max-w-sm shadow-2xl">
            <CardHeader className="text-center">
                 <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 w-fit">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                 </div>
                <CardTitle className="text-2xl">Session Locked</CardTitle>
                <CardDescription>For your security, your session has been locked due to inactivity. Please enter your local password to continue.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="lock-password">Local Password</Label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                id="lock-password" 
                                type="password" 
                                {...register('password')}
                                className={errors.password ? 'border-destructive pl-8' : 'pl-8'} 
                                placeholder="Enter password"
                                autoFocus
                            />
                        </div>
                        {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Unlock
                    </Button>
                </CardContent>
            </form>
        </Card>
    </div>
  );
}
