
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trash2, AlertTriangle, KeyRound, User, Package } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
      setError("authUsername", { type: "manual", message: "Invalid username or password." });
      setError("authPassword", { type: "manual", message: "" });
      toast({ variant: "destructive", title: "Authorization Failed", description: "The local admin credentials provided are incorrect." });
      return;
    }
    if (!user?.email) {
      toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const response = await deleteInventoryItemAction(user.email, item.id);
    setIsSubmitting(false);

    if (response.success) {
      toast({
        title: 'Deletion Successful',
        description: response.message,
      });
      onSuccess(item.id);
      onOpenChange(false);
      reset();
    } else {
      toast({
        title: 'Deletion Failed',
        description: response.message || 'Could not delete the item.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) { onOpenChange(open); reset(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Confirm Permanent Deletion
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the inventory log entry.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 p-4 border rounded-md bg-muted/50 space-y-2 text-sm">
            <div className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" /><span className="font-semibold">{item.productName}</span></div>
            <div><span className="font-medium text-muted-foreground">Barcode:</span> {item.barcode}</div>
            <div><span className="font-medium text-muted-foreground">Quantity:</span> {item.quantity}</div>
            <div><span className="font-medium text-muted-foreground">Location:</span> {item.location}</div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Authorization Required</AlertTitle>
                <AlertDescription>
                    Enter local admin credentials to confirm this permanent deletion.
                </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label htmlFor="authUsername">Local Admin Username</Label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="authUsername" {...register('authUsername')} className={cn('pl-8', errors.authUsername && 'border-destructive')} placeholder="Username" />
                </div>
                {errors.authUsername && <p className="text-sm text-destructive mt-1">{errors.authUsername.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="authPassword">Local Admin Password</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="authPassword" type="password" {...register('authPassword')} className={cn('pl-8', errors.authPassword && 'border-destructive')} placeholder="Password" />
                </div>
                {errors.authPassword && <p className="text-sm text-destructive mt-1">{errors.authPassword.message}</p>}
            </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
