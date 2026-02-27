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

interface BulkReturnDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds: string[];
  itemCount: number;
  onSuccess: () => void;
}

const returnSchema = z.object({
  returnType: z.enum(['all', 'specific']),
  quantity: z.coerce.number().optional(),
  staffName: z.string().min(1, "Name is required."),
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnType, setReturnType] = useState<'all' | 'specific'>('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      returnType: 'all',
      staffName: '',
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
      if (!open) {
        reset();
        setReturnType('all');
      }
    }
  };

  const onSubmit = async (data: ReturnFormValues) => {
    if (!user?.email) return;
    setIsSubmitting(true);
    const response = await bulkReturnInventoryItemsAction(user.email, itemIds, data.staffName, data.returnType, data.quantity);
    setIsSubmitting(false);

    if (response.success) {
      toast({ title: 'Success', description: response.message });
      onSuccess();
      handleOpenChange(false);
    } else {
      toast({ title: 'Failed', description: response.message || 'Error processing returns.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Bulk Return ({itemCount})</DialogTitle>
          <DialogDescription className="text-xs">
            Process returns for all selected items.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <RadioGroup
            value={returnType}
            onValueChange={(value: 'all' | 'specific') => setReturnType(value)}
            className="grid grid-cols-2 gap-2"
          >
            <div>
                <RadioGroupItem value="all" id="returnAll" className="peer sr-only" />
                <Label
                    htmlFor="returnAll"
                    className="flex flex-col items-center justify-center rounded-md border border-muted bg-popover p-2 text-[10px] font-bold uppercase hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                    <Package className="mb-1 h-4 w-4" />
                    All Stock
                </Label>
            </div>

             <div>
                <RadioGroupItem value="specific" id="returnSpecific" className="peer sr-only" />
                <Label
                     htmlFor="returnSpecific"
                    className="flex flex-col items-center justify-center rounded-md border border-muted bg-popover p-2 text-[10px] font-bold uppercase hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                    <Hash className="mb-1 h-4 w-4" />
                    Quantity
                </Label>
            </div>
          </RadioGroup>
          <input type="hidden" {...register('returnType')} value={returnType} />

          {returnType === 'specific' && (
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-bold uppercase text-muted-foreground">Qty per Item</Label>
              <Input
                id="quantity"
                type="number"
                {...register('quantity')}
                className={cn('h-9 text-sm', errors.quantity && 'border-destructive')}
              />
              {errors.quantity && <p className="text-[10px] text-destructive font-medium">{errors.quantity.message}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="staffName" className="text-xs font-bold uppercase text-muted-foreground">Your Name</Label>
            <Input
              id="staffName"
              placeholder="Full name"
              {...register('staffName')}
              className={cn('h-9 text-sm', errors.staffName && 'border-destructive')}
            />
            {errors.staffName && <p className="text-[10px] text-destructive font-medium">{errors.staffName.message}</p>}
          </div>

          <DialogFooter className="pt-2 grid grid-cols-2 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
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
