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
    X,
    RefreshCw,
    Activity,
    Layers,
    History as HistoryIcon,
    Fingerprint
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

  const totalStockForSku = useMemo(() => {
    if (!searchedBarcode) return 0;
    return inventoryItems
        .filter(item => item.barcode.toLowerCase().trim() === searchedBarcode.toLowerCase().trim())
        .reduce((sum, item) => sum + item.quantity, 0);
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

    toast({ 
        title: 'Update Applied', 
        description: 'Instant registry update complete. Syncing with cloud...' 
    });

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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start relative z-10">
        {/* MANAGEMENT FORM PANEL */}
        <div className={cn("xl:col-span-5 space-y-6", !showForm && "xl:col-span-12 max-w-4xl mx-auto w-full")}>
            <Card className="shadow-2xl border-white/5 bg-card/60 backdrop-blur-3xl overflow-hidden rounded-[2.5rem]">
                <CardHeader className="bg-muted/10 pb-8 pt-10 px-10 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Catalog Hub</CardTitle>
                            <CardDescription className="font-bold text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">Identity and Authority Node</CardDescription>
                        </div>
                        {showForm && (
                            <Button variant="ghost" size="icon" onClick={handleReset} className="h-10 w-10 rounded-full hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-all">
                                <X className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-8 p-10">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-1 opacity-40">Identify SKU Terminal</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow">
                                <Barcode className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/30" />
                                <Input
                                    placeholder="SCAN OR ENTER BARCODE..."
                                    value={barcodeToSearch}
                                    onChange={(e) => setBarcodeToSearch(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchBarcode()}
                                    className="pl-14 font-black h-16 text-2xl tracking-tighter bg-muted/10 border-white/5 rounded-2xl placeholder:text-muted-foreground/10 shadow-inner"
                                />
                            </div>
                            <Button onClick={() => handleSearchBarcode()} disabled={isFetchPending || !barcodeToSearch.trim()} className="h-16 px-10 font-black uppercase tracking-[0.1em] rounded-2xl shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 bg-primary hover:bg-primary/90 text-white">
                                {isFetchPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
                            </Button>
                        </div>
                    </div>

                    {showForm && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-2">
                                    {productNotFound ? (
                                        <Badge variant="outline" className="w-fit bg-primary/5 text-primary border-primary/20 font-black px-4 py-2 text-[9px] uppercase tracking-[0.2em] rounded-xl">
                                            <PlusCircle className="mr-2 h-3.5 w-3.5" /> Unregistered SKU
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="w-fit bg-accent/5 text-accent-foreground border-accent/20 font-black px-4 py-2 text-[9px] uppercase tracking-[0.2em] rounded-xl">
                                            <Edit className="mr-2 h-3.5 w-3.5" /> Registry Match
                                        </Badge>
                                    )}
                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 ml-1">
                                        <Layers className="h-3 w-3" />
                                        Consolidated Stock: <span className="text-primary">{totalStockForSku} Units</span>
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={handleMagicLookup} disabled={isMagicLoading} className="h-11 text-[9px] font-black uppercase tracking-[0.2em] text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-5 border border-primary/10 transition-all">
                                    {isMagicLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Magic Lookup
                                </Button>
                            </div>

                            <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-1 opacity-40">Asset Designation</Label>
                                        <div className="relative">
                                            <Package className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/20" />
                                            <Input
                                                id="productName"
                                                placeholder="e.g., ORGANIC ALMOND MILK"
                                                {...nameProps}
                                                ref={(e) => { nameFormRef(e); (nameInputRef as any).current = e; }}
                                                onKeyDown={(e) => e.key === 'Enter' && supplierTriggerRef.current?.focus()}
                                                className={cn("h-16 pl-14 text-xl font-black tracking-tight rounded-2xl bg-background border-white/5 shadow-sm", formErrors.productName && 'border-destructive')}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between h-5 mb-1 ml-1">
                                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] opacity-40">Master Vendor</Label>
                                                <Button type="button" variant="ghost" size="sm" onClick={handleEditSupplierClick} disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())} className="text-[8px] uppercase font-black h-5 px-1.5 text-primary hover:bg-primary/5 rounded-md opacity-40 hover:opacity-100 transition-opacity">
                                                    <Edit className="mr-1 h-2.5 w-2.5" /> Rename
                                                </Button>
                                            </div>
                                            <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button ref={supplierTriggerRef} variant="outline" role="combobox" aria-expanded={supplierComboboxOpen} className={cn("w-full h-14 justify-between font-black text-xs bg-muted/10 border-white/5 rounded-2xl pl-12", !supplierNameValue && "text-muted-foreground")}>
                                                        <Building className="absolute left-5 h-4 w-4 text-primary/30" />
                                                        <span className="truncate uppercase tracking-wider">{supplierNameValue || "SELECT VENDOR..."}</span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-20" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-3xl border-white/10">
                                                    <Command className="bg-background/95 backdrop-blur-3xl">
                                                        <CommandInput placeholder="Search or type new..." value={supplierSearchTerm} onValueChange={setSupplierSearchTerm} onKeyDown={(e) => { if (e.key === 'Enter' && supplierSearchTerm) { setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); } }} />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                {supplierSearchTerm ? (
                                                                    <Button variant="ghost" className="w-full justify-start text-[10px] h-12 font-black uppercase rounded-none px-6" onClick={() => { setValue('supplierName', supplierSearchTerm, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }}>
                                                                        <PlusCircle className="mr-3 h-4 w-4" /> Use "{supplierSearchTerm}"
                                                                    </Button>
                                                                ) : <p className="p-4 text-[10px] font-black uppercase text-muted-foreground/40 text-center tracking-widest">Registry Search...</p>}
                                                            </CommandEmpty>
                                                            <CommandGroup className="px-2 pb-2">
                                                                {sortedSuppliers.map((supplier) => (
                                                                    <CommandItem key={supplier.id} value={supplier.name} onSelect={() => { setValue("supplierName", supplier.name, { shouldValidate: true, shouldDirty: true }); setSupplierComboboxOpen(false); setTimeout(() => costInputRef.current?.focus(), 100); }} className="font-bold text-xs h-11 px-4 rounded-xl">
                                                                        <Check className={cn("mr-3 h-4 w-4", supplierNameValue?.toLowerCase() === supplier.name.toLowerCase() ? "opacity-100" : "opacity-0")} />
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
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.4em] ml-1 opacity-40">Unit Valuation</Label>
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
                                                    className={cn('h-14 pl-14 font-black text-xl bg-muted/10 border-white/5 rounded-2xl text-right pr-6', formErrors.costPrice && 'border-destructive')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" disabled={isSavePending || !isDirty} className="w-full h-16 font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-primary/30 rounded-[1.5rem] transition-all hover:scale-[1.01] active:scale-95 bg-primary text-white border-none">
                                        {isSavePending ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
                                        {editMode === 'create' ? 'REGISTER NEW SKU' : 'SYNC GLOBAL REGISTRY'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* FORENSIC HISTORY PANEL */}
        {showForm && (
            <div className="xl:col-span-7 space-y-6 animate-in fade-in slide-in-from-right-8 duration-1000">
                <Card className="shadow-2xl border-white/5 bg-card/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex flex-col h-[750px]">
                    <CardHeader className="bg-muted/10 p-8 border-b border-white/5 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/10 p-3 rounded-2xl">
                                    <HistoryIcon className="h-6 w-6 text-primary" strokeWidth={3} />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Forensic Trail</CardTitle>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mt-1">Lifecycle Analytics</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 font-black px-3 py-1 text-[10px] uppercase tracking-widest">
                                {currentHistory.length} SECURITY EVENTS
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-grow overflow-hidden bg-slate-900/[0.02]">
                        <ScrollArea className="h-full">
                            {currentHistory.length > 0 ? (
                                <div className="divide-y divide-white/5">
                                    {currentHistory.map((log) => (
                                        <div key={`${log.type}-${log.id}`} className="group p-6 hover:bg-primary/[0.03] transition-all duration-300 relative">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex items-start gap-4 flex-grow min-w-0">
                                                    <div className={cn(
                                                        "mt-1 p-2 rounded-lg border shrink-0 transition-all group-hover:scale-110 duration-500 shadow-sm",
                                                        log.action === 'ACTIVE_STOCK' ? "bg-primary text-primary-foreground border-primary/20" : getActionColor(log.action)
                                                    )}>
                                                        {log.action === 'ACTIVE_STOCK' ? <ShieldCheck className="h-4 w-4" /> : getActionIcon(log.action)}
                                                    </div>
                                                    <div className="space-y-2 min-w-0">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black uppercase tracking-tight">
                                                                {log.action === 'ACTIVE_STOCK' ? 'Live Registry' : log.action.replace('_INVENTORY', ' Node')}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                                                                <Fingerprint className="h-3 w-3" /> {log.user}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed break-words opacity-80">
                                                            {log.details}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'dd MMM yy') : '---'}
                                                    </p>
                                                    <p className="text-[9px] font-mono text-primary/30 mt-1 uppercase tracking-tighter">
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'HH:mm:ss') : '---'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-40 grayscale">
                                    <div className="p-10 bg-muted rounded-[3rem] mb-6 border-2 border-dashed border-white/5">
                                        <Activity className="h-16 w-16" strokeWidth={1} />
                                    </div>
                                    <h4 className="text-2xl font-black uppercase tracking-tighter">Zero Forensic Data</h4>
                                    <p className="text-xs font-medium max-w-[280px] mt-2 leading-relaxed">No historical traces or active stock identified for this barcode identity.</p>
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

        {/* ATMOSPHERIC LAYER */}
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            <div className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full blur-[160px] transition-all duration-1000",
                showForm ? (productNotFound ? "bg-orange-500/5" : "bg-primary/5") : "bg-primary/3"
            )} />
            <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px]" />
        </div>
    </div>
  );
}
