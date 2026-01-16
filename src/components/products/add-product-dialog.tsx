
'use client';

import { useEffect, useState, useActionState, useTransition } from 'react';
// Removed useFormStatus as it's not suitable for this manual action invocation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { addProductAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SubmitButtonProps {
  isPending: boolean;
}

function SubmitButton({ isPending }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
      Add Product
    </Button>
  );
}

export function AddProductDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isActionPending, startActionTransition] = useTransition();

  const [state, formAction] = useActionState<ActionResponse<Product> | undefined, FormData>(
    addProductAction,
    undefined
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors }, // Renamed to avoid conflict with action state.errors
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      barcode: '',
      productName: '',
      supplierName: '',
      costPrice: undefined,
    }
  });
  
  useEffect(() => {
    if (!state) return; // Do nothing if state is initial (undefined)

    if (state.success) {
      toast({
        title: 'Success!',
        description: state.message,
        variant: 'default',
      });
      reset();
      setIsOpen(false); 
    } else if (state.message && !state.success) {
      toast({
        title: 'Error Adding Product',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, reset]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset(); // Reset form when dialog is closed
    }
    setIsOpen(open);
  };

  const processFormSubmit = (data: AddProductFormValues) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    startActionTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Enter the details for the new product and its supplier. The supplier will be created if they don't exist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processFormSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="barcode" className="text-left">
                Barcode
              </Label>
              <Input
                id="barcode"
                placeholder="e.g., 1234567890123"
                {...register('barcode')}
                className={cn(formErrors.barcode || state?.errors?.find(e => e.path.includes('barcode')) ? 'border-destructive' : '')}
              />
              {formErrors.barcode && <p className="text-sm text-destructive mt-1">{formErrors.barcode.message}</p>}
              {state?.errors?.find(e => e.path.includes('barcode')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('barcode'))?.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="productName" className="text-left">
                Product Name
              </Label>
              <Input
                id="productName"
                placeholder="e.g., Organic Almond Milk"
                {...register('productName')}
                className={cn(formErrors.productName || state?.errors?.find(e => e.path.includes('productName')) ? 'border-destructive' : '')}
              />
              {formErrors.productName && <p className="text-sm text-destructive mt-1">{formErrors.productName.message}</p>}
               {state?.errors?.find(e => e.path.includes('productName')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('productName'))?.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="supplierName" className="text-left">
                Supplier Name
              </Label>
              <Input
                id="supplierName"
                placeholder="e.g., Green Pastures Ltd."
                {...register('supplierName')}
                className={cn(formErrors.supplierName || state?.errors?.find(e => e.path.includes('supplierName')) ? 'border-destructive' : '')}
              />
              {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
              {state?.errors?.find(e => e.path.includes('supplierName')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('supplierName'))?.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="costPrice" className="text-left">
                Cost Price
              </Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                placeholder="e.g., 12.99"
                {...register('costPrice')}
                className={cn(formErrors.costPrice && 'border-destructive')}
              />
              {formErrors.costPrice && <p className="text-sm text-destructive mt-1">{formErrors.costPrice.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <SubmitButton isPending={isActionPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
