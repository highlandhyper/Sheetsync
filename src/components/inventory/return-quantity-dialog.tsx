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

interface ReturnQuantityDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnSuccess: () => void; // Callback for when return is successful
}

const returnSchema = z.object({
  quantityToReturn: z.coerce.number().min(1, "Quantity must be at least 1."),
  staffName: z.string().min(1, "Your name is required to process the return."), // Added staff name
});
type ReturnFormValues = z.infer<typeof returnSchema>;

export function ReturnQuantityDialog({ item, isOpen, onOpenChange, onReturnSuccess }: ReturnQuantityDialogProps) {
  const { toast } = useToast();
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
        message: `Cannot return more than available (${item.quantity}).`,
      });
      return;
    }
    setIsSubmitting(true);
    const response = await returnInventoryItemAction(item.id, data.quantityToReturn, data.staffName);
    setIsSubmitting(false);

    if (response.success) {
      toast({
        title: 'Return Processed',
        description: response.message,
      });
      onReturnSuccess(); // Call success callback
      onOpenChange(false); // Close dialog
    } else {
      toast({
        title: 'Return Failed',
        description: response.message || 'Could not process the return.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Return Item: {item.productName}</DialogTitle>
          <DialogDescription>
            Enter the quantity you are returning and your name. Available: {item.quantity}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantityToReturn">Quantity to Return</Label>
               <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="quantityToReturn"
                  type="number"
                  {...register('quantityToReturn')}
                  className={cn('pl-8', errors.quantityToReturn && 'border-destructive')}
                />
              </div>
              {errors.quantityToReturn && (
                <p className="text-sm text-destructive mt-1">{errors.quantityToReturn.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffName">Your Name (Processing Return)</Label>
               <div className="relative">
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="staffName"
                  placeholder="Enter your name"
                  {...register('staffName')}
                  className={cn('pl-8', errors.staffName && 'border-destructive')}
                />
              </div>
              {errors.staffName && (
                <p className="text-sm text-destructive mt-1">{errors.staffName.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => reset()}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Process Return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
