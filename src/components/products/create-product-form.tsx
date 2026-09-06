'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    PlusCircle, 
    Loader2, 
    Search, 
    Save, 
    Check, 
    ChevronsUpDown, 
    Edit, 
    Package, 
    Building, 
    Barcode, 
    ShieldCheck, 
    Trash2,
    Undo2,
    AlertTriangle,
    X,
    RefreshCw,
    Activity,
    Layers,
    History,
    Fingerprint,
    Image as ImageIcon,
    Box,
    Clock,
} from 'lucide-react';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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

const getActionIcon = (action: string) => {
    if (action.includes('DELETE') || action.includes('WIPE')) return <Trash2 className="h-3 w-3" />;
    if (action.includes('UPDATE') || action.includes('EDIT')) return <Edit className="h-3 w-3" />;
    if (action.includes('CREATE') || action.includes('LOG')) return <PlusCircle className="h-3 w-3" />;
    if (action.includes('RETURN')) return <Undo2 className="h-3 w-3" />;
    return <Activity className="h-3 w-3" />;
};

const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('WIPE')) return "bg-destructive/10 text-destructive border-destructive/20";
    if (action.includes('UPDATE') || action.includes('EDIT')) return "bg-accent/10 text-accent-foreground border-accent/20";
    if (action.includes('CREATE') || action.includes('LOG')) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (action.includes('RETURN')) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    return "bg-muted text-muted-foreground border-transparent";
};

export function EditOrCreateProductForm({ allSuppliers }: EditOrCreateProductFormProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    products: cachedProducts, 
    inventoryItems, 
    auditLogs,
    addProduct: addProductToCache, 
    updateProduct: updateProductInCache, 
    refreshData 
  } = useDataCache();
  
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFetchPending, startFetchTransition] = useTransition();
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  
  const [barcodeToSearch, setBarcodeToSearch] = useState('');
  const [searchedBarcode, setSearchedBarcode] = useState(''); 
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [productNotFound, setProductNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  
  const [isSupplierEditDialogOpen, setIsSupplierEditDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  
  const [externalData, setExternalData] = useState<{ image?: string; brand?: string; name?: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);

  const barcodeMap = useMemo(() => {
    const map = new Map<string, Product>();
    cachedProducts.forEach(p => map.set(p.barcode, p));
    return map;
  }, [cachedProducts]);

  const currentHistory = useMemo(() => {
    if (!searchedBarcode) return [];
    const bc = searchedBarcode.toLowerCase().trim();

    return auditLogs
        .filter(log => {
            const d = log.details.toLowerCase();
            const t = log.target.toLowerCase();
            return d.includes(bc) || t.includes(bc);
        })
        .map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            user: log.user,
            action: log.action,
            details: log.details,
            type: 'audit'
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, searchedBarcode]);

  const skuStats = useMemo(() => {
    if (!searchedBarcode) return { total: 0, damaged: 0, zones: 0 };
    const items = inventoryItems.filter(item => item.barcode.toLowerCase().trim() === searchedBarcode.toLowerCase().trim());
    return {
        total: items.reduce((sum, item) => sum + item.quantity, 0),
        damaged: items.filter(i => i.itemType === 'Damage').reduce((sum, item) => sum + item.quantity, 0),
        zones: new Set(items.map(i => i.location)).size
    };
  }, [inventoryItems, searchedBarcode]);

  const {
    register,
    handleSubmit,
    setValue,
    watch, 
    reset,
    formState: { errors: formErrors, isDirty },
  } = useForm<AddProductFormValues>({ 
    resolver: zodResolver(addProductSchema),
    defaultValues: { barcode: '', productName: '', supplierName: '', costPrice: undefined }
  });
  
  const supplierNameValue = watch('supplierName');
  
  useEffect(() => {
    const barcodeFromUrl = searchParams.get('barcode');
    if (barcodeFromUrl) {
      setBarcodeToSearch(barcodeFromUrl);
      handleSearchBarcode(barcodeFromUrl);
    }
  }, [searchParams]);

  const handleMagicLookup = async (barcode: string, skipFieldOverwrite: boolean = false) => {
    if (!barcode) return;
    setIsMagicLoading(true);
    try {
        const res = await fetchProductExternalDataAction(barcode);
        if (res.success && res.data) {
            setExternalData(res.data);
            if (res.data.image) {
                setIsImageDialogOpen(true);
            }
            if (!skipFieldOverwrite) {
                if (res.data.name) setValue('productName', res.data.name, { shouldValidate: true, shouldDirty: true });
                if (res.data.brand) setValue('supplierName', res.data.brand, { shouldValidate: true, shouldDirty: true });
                toast({ title: "Magic Identity Found", description: `Retrieved product identity for ${barcode}.` });
            }
        } else {
            setExternalData(null);
            if (!skipFieldOverwrite) {
                toast({ title: "No Match", description: "Product identity not identified.", variant: "destructive" });
            }
        }
    } catch (e) {
        setExternalData(null);
    } finally {
        setIsMagicLoading(false);
    }
  };

  const handleSearchBarcode = async (barcode?: string) => {
    const barcodeToUse = (barcode || barcodeToSearch).trim();
    if (!barcodeToUse) {
      toast({ title: 'Barcode Required', description: 'Please enter a barcode to manage.', variant: 'destructive' });
      return;
    }

    startFetchTransition(async () => {
      setSearchedBarcode(barcodeToUse);
      setExternalData(null); 
      
      const cachedProduct = barcodeMap.get(barcodeToUse);
      
      if (cachedProduct) {
        setValue('barcode', cachedProduct.barcode);
        setValue('productName', cachedProduct.productName);
        setValue('supplierName', cachedProduct.supplierName || '');
        setValue('costPrice', cachedProduct.costPrice);
        setEditMode('edit');
        setProductNotFound(false);
        setShowForm(true);
        setTimeout(() => nameInputRef.current?.focus(), 150);
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
      setTimeout(() => nameInputRef.current?.focus(), 150);
    });
  };

  const processFormSubmit = (data: AddProductFormValues) => {
    if (!searchedBarcode) return;
    
    if (!isDirty) {
      toast({ title: "Identity Consistent", description: "No updates identified for the registry." });
      return;
    }

    const formData = new FormData();
    formData.append('barcode', searchedBarcode); 
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('userEmail', user?.email || 'Admin');
    formData.append('uniqueId', barcodeMap.get(searchedBarcode)?.uniqueId || '');
    
    const costValue = (data.costPrice === undefined || Number.isNaN(data.costPrice)) ? '' : String(data.costPrice);
    formData.append('costPrice', costValue);
    
    formData.append('editMode', editMode);
    
    const existing = barcodeMap.get(searchedBarcode);
    if (editMode === 'edit' && existing?.uniqueId) formData.append('uniqueId', existing.uniqueId);

    const optimisticProduct: Product = {
        id: existing?.uniqueId || searchedBarcode,
        barcode: searchedBarcode,
        productName: data.productName,
        supplierName: data.supplierName,
        costPrice: data.costPrice,
        uniqueId: existing?.uniqueId
    };

    if (editMode === 'create') addProductToCache(optimisticProduct);
    else updateProductInCache(optimisticProduct);

    toast({ title: 'Registry Sync Initiated', description: 'Applying changes to catalog...' });

    startSaveTransition(async () => {
      try {
        const result = await saveProductAction(undefined, formData);
        if (result.success) {
            refreshData();
        } else {
            toast({ title: 'Cloud Sync Blocked', description: result.message || 'Identity collision detected.', variant: 'destructive' });
            refreshData(); 
        }
      } catch (e) {
          refreshData();
      }
    });
  };
  
  const sortedSuppliers = useMemo(() => [...allSuppliers].sort((a, b) => a.name.localeCompare(b.name)), [allSuppliers]);
  const { ref: nameFormRef, ...nameProps } = register('productName');
  const { ref: costFormRef, ...costProps } = register('costPrice', { valueAsNumber: true });

  const handleEditSupplierClick = () => {
    const selectedSupplier = allSuppliers.find(s => s.name.toLowerCase() === (supplierNameValue || '').toLowerCase());
    if (selectedSupplier) {
      setSupplierToEdit(selectedSupplier);
      setIsSupplierEditDialogOpen(true);
    }
  };

  const handleReset = () => {
      setSearchedBarcode('');
      setBarcodeToSearch('');
      setShowForm(false);
      setExternalData(null);
      reset();
  };

  return (
    <div
      className={cn(
        "relative z-10 grid grid-cols-1 items-start gap-5 lg:gap-6 xl:grid-cols-12",
        showForm && "xl:min-h-[calc(100vh-13rem)]"
      )}
    >
      {/* PRODUCT EDITOR */}
      <section
        className={cn(
          "flex min-w-0 flex-col xl:col-span-7",
          !showForm && "mx-auto w-full max-w-5xl xl:col-span-12"
        )}
      >
        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm sm:rounded-3xl">
          <CardHeader className="border-b border-border/60 bg-muted/20 p-4 sm:p-6 lg:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-12 sm:w-12 sm:rounded-2xl">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl font-bold tracking-tight sm:text-2xl">Product catalog</CardTitle>
                    {showForm && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          productNotFound
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {productNotFound ? "New product" : "Existing product"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="max-w-xl text-xs leading-5 sm:text-sm">
                    Search by barcode, review the product, and update the master catalog.
                  </CardDescription>
                </div>
              </div>

              {showForm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  aria-label="Clear product"
                  className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 lg:p-7">
            {/* BARCODE SEARCH */}
            <div className="rounded-2xl border border-border/60 bg-muted/[0.18] p-3 sm:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
                <div>
                  <Label htmlFor="catalog-barcode-search" className="text-xs font-semibold text-foreground">
                    Barcode
                  </Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Scan or enter a product barcode.</p>
                </div>
                <Badge variant="outline" className="hidden rounded-lg border-border/70 bg-background/70 text-[9px] font-medium text-muted-foreground sm:inline-flex">
                  MASTER LOOKUP
                </Badge>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Barcode className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                  <Input
                    id="catalog-barcode-search"
                    ref={searchInputRef}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Enter barcode"
                    value={barcodeToSearch}
                    onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchBarcode()}
                    className="h-12 rounded-xl border-border/70 bg-background pl-11 pr-3 text-base font-semibold tracking-wide shadow-none sm:h-11"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => handleSearchBarcode()}
                  disabled={isFetchPending || !barcodeToSearch.trim()}
                  className="h-12 min-w-[130px] rounded-xl px-5 font-semibold shadow-sm sm:h-11"
                >
                  {isFetchPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find product
                    </>
                  )}
                </Button>
              </div>
            </div>

            {!showForm ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center px-4 py-10 text-center sm:min-h-[320px]">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] text-primary sm:h-20 sm:w-20 sm:rounded-3xl">
                  <Barcode className="h-7 w-7 sm:h-9 sm:w-9" />
                </div>
                <h3 className="text-base font-bold text-foreground sm:text-lg">Search for a product to begin</h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground sm:text-sm">
                  Existing products will load immediately. Unknown barcodes open a new product form using the same barcode.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:mt-6 sm:space-y-6">
                {/* STATUS / QUICK STATS */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-8 rounded-lg px-2.5 text-[10px] font-semibold",
                        productNotFound
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {productNotFound ? <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                      {productNotFound ? "Not yet registered" : "Catalog verified"}
                    </Badge>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">{searchedBarcode}</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleMagicLookup(searchedBarcode)}
                    disabled={isMagicLoading}
                    className="h-10 w-full rounded-xl border-primary/20 bg-primary/[0.035] text-xs font-semibold text-primary hover:bg-primary/10 sm:w-auto"
                  >
                    <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isMagicLoading && "animate-spin")} />
                    Visual lookup
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Box className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[9px] font-semibold uppercase tracking-wide">Stock</span>
                    </div>
                    <p className="mt-2 text-lg font-bold tabular-nums sm:text-xl">{skuStats.total.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className={cn("h-3.5 w-3.5", skuStats.damaged > 0 ? "text-amber-500" : "text-muted-foreground")} />
                      <span className="text-[9px] font-semibold uppercase tracking-wide">Damaged</span>
                    </div>
                    <p className={cn("mt-2 text-lg font-bold tabular-nums sm:text-xl", skuStats.damaged > 0 && "text-amber-600 dark:text-amber-400")}>
                      {skuStats.damaged.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[9px] font-semibold uppercase tracking-wide">Locations</span>
                    </div>
                    <p className="mt-2 text-lg font-bold tabular-nums sm:text-xl">{skuStats.zones.toLocaleString()}</p>
                  </div>
                </div>

                {/* PRODUCT FORM */}
                <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-5 sm:space-y-6">
                  <div className="rounded-2xl border border-border/60 bg-background p-4 sm:p-5">
                    <div className="mb-5">
                      <h3 className="text-sm font-bold text-foreground">Product information</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">Keep the product name, supplier and cost accurate.</p>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="productName" className="text-xs font-semibold">
                          Product name
                        </Label>
                        <div className="relative">
                          <Package className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="productName"
                            placeholder="Enter product name"
                            {...nameProps}
                            ref={(e) => {
                              nameFormRef(e);
                              (nameInputRef as any).current = e;
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && supplierTriggerRef.current?.focus()}
                            className={cn(
                              "h-12 rounded-xl border-border/70 bg-muted/[0.12] pl-10 text-sm font-semibold shadow-none focus:bg-background sm:h-11",
                              formErrors.productName && "border-destructive focus-visible:ring-destructive/20"
                            )}
                          />
                        </div>
                        {formErrors.productName && (
                          <p className="text-xs font-medium text-destructive">{formErrors.productName.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-xs font-semibold">Supplier</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleEditSupplierClick}
                              disabled={!supplierNameValue || !sortedSuppliers.some((s) => s.name.toLowerCase() === (supplierNameValue || '').toLowerCase())}
                              className="h-7 rounded-lg px-2 text-[10px] font-semibold text-primary"
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              Rename
                            </Button>
                          </div>

                          <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                ref={supplierTriggerRef}
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={supplierComboboxOpen}
                                className={cn(
                                  "relative h-12 w-full justify-between rounded-xl border-border/70 bg-muted/[0.12] pl-10 pr-3 text-sm font-semibold shadow-none sm:h-11",
                                  !supplierNameValue && "text-muted-foreground",
                                  formErrors.supplierName && "border-destructive"
                                )}
                              >
                                <Building className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
                                <span className="truncate">{supplierNameValue || "Select supplier"}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-border/70 p-0 shadow-xl"
                              align="start"
                            >
                              <Command>
                                <CommandInput
                                  placeholder="Search suppliers..."
                                  value={supplierSearchTerm}
                                  onValueChange={setSupplierSearchTerm}
                                  className="h-11"
                                />
                                <CommandList className="max-h-[260px]">
                                  <CommandEmpty>
                                    {supplierSearchTerm ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-12 w-full justify-start rounded-none px-4 text-xs font-semibold"
                                        onClick={() => {
                                          setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true });
                                          setSupplierComboboxOpen(false);
                                          setTimeout(() => costInputRef.current?.focus(), 100);
                                        }}
                                      >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Create “{supplierSearchTerm}”
                                      </Button>
                                    ) : (
                                      <p className="p-5 text-center text-xs text-muted-foreground">No suppliers found.</p>
                                    )}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {sortedSuppliers.map((supplier) => (
                                      <CommandItem
                                        key={supplier.id}
                                        value={supplier.name}
                                        onSelect={() => {
                                          setValue('supplierName', supplier.name, { shouldValidate: true, shouldDirty: true });
                                          setSupplierComboboxOpen(false);
                                          setTimeout(() => costInputRef.current?.focus(), 100);
                                        }}
                                        className="min-h-10 rounded-lg text-xs font-medium"
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            supplierNameValue?.toLowerCase() === supplier.name.toLowerCase() ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="truncate">{supplier.name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {formErrors.supplierName && (
                            <p className="text-xs font-medium text-destructive">{formErrors.supplierName.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="costPrice" className="text-xs font-semibold">
                            Cost price
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary">QAR</span>
                            <Input
                              id="costPrice"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              placeholder="0.00"
                              {...costProps}
                              ref={(e) => {
                                costFormRef(e);
                                (costInputRef as any).current = e;
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(processFormSubmit)()}
                              className={cn(
                                "h-12 rounded-xl border-border/70 bg-muted/[0.12] pl-12 pr-4 text-right text-base font-bold tabular-nums shadow-none focus:bg-background sm:h-11",
                                formErrors.costPrice && "border-destructive focus-visible:ring-destructive/20"
                              )}
                            />
                          </div>
                          {formErrors.costPrice && (
                            <p className="text-xs font-medium text-destructive">{formErrors.costPrice.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      {isDirty ? "You have unsaved changes." : "Product information is up to date."}
                    </p>
                    <Button
                      type="submit"
                      disabled={isSavePending || !isDirty}
                      className="h-12 w-full rounded-xl px-6 font-semibold shadow-sm sm:h-11 sm:w-auto sm:min-w-[180px]"
                    >
                      {isSavePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editMode === 'create' ? "Create product" : "Save changes"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ACTIVITY / HISTORY */}
      {showForm && (
        <aside className="min-w-0 xl:col-span-5 xl:self-stretch animate-in fade-in slide-in-from-bottom-3 duration-300 xl:slide-in-from-right-3">
          <Card className="flex h-full max-h-[720px] min-h-[360px] flex-col overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm sm:rounded-3xl xl:max-h-[calc(100vh-13rem)]">
            <CardHeader className="shrink-0 border-b border-border/60 bg-muted/20 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-bold tracking-tight sm:text-lg">Product activity</CardTitle>
                    <CardDescription className="mt-0.5 text-[11px]">Recent audit events for this barcode.</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-lg border-border/70 bg-background/70 text-[10px] font-semibold">
                  {currentHistory.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 p-0">
              <ScrollArea className="h-[440px] w-full xl:h-full">
                {currentHistory.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {currentHistory.map((log, index) => (
                      <div key={`${log.id}-${index}`} className="p-4 transition-colors hover:bg-muted/20 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn("rounded-md px-2 py-1 text-[9px] font-semibold", getActionColor(log.action))}
                          >
                            {getActionIcon(log.action)}
                            <span className="ml-1.5">{log.action.replace(/_/g, ' ')}</span>
                          </Badge>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(log.timestamp), 'dd MMM yy • HH:mm')}
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Fingerprint className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{log.user}</p>
                            <p className="mt-2 rounded-xl bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground sm:text-xs">
                              {log.details}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
                      <History className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold">No activity yet</h4>
                    <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
                      Audit events related to this product will appear here.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      )}

      {/* PRODUCT IMAGE */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="w-[94%] max-w-md overflow-hidden rounded-2xl border-border/60 bg-background p-0 shadow-2xl sm:rounded-3xl">
          <DialogHeader className="border-b border-border/60 bg-muted/20 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight sm:text-xl">Product image</DialogTitle>
                <DialogDescription className="mt-1 text-xs">Image returned by the external product lookup.</DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsImageDialogOpen(false)}
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="relative aspect-square w-full bg-white p-8 sm:p-10">
            {externalData?.image ? (
              <Image src={externalData.image} alt="Product visual" fill className="object-contain p-8" unoptimized priority />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-300">
                <ImageIcon className="h-14 w-14 opacity-30" />
                <p className="text-xs font-semibold">No image available</p>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-muted/20 p-4 text-center sm:p-5">
            <p className="truncate text-sm font-semibold text-foreground">{externalData?.name || 'Unknown product'}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{searchedBarcode}</p>
          </div>
        </DialogContent>
      </Dialog>

      {isSupplierEditDialogOpen && supplierToEdit && (
        <EditSupplierDialog
          isOpen={isSupplierEditDialogOpen}
          onOpenChange={setIsSupplierEditDialogOpen}
          supplier={supplierToEdit}
        />
      )}
    </div>
  );
}
