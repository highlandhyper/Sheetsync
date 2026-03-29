'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
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
import { useDataCache } from '@/context/data-cache-context';

interface EditProductDialogProps {
  product: Product | null;
  allSuppliers: Supplier[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedProduct: Product) => void;
}

export function EditProductDialog({ product, allSuppliers, isOpen, onOpenChange, onSuccess }: EditProductDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateProduct: updateProductInCache, refreshData } = useDataCache();
  const [isActionPending, startActionTransition] = useTransition();
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  const nameRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);
  const costRef = useRef<HTMLInputElement>(null);

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
    if (product && isOpen) {
      reset({
        barcode: product.barcode,
        productName: product.productName,
        supplierName: product.supplierName || '',
        costPrice: product.costPrice,
      });
      setSupplierSearch('');
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [product, reset, isOpen]);

  const processFormSubmit = (data: AddProductFormValues) => {
    if (!product) return;
    if (!isDirty) {
      onOpenChange(false);
      return;
    }

    const formData = new FormData();
    formData.append('barcode', product.barcode);
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('userEmail', user?.email || 'Admin');
    if (data.costPrice !== undefined) formData.append('costPrice', String(data.costPrice));
    formData.append('editMode', 'edit');

    // --- OPTIMISTIC UPDATE ---
    const optimisticProduct: Product = {
        ...product,
        productName: data.productName,
        supplierName: data.supplierName,
        costPrice: data.costPrice,
    };

    updateProductInCache(optimisticProduct);
    onOpenChange(false);
    toast({ title: 'Registry Updated', description: 'Applying changes in background...' });

    startActionTransition(async () => {
      const result = await saveProductAction(undefined, formData);
      if (result.success && result.data) {
        onSuccess(result.data);
        refreshData();
      } else {
        toast({
          title: 'Update Failed',
          description: result.message || 'Could not sync changes.',
          variant: 'destructive',
        });
        refreshData();
      }
    });
  };
  
  const sortedSuppliers = useMemo(() => {
    return [...allSuppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [allSuppliers]);

  const { ref: nameFormRef, ...nameProps } = register('productName');
  const { ref: costFormRef, ...costProps } = register('costPrice', { valueAsNumber: true });

  const handleEditSupplierClick = () => {
    const selectedSupplier = allSuppliers.find(s => s.name.toLowerCase() === supplierNameValue.toLowerCase());
    if (selectedSupplier) {
      setSupplierToEdit(selectedSupplier);
      setIsSupplierEditDialogOpen(true);
    } else {
      toast({ title: "Selection Error", description: "Select a registered supplier to edit.", variant: "destructive" });
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
              Modifying details for <span className="font-mono font-bold text-foreground">{product.barcode}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input id="barcode" {...register('barcode')} readOnly className="bg-muted cursor-not-allowed font-mono h-10" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <Input
                        id="productName"
                        placeholder="e.g., Organic Almond Milk"
                        {...nameProps}
                        ref={(e) => {
                            nameFormRef(e);
                            (nameRef as any).current = e;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                supplierTriggerRef.current?.focus();
                            }
                        }}
                        className={cn("h-10", formErrors.productName && 'border-destructive')}
                    />
                    {formErrors.productName && <p className="text-xs text-destructive">{formErrors.productName.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <div className="flex items-center justify-between h-8">
                      <Label htmlFor="supplierName">Supplier</Label>
                      <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleEditSupplierClick}
                          disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                          className="text-[10px] uppercase font-bold h-7 px-2 hover:bg-primary/10 text-primary"
                      >
                          <Edit className="mr-1 h-3 w-3" /> Rename
                      </Button>
                    </div>
                      <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            ref={supplierTriggerRef}
                            variant="outline"
                            role="combobox"
                            className={cn("w-full h-10 justify-between font-normal", !supplierNameValue && "text-muted-foreground", formErrors.supplierName && 'border-destructive')}
                          >
                            <span className="truncate">{supplierNameValue || "Select vendor..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search or type new..."
                              value={supplierSearch}
                              onValueChange={setSupplierSearch}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && supplierSearch) {
                                    setValue('supplierName', supplierSearch, { shouldDirty: true });
                                    setSupplierComboboxOpen(false);
                                    setTimeout(() => costRef.current?.focus(), 100);
                                }
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {supplierSearch ? (
                                    <Button 
                                        variant="ghost" 
                                        className="w-full justify-start text-xs h-8 font-bold"
                                        onClick={() => {
                                            setValue('supplierName', supplierSearch, { shouldDirty: true });
                                            setSupplierComboboxOpen(false);
                                            setTimeout(() => costRef.current?.focus(), 100);
                                        }}
                                    >
                                        <PlusCircle className="mr-2 h-3 w-3" /> Use "{supplierSearch}"
                                    </Button>
                                ) : "Type to find vendor..."}
                              </CommandEmpty>
                              <CommandGroup>
                                {sortedSuppliers.map((supplier) => (
                                  <CommandItem
                                    key={supplier.id}
                                    value={supplier.name}
                                    onSelect={() => { 
                                        setValue("supplierName", supplier.name, { shouldValidate: true, shouldDirty: true }); 
                                        setSupplierComboboxOpen(false); 
                                        setTimeout(() => costRef.current?.focus(), 100);
                                    }}
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
                    {formErrors.supplierName && <p className="text-xs text-destructive">{formErrors.supplierName.message}</p>}
                </div>

                <div className="space-y-2">
                      <Label htmlFor="costPrice" className="h-8 flex items-center">Unit Cost (QAR)</Label>
                      <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                              id="costPrice"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...costProps}
                              ref={(e) => {
                                  costFormRef(e);
                                  (costRef as any).current = e;
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSubmit(processFormSubmit)();
                                  }
                              }}
                              className={cn('pl-8 h-10', formErrors.costPrice && 'border-destructive')}
                          />
                      </div>
                      {formErrors.costPrice && <p className="text-xs text-destructive">{formErrors.costPrice.message}</p>}
                  </div>
            </div>
            
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isActionPending}>
                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {supplierToEdit && (
        <EditSupplierDialog isOpen={isSupplierEditDialogOpen} onOpenChange={setIsSupplierEditDialogOpen} supplier={supplierToEdit} />
      )}
    </>
  );
}
