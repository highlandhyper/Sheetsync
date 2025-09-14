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
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

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
  staffName: z.string().min(1, "Your name is required."),
}).refine(data => {
    if (data.returnType === 'specific' && (data.quantity === undefined || data.quantity < 1)) {
        return false;
    }
    return true;
}, {
    message: "A quantity of at least 1 is required for 'Specific Quantity'.",
    path: ['quantity'],
});

type ReturnFormValues = z.infer<typeof returnSchema>;

export function BulkReturnDialog({ isOpen, onOpenChange, itemIds, itemCount, onSuccess }: BulkReturnDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnType, setReturnType] = useState<'all' | 'specific'>('all');

  const {
    register,
    handleSubmit,
    reset,
    watch,
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
    setIsSubmitting(true);
    const response = await bulkReturnInventoryItemsAction(itemIds, data.staffName, data.returnType, data.quantity);
    setIsSubmitting(false);

    if (response.success) {
      toast({
        title: 'Bulk Return Processed',
        description: response.message,
      });
      onSuccess();
      handleOpenChange(false);
    } else {
      toast({
        title: 'Bulk Return Failed',
        description: response.message || 'Could not process the bulk return.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Return Confirmation</DialogTitle>
          <DialogDescription>
            You are about to process a return for {itemCount} selected item(s).
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="default" className="bg-primary/10">
          <Package className="h-4 w-4" />
          <AlertTitle>How many to return?</AlertTitle>
          <AlertDescription>
            Choose to return all stock for each selected item, or return a specific quantity from each.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <RadioGroup
            value={returnType}
            onValueChange={(value: 'all' | 'specific') => setReturnType(value)}
            className="grid grid-cols-2 gap-4"
          >
            <div>
                <RadioGroupItem value="all" id="returnAll" className="peer sr-only" />
                <Label
                    htmlFor="returnAll"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                    <Package className="mb-3 h-6 w-6" />
                    Return ALL Stock
                </Label>
            </div>

             <div>
                <RadioGroupItem value="specific" id="returnSpecific" className="peer sr-only" />
                <Label
                     htmlFor="returnSpecific"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                    <Hash className="mb-3 h-6 w-6" />
                    Specific Quantity
                </Label>
            </div>
          </RadioGroup>
          <input type="hidden" {...register('returnType')} value={returnType} />

          {returnType === 'specific' && (
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity to Return from Each Item</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="e.g., 5"
                {...register('quantity')}
                className={cn(errors.quantity && 'border-destructive')}
              />
              {errors.quantity && <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="staffName">Your Name (Processing Return)</Label>
            <Input
              id="staffName"
              placeholder="Enter your full name"
              {...register('staffName')}
              className={cn(errors.staffName && 'border-destructive')}
            />
            {errors.staffName && <p className="text-sm text-destructive mt-1">{errors.staffName.message}</p>}
          </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
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
