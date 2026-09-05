'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Barcode, 
    Calendar as CalendarIcon, 
    User, 
    PlusCircle, 
    Loader2, 
    Search, 
    Check, 
    Scan, 
    X,
    Eye,
    ShieldCheck,
    Building,
    Send
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { fetchProductAction, addExpiryWatchAction } from '@/app/actions';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { 
    Command, 
    CommandEmpty, 
    CommandGroup, 
    CommandInput, 
    CommandItem, 
    CommandList 
} from '../ui/command';
import { Separator } from '../ui/separator';

interface AddReminderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddReminderDialog({ isOpen, onOpenChange }: AddReminderDialogProps) {
    const { products, uniqueStaffNames, addExpiryReminderLocal, refreshData } = useDataCache();
    const { user } = useAuth();
    const { toast } = useToast();

    const [barcode, setBarcode] = useState('');
    const [productName, setProductName] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [staffName, setStaffName] = useState('');
    const [expiryDate, setExpiryDate] = useState<Date | undefined>();
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setBarcode('');
            setProductName('');
            setSupplierName('');
            setStaffName('');
            setExpiryDate(undefined);
            setTimeout(() => barcodeInputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    const handleBarcodeLookup = async (bc: string) => {
        if (!bc.trim()) return;
        setIsSearching(true);
        
        const match = products.find(p => p.barcode === bc.trim() || p.barcode.replace(/^0+/, '') === bc.trim().replace(/^0+/, ''));
        if (match) {
            setProductName(match.productName);
            setSupplierName(match.supplierName || 'Unknown Vendor');
        } else {
            const res = await fetchProductAction(bc);
            if (res.success && res.data) {
                setProductName(res.data.productName);
                setSupplierName(res.data.supplierName || 'Unknown Vendor');
            } else {
                setProductName('Identity Node Not Registered');
                setSupplierName('N/A');
            }
        }
        setIsSearching(false);
    };

    const handleSave = async () => {
        if (!barcode || !productName || !staffName || !expiryDate) return;
        
        setIsSaving(true);
        const res = await addExpiryWatchAction({
            barcode: barcode.trim(),
            productName,
            supplierName,
            staffName,
            expiryDate: format(expiryDate, 'yyyy-MM-dd')
        });

        if (res.success && res.data) {
            addExpiryReminderLocal(res.data);
            toast({ title: "Observation Initialized", description: `SMS alert scheduled for ${productName}.` });
            onOpenChange(false);
            await refreshData();
        } else {
            toast({ variant: "destructive", title: "Handshake Failed", description: "Could not sync observation entry with registry core." });
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95%] sm:w-full p-0 overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-3xl bg-background">
                <div className="bg-primary p-6 sm:p-8 text-primary-foreground">
                    <div className="flex items-center gap-3 sm:gap-4 mb-1">
                        <div className="bg-white/20 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                            <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Systematic Watch</DialogTitle>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-70">Expiry Observation Protocol</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Asset Identity</Label>
                            <div className="relative group">
                                <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    ref={barcodeInputRef}
                                    placeholder="SCAN OR ENTER SKU..."
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                                    onBlur={() => handleBarcodeLookup(barcode)}
                                    className="pl-11 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-muted/20 border-white/5 font-black uppercase tracking-tight text-sm sm:text-base shadow-inner"
                                />
                                {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                            </div>
                        </div>

                        {productName && (
                            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/5 border-2 border-primary/10 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="bg-background p-2 rounded-lg sm:rounded-xl shadow-sm border border-white/5 shrink-0">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Identified Node</p>
                                        <p className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white truncate">{productName}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground truncate uppercase">{supplierName}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Personnel</Label>
                            <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        role="combobox" 
                                        className="w-full h-12 sm:h-14 justify-between font-black uppercase tracking-tight bg-muted/20 border-white/5 rounded-xl sm:rounded-2xl shadow-inner px-4"
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary/40 shrink-0" />
                                            <span className="truncate">{staffName || "Select Personnel..."}</span>
                                        </div>
                                        <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-20 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-white/10" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search personnel..." className="h-11 sm:h-12" />
                                        <CommandList>
                                            <CommandEmpty className="py-6 text-[9px] font-black uppercase text-muted-foreground/40 text-center">No Identity Match</CommandEmpty>
                                            <CommandGroup className="p-1.5">
                                                {uniqueStaffNames.map(name => (
                                                    <CommandItem 
                                                        key={name} 
                                                        value={name} 
                                                        onSelect={() => {
                                                            setStaffName(name);
                                                            setStaffPopoverOpen(false);
                                                        }}
                                                        className="font-black uppercase text-[10px] sm:text-xs h-10 cursor-pointer rounded-lg px-3"
                                                    >
                                                        <Check className={cn("mr-2 h-3.5 w-3.5", staffName === name ? "opacity-100" : "opacity-0")} />
                                                        {name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Expiry Date</Label>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className={cn(
                                            "w-full h-12 sm:h-14 justify-start font-black uppercase tracking-tight bg-muted/20 border-white/5 rounded-xl sm:rounded-2xl shadow-inner px-4",
                                            !expiryDate && "text-muted-foreground/40"
                                        )}
                                    >
                                        <CalendarIcon className="mr-3 h-4 w-4 sm:h-5 sm:w-5 text-primary/40 shrink-0" />
                                        {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Select Target Date..."}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden shadow-2xl border-white/10" align="center">
                                    <Calendar 
                                        mode="single" 
                                        selected={expiryDate} 
                                        onSelect={setExpiryDate} 
                                        initialFocus 
                                        captionLayout="dropdown"
                                        startMonth={new Date()}
                                        endMonth={new Date(2045, 11)}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                <div className="p-5 sm:p-8 pt-0 bg-background">
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving || !barcode || !staffName || !expiryDate} 
                        className="w-full h-14 sm:h-16 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] sm:text-[11px] shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white border-none"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Send className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                        Initialize Watch
                    </Button>
                    <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-muted/10 rounded-xl sm:rounded-2xl border border-dashed border-white/5 text-center">
                        <p className="text-[7px] sm:text-[8px] font-black uppercase text-muted-foreground/30 tracking-[0.4em]">
                            System will dispatch SMS Alert 30 Days before target
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
