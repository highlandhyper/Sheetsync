'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
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


interface SubmitButtonProps {
  isPending: boolean;
  editMode: 'create' | 'edit';
}

function SubmitButton({ isPending, editMode }: SubmitButtonProps) {
  const Icon = editMode === 'create' ? PlusCircle : Save;
  const text = editMode === 'create' ? 'Create Product' : 'Update Product';
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      {text}
    </Button>
  );
}

interface EditOrCreateProductFormProps {
  allSuppliers: Supplier[];
}

export function EditOrCreateProductForm({ allSuppliers }: EditOrCreateProductFormProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { products: cachedProducts, addProduct: addProductToCache, updateProduct: updateProductInCache } = useDataCache();
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFetchPending, startFetchTransition] = useTransition();
  
  const [barcodeToSearch, setBarcodeToSearch] = useState('');
  const [searchedBarcode, setSearchedBarcode] = useState(''); 
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [productNotFound, setProductNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  
  const [isSupplierEditDialogOpen, setIsSupplierEditDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    });
  };

  const processFormSubmit = (data: AddProductFormValues) => {
    const formData = new FormData();
    formData.append('barcode', searchedBarcode); 
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('userEmail', user?.email || 'Admin');
    
    if(data.costPrice !== undefined) {
        formData.append('costPrice', String(data.costPrice));
    }
    formData.append('editMode', editMode);
    
    startSaveTransition(async () => {
      const result = await saveProductAction(undefined, formData);
      if (result.success && result.data) {
        toast({
            title: 'Registry Updated',
            description: result.message,
        });

        if (editMode === 'create') {
            addProductToCache(result.data);
        } else {
            updateProductInCache(result.data);
        }

        setValue('productName', result.data.productName); 
        setValue('barcode', result.data.barcode);
        setValue('supplierName', result.data.supplierName || '');
        setValue('costPrice', result.data.costPrice);
        setSearchedBarcode(result.data.barcode); 
        setEditMode('edit'); 
        setProductNotFound(false);
        setShowForm(true);

      } else {
          toast({
              title: 'Registry Error',
              description: result.message || 'Failed to save changes.',
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
        description: "Please select a registered supplier from the list to rename them globally.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Product Catalog Manager</CardTitle>
        <CardDescription>
          Search for an existing product to update details, or define a new product barcode in the system.
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
          <>
            {productNotFound && editMode === 'create' && (
              <Alert variant="default" className="bg-primary/10 border-primary/50">
                <PlusCircle className="h-4 w-4 !text-primary" />
                <AlertTitle>Unregistered Barcode</AlertTitle>
                <AlertDescription>
                  Barcode <span className="font-mono font-bold">{searchedBarcode}</span> is not in your catalog. Creating a new definition.
                </AlertDescription>
              </Alert>
            )}
            {editMode === 'edit' && !productNotFound && (
               <Alert variant="default" className="bg-accent/20 border-accent/50">
                 <Save className="h-4 w-4 !text-accent-foreground" />
                <AlertTitle>Editing Definition</AlertTitle>
                <AlertDescription>
                  Updating global metadata for <span className="font-mono font-bold">{searchedBarcode}</span>.
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-6 border-t pt-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="barcodeDisplay">Barcode</Label>
                    <Input
                    id="barcodeDisplay"
                    {...register('barcode')}
                    readOnly 
                    className="bg-muted cursor-not-allowed font-mono"
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="supplierName">Vendor / Supplier</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleEditSupplierClick}
                            disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                            className="text-[10px] uppercase font-black h-6 px-2 hover:bg-primary/10 text-primary"
                        >
                            <Edit className="mr-1 h-3 w-3" />
                            Rename Vendor
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
                          {supplierNameValue
                            ? sortedSuppliers.find((supplier) => supplier.name.toLowerCase() === supplierNameValue.toLowerCase())?.name || supplierNameValue
                            : "Select vendor..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command
                          filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}
                        >
                          <CommandInput
                            placeholder="Search or type new..."
                            value={supplierNameValue || ''}
                            onValueChange={(v) => setValue('supplierName', v, { shouldValidate: true })}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {supplierNameValue ? `Add "${supplierNameValue}" to list?` : "Type to add vendor."}
                            </CommandEmpty>
                            <CommandGroup>
                              {sortedSuppliers.map((supplier) => (
                                <CommandItem
                                  key={supplier.id}
                                  value={supplier.name}
                                  onSelect={() => {
                                    setValue("supplierName", supplier.name, { shouldValidate: true });
                                    setSupplierComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      supplierNameValue?.toLowerCase() === supplier.name.toLowerCase() ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {supplier.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
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
                                    Use "{supplierNameValue}"
                                </CommandItem>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
                </div>
                <div>
                    <Label htmlFor="costPrice">Unit Cost (QAR)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="costPrice"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...register('costPrice')}
                            className={cn('pl-8', formErrors.costPrice && 'border-destructive')}
                        />
                    </div>
                    {formErrors.costPrice && <p className="text-sm text-destructive mt-1">{formErrors.costPrice.message}</p>}
                </div>
              </div>

              <CardFooter className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center p-0 pt-6 gap-3">
                <SubmitButton isPending={isSavePending} editMode={editMode} />
              </CardFooter>
            </form>
          </>
        )}
      </CardContent>
    </Card>
    
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
