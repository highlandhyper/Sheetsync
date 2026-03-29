'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, Search, Save, Check, ChevronsUpDown, DollarSign, Edit } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { fetchProductAction, saveProductAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product, Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { EditSupplierDialog } from '@/components/suppliers/edit-supplier-dialog';

interface EditOrCreateProductFormProps {
  allSuppliers: Supplier[];
}

export function EditOrCreateProductForm({ allSuppliers }: EditOrCreateProductFormProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { products: cachedProducts, addProduct: addProductToCache, updateProduct: updateProductInCache, refreshData } = useDataCache();
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFetchPending, startFetchTransition] = useTransition();
  
  const [barcodeToSearch, setBarcodeToSearch] = useState('');
  const [searchedBarcode, setSearchedBarcode] = useState(''); 
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [productNotFound, setProductNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  
  const [isSupplierEditDialogOpen, setIsSupplierEditDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);

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
      barcode: '',
      productName: '',
      supplierName: '',
      costPrice: undefined,
    }
  });
  
  const supplierNameValue = watch('supplierName');
  
  useEffect(() => {
    const barcodeFromUrl = searchParams.get('barcode');
    if (barcodeFromUrl) {
      setBarcodeToSearch(barcodeFromUrl);
      handleSearchBarcode(barcodeFromUrl);
    }
  }, [searchParams]);

  const handleSearchBarcode = async (barcode?: string) => {
    const barcodeToUse = barcode || barcodeToSearch;
    if (!barcodeToUse.trim()) {
      toast({ title: 'Barcode Required', description: 'Please enter a barcode to search.', variant: 'destructive' });
      return;
    }

    startFetchTransition(async () => {
      const currentSearchTerm = barcodeToUse.trim();
      setSearchedBarcode(currentSearchTerm);

      const cachedProduct = cachedProducts.find(p => p.barcode === currentSearchTerm);
      if (cachedProduct) {
        setValue('barcode', cachedProduct.barcode);
        setValue('productName', cachedProduct.productName);
        setValue('supplierName', cachedProduct.supplierName || '');
        setValue('costPrice', cachedProduct.costPrice);
        setEditMode('edit');
        setProductNotFound(false);
        setShowForm(true);
        setSupplierSearchTerm('');
        setTimeout(() => nameInputRef.current?.focus(), 100);
        return;
      }
      
      const result = await fetchProductAction(currentSearchTerm);
      if (result.success && result.data) {
        setValue('barcode', result.data.barcode);
        setValue('productName', result.data.productName);
        setValue('supplierName', result.data.supplierName || '');
        setValue('costPrice', result.data.costPrice);
        setEditMode('edit');
        setProductNotFound(false);
      } else {
        setValue('barcode', currentSearchTerm); 
        setValue('productName', '');
        setValue('supplierName', '');
        setValue('costPrice', undefined);
        setEditMode('create');
        setProductNotFound(true);
      }
      setShowForm(true); 
      setSupplierSearchTerm('');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    });
  };

  const processFormSubmit = (data: AddProductFormValues) => {
    const formData = new FormData();
    formData.append('barcode', searchedBarcode); 
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('userEmail', user?.email || 'Admin');
    if(data.costPrice !== undefined) formData.append('costPrice', String(data.costPrice));
    formData.append('editMode', editMode);
    
    // --- OPTIMISTIC UPDATE ---
    const optimisticProduct: Product = {
        id: searchedBarcode,
        barcode: searchedBarcode,
        productName: data.productName,
        supplierName: data.supplierName,
        costPrice: data.costPrice,
    };

    if (editMode === 'create') {
        addProductToCache(optimisticProduct);
    } else {
        updateProductInCache(optimisticProduct);
    }

    toast({ 
        title: 'Update Saved Locally', 
        description: 'Changes reflected instantly. Syncing with cloud...' 
    });

    startSaveTransition(async () => {
      const result = await saveProductAction(undefined, formData);
      if (result.success && result.data) {
        // Success: Action completed. Cache already updated optimistically.
        // We refresh data to ensure global metadata propagation is loaded.
        refreshData();
      } else {
          toast({ 
              title: 'Sync Error', 
              description: result.message || 'Cloud registry update failed. Reverting...', 
              variant: 'destructive' 
          });
          refreshData(); // Revert optimistic changes
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
      toast({ title: "Selection Error", description: "Select a registered vendor to rename.", variant: "destructive" });
    }
  };

  return (
    <>
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Product Catalog Manager</CardTitle>
        <CardDescription>
          Lookup a product barcode to update or create its global registry entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="barcodeSearch">Lookup Barcode</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="barcodeSearch"
              placeholder="Scan or enter barcode"
              value={barcodeToSearch}
              onChange={(e) => setBarcodeToSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchBarcode();
                }
              }}
              className="flex-grow font-mono"
            />
            <Button onClick={() => handleSearchBarcode()} disabled={isFetchPending || !barcodeToSearch.trim()} className="w-full sm:w-auto">
              {isFetchPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search Catalog
            </Button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-6 border-t pt-6 mt-6">
              {productNotFound ? (
                <Alert className="bg-primary/10 border-primary/50">
                    <PlusCircle className="h-4 w-4 !text-primary" />
                    <AlertTitle>New Product Detected</AlertTitle>
                    <AlertDescription>Barcode <span className="font-mono font-bold">{searchedBarcode}</span> is unregistered.</AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-accent/20 border-accent/50">
                    <Save className="h-4 w-4 !text-accent-foreground" />
                    <AlertTitle>Editing Existing Product</AlertTitle>
                    <AlertDescription>Updating details for <span className="font-mono font-bold">{searchedBarcode}</span>.</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="barcodeDisplay">Barcode</Label>
                    <Input id="barcodeDisplay" {...register('barcode')} readOnly className="bg-muted cursor-not-allowed font-mono h-10" />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between h-8 mb-1">
                        <Label htmlFor="supplierName">Vendor / Supplier</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleEditSupplierClick}
                            disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                            className="text-[10px] uppercase font-black h-7 px-2 hover:bg-primary/10 text-primary"
                        >
                            <Edit className="mr-1 h-3 w-3" /> Rename Vendor
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
                            value={supplierSearchTerm}
                            onValueChange={setSupplierSearchTerm}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && supplierSearchTerm) {
                                    setValue('supplierName', supplierSearchTerm, { shouldValidate: true });
                                    setSupplierComboboxOpen(false);
                                    setTimeout(() => costInputRef.current?.focus(), 100);
                                }
                            }}
                          />
                          <CommandList>
                            <CommandEmpty>
                                {supplierSearchTerm ? (
                                    <Button 
                                        variant="ghost" 
                                        className="w-full justify-start text-xs h-8 font-bold"
                                        onClick={() => {
                                            setValue('supplierName', supplierSearchTerm, { shouldValidate: true });
                                            setSupplierComboboxOpen(false);
                                            setTimeout(() => costInputRef.current?.focus(), 100);
                                        }}
                                    >
                                        <PlusCircle className="mr-2 h-3 w-3" /> Use "{supplierSearchTerm}"
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
                    <Label htmlFor="costPrice" className="h-8 flex items-center mb-1">Unit Cost (QAR)</Label>
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

              <CardFooter className="flex justify-end p-0 pt-6">
                <Button type="submit" disabled={isSavePending} className="w-full sm:w-auto">
                  {isSavePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editMode === 'create' ? <PlusCircle className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />)}
                  {editMode === 'create' ? 'Register Product' : 'Save Changes'}
                </Button>
              </CardFooter>
            </form>
        )}
      </CardContent>
    </Card>
    
    {supplierToEdit && (
        <EditSupplierDialog isOpen={isSupplierEditDialogOpen} onOpenChange={setIsSupplierEditDialogOpen} supplier={supplierToEdit} />
    )}
    </>
  );
}
