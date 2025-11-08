
'use client';

import { useEffect, useState, useActionState, useTransition } from 'react';
// Removed useFormStatus as it's not suitable for this manual action invocation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, Building } from 'lucide-react';
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
import { addSupplierSchema, type AddSupplierFormValues } from '@/lib/schemas';
import { addSupplierAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SubmitButtonProps {
  isPending: boolean;
}

function SubmitButton({ isPending }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building className="mr-2 h-4 w-4" /> }
      Add Supplier
    </Button>
  );
}

interface AddSupplierDialogProps {
  onSupplierAdded?: (supplier: Supplier) => void; // Optional callback
}

export function AddSupplierDialog({ onSupplierAdded }: AddSupplierDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isActionPending, startActionTransition] = useTransition();

  const [state, formAction] = useActionState<ActionResponse<Supplier> | undefined, FormData>(
    addSupplierAction,
    undefined
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors }, 
  } = useForm<AddSupplierFormValues>({
    resolver: zodResolver(addSupplierSchema),
    defaultValues: {
      supplierName: '',
    }
  });
  
  useEffect(() => {
    if (!state) return;

    if (state.success && state.data) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      onSupplierAdded?.(state.data);
      reset();
      setIsOpen(false); 
    } else if (state.message && !state.success) {
      toast({
        title: 'Error Adding Supplier',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, reset, onSupplierAdded]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset(); 
    }
    setIsOpen(open);
  };

  const processFormSubmit = (data: AddSupplierFormValues) => {
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
          <Building className="mr-2 h-4 w-4" /> Add New Supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
          <DialogDescription>
            Enter the name for the new supplier.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processFormSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="supplierName" className="text-left">
                Supplier Name
              </Label>
              <Input
                id="supplierName"
                placeholder="e.g., Global Provisions Inc."
                {...register('supplierName')}
                className={cn(formErrors.supplierName || state?.errors?.find(e => e.path.includes('supplierName')) ? 'border-destructive' : '')}
              />
              {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
              {state?.errors?.find(e => e.path.includes('supplierName')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('supplierName'))?.message}</p>}
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
