
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
      toast({ title: "No Changes", description: "No changes were made to the product." });
      onOpenChange(false);
      return;
    }

    const formData = new FormData();
    formData.append('barcode', product.barcode);
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    if (data.costPrice !== undefined) {
      formData.append('costPrice', String(data.costPrice));
    }
    formData.append('editMode', 'edit');

    startActionTransition(async () => {
      const result = await saveProductAction(undefined, formData);
      if (result.success && result.data) {
        toast({
          title: 'Success!',
          description: result.message,
        });
        onSuccess(result.data); // Notify parent to update cache
        onOpenChange(false);
      } else {
        toast({
          title: 'Error Updating Product',
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
        title: "Supplier Not Found",
        description: "Please select an existing supplier to edit.",
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
            <DialogTitle>Edit Product: {product.productName}</DialogTitle>
            <DialogDescription>
              Update the details for this product. The barcode cannot be changed.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="supplierName">Supplier Name</Label>
                      <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleEditSupplierClick}
                          disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                          className="text-xs h-auto py-0.5 px-2"
                      >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                      </Button>
                    </div>
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
                            <span className="truncate">
                            {supplierNameValue
                              ? sortedSuppliers.find((supplier) => supplier.name.toLowerCase() === supplierNameValue.toLowerCase())?.name || supplierNameValue
                              : "Select or type supplier..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command
                            filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0 }
                          >
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
                                      Create new supplier: "{supplierNameValue}"
                                  </CommandItem>
                              )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
                </div>

                <div>
                      <Label htmlFor="costPrice">Cost Price</Label>
                      <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                              id="costPrice"
                              type="number"
                              step="0.01"
                              placeholder="e.g., 12.99"
                              {...register('costPrice')}
                              className={cn('pl-8', formErrors.costPrice && 'border-destructive')}
                          />
                      </div>
                      {formErrors.costPrice && <p className="text-sm text-destructive mt-1">{formErrors.costPrice.message}</p>}
                  </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2">If supplier doesn't exist, it will be created automatically.</p>


            <DialogFooter className="pt-4">
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
