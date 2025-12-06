
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, ShieldQuestion, KeyRound, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AuthorizeActionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthorizationSuccess: () => void;
  actionDescription: string;
}

const authSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

type AuthFormValues = z.infer<typeof authSchema>;

export function AuthorizeActionDialog({
  isOpen,
  onOpenChange,
  onAuthorizationSuccess,
  actionDescription,
}: AuthorizeActionDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { verifyCredentials } = useLocalSettingsAuth();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: '', password: '' },
  });

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
      if (!open) {
        reset();
      }
    }
  };

  const onSubmit = async (data: AuthFormValues) => {
    setIsSubmitting(true);
    const isAuthorized = verifyCredentials(data.username, data.password);
    
    // Simulate a small delay for user feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsSubmitting(false);

    if (isAuthorized) {
      toast({
        title: "Authorized",
        description: "Credentials verified successfully.",
      });
      onAuthorizationSuccess();
    } else {
      setError("username", { type: "manual", message: "Invalid username or password." });
      setError("password", { type: "manual", message: "" });
      toast({
        variant: "destructive",
        title: "Authorization Failed",
        description: "The local admin credentials provided are incorrect.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-primary">
            <ShieldQuestion className="mr-2 h-5 w-5" />
            Authorization Required
          </DialogTitle>
          <DialogDescription>
            {actionDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="authUsername">Local Admin Username</Label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="authUsername" {...register('username')} className={cn('pl-8', errors.username && 'border-destructive')} placeholder="Username" />
                </div>
                {errors.username && <p className="text-sm text-destructive mt-1">{errors.username.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="authPassword">Local Admin Password</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="authPassword" type="password" {...register('password')} className={cn('pl-8', errors.password && 'border-destructive')} placeholder="Password" />
                </div>
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Authorize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
