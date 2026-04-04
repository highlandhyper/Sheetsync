
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ShieldAlert, Eye, EyeOff, Mail, KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const createUserSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function UserManager() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: CreateUserFormValues) => {
    setIsSubmitting(true);
    
    // Use a secondary Firebase app instance to create the user 
    // without signing out the current Admin user.
    const tempAppName = `temp-app-${Date.now()}`;
    let tempApp;

    try {
      tempApp = initializeApp(firebaseConfig as any, tempAppName);
      const tempAuth = getAuth(tempApp);
      
      await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
      
      toast({
        title: "User Created",
        description: `Successfully registered ${data.email} in Firebase Authentication.`,
      });
      reset();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not create the user account.",
      });
    } finally {
      if (tempApp) {
        await deleteApp(tempApp);
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-primary/5 border-primary/20">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm font-bold uppercase tracking-tight">Security Note</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          New users will be registered in Firebase Auth. In this system, any email other than 'viewer@example.com' is automatically treated as an Administrator.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-email">Account Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="new-email"
              type="email"
              placeholder="user@example.com"
              {...register('email')}
              className={errors.email ? 'border-destructive pl-9' : 'pl-9'}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">Account Password</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className={errors.password ? 'border-destructive pl-9 pr-10' : 'pl-9 pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-bold shadow-lg shadow-primary/20">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Register User to Firebase
        </Button>
      </form>
    </div>
  );
}
