'use client';

import { useState, useEffect, useRef } from 'react';
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
            <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-xl border-none shadow-3xl bg-background h-auto max-h-[90vh]">
                <div className="bg-primary p-3 sm:p-4 text-primary-foreground shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-1.5 rounded-lg">
                            <Eye className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black uppercase tracking-tighter leading-none mb-1">
                                {currentStep === 0 ? "Identify SKU" : "Reminder Details"}
                            </DialogTitle>
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">Step {currentStep + 1} of 2</p>
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[60vh] sm:max-h-[70vh]">
                    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                        
                        {/* STEP 1: BARCODE */}
                        {currentStep === 0 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Asset Barcode</Label>
                                    <div className="relative group">
                                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
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
                                            className="pl-11 h-12 rounded-lg bg-muted/20 border-white/5 font-black uppercase tracking-tight text-lg shadow-inner"
                                        />
                                        {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => handleBarcodeLookup(barcode)}
                                    disabled={!barcode.trim() || isSearching}
                                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                                >
                                    Proceed <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        )}

                        {/* STEP 2: STAFF & DATE */}
                        {currentStep === 1 && (
                            <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                {productName && (
                                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Target Identity</p>
                                                <p className="text-sm font-black uppercase text-slate-900 dark:text-white truncate">{productName}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{barcode}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Identify Personnel</Label>
                                        <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    role="combobox" 
                                                    className="w-full h-12 justify-between font-black uppercase tracking-tight bg-muted/20 border-white/5 rounded-lg shadow-inner px-4 text-xs"
                                                >
                                                    <div className="flex items-center gap-3 truncate">
                                                        <User className="h-4 w-4 text-primary/40 shrink-0" />
                                                        <span className="truncate">{staffName || "Select Personnel..."}</span>
                                                    </div>
                                                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-20 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search registry..." className="h-11" />
                                                    <CommandList className="max-h-72">
                                                        <CommandEmpty className="py-6 text-[10px] font-black uppercase text-muted-foreground/40 text-center">No Node Found</CommandEmpty>
                                                        <CommandGroup className="p-1.5">
                                                            {uniqueStaffNames.map(name => (
                                                                <CommandItem 
                                                                    key={name} 
                                                                    value={name} 
                                                                    onSelect={() => {
                                                                        setStaffName(name);
                                                                        setStaffPopoverOpen(false);
                                                                    }}
                                                                    className="font-black uppercase text-[10px] h-10 cursor-pointer rounded-lg px-3"
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", staffName === name ? "opacity-100" : "opacity-0")} />
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
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Target Expiry Date</Label>
                                        <Popover modal={true}>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    className={cn(
                                                        "w-full h-12 justify-start font-black uppercase tracking-tight bg-muted/20 border-white/5 rounded-lg shadow-inner px-4 text-xs",
                                                        !expiryDate && "text-muted-foreground/40"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-3 h-5 w-5 text-primary/40 shrink-0" />
                                                    {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Select Expiry Date..."}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="center">
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
                                    <Button variant="ghost" onClick={() => setCurrentStep(0)} className="h-12 px-4 font-black uppercase text-[10px] tracking-widest">
                                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                                    </Button>
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !staffName || !expiryDate} 
                                        className="flex-1 h-12 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20"
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Initialize Reminder
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-1.5 bg-muted/30 border-t shrink-0 flex justify-center">
                    <DialogClose asChild>
                        <Button variant="ghost" className="text-[8px] font-black uppercase tracking-[0.4em] opacity-30 hover:opacity-100">
                            Abort Protocol
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}