'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send, Hash, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
}
from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { returnInventoryItemAction, type ActionResponse } from '@/app/actions';
import type { InventoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

interface ReturnQuantityDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnSuccess: (returnedItemId: string, returnedQuantity: number) => void;
}

const returnSchema = z.object({
  quantityToReturn: z.coerce.number().min(1, "Quantity must be at least 1."),
  staffName: z.string().min(1, "Your name is required."),
});
type ReturnFormValues = z.infer<typeof returnSchema>;

export function ReturnQuantityDialog({ item, isOpen, onOpenChange, onReturnSuccess }: ReturnQuantityDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      quantityToReturn: item?.quantity,
      staffName: '',
    },
  });

  useEffect(() => {
    if (item) {
      reset({ quantityToReturn: item.quantity, staffName: '' });
    }
  }, [item, reset, isOpen]);

  if (!item) return null;

  const onSubmit = async (data: ReturnFormValues) => {
    if (data.quantityToReturn > item.quantity) {
      setError('quantityToReturn', {
        type: 'manual',
        message: `Max allowed: ${item.quantity}.`,
      });
      return;
    }
    if (!user?.email) {
      toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const response = await returnInventoryItemAction(user.email, item.id, data.quantityToReturn, data.staffName);
    setIsSubmitting(false);

    if (response.success) {
      toast({ title: 'Return Processed', description: response.message });
      onReturnSuccess(item.id, data.quantityToReturn);
      onOpenChange(false);
    } else {
      toast({ title: 'Return Failed', description: response.message || 'Could not process return.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Return: {item.productName}</DialogTitle>
          <DialogDescription className="text-xs">
            Available stock: {item.quantity} units.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="quantityToReturn" className="text-xs font-bold uppercase text-muted-foreground">Quantity to Return</Label>
               <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="quantityToReturn"
                  type="number"
                  {...register('quantityToReturn')}
                  className={cn('pl-9 h-9 text-sm', errors.quantityToReturn && 'border-destructive')}
                />
              </div>
              {errors.quantityToReturn && (
                <p className="text-[10px] text-destructive font-medium">{errors.quantityToReturn.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staffName" className="text-xs font-bold uppercase text-muted-foreground">Your Name</Label>
               <div className="relative">
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="staffName"
                  placeholder="Enter name"
                  {...register('staffName')}
                  className={cn('pl-9 h-9 text-sm', errors.staffName && 'border-destructive')}
                />
              </div>
              {errors.staffName && (
                <p className="text-[10px] text-destructive font-medium">{errors.staffName.message}</p>
              )}
            </div>
          <DialogFooter className="pt-2 grid grid-cols-2 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
              Process
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
