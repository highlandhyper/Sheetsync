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
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto font-bold">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

interface EditSupplierDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export function EditSupplierDialog({ isOpen, onOpenChange, supplier }: EditSupplierDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateSupplier, refreshData } = useDataCache();
  const [isActionPending, startActionTransition] = useTransition();

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
    if (supplier && isOpen) {
      reset({
        supplierId: supplier.id,
        currentSupplierName: supplier.name,
        newSupplierName: supplier.name,
      });
    }
  }, [supplier, reset, isOpen]);

  const handleFormSubmit = (data: EditSupplierFormValues) => {
    if (!supplier) return;
    
    if (!isDirty) {
        onOpenChange(false);
        return;
    }
    
    const formData = new FormData();
    formData.append('supplierId', supplier.id || data.supplierId);
    formData.append('currentSupplierName', supplier.name || data.currentSupplierName);
    formData.append('newSupplierName', data.newSupplierName);
    formData.append('userEmail', user?.email || 'Admin');
    
    startActionTransition(async () => {
      // 1. OPTIMISTIC UPDATE: Instant feedback locally
      const oldName = supplier.name;
      const newName = data.newSupplierName;
      
      updateSupplier(oldName, newName);
      onOpenChange(false); // CLOSE DIALOG INSTANTLY
      
      toast({
        title: 'Registry Update Initiated',
        description: `Renaming "${oldName}" to "${newName}" in background...`,
      });

      try {
        const result = await editSupplierAction(undefined, formData);
        
        if (result.success) {
          toast({
            title: 'Update Successful',
            description: `Registry updated. all associated logs now reflect "${newName}".`,
          });
          refreshData(); // Final sync to confirm all changes
        } else {
          toast({
            title: 'Sync Error',
            description: result.message || 'Cloud rename failed. Reverting local changes...',
            variant: 'destructive',
          });
          refreshData(); // REVERT
        }
      } catch (error) {
        toast({
          title: 'Connection Error',
          description: 'Failed to reach registry service. Reverting local changes...',
          variant: 'destructive',
        });
        refreshData();
      }
    });
  };
  
  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Rename Master Registry: {supplier.name}</DialogTitle>
          <DialogDescription>
            Updating this name will propagate changes to all associated products and inventory logs. This ensures data consistency.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <input type="hidden" {...register('supplierId')} value={supplier.id} />
          <input type="hidden" {...register('currentSupplierName')} value={supplier.name} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 items-center">
              <Label htmlFor="newSupplierName" className="text-left font-bold uppercase text-[10px] text-muted-foreground tracking-widest">
                New Master Name
              </Label>
              <Input
                id="newSupplierName"
                placeholder="Enter new supplier name"
                {...register('newSupplierName')}
                className={cn("h-11 font-semibold", formErrors.newSupplierName && 'border-destructive')}
              />
              {formErrors.newSupplierName && <p className="text-xs text-destructive mt-1 font-medium">{formErrors.newSupplierName.message}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
                <Button type="button" variant="outline" className="font-bold">Cancel</Button>
            </DialogClose>
            <SubmitButton isPending={isActionPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
