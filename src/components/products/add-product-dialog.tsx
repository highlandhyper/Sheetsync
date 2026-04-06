'use client';

import { useEffect, useState, useTransition, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, ChevronsUpDown, Check, DollarSign } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';

export function AddProductDialog() {
  const { toast } = useToast();
  const { suppliers, addProduct: addProductToCache } = useDataCache();
  const [isOpen, setIsOpen] = useState(false);
  const [isActionPending, startActionTransition] = useTransition();
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  const barcodeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);
  const costRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors: formErrors },
  } = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      barcode: '',
      productName: '',
      supplierName: '',
      costPrice: undefined,
    }
  });

  const supplierNameValue = watch('supplierName');
  
  useEffect(() => {
    if (isOpen) {
        reset();
        setSupplierSearch('');
        setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [isOpen, reset]);

  const processFormSubmit = (data: AddProductFormValues) => {
    const formData = new FormData();
    formData.append('barcode', data.barcode);
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('editMode', 'create');
    if (data.costPrice !== undefined) {
        formData.append('costPrice', String(data.costPrice));
    }

    startActionTransition(async () => {
      const result = await saveProductAction(undefined, formData);
      if (result.success && result.data) {
        toast({ title: 'Success!', description: result.message });
        addProductToCache(result.data);
        setIsOpen(false);
      } else {
        toast({
          title: 'Error Adding Product',
          description: result.message || 'Validation failed.',
          variant: 'destructive',
        });
      }
    });
  };

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const { ref: barcodeFormRef, ...barcodeProps } = register('barcode');
  const { ref: nameFormRef, ...nameProps } = register('productName');
  const { ref: costFormRef, ...costProps } = register('costPrice', { valueAsNumber: true });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[480px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Register a new barcode in your system catalog.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                placeholder="Scan or enter barcode"
                {...barcodeProps}
                ref={(e) => {
                    barcodeFormRef(e);
                    (barcodeRef as any).current = e;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        nameRef.current?.focus();
                    }
                }}
                className={cn("font-mono", formErrors.barcode && 'border-destructive')}
              />
              {formErrors.barcode && <p className="text-xs text-destructive">{formErrors.barcode.message}</p>}
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
                className={cn(formErrors.productName && 'border-destructive')}
              />
              {formErrors.productName && <p className="text-xs text-destructive">{formErrors.productName.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <Label htmlFor="supplierName" className="h-8 flex items-center">Supplier</Label>
                    <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                        <PopoverTrigger asChild>
                        <Button
                            ref={supplierTriggerRef}
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
                                {supplierNameValue || "Select vendor..."}
                            </span>
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
                                        setValue('supplierName', supplierSearch, { shouldValidate: true });
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
                                            setValue('supplierName', supplierSearch, { shouldValidate: true });
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
                                        setValue("supplierName", supplier.name, { shouldValidate: true }); 
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
                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add Product
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
