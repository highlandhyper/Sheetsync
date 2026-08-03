'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send, Hash } from 'lucide-react';
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
import { returnInventoryItemAction } from '@/app/actions';
import type { InventoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';

interface ReturnQuantityDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnSuccess: (returnedItemId: string, returnedQuantity: number) => void;
}

const returnSchema = z.object({
  quantityToReturn: z.coerce.number().int().min(1, "Quantity must be at least 1."),
});
type ReturnFormValues = z.infer<typeof returnSchema>;

export function ReturnQuantityDialog({ item, isOpen, onOpenChange, onReturnSuccess }: ReturnQuantityDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateInventoryItem, removeInventoryItem, refreshData } = useDataCache();
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
    },
  });

  useEffect(() => {
    if (item) {
      reset({ quantityToReturn: item.quantity });
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
    
    // OPTIMISTIC UPDATE
    const returnedQty = data.quantityToReturn;
    const newQty = item.quantity - returnedQty;
    
    if (newQty > 0) {
        updateInventoryItem({ ...item, quantity: newQty });
    } else {
        removeInventoryItem(item.id);
    }
    
    onOpenChange(false);
    onReturnSuccess(item.id, returnedQty);
    toast({ title: 'Success', description: "Processing return in background..." });

    // SYSTEM ATTRIBUTION: Uses the logged-in Admin's identity
    const processingStaff = user.email.split('@')[0].toUpperCase();

    return returnInventoryItemAction(user.email, item.id, returnedQty, processingStaff).then(response => {
        setIsSubmitting(false);
        if (!response.success) {
            toast({ variant: 'destructive', title: 'Sync Error', description: response.message || 'Failed to process return on sheet.' });
            refreshData(); 
        }
    }).catch(() => {
        setIsSubmitting(false);
        refreshData();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] rounded-3xl overflow-hidden border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight text-primary">Return Stock</DialogTitle>
          <DialogDescription className="text-xs font-medium">
            Returning <strong>{item.productName}</strong> to supplier or storage.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <Label htmlFor="quantityToReturn" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Quantity to Return</Label>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Available: {item.quantity}</span>
              </div>
               <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="quantityToReturn"
                  type="number"
                  min="1"
                  {...register('quantityToReturn', { valueAsNumber: true })}
                  onKeyDown={(e) => {
                    if (['-', 'e', 'E', '+', '.'].includes(e.key)) {
                        e.preventDefault();
                    }
                  }}
                  className={cn('pl-9 h-12 text-lg font-black bg-muted/20 border-none', errors.quantityToReturn && 'ring-2 ring-destructive')}
                />
              </div>
              {errors.quantityToReturn && (
                <p className="text-[10px] text-destructive font-bold uppercase">{errors.quantityToReturn.message}</p>
              )}
            </div>
          <DialogFooter className="pt-2 grid grid-cols-2 gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-12 font-bold rounded-xl" onClick={() => reset()}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-12 font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
