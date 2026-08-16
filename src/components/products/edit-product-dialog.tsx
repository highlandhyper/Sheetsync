'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    Loader2, 
    Save, 
    Check, 
    ChevronsUpDown, 
    PlusCircle, 
    DollarSign, 
    Edit, 
    Image as ImageIcon, 
    X, 
    History, 
    Info, 
    MapPin, 
    User as UserIcon, 
    Layers,
    Tag,
    ShieldCheck,
    AlertTriangle,
    Undo2,
    Trash2
} from 'lucide-react';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { saveProductAction, fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Product, Supplier, InventoryItem, AuditLogEntry } from '@/lib/types';
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

const getActionIcon = (action: string) => {
    switch (action) {
        case 'LOG_INVENTORY': return <PlusCircle className="h-2.5 w-2.5" />;
        case 'RETURN_INVENTORY': return <Undo2 className="h-2.5 w-2.5" />;
        case 'UPDATE_INVENTORY': return <Edit className="h-2.5 w-2.5" />;
        case 'DELETE_INVENTORY': return <Trash2 className="h-2.5 w-2.5" />;
        default: return <Tag className="h-2.5 w-2.5" />;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case 'LOG_INVENTORY': return "bg-green-500/10 text-green-600";
        case 'RETURN_INVENTORY': return "bg-blue-500/10 text-blue-600";
        case 'UPDATE_INVENTORY': return "bg-accent/10 text-accent-foreground";
        case 'DELETE_INVENTORY': return "bg-destructive/10 text-destructive";
        default: return "bg-muted text-muted-foreground";
    }
};

export function EditProductDialog({ product, allSuppliers, isOpen, onOpenChange, onSuccess }: EditProductDialogProps) {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { updateProduct: updateProductInCache, refreshData, inventoryItems, auditLogs } = useDataCache();
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
  const [activeTab, setActiveTab] = useState<string>('details');

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

  // Filter history for this product from both current inventory and permanent audit logs
  const combinedHistory = useMemo(() => {
    if (!product) return [];

    const barcode = product.barcode.toLowerCase().trim();

    // 1. Map Current Inventory Logs
    const currentLogs = inventoryItems
        .filter(item => item.barcode.toLowerCase().trim() === barcode && item.quantity > 0)
        .map(item => ({
            id: item.id,
            timestamp: item.timestamp || '',
            user: item.staffName,
            action: 'ACTIVE_STOCK',
            details: `Quantity: ${item.quantity} | Zone: ${item.location}`,
            type: 'inventory'
        }));

    // 2. Map Forensic Audit Logs
    const auditTraces = auditLogs
        .filter(log => {
            const detailStr = log.details.toLowerCase();
            const targetStr = log.target.toLowerCase();
            return detailStr.includes(barcode) || targetStr.includes(barcode);
        })
        .map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            user: log.user,
            action: log.action,
            details: log.details,
            type: 'audit'
        }));

    // 3. Combine and Sort
    return [...currentLogs, ...auditTraces].sort((a, b) => {
        const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
        return dateB - dateA;
    });
  }, [inventoryItems, auditLogs, product]);

  const totalStockInRegistry = useMemo(() => {
    return inventoryItems
        .filter(item => item.barcode.toLowerCase().trim() === product?.barcode.toLowerCase().trim())
        .reduce((sum, item) => sum + item.quantity, 0);
  }, [inventoryItems, product]);

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
      setActiveTab('details');
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
    formData.append('uniqueId', product.uniqueId || '');
    
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
          className="sm:max-w-4xl p-0 overflow-hidden rounded-[2rem] border-none shadow-3xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="p-8 pb-4 bg-muted/30">
            <DialogHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-1">
                            {product.productName}
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background px-2 py-0.5 rounded border border-white/10">
                                {product.barcode}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                            <span className="text-[10px] font-black uppercase text-primary tracking-widest">
                                {totalStockInRegistry} UNITS IN REGISTRY
                            </span>
                        </DialogDescription>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-[10px] font-black px-3 bg-white/50 dark:bg-black/50 border-primary/20 text-primary shadow-sm hover:bg-primary/5" 
                        onClick={handleFetchImage}
                        disabled={isFetchingImage}
                    >
                        {isFetchingImage ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="mr-2 h-3.5 w-3.5" />}
                        PRODUCT VISUAL
                    </Button>
                </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
                <TabsList className="grid w-full grid-cols-2 h-11 bg-background/50 p-1 rounded-xl">
                    <TabsTrigger value="details" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <Info className="mr-2 h-3.5 w-3.5" />
                        Identity Details
                    </TabsTrigger>
                    <TabsTrigger value="history" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <History className="mr-2 h-3.5 w-3.5" />
                        Forensic History
                    </TabsTrigger>
                </TabsList>

                <div className="py-6">
                    <TabsContent value="details" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <form id="edit-product-form" onSubmit={handleSubmit(processFormSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="productName" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Identification Name</Label>
                                    <Input
                                        id="productName"
                                        placeholder="e.g., Organic Almond Milk"
                                        {...nameProps}
                                        ref={(e) => {
                                            nameFormRef(e);
                                            (nameInputRef as any).current = e;
                                        }}
                                        readOnly={isViewer}
                                        className={cn("h-12 font-bold bg-background", isViewer && "bg-muted cursor-not-allowed", formErrors.productName && 'border-destructive')}
                                    />
                                    {formErrors.productName && <p className="text-xs text-destructive">{formErrors.productName.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="costPrice" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Unit Valuation (QAR)</Label>
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
                                            readOnly={isViewer}
                                            className={cn('pl-9 h-12 font-black bg-background', isViewer && "bg-muted cursor-not-allowed", formErrors.costPrice && 'border-destructive')}
                                        />
                                    </div>
                                    {formErrors.costPrice && <p className="text-xs text-destructive">{formErrors.costPrice.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between h-8 mb-1">
                                    <Label htmlFor="supplierName" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Master Supplier Registry</Label>
                                    {!isViewer && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleEditSupplierClick}
                                            disabled={!supplierNameValue || !allSuppliers.some(s => s.name.toLowerCase() === supplierNameValue.toLowerCase())}
                                            className="text-[9px] uppercase font-black h-7 px-2 hover:bg-primary/10 text-primary"
                                        >
                                            <Edit className="mr-1.5 h-3 w-3" /> Rename Entry
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
                                            className={cn("w-full h-12 justify-between font-bold bg-background text-sm", isViewer && "bg-muted cursor-not-allowed", !supplierNameValue && "text-muted-foreground", formErrors.supplierName && 'border-destructive')}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Layers className="h-4 w-4 text-primary/40" />
                                                <span className="truncate">{supplierNameValue || "Select vendor..."}</span>
                                            </div>
                                            {!isViewer && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl">
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
                                                            className="w-full justify-start text-xs h-10 font-black uppercase"
                                                            onClick={() => {
                                                                setValue('supplierName', supplierSearch, { shouldDirty: true, shouldValidate: true });
                                                                setSupplierComboboxOpen(false);
                                                                setTimeout(() => costInputRef.current?.focus(), 100);
                                                            }}
                                                        >
                                                            <PlusCircle className="mr-2 h-4 w-4" /> Use "{supplierSearch}"
                                                        </Button>
                                                    ) : "Type to identify vendor..."}
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
                                                            className="font-bold text-xs h-10"
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
                        </form>
                    </TabsContent>

                    <TabsContent value="history" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="rounded-2xl border bg-background overflow-hidden shadow-inner h-[400px]">
                            <div className="bg-muted/50 p-3 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Complete Forensic Audit Trail</span>
                                </div>
                                <Badge variant="secondary" className="text-[8px] font-black px-1.5 py-0 border-none bg-primary/10 text-primary">
                                    {combinedHistory.length} TOTAL EVENTS
                                </Badge>
                            </div>
                            <ScrollArea className="h-[calc(400px-40px)] w-full">
                                {combinedHistory.length > 0 ? (
                                    <Table>
                                        <TableHeader className="bg-muted/10 sticky top-0 z-10">
                                            <TableRow className="h-10 hover:bg-transparent">
                                                <TableHead className="text-[9px] uppercase font-black pl-4">Timestamp</TableHead>
                                                <TableHead className="text-[9px] uppercase font-black">Operation</TableHead>
                                                <TableHead className="text-[9px] uppercase font-black">Personnel</TableHead>
                                                <TableHead className="text-[9px] uppercase font-black pr-4">Event Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {combinedHistory.map((log) => (
                                                <TableRow key={`${log.type}-${log.id}`} className="h-auto group hover:bg-muted/30 transition-colors">
                                                    <TableCell className="text-[10px] font-mono text-muted-foreground pl-4 whitespace-nowrap">
                                                        {log.timestamp ? format(parseISO(log.timestamp), 'dd/MM/yy HH:mm') : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className={cn(
                                                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter shadow-sm",
                                                            log.action === 'ACTIVE_STOCK' ? "bg-primary text-primary-foreground" : getActionColor(log.action)
                                                        )}>
                                                            {log.action === 'ACTIVE_STOCK' ? <ShieldCheck className="h-2.5 w-2.5" /> : getActionIcon(log.action)}
                                                            {log.action === 'ACTIVE_STOCK' ? 'In Stock' : log.action.replace('_INVENTORY', '')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                                                        <div className="flex items-center gap-1.5">
                                                            <UserIcon className="h-2.5 w-2.5 opacity-40" />
                                                            <span className="truncate max-w-[80px]">{log.user}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="pr-4 py-3">
                                                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                                            {log.details}
                                                        </p>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                                        <div className="bg-muted p-4 rounded-full mb-3 opacity-20">
                                            <History className="h-8 w-8" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero forensic Logs</p>
                                        <p className="text-[9px] font-medium max-w-[200px] mt-1">No audit traces or active stock found for this SKU in the registry.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
          </div>
          
          <DialogFooter className="p-8 pt-2 bg-background shrink-0 flex items-center justify-between border-t border-white/5">
            <DialogClose asChild>
                <Button type="button" variant="ghost" className="font-black uppercase tracking-widest text-[9px] opacity-40 hover:opacity-100">
                    Terminate Session
                </Button>
            </DialogClose>
            
            <div className="flex items-center gap-3">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="font-bold rounded-xl h-12 px-6">{isViewer ? 'Close' : 'Cancel'}</Button>
                </DialogClose>
                {!isViewer && activeTab === 'details' && (
                  <Button 
                    form="edit-product-form"
                    type="submit" 
                    disabled={isActionPending}
                    className="h-12 px-10 font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90"
                  >
                      {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Sync Catalog
                  </Button>
                )}
            </div>
          </DialogFooter>
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
