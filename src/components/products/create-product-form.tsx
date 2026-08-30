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
    DollarSign, 
    Edit, 
    Package, 
    Building, 
    Barcode, 
    ShieldCheck, 
    Tag,
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
    Clock
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    switch (action) {
        case 'LOG_INVENTORY': return <PlusCircle className="h-3 w-3" />;
        case 'RETURN_INVENTORY': return <Undo2 className="h-3 w-3" />;
        case 'UPDATE_INVENTORY': return <Edit className="h-3 w-3" />;
        case 'DELETE_INVENTORY': return <Trash2 className="h-3 w-3" />;
        case 'WIPE_DATABASE': return <AlertTriangle className="h-3 w-3" />;
        default: return <Tag className="h-3 w-3" />;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case 'LOG_INVENTORY': return "bg-green-500/10 text-green-600 border-green-500/20";
        case 'RETURN_INVENTORY': return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case 'UPDATE_INVENTORY': return "bg-accent/10 text-accent-foreground border-accent/20";
        case 'DELETE_INVENTORY': case 'WIPE_DATABASE': return "bg-destructive/10 text-destructive border-destructive/20";
        default: return "bg-muted text-muted-foreground border-transparent";
    }
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

    const auditTraces = auditLogs
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
        }));

    return auditTraces.sort((a, b) => {
        const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
        return dateB - dateA;
    });
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
            if (!skipFieldOverwrite) {
                if (res.data.name) setValue('productName', res.data.name, { shouldValidate: true, shouldDirty: true });
                if (res.data.brand) setValue('supplierName', res.data.brand, { shouldValidate: true, shouldDirty: true });
                toast({ title: "Magic Identity Found", description: `Retrieved product identity for ${barcode}.` });
            }
        } else {
            setExternalData(null);
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
      
      const cachedProduct = barcodeMap.get(barcodeToUse);
      
      if (cachedProduct) {
        setValue('barcode', cachedProduct.barcode);
        setValue('productName', cachedProduct.productName);
        setValue('supplierName', cachedProduct.supplierName || '');
        setValue('costPrice', cachedProduct.costPrice);
        setEditMode('edit');
        setProductNotFound(false);
        setShowForm(true);
        handleMagicLookup(barcodeToUse, true);
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
        handleMagicLookup(barcodeToUse, true);
      } else {
        setValue('barcode', barcodeToUse); 
        setValue('productName', '');
        setValue('supplierName', '');
        setValue('costPrice', undefined);
        setEditMode('create');
        setProductNotFound(true);
        handleMagicLookup(barcodeToUse, false);
      }
      setShowForm(true); 
      setTimeout(() => nameInputRef.current?.focus(), 150);
    });
  };

  const processFormSubmit = (data: AddProductFormValues) => {
    if (!searchedBarcode) return;
    
    if (!isDirty) {
      toast({ title: "Identity Consistent", description: "No updates were identified for the registry." });
      return;
    }

    const formData = new FormData();
    formData.append('barcode', searchedBarcode); 
    formData.append('productName', data.productName);
    formData.append('supplierName', data.supplierName);
    formData.append('userEmail', user?.email || 'Admin');
    formData.append('costPrice', (data.costPrice === undefined || isNaN(data.costPrice)) ? '' : String(data.costPrice));
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

    toast({ 
        title: 'Registry Sync Initiated', 
        description: 'Instant local update complete. Finalizing cloud write...' 
    });

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
    <div className={cn(
        "grid grid-cols-1 xl:grid-cols-12 gap-10 items-start relative z-10",
        showForm && "xl:h-[calc(100vh-12rem)]"
    )}>
        <div className={cn(
            "xl:col-span-6 space-y-6 flex flex-col h-full", 
            !showForm && "xl:col-span-12 max-w-4xl mx-auto w-full"
        )}>
            <Card className="shadow-2xl border-white/5 bg-card/60 backdrop-blur-3xl overflow-hidden rounded-[3rem] flex flex-col h-full">
                <CardHeader className="bg-muted/10 pb-6 pt-10 px-12 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Catalog Identity Node</CardTitle>
                            <CardDescription className="font-bold text-[9px] uppercase tracking-[0.4em] text-muted-foreground/30">Secure SKU Authority Terminal</CardDescription>
                        </div>
                        {showForm && (
                            <Button variant="ghost" size="icon" onClick={handleReset} className="h-10 w-10 rounded-xl hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-all">
                                <X className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                
                <CardContent className={cn("px-12 py-10 flex flex-col flex-grow", showForm ? "overflow-y-auto" : "")}>
                    <div className="space-y-6 mb-12 shrink-0">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-[0.4em] opacity-60">Identification Terminal</Label>
                            <Badge variant="outline" className="text-[8px] font-black tracking-widest bg-primary/5 border-primary/10 text-primary px-3 py-1 rounded-full uppercase">
                                SKU Mode
                            </Badge>
                        </div>
                        
                        <div className="relative group p-1 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-[2rem] transition-all duration-700 hover:from-primary/40 hover:to-primary/40">
                            <div className="flex flex-col sm:flex-row gap-0 bg-background/80 backdrop-blur-xl rounded-[1.9rem] overflow-hidden border border-white/10 shadow-2xl">
                                <div className="relative flex-grow">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/10 transition-transform duration-500 group-focus-within:rotate-[15deg]">
                                            <Barcode className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                    <Input
                                        ref={searchInputRef}
                                        placeholder="IDENTIFY ASSET OR SCAN BARCODE..."
                                        value={barcodeToSearch}
                                        onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchBarcode()}
                                        className="pl-20 border-none bg-transparent h-20 text-xl sm:text-2xl font-black tracking-tighter placeholder:text-muted-foreground/10 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                </div>
                                <div className="p-2 shrink-0 flex items-center">
                                    <Button 
                                        onClick={() => handleSearchBarcode()} 
                                        disabled={isFetchPending || !barcodeToSearch.trim()} 
                                        className="h-16 px-12 font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 bg-primary hover:bg-primary/90 text-white border-none"
                                    >
                                        {isFetchPending ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <Search className="h-5 w-5" strokeWidth={3} />
                                                <span>Initialize</span>
                                            </div>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showForm && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div className="md:col-span-4">
                                    <div className="aspect-[4/3] relative rounded-[2rem] bg-muted/10 border-2 border-dashed border-white/5 flex flex-col items-center justify-center overflow-hidden group shadow-inner">
                                        {isMagicLoading ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="h-8 w-8 text-primary/40 animate-spin" />
                                                <span className="text-[7px] font-black uppercase tracking-widest text-primary/40">Fetching...</span>
                                            </div>
                                        ) : externalData?.image ? (
                                            <>
                                                <Image 
                                                    src={externalData.image} 
                                                    alt="Verification Preview" 
                                                    fill 
                                                    className="object-contain p-4 group-hover:scale-110 transition-transform duration-1000"
                                                    unoptimized
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                                                    <span className="text-[9px] font-black uppercase text-white tracking-widest">Visual Review</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 opacity-10">
                                                <ImageIcon className="h-12 w-12" strokeWidth={1} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">No Visual ID</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="md:col-span-8 flex flex-col justify-between py-1">
                                    <div className="space-y-5">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className={cn("px-4 py-1.5 font-black text-[9px] uppercase tracking-widest rounded-xl border-none shadow-md", productNotFound ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary")}>
                                                    {productNotFound ? <PlusCircle className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                                    {productNotFound ? 'Unregistered Identity' : 'Registry Verified'}
                                                </Badge>
                                                {externalData?.brand && (
                                                    <Badge variant="secondary" className="px-3 py-1.5 font-black text-[9px] uppercase tracking-widest border-none bg-muted/40 max-w-[200px] truncate">
                                                        {externalData.brand}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1">
                                                <div className="flex items-center gap-2 text-primary/30">
                                                    <Box className="h-3 w-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Registry Volume</span>
                                                </div>
                                                <p className="text-xl font-black text-primary tracking-tighter">{skuStats.total} Units</p>
                                            </div>
                                            <div className={cn("p-4 rounded-2xl border space-y-1", skuStats.damaged > 0 ? "bg-orange-500/5 border-orange-500/10" : "bg-muted/5 border-white/5 opacity-40")}>
                                                <div className={cn("flex items-center gap-2", skuStats.damaged > 0 ? "text-orange-500/40" : "text-muted-foreground/30")}>
                                                    <AlertTriangle className="h-3 w-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Damaged Stock</span>
                                                </div>
                                                <p className={cn("text-xl font-black tracking-tighter", skuStats.damaged > 0 ? "text-orange-600" : "text-muted-foreground/20")}>{skuStats.damaged}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button type="button" variant="ghost" onClick={() => handleMagicLookup(searchedBarcode)} disabled={isMagicLoading} className="h-10 w-full text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl border border-primary/10 transition-all mt-4">
                                        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isMagicLoading && "animate-spin")} />
                                        Force Visual Refresh
                                    </Button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-8">
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.5em] ml-1 opacity-30">Authoritative Designation</Label>
                                        <div className="relative group">
                                            <Package className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/20 group-focus-within:text-primary transition-colors" />
                                            <Input
                                                id="productName"
                                                placeholder="ENTER MASTER PRODUCT NAME..."
                                                {...nameProps}
                                                ref={(e) => { nameFormRef(e); (nameInputRef as any).current = e; }}
                                                onKeyDown={(e) => e.key === 'Enter' && supplierTriggerRef.current?.focus()}
                                                className={cn("h-16 pl-16 text-xl font-black tracking-tighter rounded-2xl bg-background border-white/5 shadow-inner focus:border-primary/20", formErrors.productName && 'border-destructive')}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between h-4 ml-1">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.5em] opacity-30">Primary Vendor</Label>
                                                <Button type="button" variant="ghost" size="sm" onClick={handleEditSupplierClick} disabled={!supplierNameValue || !allSortedSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())} className="text-[9px] uppercase font-black h-4 px-2 text-primary hover:bg-primary/10 rounded-md opacity-30 hover:opacity-100 transition-opacity">
                                                    Master Edit
                                                </Button>
                                            </div>
                                            <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button ref={supplierTriggerRef} variant="outline" role="combobox" aria-expanded={supplierComboboxOpen} className={cn("w-full h-14 justify-between font-black text-sm bg-muted/5 border-white/5 rounded-2xl pl-14 shadow-sm", !supplierNameValue && "text-muted-foreground")}>
                                                        <Building className="absolute left-6 h-5 w-5 text-primary/20" />
                                                        <span className="truncate uppercase tracking-wider">{supplierNameValue || "SELECT VENDOR..."}</span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-20" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-3xl border-white/10">
                                                    <Command>
                                                        <CommandInput placeholder="Search Registry..." value={supplierSearchTerm} onValueChange={setSupplierSearchTerm} />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                {supplierSearchTerm ? (
                                                                    <Button variant="ghost" className="w-full justify-start text-[10px] h-12 font-black uppercase rounded-none px-8" onClick={() => { setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }}>
                                                                        <PlusCircle className="mr-3 h-4 w-4" /> Create "{supplierSearchTerm}"
                                                                    </Button>
                                                                ) : <p className="p-6 text-[10px] font-black uppercase text-muted-foreground/40 text-center tracking-widest">Searching Master List...</p>}
                                                            </CommandEmpty>
                                                            <CommandGroup className="px-3 pb-3">
                                                                {sortedSuppliers.map((supplier) => (
                                                                    <CommandItem key={supplier.id} value={supplier.name} onSelect={() => { setValue("supplierName", supplier.name, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }} className="font-bold text-xs h-11 px-4 rounded-xl">
                                                                        <Check className={cn("mr-2 h-4 w-4", supplierNameValue?.toLowerCase() === supplier.name.toLowerCase() ? "opacity-100" : "opacity-0")} />
                                                                        {supplier.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.5em] ml-1 opacity-30">Unit Value (QAR)</Label>
                                            <div className="relative">
                                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[11px] font-black text-primary/30 uppercase tracking-tighter">QAR</div>
                                                <Input
                                                    id="costPrice"
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    {...costProps}
                                                    ref={(e) => { costFormRef(e); (costInputRef as any).current = e; }}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(processFormSubmit)()}
                                                    className={cn('h-14 pl-16 font-black text-xl bg-muted/10 border-white/5 rounded-2xl text-right pr-8 shadow-sm focus:border-primary/20', formErrors.costPrice && 'border-destructive')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-background/95 to-transparent py-4 shrink-0">
                                    <Button type="submit" disabled={isSavePending || !isDirty} className="w-full h-16 font-black uppercase tracking-[0.4em] text-[11px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] shadow-primary/30 rounded-2xl transition-all hover:scale-[1.01] active:scale-95 bg-primary text-white border-none">
                                        {isSavePending ? <Loader2 className="mr-4 h-5 w-5 animate-spin" /> : <Save className="mr-4 h-5 w-5" />}
                                        {editMode === 'create' ? 'SYNCHRONIZE IDENTITY' : 'UPDATE MASTER CATALOG'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {showForm && (
            <div className="xl:col-span-6 space-y-6 flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-700">
                <Card className="border-white/5 bg-card/40 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-full">
                    <CardHeader className="bg-muted/10 p-10 border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <History className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tighter">Forensic Node History</CardTitle>
                                <CardDescription className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30">SKU Trace Logs & Forensic Audit</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-grow overflow-hidden">
                        <ScrollArea className="h-full w-full">
                            {currentHistory.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {currentHistory.map((log, index) => (
                                        <div key={`${log.id}-${index}`} className="p-8 hover:bg-primary/[0.02] transition-colors group">
                                            <div className="flex items-center justify-between mb-4">
                                                <Badge variant="outline" className={cn("px-3 py-1 font-black text-[8px] uppercase tracking-[0.1em] rounded-lg border-none shadow-sm", getActionColor(log.action))}>
                                                    {getActionIcon(log.action)}
                                                    <span className="ml-2">{log.action.replace('_', ' ')}</span>
                                                </Badge>
                                                <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/30 uppercase tracking-tighter tabular-nums">
                                                    <Clock className="h-3 w-3" />
                                                    {format(parseISO(log.timestamp), 'dd MMM yy • HH:mm')}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-5">
                                                <div className="p-2.5 bg-muted/40 rounded-xl border border-white/5 text-muted-foreground/20 group-hover:text-primary transition-all duration-500">
                                                    <Fingerprint className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-1.5 flex-1 min-w-0">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">Operating Personnel</p>
                                                    <p className="text-sm font-black truncate uppercase text-slate-700 dark:text-slate-300">{log.user}</p>
                                                    <div className="mt-3 p-4 bg-muted/20 rounded-2xl border border-white/5">
                                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed italic opacity-80">
                                                            "{log.details}"
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[500px] text-center opacity-20 grayscale">
                                    <div className="p-8 bg-muted/20 rounded-[3rem] mb-6 border-4 border-dashed border-white/5">
                                        <Layers className="h-16 w-16" />
                                    </div>
                                    <h4 className="text-2xl font-black uppercase tracking-tighter">Zero Traces</h4>
                                    <p className="text-sm font-medium mt-2 max-w-[280px]">No historical forensic logs match this identity node in the registry core.</p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                    <div className="p-8 bg-muted/5 border-t border-white/5 shrink-0 text-center">
                        <p className="text-[8px] font-black uppercase tracking-[0.6em] text-muted-foreground/20">Secure Registry Tunnel • AES-256 Protocol</p>
                    </div>
                </Card>
            </div>
        )}

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
