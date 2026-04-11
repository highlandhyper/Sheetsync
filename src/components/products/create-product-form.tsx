
'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, Search, Save, Check, ChevronsUpDown, DollarSign, Edit, Zap, Globe } from 'lucide-react';

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
import { fetchProductAction, saveProductAction, fetchProductExternalDataAction } from '@/app/actions';
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
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  
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

  // HIGH-PERFORMANCE SEARCH INDEX: Build a Map for O(1) lookups
  const barcodeMap = useMemo(() => {
    const map = new Map<string, Product>();
    cachedProducts.forEach(p => map.set(p.barcode, p));
    return map;
  }, [cachedProducts]);

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

  const handleMagicLookup = async () => {
    if (!searchedBarcode) return;
    setIsMagicLoading(true);
    try {
        const res = await fetchProductExternalDataAction(searchedBarcode);
        if (res.success && res.data) {
            if (res.data.name) setValue('productName', res.data.name, { shouldValidate: true });
            if (res.data.brand) setValue('supplierName', res.data.brand, { shouldValidate: true });
            toast({ title: "Magic Lookup Success", description: `Retrieved product identity from global registry.` });
        } else {
            toast({ title: "No Result", description: "Barcode not found in global registry.", variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Error", description: "Could not reach global database.", variant: "destructive" });
    } finally {
        setIsMagicLoading(false);
    }
  };

  const handleSearchBarcode = async (barcode?: string) => {
    const barcodeToUse = (barcode || barcodeToSearch).trim();
    if (!barcodeToUse) {
      toast({ title: 'Barcode Required', description: 'Please enter a barcode to search.', variant: 'destructive' });
      return;
    }

    startFetchTransition(async () => {
      setSearchedBarcode(barcodeToUse);

      // FAST LOOKUP via Index Map
      const cachedProduct = barcodeMap.get(barcodeToUse);
      
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
      
      const result = await fetchProductAction(barcodeToUse);
      if (result.success && result.data) {
        setValue('barcode', result.data.barcode);
        setValue('productName', result.data.productName);
        setValue('supplierName', result.data.supplierName || '');
        setValue('costPrice', result.data.costPrice);
        setEditMode('edit');
        setProductNotFound(false);
      } else {
        setValue('barcode', barcodeToUse); 
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
    
    const costValue = (data.costPrice === undefined || Number.isNaN(data.costPrice)) ? '' : String(data.costPrice);
    formData.append('costPrice', costValue);
    formData.append('editMode', editMode);
    
    const existing = barcodeMap.get(searchedBarcode);
    if (editMode === 'edit' && existing?.uniqueId) {
        formData.append('uniqueId', existing.uniqueId);
    }

    const optimisticProduct: Product = {
        id: searchedBarcode,
        barcode: searchedBarcode,
        productName: data.productName,
        supplierName: data.supplierName,
        costPrice: data.costPrice,
        uniqueId: existing?.uniqueId
    };

    if (editMode === 'create') {
        addProductToCache(optimisticProduct);
    } else {
        updateProductInCache(optimisticProduct);
    }

    toast({ 
        title: 'Update Applied', 
        description: 'Syncing changes with global registry in background...' 
    });

    startSaveTransition(async () => {
      try {
        const result = await saveProductAction(undefined, formData);
        if (result.success && result.data) {
            refreshData();
        } else {
            toast({ 
                title: 'Sync Error', 
                description: result.message || 'Registry sync failed. Reverting...', 
                variant: 'destructive' 
            });
            refreshData(); 
        }
      } catch (e) {
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
      toast({ title: "Selection Error", description: "Select a registered vendor to rename.", variant: "destructive" });
    }
  };

  return (
    <>
    <Card className="w-full max-w-4xl mx-auto shadow-xl border-primary/10 overflow-hidden">
      <CardHeader className="bg-muted/30 pb-8">
        <CardTitle className="text-2xl font-black uppercase tracking-tight text-primary">Catalog Manager</CardTitle>
        <CardDescription className="font-medium">
          Lookup a product barcode to update or create its global registry entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <Label htmlFor="barcodeSearch" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Identify Barcode</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
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
                className="flex-grow font-mono h-12 text-lg font-bold bg-muted/20 border-primary/10"
                />
            </div>
            <Button onClick={() => handleSearchBarcode()} disabled={isFetchPending || !barcodeToSearch.trim()} className="w-full sm:w-auto h-12 font-black uppercase tracking-tighter shadow-lg shadow-primary/20">
              {isFetchPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search Catalog
            </Button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-6 border-t pt-8 mt-4 animate-in slide-in-from-top-4 duration-500">
              {productNotFound ? (
                <Alert className="bg-primary/5 border-primary/20 rounded-3xl relative overflow-hidden p-6">
                    <div className="absolute top-4 right-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={handleMagicLookup}
                            disabled={isMagicLoading}
                            className="h-9 text-[10px] font-black uppercase bg-white/80 border-primary/30 shadow-sm"
                        >
                            {isMagicLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5 fill-primary text-primary" />}
                            Magic Lookup
                        </Button>
                    </div>
                    <PlusCircle className="h-5 w-5 !text-primary" />
                    <AlertTitle className="font-black uppercase text-sm tracking-widest text-primary mb-1">Unregistered Barcode</AlertTitle>
                    <AlertDescription className="text-xs font-medium text-muted-foreground">Barcode <span className="font-mono font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">{searchedBarcode}</span> is new. Use Magic Lookup to find it globally.</AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-accent/5 border-accent/20 rounded-3xl p-6">
                    <Edit className="h-5 w-5 !text-accent-foreground" />
                    <AlertTitle className="font-black uppercase text-sm tracking-widest mb-1">Catalog Entry Match</AlertTitle>
                    <AlertDescription className="text-xs font-medium text-muted-foreground">Updating definitions for SKU <span className="font-mono font-black text-accent-foreground bg-accent/10 px-1.5 py-0.5 rounded">{searchedBarcode}</span>.</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="barcodeDisplay" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Barcode (Key)</Label>
                    <Input id="barcodeDisplay" {...register('barcode')} readOnly className="bg-muted cursor-not-allowed font-mono h-11 font-bold border-none" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="productName" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Identification Name</Label>
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
                        className={cn("h-11 font-bold", formErrors.productName && 'border-destructive')}
                    />
                    {formErrors.productName && <p className="text-[10px] text-destructive font-bold">{formErrors.productName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="supplierName" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Master Vendor</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleEditSupplierClick}
                            disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                            className="text-[9px] uppercase font-black h-6 px-2 hover:bg-primary/10 text-primary"
                        >
                            <Edit className="mr-1 h-3 w-3" /> Rename Registry
                        </Button>
                    </div>
                    <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          ref={supplierTriggerRef}
                          variant="outline"
                          role="combobox"
                          className={cn("w-full h-11 justify-between font-bold text-sm bg-muted/10 border-primary/5", !supplierNameValue && "text-muted-foreground", formErrors.supplierName && 'border-destructive')}
                        >
                          <span className="truncate">{supplierNameValue || "Select vendor..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                                        className="w-full justify-start text-xs h-9 font-black uppercase tracking-tight"
                                        onClick={() => {
                                            setValue('supplierName', supplierSearchTerm, { shouldValidate: true });
                                            setSupplierComboboxOpen(false);
                                            setTimeout(() => costInputRef.current?.focus(), 100);
                                        }}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" /> Use "{supplierSearchTerm}"
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
                                  className="font-bold text-xs"
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
                    {formErrors.supplierName && <p className="text-[10px] text-destructive font-bold">{formErrors.supplierName.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="costPrice" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cost Valuation (QAR)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
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
                            className={cn('pl-9 h-11 font-black bg-muted/10 border-primary/5', formErrors.costPrice && 'border-destructive')}
                        />
                    </div>
                    {formErrors.costPrice && <p className="text-[10px] text-destructive font-bold">{formErrors.costPrice.message}</p>}
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <Button type="submit" disabled={isSavePending} className="w-full sm:w-auto h-12 px-10 font-black uppercase tracking-tighter shadow-xl shadow-primary/20 rounded-2xl">
                  {isSavePending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (editMode === 'create' ? <PlusCircle className="mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />)}
                  {editMode === 'create' ? 'Register New SKU' : 'Save Catalog Update'}
                </Button>
              </div>
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
