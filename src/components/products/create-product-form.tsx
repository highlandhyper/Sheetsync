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
    History as HistoryIcon,
    Fingerprint,
    Image as ImageIcon,
    Box,
    Clock,
    ArrowUpRight
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
        case 'ACTIVE_STOCK': return <ShieldCheck className="h-3 w-3" />;
        default: return <Tag className="h-3 w-3" />;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case 'LOG_INVENTORY': return "bg-green-500/10 text-green-600 border-green-500/20";
        case 'RETURN_INVENTORY': return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case 'UPDATE_INVENTORY': return "bg-accent/10 text-accent-foreground border-accent/20";
        case 'DELETE_INVENTORY': return "bg-destructive/10 text-destructive border-destructive/20";
        case 'ACTIVE_STOCK': return "bg-primary/10 text-primary border-primary/20";
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

    const currentLogs = inventoryItems
        .filter(item => item.barcode.toLowerCase().trim() === bc && item.quantity > 0)
        .map(item => ({
            id: item.id,
            timestamp: item.timestamp || '',
            user: item.staffName,
            action: 'ACTIVE_STOCK',
            details: `Quantity: ${item.quantity} | Zone: ${item.location}`,
            type: 'inventory'
        }));

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

    return [...currentLogs, ...auditTraces].sort((a, b) => {
        const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
        return dateB - dateA;
    });
  }, [inventoryItems, auditLogs, searchedBarcode]);

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

  const handleMagicLookup = async (barcode?: string) => {
    const targetBarcode = barcode || searchedBarcode;
    if (!targetBarcode) return;
    setIsMagicLoading(true);
    try {
        const res = await fetchProductExternalDataAction(targetBarcode);
        if (res.success && res.data) {
            setExternalData(res.data);
            if (res.data.name) setValue('productName', res.data.name, { shouldValidate: true, shouldDirty: true });
            if (res.data.brand) setValue('supplierName', res.data.brand, { shouldValidate: true, shouldDirty: true });
            toast({ title: "Magic Identity Found", description: `Retrieved product identity for ${targetBarcode}.` });
        } else {
            setExternalData(null);
            if (!barcode) {
                toast({ title: "No Registry Match", description: "This SKU was not found in global databases.", variant: "destructive" });
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
      handleMagicLookup(barcodeToUse);

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
        "grid grid-cols-1 xl:grid-cols-12 gap-8 items-start relative z-10",
        showForm && "xl:h-[calc(100vh-12rem)]"
    )}>
        {/* IDENTITY MANAGEMENT PANEL */}
        <div className={cn(
            "xl:col-span-6 space-y-6 flex flex-col h-full", 
            !showForm && "xl:col-span-12 max-w-4xl mx-auto w-full"
        )}>
            <Card className="shadow-2xl border-white/5 bg-card/60 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] flex flex-col h-full">
                <CardHeader className="bg-muted/10 pb-4 pt-6 px-10 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Catalog Identity Node</CardTitle>
                            <CardDescription className="font-bold text-[8px] uppercase tracking-[0.3em] text-muted-foreground/40">Secure SKU Authority Terminal</CardDescription>
                        </div>
                        {showForm && (
                            <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-all">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                
                <CardContent className={cn("px-10 py-6 flex flex-col flex-grow", showForm ? "overflow-y-auto custom-scrollbar" : "")}>
                    <div className="space-y-3 mb-6 shrink-0">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-1 opacity-40">Identity Selection Terminal</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow">
                                <Barcode className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30" />
                                <Input
                                    placeholder="SCAN OR IDENTIFY SKU..."
                                    value={barcodeToSearch}
                                    onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchBarcode()}
                                    className="pl-14 font-black h-14 text-xl tracking-tighter bg-muted/10 border-white/5 rounded-2xl placeholder:text-muted-foreground/10 shadow-inner"
                                />
                            </div>
                            <Button onClick={() => handleSearchBarcode()} disabled={isFetchPending || !barcodeToSearch.trim()} className="h-14 px-8 font-black uppercase tracking-[0.1em] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 bg-primary hover:bg-primary/90 text-white">
                                {isFetchPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>

                    {showForm && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* VISUAL VERIFICATION UNIT - COMPACTED */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="md:col-span-4">
                                    <div className="aspect-[4/3] relative rounded-[1.5rem] bg-muted/20 border-2 border-dashed border-white/5 flex flex-col items-center justify-center overflow-hidden group">
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
                                                    className="object-contain p-3 group-hover:scale-105 transition-transform duration-700"
                                                    unoptimized
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                                                    <span className="text-[8px] font-black uppercase text-white tracking-widest">Visual Review</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 opacity-10">
                                                <ImageIcon className="h-10 w-10" strokeWidth={1} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">No Visual ID</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="md:col-span-8 flex flex-col justify-between py-0.5">
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={cn("px-3 py-1 font-black text-[8px] uppercase tracking-widest rounded-lg border-none shadow-sm", productNotFound ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary")}>
                                                    {productNotFound ? <PlusCircle className="mr-1.5 h-3 w-3" /> : <ShieldCheck className="mr-1.5 h-3 w-3" />}
                                                    {productNotFound ? 'Unregistered' : 'Verified'}
                                                </Badge>
                                                {externalData?.brand && (
                                                    <Badge variant="secondary" className="px-2 py-1 font-black text-[8px] uppercase tracking-widest border-none bg-muted/40 max-w-[150px] truncate">
                                                        {externalData.brand}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-primary/40">
                                                    <Box className="h-2.5 w-2.5" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Volume</span>
                                                </div>
                                                <p className="text-lg font-black text-primary">{skuStats.total} Units</p>
                                            </div>
                                            <div className={cn("p-3 rounded-xl border space-y-0.5", skuStats.damaged > 0 ? "bg-orange-500/5 border-orange-500/10" : "bg-muted/10 border-white/5")}>
                                                <div className={cn("flex items-center gap-1.5", skuStats.damaged > 0 ? "text-orange-500/40" : "text-muted-foreground/30")}>
                                                    <AlertTriangle className="h-2.5 w-2.5" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Damaged</span>
                                                </div>
                                                <p className={cn("text-lg font-black", skuStats.damaged > 0 ? "text-orange-600" : "text-muted-foreground/20")}>{skuStats.damaged}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button type="button" variant="ghost" onClick={() => handleMagicLookup()} disabled={isMagicLoading} className="h-9 w-full text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-lg border border-primary/10 transition-all mt-3">
                                        <RefreshCw className={cn("mr-1.5 h-3 w-3", isMagicLoading && "animate-spin")} />
                                        Refresh Visual
                                    </Button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-6">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-1 opacity-40">Authoritative Designation</Label>
                                        <div className="relative">
                                            <Package className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20" />
                                            <Input
                                                id="productName"
                                                placeholder="ENTER MASTER PRODUCT NAME..."
                                                {...nameProps}
                                                ref={(e) => { nameFormRef(e); (nameInputRef as any).current = e; }}
                                                onKeyDown={(e) => e.key === 'Enter' && supplierTriggerRef.current?.focus()}
                                                className={cn("h-14 pl-14 text-lg font-black tracking-tighter rounded-xl bg-background border-white/5 shadow-inner", formErrors.productName && 'border-destructive')}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between h-4 ml-1">
                                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] opacity-40">Primary Vendor</Label>
                                                <Button type="button" variant="ghost" size="sm" onClick={handleEditSupplierClick} disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())} className="text-[8px] uppercase font-black h-4 px-1 text-primary hover:bg-primary/5 rounded-md opacity-30 hover:opacity-100 transition-opacity">
                                                    Master Edit
                                                </Button>
                                            </div>
                                            <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button ref={supplierTriggerRef} variant="outline" role="combobox" aria-expanded={supplierComboboxOpen} className={cn("w-full h-12 justify-between font-black text-xs bg-muted/10 border-white/5 rounded-xl pl-12 shadow-sm", !supplierNameValue && "text-muted-foreground")}>
                                                        <Building className="absolute left-5 h-4 w-4 text-primary/30" />
                                                        <span className="truncate uppercase tracking-wider">{supplierNameValue || "SELECT VENDOR..."}</span>
                                                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-20" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-3xl border-white/10">
                                                    <Command className="bg-background/95 backdrop-blur-3xl">
                                                        <CommandInput placeholder="Search Registry..." value={supplierSearchTerm} onValueChange={setSupplierSearchTerm} />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                {supplierSearchTerm ? (
                                                                    <Button variant="ghost" className="w-full justify-start text-[9px] h-11 font-black uppercase rounded-none px-6" onClick={() => { setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }}>
                                                                        <PlusCircle className="mr-2 h-3.5 w-3.5" /> Create "{supplierSearchTerm}"
                                                                    </Button>
                                                                ) : <p className="p-5 text-[9px] font-black uppercase text-muted-foreground/40 text-center tracking-widest">Searching Master List...</p>}
                                                            </CommandEmpty>
                                                            <CommandGroup className="px-2 pb-2">
                                                                {sortedSuppliers.map((supplier) => (
                                                                    <CommandItem key={supplier.id} value={supplier.name} onSelect={() => { setValue("supplierName", supplier.name, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }} className="font-bold text-xs h-10 px-4 rounded-lg">
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

                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-1 opacity-40">Unit Value (QAR)</Label>
                                            <div className="relative">
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/40 uppercase tracking-tighter">QAR</div>
                                                <Input
                                                    id="costPrice"
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    {...costProps}
                                                    ref={(e) => { costFormRef(e); (costInputRef as any).current = e; }}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(processFormSubmit)()}
                                                    className={cn('h-12 pl-14 font-black text-lg bg-muted/10 border-white/5 rounded-xl text-right pr-6 shadow-sm', formErrors.costPrice && 'border-destructive')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 sticky bottom-0 bg-gradient-to-t from-background/95 to-transparent py-2 shrink-0">
                                    <Button type="submit" disabled={isSavePending || !isDirty} className="w-full h-14 font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl shadow-primary/30 rounded-xl transition-all hover:scale-[1.01] active:scale-95 bg-primary text-white border-none">
                                        {isSavePending ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                                        {editMode === 'create' ? 'SYNCHRONIZE IDENTITY' : 'UPDATE MASTER CATALOG'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* HIGH-DENSITY FORENSIC SIDEBAR */}
        {showForm && (
            <div className="xl:col-span-6 space-y-6 animate-in fade-in slide-in-from-right-8 duration-1000 flex flex-col h-full overflow-hidden">
                <Card className="shadow-2xl border-white/5 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex flex-col h-full">
                    <CardHeader className="bg-muted/10 p-6 border-b border-white/5 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/10 p-3 rounded-xl">
                                    <HistoryIcon className="h-6 w-6 text-primary" strokeWidth={3} />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Forensic Stream</CardTitle>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mt-1">Real-Time Lifecycle Audit</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-background border-primary/20 text-primary font-black px-3 py-1.5 text-[9px] uppercase tracking-widest rounded-lg">
                                {currentHistory.length} EVENTS
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-grow overflow-hidden bg-slate-900/[0.02]">
                        <ScrollArea className="h-full">
                            {currentHistory.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {currentHistory.map((log) => (
                                        <div key={`${log.type}-${log.id}`} className="group p-6 hover:bg-primary/[0.04] transition-all duration-300 relative">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex items-start gap-4 flex-grow min-w-0">
                                                    <div className={cn(
                                                        "mt-1 p-2 rounded-lg border shrink-0 transition-all group-hover:scale-110 group-hover:rotate-[5deg] duration-500 shadow-sm",
                                                        getActionColor(log.action)
                                                    )}>
                                                        {getActionIcon(log.action)}
                                                    </div>
                                                    <div className="space-y-2 min-w-0">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                                                {log.action.replace(/_/g, ' ')}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] bg-muted/20 px-2 py-0.5 rounded-md">
                                                                <Fingerprint className="h-3 w-3" /> {log.user}
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-muted-foreground/70 leading-relaxed break-words opacity-90 font-mono tracking-tighter">
                                                            {log.details}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 flex flex-col items-end">
                                                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-900 dark:text-white/60">
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'dd MMM yy') : '---'}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-[8px] font-mono text-primary/40 mt-1 uppercase tracking-tighter">
                                                        <Clock className="h-2 w-2" />
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'HH:mm:ss') : '---'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-40 grayscale">
                                    <div className="p-10 bg-muted/20 rounded-[3rem] mb-6 border-4 border-dashed border-white/5 shadow-inner">
                                        <Activity className="h-16 w-16" strokeWidth={1} />
                                    </div>
                                    <h4 className="text-2xl font-black uppercase tracking-tighter">Identity Vacuum</h4>
                                    <p className="text-xs font-medium max-w-[280px] mt-3 leading-relaxed opacity-60">No historical traces or active stock identified for this unique SKU identity.</p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        )}
        
        {supplierToEdit && (
            <EditSupplierDialog isOpen={isSupplierEditDialogOpen} onOpenChange={setIsSupplierEditDialogOpen} supplier={supplierToEdit} />
        )}

        {/* DYNAMIC ATMOSPHERIC ENGINE */}
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            <div className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full blur-[180px] transition-all duration-[2000ms]",
                showForm ? (productNotFound ? "bg-orange-500/[0.08]" : "bg-primary/[0.08]") : "bg-primary/[0.03]"
            )} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-accent/[0.04] rounded-full blur-[140px]" />
            <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[120px]" />
        </div>
    </div>
  );
}
