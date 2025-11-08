
'use client';

import { useEffect, useState, useActionState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, Check, ChevronsUpDown } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { saveProductAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product, Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';

interface CreateProductFromInventoryDialogProps {
  barcode: string;
  allSuppliers: Supplier[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
      Create Product
    </Button>
  );
}

export function CreateProductFromInventoryDialog({ barcode, allSuppliers, isOpen, onOpenChange, onSuccess }: CreateProductFromInventoryDialogProps) {
  const { toast } = useToast();
  const [isActionPending, startActionTransition] = useTransition();
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResponse<Product> | undefined, FormData>(
    saveProductAction,
    undefined
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors: formErrors },
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      barcode: barcode,
      productName: '',
      supplierName: '',
    }
  });

  const supplierNameValue = watch('supplierName');
  
  useEffect(() => {
    reset({
      barcode: barcode,
      productName: '',
      supplierName: '',
    });
  }, [barcode, reset, isOpen]);

  useEffect(() => {
    if (!state) return;

    if (state.success) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      onSuccess();
      onOpenChange(false);
    } else if (state.message && !state.success) {
      toast({
        title: 'Error Creating Product',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, onOpenChange, onSuccess]);

  const processFormSubmit = (data: AddProductFormValues) => {
    const formData = new FormData();
    formData.append('barcode', data.barcode);
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('editMode', 'create'); // Always creating here
    
    startActionTransition(() => {
      formAction(formData);
    });
  };

  const sortedSuppliers = useMemo(() => {
    return [...allSuppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [allSuppliers]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
          <DialogDescription>
            This product was not found in your catalog. Add its details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                {...register('barcode')}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
              {formErrors.barcode && <p className="text-sm text-destructive mt-1">{formErrors.barcode.message}</p>}
            </div>

            <div>
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                placeholder="e.g., Organic Almond Milk"
                {...register('productName')}
                className={cn(formErrors.productName && 'border-destructive')}
              />
              {formErrors.productName && <p className="text-sm text-destructive mt-1">{formErrors.productName.message}</p>}
            </div>

            <div>
              <Label htmlFor="supplierName">Supplier Name</Label>
              <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={supplierComboboxOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !supplierNameValue && "text-muted-foreground",
                      formErrors.supplierName && 'border-destructive'
                    )}
                  >
                    {supplierNameValue
                      ? sortedSuppliers.find((supplier) => supplier.name.toLowerCase() === supplierNameValue.toLowerCase())?.name
                      : "Select or type supplier..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                    <CommandInput
                      placeholder="Search or create supplier..."
                      value={supplierNameValue || ''}
                      onValueChange={(v) => setValue('supplierName', v, { shouldValidate: true })}
                    />
                    <CommandList>
                      <CommandEmpty>No supplier found. Type to create new.</CommandEmpty>
                      <CommandGroup>
                        {sortedSuppliers.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={supplier.name}
                            onSelect={() => { setValue("supplierName", supplier.name, { shouldValidate: true }); setSupplierComboboxOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", supplierNameValue?.toLowerCase() === supplier.name.toLowerCase() ? "opacity-100" : "opacity-0")} />
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
              <p className="text-xs text-muted-foreground mt-1">If supplier doesn't exist, it will be created.</p>
            </div>
            
            <DialogFooter className="pt-4">
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
