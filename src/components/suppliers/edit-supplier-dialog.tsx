
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
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
import { editSupplierSchema, type EditSupplierFormValues } from '@/lib/schemas';
import { editSupplierAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';

function SubmitButton({isPending}: {isPending: boolean}) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

interface EditSupplierDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSupplierUpdated?: () => void;
}

export function EditSupplierDialog({ isOpen, onOpenChange, supplier, onSupplierUpdated }: EditSupplierDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isDirty },
  } = useForm<EditSupplierFormValues>({
    resolver: zodResolver(editSupplierSchema),
    defaultValues: {
      supplierId: supplier?.id || '',
      currentSupplierName: supplier?.name || '',
      newSupplierName: supplier?.name || '',
    }
  });
  
  useEffect(() => {
    if (supplier) {
      reset({
        supplierId: supplier.id,
        currentSupplierName: supplier.name,
        newSupplierName: supplier.name,
      });
    }
  }, [supplier, reset, isOpen]);

  const handleFormSubmit = (data: EditSupplierFormValues) => {
    if (!isDirty) {
        toast({ title: 'No Changes', description: 'The supplier name has not been changed.' });
        onOpenChange(false);
        return;
    }
    const formData = new FormData();
    formData.append('supplierId', supplier?.id || data.supplierId);
    formData.append('currentSupplierName', supplier?.name || data.currentSupplierName);
    formData.append('newSupplierName', data.newSupplierName);
    
    startTransition(async () => {
        const state = await editSupplierAction(undefined, formData);
        if (state?.success) {
            toast({
                title: 'Success!',
                description: state.message,
            });
            onSupplierUpdated?.();
            onOpenChange(false); 
        } else if (state?.message && !state.success) {
            toast({
                title: 'Error Updating Supplier',
                description: state.message,
                variant: 'destructive',
            });
        }
    });
  };
  
  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Supplier: {supplier.name}</DialogTitle>
          <DialogDescription>
            Update the name for this supplier. This will update the name in the supplier list and all associated inventory and return log records. This can be a slow operation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <input type="hidden" {...register('supplierId')} value={supplier.id} />
          <input type="hidden" {...register('currentSupplierName')} value={supplier.name} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="newSupplierName" className="text-left">
                New Supplier Name
              </Label>
              <Input
                id="newSupplierName"
                placeholder="Enter new supplier name"
                {...register('newSupplierName')}
                className={cn(formErrors.newSupplierName && 'border-destructive')}
              />
              {formErrors.newSupplierName && <p className="text-sm text-destructive mt-1">{formErrors.newSupplierName.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </DialogClose>
            <SubmitButton isPending={isPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    