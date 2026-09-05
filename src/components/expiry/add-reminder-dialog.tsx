'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Barcode, 
    Calendar as CalendarIcon, 
    User, 
    PlusCircle, 
    Loader2, 
    Check, 
    Eye,
    ShieldCheck,
    Send,
    ArrowRight,
    ArrowLeft,
    ChevronsUpDown
} from 'lucide-react';
import { format } from 'date-fns';
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
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

interface AddReminderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddReminderDialog({ isOpen, onOpenChange }: AddReminderDialogProps) {
    const { products, uniqueStaffNames, addExpiryReminderLocal, refreshData } = useDataCache();
    const { user } = useAuth();
    const { toast } = useToast();

    const [currentStep, setCurrentStep] = useState(0);
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
            setCurrentStep(0);
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
        // AUTOMATIC STEP TRANSITION
        setCurrentStep(1);
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
            toast({ title: "Signal Scheduled", description: `SMS alert set for ${productName}.` });
            onOpenChange(false);
            await refreshData();
        } else {
            toast({ variant: "destructive", title: "Handshake Failed", description: "Registry core connection failure." });
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-xl sm:rounded-2xl border-0 sm:border shadow-none sm:shadow-xl bg-transparent sm:bg-card h-auto max-h-[90vh]">
                <div className="p-4 sm:p-6 pb-2 shrink-0 bg-transparent sm:bg-muted/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Eye className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tighter leading-none mb-1">
                                {currentStep === 0 ? "Identify SKU" : "Reminder Details"}
                            </DialogTitle>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Registry Step {currentStep + 1} of 2</p>
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[60vh] sm:max-h-[70vh]">
                    <div className="p-4 sm:p-8 space-y-6">
                        
                        {/* STEP 1: BARCODE */}
                        {currentStep === 0 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Asset Identity Node</Label>
                                    <div className="relative group">
                                        <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                        <Input 
                                            ref={barcodeInputRef}
                                            placeholder="SCAN OR ENTER SKU..."
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleBarcodeLookup(barcode);
                                                }
                                            }}
                                            className="pl-12 h-14 rounded-xl bg-muted/10 border-white/5 font-black uppercase tracking-tight text-lg shadow-inner"
                                        />
                                        {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => handleBarcodeLookup(barcode)}
                                    disabled={!barcode.trim() || isSearching}
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white"
                                >
                                    Begin Identification <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* STEP 2: STAFF & DATE */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                {productName && (
                                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm relative overflow-hidden">
                                        <div className="absolute inset-0 bg-tech-grid opacity-10" />
                                        <div className="relative z-10 flex items-center gap-4">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Authenticated Target</p>
                                                <p className="text-sm font-black uppercase text-slate-900 dark:text-white truncate">{productName}</p>
                                                <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase opacity-60">{barcode}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Operating Personnel</Label>
                                        <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    role="combobox" 
                                                    className="w-full h-14 justify-between font-black uppercase tracking-tight bg-muted/10 border-white/5 rounded-xl shadow-inner px-4 text-sm"
                                                >
                                                    <div className="flex items-center gap-3 truncate">
                                                        <User className="h-5 w-5 text-primary/40 shrink-0" />
                                                        <span className="truncate">{staffName || "Select Identity..."}</span>
                                                    </div>
                                                    <ChevronsUpDown className="h-4 w-4 opacity-20 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-white/10" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search registry..." className="h-12" />
                                                    <CommandList className="max-h-72">
                                                        <CommandEmpty className="py-8 text-[10px] font-black uppercase text-muted-foreground/40 text-center tracking-[0.2em]">Zero Node Matches</CommandEmpty>
                                                        <CommandGroup className="p-2">
                                                            {uniqueStaffNames.map(name => (
                                                                <CommandItem 
                                                                    key={name} 
                                                                    value={name} 
                                                                    onSelect={() => {
                                                                        setStaffName(name);
                                                                        setStaffPopoverOpen(false);
                                                                    }}
                                                                    className="font-black uppercase text-[10px] h-12 cursor-pointer rounded-xl px-4"
                                                                >
                                                                    <Check className={cn("mr-3 h-4 w-4", staffName === name ? "opacity-100" : "opacity-0")} />
                                                                    {name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Threshold Expiry Date</Label>
                                        <Popover modal={true}>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    className={cn(
                                                        "w-full h-14 justify-start font-black uppercase tracking-tight bg-muted/10 border-white/5 rounded-xl shadow-inner px-4 text-sm",
                                                        !expiryDate && "text-muted-foreground/40"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-3 h-5 w-5 text-primary/40 shrink-0" />
                                                    {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Identify Date..."}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-white/10" align="center">
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

                                <div className="flex gap-3 pt-4">
                                    <Button variant="ghost" onClick={() => setCurrentStep(0)} className="h-14 px-6 font-black uppercase text-[10px] tracking-widest opacity-40 hover:opacity-100">
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !staffName || !expiryDate} 
                                        className="flex-1 h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white"
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Initialize Signal
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-2 bg-muted/5 sm:bg-muted/10 border-t shrink-0 flex justify-center">
                    <DialogClose asChild>
                        <Button variant="ghost" className="text-[8px] font-black uppercase tracking-[0.5em] opacity-20 hover:opacity-100 transition-all">
                            Terminate Protocol
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
