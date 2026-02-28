'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trash2, AlertTriangle, KeyRound, User } from 'lucide-react';
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
import { bulkDeleteInventoryItemsAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { useAuth } from '@/context/auth-context';

interface BulkDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds: string[];
  itemCount: number;
  onSuccess: () => void;
}

const deleteSchema = z.object({
  authUsername: z.string().min(1, "Username is required."),
  authPassword: z.string().min(1, "Password is required."),
});
type DeleteFormValues = z.infer<typeof deleteSchema>;

export function BulkDeleteDialog({ isOpen, onOpenChange, itemIds, itemCount, onSuccess }: BulkDeleteDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { verifyCredentials } = useLocalSettingsAuth();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DeleteFormValues>({
    resolver: zodResolver(deleteSchema),
  });

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
      if (!open) reset();
    }
  };

  const onSubmit = async (data: DeleteFormValues) => {
    const isAuthorized = verifyCredentials(data.authUsername, data.authPassword);
    if (!isAuthorized) {
      setError("authUsername", { type: "manual", message: "Invalid credentials." });
      setError("authPassword", { type: "manual", message: "" });
      return;
    }
    if (!user?.email) return;

    setIsSubmitting(true);
    const response = await bulkDeleteInventoryItemsAction(user.email, itemIds);
    setIsSubmitting(false);

    if (response.success) {
      toast({ title: 'Success', description: response.message });
      onSuccess();
      handleOpenChange(false);
    } else {
      toast({ title: 'Failed', description: response.message, variant: 'destructive' });
    }
  };

  const { ref: passwordHookRef, ...passwordProps } = register('authPassword');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-destructive text-lg">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Bulk Delete
          </DialogTitle>
          <DialogDescription className="text-xs">
            Permanently delete {itemCount} log entries. No undo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
                <Label htmlFor="authUsernameBulk" className="text-xs font-bold uppercase text-muted-foreground">Admin Username</Label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="authUsernameBulk" 
                        {...register('authUsername')} 
                        className={cn('pl-9 h-9 text-sm', errors.authUsername && 'border-destructive')} 
                        placeholder="Username" 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                passwordInputRef.current?.focus();
                            }
                        }}
                    />
                </div>
                {errors.authUsername && <p className="text-[10px] text-destructive font-medium">{errors.authUsername.message}</p>}
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="authPasswordBulk" className="text-xs font-bold uppercase text-muted-foreground">Admin Password</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="authPasswordBulk" 
                        type="password" 
                        {...passwordProps} 
                        ref={(e) => {
                            passwordHookRef(e);
                            (passwordInputRef as any).current = e;
                        }}
                        className={cn('pl-9 h-9 text-sm', errors.authPassword && 'border-destructive')} 
                        placeholder="Password" 
                    />
                </div>
                {errors.authPassword && <p className="text-[10px] text-destructive font-medium">{errors.authPassword.message}</p>}
            </div>

          <DialogFooter className="pt-2 grid grid-cols-2 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
              Delete {itemCount}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
