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
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[380px] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[26px] border-0 bg-background p-0 shadow-2xl">
                <div className="shrink-0 px-4 pb-2 pt-5 sm:px-5 sm:pt-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Eye className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tighter leading-none mb-1">
                                {currentStep === 0 ? "Identify SKU" : "Reminder Details"}
                            </DialogTitle>
                            <p className="mt-1 text-[10px] font-medium text-muted-foreground">Step {currentStep + 1} of 2</p>
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[68dvh]">
                    <div className="space-y-4 px-4 py-3 sm:px-5 sm:py-4">
                        
                        {/* STEP 1: BARCODE */}
                        {currentStep === 0 && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Asset Identity Node</Label>
                                    <div className="group relative">
                                        <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
                                        <Input 
                                            ref={barcodeInputRef}
                                            placeholder="Scan or enter barcode"
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleBarcodeLookup(barcode);
                                                }
                                            }}
                                            className="h-11 w-full rounded-xl border-0 bg-muted/40 pl-9 pr-10 text-base font-semibold uppercase shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                                        />
                                        {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => handleBarcodeLookup(barcode)}
                                    disabled={!barcode.trim() || isSearching}
                                    className="h-11 w-full rounded-xl border-0 bg-primary text-xs font-semibold text-primary-foreground shadow-none"
                                >
                                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* STEP 2: STAFF & DATE */}
                        {currentStep === 1 && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">
                                {productName && (
                                    <div className="rounded-2xl bg-primary/[0.055] p-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                                                <ShieldCheck className="h-4 w-4" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-[9px] font-semibold text-primary/70">Product found</p>
                                                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{productName}</p>
                                                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{barcode}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Staff member</Label>
                                        <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    role="combobox" 
                                                    className="h-11 w-full min-w-0 justify-between rounded-xl border-0 bg-muted/40 px-3 text-sm font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                                        <User className="h-4 w-4 shrink-0 text-primary/50" />
                                                        <span className="truncate">{staffName || "Select staff member..."}</span>
                                                    </div>
                                                    <ChevronsUpDown className="h-4 w-4 opacity-20 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border-0 p-0 shadow-xl" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search staff..." className="h-12" />
                                                    <CommandList className="max-h-72">
                                                        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No staff members found</CommandEmpty>
                                                        <CommandGroup className="p-2">
                                                            {uniqueStaffNames.map(name => (
                                                                <CommandItem 
                                                                    key={name} 
                                                                    value={name} 
                                                                    onSelect={() => {
                                                                        setStaffName(name);
                                                                        setStaffPopoverOpen(false);
                                                                    }}
                                                                    className="h-10 cursor-pointer rounded-lg px-3 text-xs font-medium"
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
                                                    variant="ghost" 
                                                    className={cn(
                                                        "h-11 w-full min-w-0 justify-start rounded-xl border-0 bg-muted/40 px-3 text-left text-sm font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0",
                                                        !expiryDate && "text-muted-foreground/40"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2.5 h-4 w-4 shrink-0 text-primary/50" />
                                                    {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Select date..."}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] overflow-auto rounded-2xl border-0 p-0 shadow-2xl" align="center" sideOffset={6}>
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

                                <div className="flex min-w-0 gap-2 pt-1">
                                    <Button variant="ghost" onClick={() => setCurrentStep(0)} className="h-11 shrink-0 rounded-xl bg-muted/30 px-3 text-xs font-semibold opacity-100 shadow-none hover:bg-muted/45">
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !staffName || !expiryDate} 
                                        className="h-11 flex-1 rounded-xl border-0 bg-primary text-xs font-semibold text-primary-foreground shadow-none"
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Log Entry
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="flex shrink-0 justify-center px-4 pb-3 pt-1">
                    <DialogClose asChild>
                        <Button variant="ghost" className="h-8 rounded-lg px-3 text-[10px] font-medium text-muted-foreground shadow-none hover:bg-muted/40">
                            Close
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
