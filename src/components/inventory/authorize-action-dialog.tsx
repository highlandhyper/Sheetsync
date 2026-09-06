'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldQuestion,
  User,
} from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  username: z.string().min(1, 'Identity is required.'),
  password: z.string().min(1, 'Access key is required.'),
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
  const { verifyCredentials } = useLocalSettingsAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
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
    defaultValues: {
      username: fixedIdentifier || '',
      password: '',
    },
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
        try {
          await signInWithEmailAndPassword(
            auth,
            identifier,
            data.password,
          );

          isAuthorized = true;
        } catch (firebaseErr: any) {
          console.error('Re-auth failed:', firebaseErr.code);
          isAuthorized = false;
        }
      } else {
        isAuthorized = verifyCredentials(
          identifier,
          data.password,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 400));

      if (isAuthorized) {
        toast({
          title: 'Identity Verified',
          description: isEmail
            ? 'Cloud credentials confirmed.'
            : 'Administrative access granted.',
        });

        onAuthorizationSuccess();
      } else {
        setError('password', {
          type: 'manual',
          message: isEmail
            ? 'Invalid password for this account.'
            : 'Invalid access key for this identity.',
        });

        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: isEmail
            ? 'The password provided is incorrect.'
            : 'The access key is incorrect.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'System Error',
        description:
          'An unexpected error occurred during verification.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const {
    ref: passwordHookRef,
    ...passwordProps
  } = register('password');

  const isFixedEmail = fixedIdentifier?.includes('@');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-1.5rem)] max-w-[360px]
          overflow-hidden rounded-[26px]
          border-0 bg-background p-0 shadow-2xl
        "
      >
        <div className="px-4 pb-2 pt-5 sm:px-5 sm:pt-6">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldQuestion className="h-5 w-5" />
              </div>

              <div className="min-w-0 pt-0.5">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Verification
                </DialogTitle>

                <DialogDescription className="mt-1 text-xs leading-5 text-muted-foreground">
                  {actionDescription}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 px-4 pb-4 pt-2 sm:px-5 sm:pb-5"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="authUsername"
              className="ml-0.5 text-[11px] font-semibold text-foreground"
            >
              Account
            </Label>

            <div className="relative">
              {isFixedEmail ? (
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
              ) : (
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}

              <Input
                id="authUsername"
                {...register('username')}
                readOnly={!!fixedIdentifier}
                placeholder="Email or username"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    passwordInputRef.current?.focus();
                  }
                }}
                className={cn(
                  `
                    h-11 w-full rounded-xl border-0
                    bg-muted/40 pl-9 pr-3
                    text-base font-medium shadow-none
                    outline-none ring-0
                    focus-visible:ring-0
                    focus-visible:ring-offset-0
                    sm:text-sm
                  `,
                  fixedIdentifier &&
                    'cursor-not-allowed bg-primary/[0.06] text-primary',
                  errors.username &&
                    'bg-destructive/10',
                )}
              />
            </div>

            {errors.username && (
              <div className="flex items-center gap-1.5 px-0.5">
                <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
                <p className="text-[10px] leading-none text-destructive">
                  {errors.username.message}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="authPassword"
              className="ml-0.5 text-[11px] font-semibold text-foreground"
            >
              {isFixedEmail ? 'Login password' : 'Access key'}
            </Label>

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                id="authPassword"
                type="password"
                {...passwordProps}
                ref={(element) => {
                  passwordHookRef(element);
                  passwordInputRef.current = element;
                }}
                placeholder="••••••••"
                autoFocus={!!fixedIdentifier}
                className={cn(
                  `
                    h-11 w-full rounded-xl border-0
                    bg-muted/40 pl-9 pr-3
                    text-base font-medium shadow-none
                    outline-none ring-0
                    focus-visible:ring-0
                    focus-visible:ring-offset-0
                    sm:text-sm
                  `,
                  errors.password &&
                    'bg-destructive/10',
                )}
              />
            </div>

            {errors.password && (
              <div className="flex items-center gap-1.5 px-0.5">
                <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
                <p className="text-[10px] leading-none text-destructive">
                  {errors.password.message}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                className="
                  h-11 rounded-xl
                  bg-muted/35 text-xs font-semibold
                  shadow-none hover:bg-muted/50
                "
              >
                Cancel
              </Button>
            </DialogClose>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="
                h-11 rounded-xl
                bg-primary text-xs font-semibold
                shadow-none
              "
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}

              Authorize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
