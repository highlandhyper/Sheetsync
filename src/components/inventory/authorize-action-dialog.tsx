'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, ShieldQuestion, KeyRound, User, Mail, AlertCircle } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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

interface AuthorizeActionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthorizationSuccess: () => void;
  actionDescription: string;
  fixedIdentifier?: string;
}

const authSchema = z.object({
  username: z.string().min(1, "Identity is required."),
  password: z.string().min(1, "Access key is required."),
});

type AuthFormValues = z.infer<typeof authSchema>;

export function AuthorizeActionDialog({
  isOpen,
  onOpenChange,
  onAuthorizationSuccess,
  actionDescription,
  fixedIdentifier,
}: AuthorizeActionDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { verifyCredentials } = useLocalSettingsAuth();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: fixedIdentifier || '', password: '' },
  });

  useEffect(() => {
    if (isOpen && fixedIdentifier) {
      setValue('username', fixedIdentifier);
    }
  }, [isOpen, fixedIdentifier, setValue]);

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
    const identifier = fixedIdentifier || data.username;
    const isEmail = identifier.includes('@');

    try {
        let isAuthorized = false;

        if (isEmail && auth) {
            // FIREBASE RE-AUTHENTICATION: Use login password
            try {
                await signInWithEmailAndPassword(auth, identifier, data.password);
                isAuthorized = true;
            } catch (firebaseErr: any) {
                console.error("Re-auth failed:", firebaseErr.code);
                isAuthorized = false;
            }
        } else {
            // LOCAL KEY FALLBACK: Use generic admin key
            isAuthorized = verifyCredentials(identifier, data.password);
        }

        // Simulate a small delay for user feedback
        await new Promise(resolve => setTimeout(resolve, 400));

        if (isAuthorized) {
            toast({
                title: "Identity Verified",
                description: isEmail ? "Cloud credentials confirmed." : "Administrative access granted.",
            });
            onAuthorizationSuccess();
        } else {
            setError("password", { 
                type: "manual", 
                message: isEmail ? "Invalid password for this account." : "Invalid access key for this identity." 
            });
            toast({
                variant: "destructive",
                title: "Verification Failed",
                description: isEmail ? "The password provided is incorrect." : "The access key is incorrect.",
            });
        }
    } catch (e) {
        toast({
            variant: "destructive",
            title: "System Error",
            description: "An unexpected error occurred during verification.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const { ref: passwordHookRef, ...passwordProps } = register('password');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px] rounded-3xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-primary text-xl font-black uppercase tracking-tight">
            <ShieldQuestion className="mr-3 h-6 w-6 text-primary" />
            Verification
          </DialogTitle>
          <DialogDescription className="text-xs font-medium leading-relaxed">
            {actionDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
                <Label htmlFor="authUsername" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Account Identity</Label>
                <div className="relative">
                    {fixedIdentifier?.includes('@') ? (
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    ) : (
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input 
                        id="authUsername" 
                        {...register('username')} 
                        readOnly={!!fixedIdentifier}
                        className={cn(
                            'pl-9 h-11 text-sm font-bold', 
                            fixedIdentifier ? 'bg-primary/5 border-primary/20 cursor-not-allowed text-primary' : '',
                            errors.username && 'border-destructive'
                        )} 
                        placeholder="Identity (Email or Username)" 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                passwordInputRef.current?.focus();
                            }
                        }}
                    />
                </div>
                {errors.username && <p className="text-[10px] text-destructive font-bold uppercase tracking-tight ml-1">{errors.username.message}</p>}
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="authPassword" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                    {fixedIdentifier?.includes('@') ? "Login Password" : "Access Key"}
                </Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="authPassword" 
                        type="password" 
                        {...passwordProps}
                        ref={(e) => {
                            passwordHookRef(e);
                            (passwordInputRef as any).current = e;
                        }}
                        className={cn('pl-9 h-11 text-sm font-bold bg-muted/20 border-white/10', errors.password && 'border-destructive')} 
                        placeholder="••••••••" 
                        autoFocus={!!fixedIdentifier}
                    />
                </div>
                {errors.password && <p className="text-[10px] text-destructive font-bold uppercase tracking-tight ml-1">{errors.password.message}</p>}
            </div>

          <DialogFooter className="pt-2 grid grid-cols-2 gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11 font-bold rounded-xl" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11 font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Authorize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
