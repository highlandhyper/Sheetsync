'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send, Package, Hash } from 'lucide-react';
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
import { bulkReturnInventoryItemsAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';

interface BulkReturnDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds: string[];
  itemCount: number;
  onSuccess: () => void;
}

const returnSchema = z.object({
  returnType: z.enum(['all', 'specific']),
  quantity: z.coerce.number().int().optional(),
}).refine(data => {
    if (data.returnType === 'specific' && (data.quantity === undefined || data.quantity < 1)) {
        return false;
    }
    return true;
}, {
    message: "Quantity >= 1 required.",
    path: ['quantity'],
});

type ReturnFormValues = z.infer<typeof returnSchema>;

export function BulkReturnDialog({ isOpen, onOpenChange, itemIds, itemCount, onSuccess }: BulkReturnDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshData } = useDataCache();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnType, setReturnType] = useState<'all' | 'specific'>('all');
  const [returnError, setReturnError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      returnType: 'all',
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
      if (!open) {
        reset();
        setReturnType('all');
        setReturnError(null);
      }
    }
  };

  const onSubmit = async (data: ReturnFormValues) => {
    if (isSubmitting) return;

    if (!user?.email) {
      toast({
        variant: 'destructive',
        title: 'Return failed',
        description: 'Your session could not be identified. Please sign in again and retry.',
      });
      return;
    }

    if (itemIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No items selected',
        description: 'Select at least one inventory item to return.',
      });
      return;
    }

    setIsSubmitting(true);
    setReturnError(null);
    const processingStaff = user.email.split('@')[0].toUpperCase();

    try {
      // Wait for the server action to finish before closing the dialog or
      // changing the local inventory cache. This prevents false success UI.
      const response = await bulkReturnInventoryItemsAction(
        user.email,
        itemIds,
        processingStaff,
        data.returnType,
        data.quantity
      );

      if (!response?.success) {
        const message = response?.message || 'The return could not be saved. Refresh inventory before retrying.';
        setReturnError(message);
        toast({
          variant: 'destructive',
          title: 'Return failed',
          description: message,
        });

        // A batch may have partially completed, so always reconcile with Sheets.
        try {
          await refreshData();
        } catch (refreshError) {
          console.error('Failed to refresh inventory after return failure:', refreshError);
        }
        return;
      }

      try {
        await refreshData();
      } catch (refreshError) {
        console.error('Return succeeded, but inventory refresh failed:', refreshError);
      }

      toast({
        title: 'Return completed',
        description: `Successfully processed return for ${itemIds.length} selected item(s).`,
      });
      setReturnError(null);
      onOpenChange(false);
      onSuccess();
      reset();
      setReturnType('all');
    } catch (error) {
      console.error('Bulk return request failed:', error);

      const message = error instanceof Error
        ? error.message
        : 'The server did not return a usable response. Refresh inventory before retrying.';
      setReturnError(message);
      toast({
        variant: 'destructive',
        title: 'Return request failed',
        description: message,
      });

      try {
        await refreshData();
      } catch (refreshError) {
        console.error('Failed to refresh inventory after return request error:', refreshError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl overflow-hidden border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-primary">Bulk Return</DialogTitle>
          <DialogDescription className="text-xs font-medium">
            Processing return for <span className="text-primary font-bold">{itemCount} selected log entries</span>.
          </DialogDescription>
        </DialogHeader>

        {returnError && (
          <div role="alert" aria-live="assertive" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
            <p className="font-bold">Return failed</p>
            <p className="mt-1">{returnError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <RadioGroup
            value={returnType}
            onValueChange={(value: 'all' | 'specific') => setReturnType(value)}
            className="grid grid-cols-2 gap-3"
            disabled={isSubmitting}
          >
            <div>
                <RadioGroupItem value="all" id="bulkReturnAll" className="peer sr-only" />
                <Label
                    htmlFor="bulkReturnAll"
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-muted bg-popover p-4 text-[10px] font-black uppercase tracking-widest hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                >
                    <Package className="mb-2 h-6 w-6 text-primary" />
                    All Units
                </Label>
            </div>

             <div>
                <RadioGroupItem value="specific" id="bulkReturnSpecific" className="peer sr-only" />
                <Label
                     htmlFor="bulkReturnSpecific"
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-muted bg-popover p-4 text-[10px] font-black uppercase tracking-widest hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                >
                    <Hash className="mb-2 h-6 w-6 text-primary" />
                    Set Qty
                </Label>
            </div>
          </RadioGroup>
          <input type="hidden" {...register('returnType')} value={returnType} />

          {returnType === 'specific' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <Label htmlFor="bulkQty" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Quantity per Item</Label>
              <Input
                id="bulkQty"
                type="number"
                min="1"
                disabled={isSubmitting}
                {...register('quantity', { valueAsNumber: true })}
                onKeyDown={(e) => {
                    if (['-', 'e', 'E', '+', '.'].includes(e.key)) {
                        e.preventDefault();
                    }
                }}
                className={cn('h-12 font-black text-lg bg-muted/20 border-none', errors.quantity && 'ring-2 ring-destructive')}
              />
              {errors.quantity && <p className="text-[10px] text-destructive font-bold uppercase">{errors.quantity.message}</p>}
            </div>
          )}

          <DialogFooter className="pt-2 grid grid-cols-2 gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-12 font-bold rounded-xl" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-12 font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
              {isSubmitting ? 'Processing…' : 'Process Bulk'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
