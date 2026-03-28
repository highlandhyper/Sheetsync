'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Check, ChevronsUpDown, PlusCircle, DollarSign, Edit } from 'lucide-react';

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
import { saveProductAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product, Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EditSupplierDialog } from '@/components/suppliers/edit-supplier-dialog';
import { useAuth } from '@/context/auth-context';

interface EditProductDialogProps {
  product: Product | null;
  allSuppliers: Supplier[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedProduct: Product) => void;
}

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

export function EditProductDialog({ product, allSuppliers, isOpen, onOpenChange, onSuccess }: EditProductDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isActionPending, startActionTransition] = useTransition();
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  
  const [isSupplierEditDialogOpen, setIsSupplierEditDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors: formErrors, isDirty },
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      barcode: product?.barcode || '',
      productName: product?.productName || '',
      supplierName: product?.supplierName || '',
      costPrice: product?.costPrice,
    },
  });

  const supplierNameValue = watch('supplierName');

  useEffect(() => {
    if (product) {
      reset({
        barcode: product.barcode,
        productName: product.productName,
        supplierName: product.supplierName || '',
        costPrice: product.costPrice,
      });
    }
  }, [product, reset, isOpen]);

  const processFormSubmit = (data: AddProductFormValues) => {
    if (!product) return;
    if (!isDirty) {
      toast({ title: "No Changes", description: "No changes were made to the product definition." });
      onOpenChange(false);
      return;
    }

    const formData = new FormData();
    formData.append('barcode', product.barcode);
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('userEmail', user?.email || 'Admin');
    
    if (data.costPrice !== undefined) {
      formData.append('costPrice', String(data.costPrice));
    }
    formData.append('editMode', 'edit');

    startActionTransition(async () => {
      const result = await saveProductAction(undefined, formData);
      if (result.success && result.data) {
        toast({
          title: 'Update Successful',
          description: result.message,
        });
        onSuccess(result.data);
        onOpenChange(false);
      } else {
        toast({
          title: 'Update Failed',
          description: result.message || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    });
  };
  
  const sortedSuppliers = useMemo(() => {
    return [...allSuppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [allSuppliers]);

  const handleEditSupplierClick = () => {
    const selectedSupplier = allSuppliers.find(s => s.name.toLowerCase() === supplierNameValue.toLowerCase());
    if (selectedSupplier) {
      setSupplierToEdit(selectedSupplier);
      setIsSupplierEditDialogOpen(true);
    } else {
      toast({
        title: "Selection Error",
        description: "Please select a registered supplier to edit their details.",
        variant: "destructive",
      });
    }
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product Catalog</DialogTitle>
            <DialogDescription>
              Modify details for barcode: <span className="font-mono font-bold text-foreground">{product.barcode}</span>. Changes will propagate to inventory logs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center h-6 mb-1">
                        <Label htmlFor="barcode">Barcode</Label>
                    </div>
                    <Input
                        id="barcode"
                        {...register('barcode')}
                        readOnly
                        className="bg-muted cursor-not-allowed font-mono h-10"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center h-6 mb-1">
                        <Label htmlFor="productName">Product Name</Label>
                    </div>
                    <Input
                        id="productName"
                        placeholder="e.g., Organic Almond Milk"
                        {...register('productName')}
                        className={cn("h-10", formErrors.productName && 'border-destructive')}
                    />
                    {formErrors.productName && <p className="text-sm text-destructive mt-1">{formErrors.productName.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between h-6 mb-1">
                      <Label htmlFor="supplierName">Supplier</Label>
                      <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleEditSupplierClick}
                          disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                          className="text-[10px] uppercase font-bold h-auto py-0.5 px-2 hover:bg-primary/10 text-primary"
                      >
                          <Edit className="mr-1 h-3 w-3" />
                          Rename
                      </Button>
                    </div>
                      <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={supplierComboboxOpen}
                            className={cn(
                              "w-full h-10 justify-between font-normal",
                              !supplierNameValue && "text-muted-foreground",
                              formErrors.supplierName && 'border-destructive'
                            )}
                          >
                            <span className="truncate">
                            {supplierNameValue
                              ? sortedSuppliers.find((supplier) => supplier.name.toLowerCase() === supplierNameValue.toLowerCase())?.name || supplierNameValue
                              : "Select vendor..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command
                            filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0 }
                          >
                            <CommandInput
                              placeholder="Search or type new..."
                              value={supplierNameValue || ''}
                              onValueChange={(v) => setValue('supplierName', v, { shouldValidate: true })}
                            />
                            <CommandList>
                              <CommandEmpty>Press Enter to use "{supplierNameValue}"</CommandEmpty>
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
                                {supplierNameValue && !sortedSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase()) && (
                                  <CommandItem
                                      key={supplierNameValue}
                                      value={supplierNameValue}
                                      onSelect={() => {
                                          setValue("supplierName", supplierNameValue, { shouldValidate: true });
                                          setSupplierComboboxOpen(false);
                                      }}
                                      className="italic text-muted-foreground"
                                  >
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Add "{supplierNameValue}"
                                  </CommandItem>
                              )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
                </div>

                <div className="space-y-2">
                      <div className="flex items-center h-6 mb-1">
                        <Label htmlFor="costPrice">Cost Price (QAR)</Label>
                      </div>
                      <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                              id="costPrice"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...register('costPrice')}
                              className={cn('pl-8 h-10', formErrors.costPrice && 'border-destructive')}
                          />
                      </div>
                      {formErrors.costPrice && <p className="text-sm text-destructive mt-1">{formErrors.costPrice.message}</p>}
                  </div>
            </div>
            
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <SubmitButton isPending={isActionPending} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {supplierToEdit && (
        <EditSupplierDialog
          isOpen={isSupplierEditDialogOpen}
          onOpenChange={setIsSupplierEditDialogOpen}
          supplier={supplierToEdit}
        />
      )}
    </>
  );
}
