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
    Zap, 
    History, 
    Package, 
    Building, 
    Barcode, 
    ShieldCheck, 
    Tag,
    Trash2,
    Undo2,
    User as UserIcon,
    AlertTriangle,
    Info,
    ArrowRight,
    X
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { fetchProductAction, saveProductAction, fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product, Supplier, InventoryItem, AuditLogEntry } from '@/lib/types';
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
        default: return <Tag className="h-3 w-3" />;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case 'LOG_INVENTORY': return "bg-green-500/10 text-green-600 border-green-500/20";
        case 'RETURN_INVENTORY': return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case 'UPDATE_INVENTORY': return "bg-accent/10 text-accent-foreground border-accent/20";
        case 'DELETE_INVENTORY': return "bg-destructive/10 text-destructive border-destructive/20";
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

  const nameInputRef = useRef<HTMLInputElement>(null);
  const supplierTriggerRef = useRef<HTMLButtonElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);

  const barcodeMap = useMemo(() => {
    const map = new Map<string, Product>();
    cachedProducts.forEach(p => map.set(p.barcode, p));
    return map;
  }, [cachedProducts]);

  // DERIVE CURRENT PRODUCT HISTORY
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

  const handleMagicLookup = async () => {
    if (!searchedBarcode) return;
    setIsMagicLoading(true);
    try {
        const res = await fetchProductExternalDataAction(searchedBarcode);
        if (res.success && res.data) {
            if (res.data.name) setValue('productName', res.data.name, { shouldValidate: true, shouldDirty: true });
            if (res.data.brand) setValue('supplierName', res.data.brand, { shouldValidate: true, shouldDirty: true });
            toast({ title: "Magic Lookup Success", description: `Retrieved product identity for ${searchedBarcode}.` });
        } else {
            toast({ title: "No Registry Match", description: "This SKU was not found in global databases.", variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Network Error", description: "Global registry service unreachable.", variant: "destructive" });
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
      toast({ title: "No Changes", description: "No updates were identified." });
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

    // --- INSTANT OPTIMISTIC SYNC ---
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

    toast({ title: 'Update Applied', description: 'Instant registry update complete. Syncing with cloud...' });

    startSaveTransition(async () => {
      try {
        const result = await saveProductAction(undefined, formData);
        if (result.success) {
            refreshData();
        } else {
            toast({ title: 'Cloud Sync Failed', description: result.message || 'Registry revert triggered.', variant: 'destructive' });
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
      reset();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* MANAGEMENT FORM PANEL */}
        <div className={cn("xl:col-span-5 space-y-6", !showForm && "xl:col-span-12 max-w-4xl mx-auto w-full")}>
            <Card className="shadow-2xl border-primary/10 overflow-hidden rounded-[2.5rem]">
                <CardHeader className="bg-muted/30 pb-8 pt-10 px-10">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-3xl font-black uppercase tracking-tight text-primary">Catalog Hub</CardTitle>
                            <CardDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground/60">Define and regulate product SKU identities.</CardDescription>
                        </div>
                        {showForm && (
                            <Button variant="ghost" size="icon" onClick={handleReset} className="h-10 w-10 rounded-full hover:bg-destructive/10 text-destructive/40 hover:text-destructive">
                                <X className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-8 p-10">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Identify Terminal</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow">
                                <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30" />
                                <Input
                                    placeholder="SCAN OR ENTER BARCODE..."
                                    value={barcodeToSearch}
                                    onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchBarcode()}
                                    className="pl-12 font-black h-14 text-xl tracking-tight bg-muted/10 border-primary/5 rounded-2xl placeholder:text-muted-foreground/10"
                                />
                            </div>
                            <Button onClick={() => handleSearchBarcode()} disabled={isFetchPending || !barcodeToSearch.trim()} className="h-14 px-8 font-black uppercase tracking-[0.1em] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                                {isFetchPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
                                <span className="ml-2 hidden sm:inline">Identify</span>
                            </Button>
                        </div>
                    </div>

                    {showForm && (
                        <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between gap-4">
                                {productNotFound ? (
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black px-4 py-2 text-[10px] uppercase tracking-widest rounded-xl">
                                        <PlusCircle className="mr-2 h-3.5 w-3.5" /> Unregistered SKU
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-accent/5 text-accent-foreground border-accent/20 font-black px-4 py-2 text-[10px] uppercase tracking-widest rounded-xl">
                                        <Edit className="mr-2 h-3.5 w-3.5" /> Global Entry Match
                                    </Badge>
                                )}
                                <Button type="button" variant="ghost" size="sm" onClick={handleMagicLookup} disabled={isMagicLoading} className="h-10 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-4">
                                    {isMagicLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-primary" />}
                                    Magic Lookup
                                </Button>
                            </div>

                            <Separator className="bg-primary/5" />

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Asset Identity</Label>
                                    <div className="relative">
                                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30" />
                                        <Input
                                            id="productName"
                                            placeholder="e.g., ORGANIC ALMOND MILK"
                                            {...nameProps}
                                            ref={(e) => { nameFormRef(e); (nameInputRef as any).current = e; }}
                                            onKeyDown={(e) => e.key === 'Enter' && supplierTriggerRef.current?.focus()}
                                            className={cn("h-14 pl-12 text-lg font-black tracking-tight rounded-2xl", formErrors.productName && 'border-destructive')}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-1 ml-1">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Master Vendor</Label>
                                        <Button type="button" variant="ghost" size="sm" onClick={handleEditSupplierClick} disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())} className="text-[9px] uppercase font-black h-6 px-2 text-primary hover:bg-primary/5 rounded-lg">
                                            <Edit className="mr-1.5 h-3 w-3" /> Rename Registry
                                        </Button>
                                    </div>
                                    <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button ref={supplierTriggerRef} variant="outline" role="combobox" aria-expanded={supplierComboboxOpen} className={cn("w-full h-14 justify-between font-black text-sm bg-muted/10 border-primary/5 rounded-2xl pl-12", !supplierNameValue && "text-muted-foreground")}>
                                                <Building className="absolute left-4 h-5 w-5 text-primary/30" />
                                                <span className="truncate">{supplierNameValue || "SELECT VENDOR..."}</span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-3xl">
                                            <Command>
                                                <CommandInput placeholder="Search or type new..." value={supplierSearchTerm} onValueChange={setSupplierSearchTerm} onKeyDown={(e) => { if (e.key === 'Enter' && supplierSearchTerm) { setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); } }} />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        {supplierSearchTerm ? (
                                                            <Button variant="ghost" className="w-full justify-start text-xs h-12 font-black uppercase rounded-none" onClick={() => { setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }}>
                                                                <PlusCircle className="mr-3 h-4 w-4" /> Use "{supplierSearchTerm}"
                                                            </Button>
                                                        ) : "Search Registry..."}
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {sortedSuppliers.map((supplier) => (
                                                            <CommandItem key={supplier.id} value={supplier.name} onSelect={() => { setValue("supplierName", supplier.name, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }} className="font-bold text-xs h-11">
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
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Unit Valuation (QAR)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                                        <Input
                                            id="costPrice"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...costProps}
                                            ref={(e) => { costFormRef(e); (costInputRef as any).current = e; }}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(processFormSubmit)()}
                                            className={cn('h-14 pl-12 font-black text-xl bg-muted/10 border-primary/5 rounded-2xl', formErrors.costPrice && 'border-destructive')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8">
                                <Button type="submit" disabled={isSavePending || !isDirty} className="w-full h-16 font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                                    {isSavePending ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Save className="mr-3 h-6 w-6" />}
                                    {editMode === 'create' ? 'Register New SKU' : 'Sync Global Registry'}
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* FORENSIC HISTORY PANEL */}
        {showForm && (
            <div className="xl:col-span-7 space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
                <Card className="shadow-2xl border-white/5 bg-card/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex flex-col h-[750px]">
                    <CardHeader className="bg-muted/10 p-8 border-b border-white/5 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/10 p-3 rounded-2xl">
                                    <History className="h-6 w-6 text-primary" strokeWidth={3} />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Forensic Trail</CardTitle>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mt-1">Complete SKU Lifecycle Analytics</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 font-black px-3 py-1 text-[10px] uppercase tracking-widest">
                                {currentHistory.length} EVENTS
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-grow overflow-hidden">
                        <ScrollArea className="h-full">
                            {currentHistory.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {currentHistory.map((log) => (
                                        <div key={`${log.type}-${log.id}`} className="group p-6 hover:bg-primary/[0.02] transition-colors relative">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex items-start gap-4 flex-grow min-w-0">
                                                    <div className={cn(
                                                        "mt-1 p-2 rounded-lg border shrink-0 transition-transform group-hover:scale-110 duration-500",
                                                        log.action === 'ACTIVE_STOCK' ? "bg-primary text-primary-foreground border-primary/20" : getActionColor(log.action)
                                                    )}>
                                                        {log.action === 'ACTIVE_STOCK' ? <ShieldCheck className="h-4 w-4" /> : getActionIcon(log.action)}
                                                    </div>
                                                    <div className="space-y-2 min-w-0">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black uppercase tracking-tight">
                                                                {log.action === 'ACTIVE_STOCK' ? 'Live Inventory' : log.action.replace('_INVENTORY', ' OP')}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase">
                                                                <UserIcon className="h-3 w-3" /> {log.user}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed break-words">
                                                            {log.details}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'dd/MM/yy') : '---'}
                                                    </p>
                                                    <p className="text-[9px] font-mono text-muted-foreground/20 mt-1 uppercase">
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'HH:mm:ss') : '---'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
                                    <div className="p-8 bg-muted rounded-[3rem] mb-6 border-4 border-dashed border-white/5">
                                        <AlertTriangle className="h-16 w-16" strokeWidth={1} />
                                    </div>
                                    <h4 className="text-2xl font-black uppercase tracking-tighter">Zero Forensic Data</h4>
                                    <p className="text-sm font-medium max-w-[280px] mt-2">No historical traces or active stock identified for this barcode.</p>
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

        {/* BACKGROUND AMBIANCE */}
        {!showForm && (
            <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px]" />
            </div>
        )}
    </div>
  );
}
