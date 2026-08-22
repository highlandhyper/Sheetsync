'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    Search, 
    Loader2, 
    Barcode, 
    Package, 
    Building, 
    DollarSign, 
    Save, 
    X,
    CheckCircle2,
    ChevronsUpDown,
    Check,
    PlusCircle,
    Layers
} from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { addProductSchema, type AddProductFormValues } from '@/lib/schemas';
import { saveProductAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface QuickProductEditDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function QuickProductEditDialog({ isOpen, onOpenChange }: QuickProductEditDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const { products, suppliers, updateProduct, refreshData } = useDataCache();
    const [isActionPending, startActionTransition] = useTransition();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
    const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    
    const searchInputRef = useRef<HTMLInputElement>(null);
    const supplierTriggerRef = useRef<HTMLButtonElement>(null);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<AddProductFormValues>({
        resolver: zodResolver(addProductSchema),
    });

    const supplierNameValue = watch('supplierName');

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setMatchedProduct(null);
            reset();
            setSupplierSearch('');
            setTimeout(() => searchInputRef.current?.focus(), 150);
        }
    }, [isOpen, reset]);

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        const termLower = term.toLowerCase().trim();
        if (!termLower) {
            setMatchedProduct(null);
            return;
        }

        const match = products.find(p => 
            p.barcode.toLowerCase() === termLower || 
            p.productName.toLowerCase().includes(termLower)
        );

        if (match) {
            setMatchedProduct(match);
            reset({
                barcode: match.barcode,
                productName: match.productName,
                supplierName: match.supplierName || '',
                costPrice: match.costPrice,
            });
        } else {
            setMatchedProduct(null);
        }
    };

    const sortedSuppliers = useMemo(() => {
        return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const onFormSubmit = (data: AddProductFormValues) => {
        if (!matchedProduct || !user?.email) return;

        // --- INSTANT LOCAL UPDATE (OPTIMISTIC) ---
        const updatedProduct: Product = {
            ...matchedProduct,
            productName: data.productName,
            supplierName: data.supplierName,
            costPrice: data.costPrice,
        };

        updateProduct(updatedProduct);
        onOpenChange(false);
        toast({ 
            title: "Local Sync Success", 
            description: `Registry updated for ${data.productName}. Pushing to cloud...` 
        });

        // --- BACKGROUND SERVER SYNC ---
        startActionTransition(async () => {
            const formData = new FormData();
            formData.append('barcode', data.barcode);
            formData.append('productName', data.productName);
            formData.append('supplierName', data.supplierName);
            formData.append('userEmail', user.email!);
            formData.append('uniqueId', matchedProduct.uniqueId || '');
            formData.append('editMode', 'edit');
            if (data.costPrice !== undefined) {
                formData.append('costPrice', String(data.costPrice));
            }

            try {
                const res = await saveProductAction(undefined, formData);
                if (!res.success) {
                    toast({ 
                        variant: "destructive", 
                        title: "Cloud Sync Error", 
                        description: res.message || "Failed to finalize registry write." 
                    });
                    refreshData(); // Revert local state if server fails
                }
            } catch (e) {
                refreshData();
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                className="sm:max-w-md rounded-3xl border-none shadow-3xl p-0 overflow-hidden bg-background"
                onPointerDownOutside={(e) => e.preventDefault()} // CRITICAL: Prevents closure during dropdown interaction
            >
                <div className="bg-primary p-6 text-primary-foreground flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Quick Registry Update</DialogTitle>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">High-Speed Catalog Sync</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Search Asset or Barcode</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                            <Input 
                                ref={searchInputRef}
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Identify SKU to edit..."
                                className="pl-10 h-12 rounded-2xl bg-muted/20 border-white/5 font-bold"
                            />
                        </div>
                    </div>

                    {matchedProduct ? (
                        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Barcode className="h-4 w-4 text-primary" />
                                    <span className="font-mono text-xs font-black text-primary">{matchedProduct.barcode}</span>
                                </div>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Asset Identity</Label>
                                    <div className="relative">
                                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                                        <Input 
                                            {...register('productName')} 
                                            className={cn("pl-9 h-11 font-bold", errors.productName && "border-destructive")} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Master Vendor</Label>
                                    <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen} modal={true}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                ref={supplierTriggerRef}
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={supplierComboboxOpen}
                                                className={cn(
                                                    "w-full h-11 justify-between font-bold text-sm bg-muted/5 border-white/10",
                                                    !supplierNameValue && "text-muted-foreground",
                                                    errors.supplierName && "border-destructive"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <Building className="h-4 w-4 text-primary/40 shrink-0" />
                                                    <span className="truncate">{supplierNameValue || "Select vendor..."}</span>
                                                </div>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setValue('supplierName', supplierSearch, { shouldDirty: true, shouldValidate: true });
                                                                    setSupplierComboboxOpen(false);
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
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-1">Unit Valuation (QAR)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                        <Input 
                                            type="number" 
                                            step="0.01"
                                            {...register('costPrice')} 
                                            className={cn("pl-9 h-11 font-black", errors.costPrice && "border-destructive")} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" disabled={isActionPending} className="w-full h-14 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-[0.2em] mt-4">
                                {isActionPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                Sync Registry
                            </Button>
                        </form>
                    ) : searchTerm && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="bg-muted/20 p-6 rounded-full border-2 border-dashed border-white/5">
                                <X className="h-8 w-8 text-muted-foreground/20" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-black uppercase tracking-tight text-muted-foreground/40">Zero Results</h4>
                                <p className="text-[10px] font-medium text-muted-foreground/30">Target SKU not found in local cache.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-muted/30 border-t flex justify-center">
                    <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100" onClick={() => onOpenChange(false)}>
                        Terminate Session
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
