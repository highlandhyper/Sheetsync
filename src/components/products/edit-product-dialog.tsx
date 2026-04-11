
'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Check, ChevronsUpDown, PlusCircle, DollarSign, Edit, Image as ImageIcon, X } from 'lucide-react';
import Image from 'next/image';

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
import { saveProductAction, fetchProductExternalDataAction } from '@/app/actions';
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
  const { user, role } = useAuth();
  const { updateProduct: updateProductInCache, refreshData } = useDataCache();
  const [isActionPending, startActionTransition] = useTransition();
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);

  const [isSupplierEditDialogOpen, setIsSupplierEditDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const [externalData, setExternalData] = useState<{ image?: string; brand?: string; name?: string } | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);

  const isViewer = role === 'viewer';

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
      barcode: '',
      productName: '',
      supplierName: '',
      costPrice: undefined,
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
      setExternalData(null);
      if (!isViewer) {
        setTimeout(() => nameInputRef.current?.focus(), 150);
      }
    }
  }, [product, reset, isOpen, isViewer]);

  const handleFetchImage = async () => {
    if (!product?.barcode) return;
    setIsFetchingImage(true);
    try {
        const res = await fetchProductExternalDataAction(product.barcode);
        if (res.success && res.data) {
            setExternalData(res.data);
            if (res.data.image) {
                setIsImagePopupOpen(true);
            } else {
                toast({ title: "No Image", description: "No visual data found in global registries.", variant: "destructive" });
            }
        } else {
            toast({ title: "Lookup Failed", description: res.message || "Product not found.", variant: "destructive" });
        }
    } catch (err) {
        console.error("Failed to fetch image:", err);
    } finally {
        setIsFetchingImage(false);
    }
  };

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
    formData.append('uniqueId', product.uniqueId || ''); // Pass Unique ID
    
    const costValue = (data.costPrice === undefined || Number.isNaN(data.costPrice)) ? '' : String(data.costPrice);
    formData.append('costPrice', costValue);
    
    formData.append('editMode', 'edit');

    const optimisticProduct: Product = {
        ...product,
        productName: data.productName,
        supplierName: data.supplierName,
        costPrice: data.costPrice,
    };

    updateProductInCache(optimisticProduct);
    onOpenChange(false);
    toast({ title: 'Registry Update Initiated', description: 'Applying changes to catalog...' });

    startActionTransition(async () => {
      try {
        const result = await saveProductAction(undefined, formData);
        if (result.success && result.data) {
          onSuccess(result.data);
        } else {
          toast({
            title: 'Update Failed',
            description: result.message || 'Could not sync changes with registry.',
            variant: 'destructive',
          });
          refreshData(); 
        }
      } catch (e) {
        toast({ title: 'Connection Error', description: 'Registry sync interrupted.', variant: 'destructive' });
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
    const selectedSupplier = allSuppliers.find(s => s.name.toLowerCase() === (supplierNameValue || '').toLowerCase());
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
        <DialogContent 
          className="sm:max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
                <div>
                    <DialogTitle>{isViewer ? 'Product Details' : 'Edit Product Catalog'}</DialogTitle>
                    <DialogDescription>
                    Information for barcode: <span className="font-mono font-bold text-foreground">{product.barcode}</span>
                    </DialogDescription>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[10px] font-black px-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary" 
                    onClick={handleFetchImage}
                    disabled={isFetchingImage}
                >
                    {isFetchingImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ImageIcon className="mr-1 h-3 w-3" />}
                    VIEW IMAGE
                </Button>
            </div>
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
                            (nameInputRef as any).current = e;
                        }}
                        readOnly={isViewer}
                        className={cn("h-10", isViewer && "bg-muted cursor-not-allowed", formErrors.productName && 'border-destructive')}
                    />
                    {formErrors.productName && <p className="text-xs text-destructive">{formErrors.productName.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <div className="flex items-center justify-between h-8">
                      <Label htmlFor="supplierName">Supplier</Label>
                      {!isViewer && (
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
                      )}
                    </div>
                      <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            ref={supplierTriggerRef}
                            variant="outline"
                            role="combobox"
                            disabled={isViewer}
                            className={cn("w-full h-10 justify-between font-normal", isViewer && "bg-muted cursor-not-allowed", !supplierNameValue && "text-muted-foreground", formErrors.supplierName && 'border-destructive')}
                          >
                            <span className="truncate">{supplierNameValue || "Select vendor..."}</span>
                            {!isViewer && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search or type new..."
                              value={supplierSearch}
                              onValueChange={setSupplierSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {supplierSearch ? (
                                    <Button 
                                        variant="ghost" 
                                        className="w-full justify-start text-xs h-8 font-bold"
                                        onClick={() => {
                                            setValue('supplierName', supplierSearch, { shouldDirty: true, shouldValidate: true });
                                            setSupplierComboboxOpen(false);
                                            setTimeout(() => costInputRef.current?.focus(), 100);
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
                                        setTimeout(() => costInputRef.current?.focus(), 100);
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
                                  (costInputRef as any).current = e;
                              }}
                              readOnly={isViewer}
                              className={cn('pl-8 h-10', isViewer && "bg-muted cursor-not-allowed", formErrors.costPrice && 'border-destructive')}
                          />
                      </div>
                      {formErrors.costPrice && <p className="text-xs text-destructive">{formErrors.costPrice.message}</p>}
                  </div>
            </div>
            
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">{isViewer ? 'Close' : 'Cancel'}</Button>
              </DialogClose>
              {!isViewer && (
                <Button type="submit" disabled={isActionPending}>
                    {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isImagePopupOpen} onOpenChange={setIsImagePopupOpen}>
        <DialogContent className="max-w-full sm:max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl h-[90vh] sm:h-auto flex flex-col">
            <DialogHeader className="p-6 border-b bg-white shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold truncate pr-12 text-slate-900">{product.productName}</DialogTitle>
                        <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-2 mt-1">
                            {externalData?.brand || 'Product Verification Image'}
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="font-mono text-slate-500">{product.barcode}</span>
                        </DialogDescription>
                    </div>
                    <button 
                        onClick={() => setIsImagePopupOpen(false)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors shadow-sm"
                    >
                        <X className="h-6 w-6 text-slate-600" />
                    </button>
                </div>
            </DialogHeader>
            <div className="relative flex-1 w-full flex items-center justify-center p-4 sm:p-12 bg-white min-h-0 overflow-hidden">
                {externalData?.image ? (
                    <div className="relative w-full h-[60vh] sm:h-[75vh]">
                        <Image 
                            src={externalData.image} 
                            alt={product.productName}
                            fill
                            className="object-contain"
                            unoptimized
                            priority
                            sizes="(max-width: 768px) 100vw, 80vw"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-4 min-h-[300px]">
                        <ImageIcon className="h-20 w-20 opacity-20" />
                        <p className="font-medium">No Image Available</p>
                    </div>
                )}
            </div>
            <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter italic">High Resolution Visual Verification Asset</p>
            </div>
        </DialogContent>
      </Dialog>

      {supplierToEdit && (
        <EditSupplierDialog isOpen={isSupplierEditDialogOpen} onOpenChange={setIsSupplierEditDialogOpen} supplier={supplierToEdit} />
      )}
    </>
  );
}
