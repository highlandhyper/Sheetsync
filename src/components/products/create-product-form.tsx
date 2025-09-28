
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, Search, Save, Check, ChevronsUpDown } from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';

import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { fetchProductAction, saveProductAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product, Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';


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
  const { toast } = useToast();
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFetchPending, startFetchTransition] = useTransition();
  
  const [barcodeToSearch, setBarcodeToSearch] = useState('');
  const [searchedBarcode, setSearchedBarcode] = useState(''); 
  const [currentProductName, setCurrentProductName] = useState('');
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [productNotFound, setProductNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);


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
    }
  });
  
  const supplierNameValue = watch('supplierName');

  const handleSearchBarcode = async () => {
    if (!barcodeToSearch.trim()) {
      toast({ title: 'Barcode Required', description: 'Please enter a barcode to search.', variant: 'destructive' });
      return;
    }
    startFetchTransition(async () => {
      const currentSearchTerm = barcodeToSearch.trim();
      const result = await fetchProductAction(currentSearchTerm);
      setSearchedBarcode(currentSearchTerm); 
      if (result.success && result.data) {
        setValue('barcode', result.data.barcode);
        setValue('productName', result.data.productName);
        setValue('supplierName', result.data.supplierName || '');
        setCurrentProductName(result.data.productName);
        setEditMode('edit');
        setProductNotFound(false);
      } else {
        setValue('barcode', currentSearchTerm); 
        setValue('productName', '');
        setValue('supplierName', '');
        setCurrentProductName('');
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
    formData.append('editMode', editMode);
    
    startSaveTransition(async () => {
      const saveState = await saveProductAction(undefined, formData);
      if (saveState?.success) {
        toast({
          title: 'Success!',
          description: saveState.message,
        });
        if (editMode === 'create' && saveState.data?.productName) {
          setCurrentProductName(saveState.data.productName);
          setValue('productName', saveState.data.productName); 
          setValue('barcode', saveState.data.barcode);
          setValue('supplierName', saveState.data.supplierName || '');
          setSearchedBarcode(saveState.data.barcode); 
          setEditMode('edit'); 
          setProductNotFound(false);
          setShowForm(true);
        } else if (editMode === 'edit' && saveState.data?.productName) {
          setCurrentProductName(saveState.data.productName);
        } else {
          reset({ barcode: '', productName: '', supplierName: '' }); 
          setShowForm(false); 
          setSearchedBarcode(''); 
          setBarcodeToSearch(''); 
          setEditMode('create');
          setProductNotFound(false);
          setCurrentProductName('');
        }
      } else if (saveState?.message && !saveState.success) {
        toast({
          title: 'Error Saving Product',
          description: saveState.message,
          variant: 'destructive',
        });
      }
    });
  };
  
  const sortedSuppliers = useMemo(() => {
    return [...allSuppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [allSuppliers]);

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Manage Product Details</CardTitle>
        <CardDescription>
          Search for a product by its barcode to edit its details. If the barcode is not found, you can create a new product entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="barcodeSearch">Search Barcode</Label>
          <div className="flex gap-2">
            <Input
              id="barcodeSearch"
              placeholder="Enter barcode to search or edit"
              value={barcodeToSearch}
              onChange={(e) => setBarcodeToSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchBarcode();
                }
              }}
            />
            <Button onClick={handleSearchBarcode} disabled={isFetchPending || !barcodeToSearch.trim()}>
              {isFetchPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>

        {showForm && (
          <>
            {productNotFound && editMode === 'create' && (
              <Alert variant="default" className="bg-primary/10 border-primary/50">
                <PlusCircle className="h-4 w-4 !text-primary" />
                <AlertTitle>New Product</AlertTitle>
                <AlertDescription>
                  Barcode <span className="font-semibold">{searchedBarcode}</span> not found. You can create a new product with this barcode.
                </AlertDescription>
              </Alert>
            )}
            {editMode === 'edit' && !productNotFound && (
               <Alert variant="default" className="bg-accent/20 border-accent/50">
                 <Save className="h-4 w-4 !text-accent-foreground" />
                <AlertTitle>Editing Product</AlertTitle>
                <AlertDescription>
                  Currently editing details for barcode <span className="font-semibold">{searchedBarcode}</span>.
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-6 border-t pt-6 mt-6">
              <div>
                <Label htmlFor="barcodeDisplay">Barcode (Editing/Creating)</Label>
                <Input
                  id="barcodeDisplay"
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
                  {...register('productName', { 
                      onChange: (e) => setCurrentProductName(e.target.value) 
                  })}
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
                        (formErrors.supplierName) && 'border-destructive'
                      )}
                    >
                      {supplierNameValue
                        ? sortedSuppliers.find((supplier) => supplier.name.toLowerCase() === supplierNameValue.toLowerCase())?.name
                        : "Select or type supplier..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command
                      filter={(value, search) => {
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                        return 0;
                      }}
                    >
                      <CommandInput
                        placeholder="Search supplier or type new..."
                        value={supplierNameValue || ''}
                        onValueChange={(currentValue) => {
                           setValue('supplierName', currentValue, { shouldValidate: true });
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {supplierNameValue ? `Create "${supplierNameValue}"? Press Enter or select.` : "No supplier found. Type to add."}
                        </CommandEmpty>
                        <CommandGroup>
                          {sortedSuppliers.map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={supplier.name}
                              onSelect={(currentValue) => {
                                setValue("supplierName", currentValue === supplierNameValue.toLowerCase() ? supplierNameValue : currentValue, { shouldValidate: true });
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
                                Create new supplier: "{supplierNameValue}"
                            </CommandItem>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formErrors.supplierName && <p className="text-sm text-destructive mt-1">{formErrors.supplierName.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">If supplier doesn't exist in the list, it will be created.</p>
              </div>

              <CardFooter className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center p-0 pt-6 gap-3">
                <SubmitButton isPending={isSavePending} editMode={editMode} />
              </CardFooter>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

    