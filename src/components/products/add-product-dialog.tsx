
'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { addProductAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
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
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      barcode: '',
      productName: '',
      supplierName: '',
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
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
    startTransition(async () => {
      const state = await addProductAction(undefined, formData);
      if (state?.success) {
        toast({
          title: 'Success!',
          description: state.message,
          variant: 'default',
        });
        reset();
        setIsOpen(false);
      } else if (state?.message && !state.success) {
        toast({
          title: 'Error Adding Product',
          description: state.message,
          variant: 'destructive',
        });
      }
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
                className={cn(formErrors.barcode && 'border-destructive')}
              />
              {formErrors.barcode && <p className="text-sm text-destructive mt-1">{formErrors.barcode.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="productName" className="text-left">
                Product Name
              </Label>
              <Input
                id="productName"
                placeholder="e.g., Organic Almond Milk"
                {...register('productName')}
                className={cn(formErrors.productName && 'border-destructive')}
              />
              {formErrors.productName && <p className="text-sm text-destructive mt-1">{formErrors.productName.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="supplierName" className="text-left">
                Supplier Name
              </Label>
              <Input
                id="supplierName"
                placeholder="e.g., Green Pastures Ltd."
                {...register('supplierName')}
                className={cn(formErrors.supplierName && 'border-destructive')}
              />
              {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <SubmitButton isPending={isPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    