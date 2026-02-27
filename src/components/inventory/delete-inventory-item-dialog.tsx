'use client';

import { useState } from 'react';
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
import { deleteInventoryItemAction } from '@/app/actions';
import type { InventoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { useAuth } from '@/context/auth-context';

interface DeleteConfirmationDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (deletedItemId: string) => void;
}

const deleteSchema = z.object({
  authUsername: z.string().min(1, "Username is required."),
  authPassword: z.string().min(1, "Password is required."),
});
type DeleteFormValues = z.infer<typeof deleteSchema>;

export function DeleteConfirmationDialog({ item, isOpen, onOpenChange, onSuccess }: DeleteConfirmationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { verifyCredentials } = useLocalSettingsAuth();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DeleteFormValues>({
    resolver: zodResolver(deleteSchema),
  });

  if (!item) return null;

  const onSubmit = async (data: DeleteFormValues) => {
    const isAuthorized = verifyCredentials(data.authUsername, data.authPassword);
    if (!isAuthorized) {
      setError("authUsername", { type: "manual", message: "Invalid credentials." });
      setError("authPassword", { type: "manual", message: "" });
      return;
    }
    if (!user?.email) return;

    setIsSubmitting(true);
    const response = await deleteInventoryItemAction(user.email, item.id);
    setIsSubmitting(false);

    if (response.success) {
      toast({ title: 'Deleted', description: response.message });
      onSuccess(item.id);
      onOpenChange(false);
      reset();
    } else {
      toast({ title: 'Error', description: response.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) { onOpenChange(open); reset(); } }}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-destructive text-lg">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription className="text-xs">
            Permanently delete log for: <strong>{item.productName}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
                <Label htmlFor="authUsername" className="text-xs font-bold uppercase text-muted-foreground">Admin Username</Label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="authUsername" {...register('authUsername')} className={cn('pl-9 h-9 text-sm', errors.authUsername && 'border-destructive')} placeholder="Username" />
                </div>
                {errors.authUsername && <p className="text-[10px] text-destructive font-medium">{errors.authUsername.message}</p>}
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="authPassword" className="text-xs font-bold uppercase text-muted-foreground">Admin Password</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="authPassword" type="password" {...register('authPassword')} className={cn('pl-9 h-9 text-sm', errors.authPassword && 'border-destructive')} placeholder="Password" />
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
              Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
