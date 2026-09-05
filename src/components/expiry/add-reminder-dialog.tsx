
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
    Send
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
            <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-xl border-none shadow-3xl bg-background">
                <div className="bg-primary p-3 sm:p-4 text-primary-foreground shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-1.5 rounded-lg">
                            <Eye className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black uppercase tracking-tighter leading-none mb-1">Entry Protocol</DialogTitle>
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">Diary Reminder Initialization</p>
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[60vh] sm:max-h-[75vh]">
                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Asset Identity</Label>
                                <div className="relative group">
                                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        ref={barcodeInputRef}
                                        placeholder="SCAN OR ENTER SKU..."
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                                        onBlur={() => handleBarcodeLookup(barcode)}
                                        className="pl-10 h-12 rounded-lg bg-muted/20 border-white/5 font-black uppercase tracking-tight text-sm shadow-inner"
                                    />
                                    {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                                </div>
                            </div>

                            {productName && (
                                <div className="p-3 rounded-lg bg-primary/5 border-2 border-primary/10 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background p-1.5 rounded-lg shadow-sm border border-white/5 shrink-0">
                                            <ShieldCheck className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Matched Node</p>
                                            <p className="text-xs font-black uppercase text-slate-900 dark:text-white truncate">{productName}</p>
                                            <p className="text-[8px] font-bold text-muted-foreground truncate uppercase">{supplierName}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Identify Personnel</Label>
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
                                            <PlusCircle className="h-3.5 w-3.5 opacity-20 shrink-0" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search registry..." className="h-11" />
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
                                                            className="font-black uppercase text-[10px] h-10 cursor-pointer rounded-lg px-3"
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
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Expiry Date</Label>
                                <Popover modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            className={cn(
                                                "w-full h-12 justify-start font-black uppercase tracking-tight bg-muted/20 border-white/5 rounded-lg shadow-inner px-4 text-xs",
                                                !expiryDate && "text-muted-foreground/40"
                                            )}
                                        >
                                            <CalendarIcon className="mr-3 h-4 w-4 text-primary/40 shrink-0" />
                                            {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Select Target Date..."}
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

                        <div className="pt-2">
                            <Button 
                                onClick={handleSave} 
                                disabled={isSaving || !barcode || !staffName || !expiryDate} 
                                className="w-full h-12 rounded-lg font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white border-none"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Initialize Reminder
                            </Button>
                            <div className="mt-4 p-3 bg-muted/10 rounded-lg border border-dashed border-white/5 text-center">
                                <p className="text-[7px] font-black uppercase text-muted-foreground/30 tracking-[0.4em]">
                                    SMS Signal will dispatch 30 Days before target
                                </p>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-3 bg-muted/30 border-t shrink-0 flex justify-center">
                    <DialogClose asChild>
                        <Button variant="ghost" className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100 h-8">
                            Cancel Protocol
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
