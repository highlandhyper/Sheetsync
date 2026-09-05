
'use client';

import React, { useEffect, useState, useTransition, useRef, useCallback, useMemo } from 'react';
import { 
    CalendarIcon, 
    Loader2, 
    FilePlus, 
    ChevronsUpDown, 
    Check, 
    Barcode, 
    Info, 
    Warehouse, 
    ArrowLeft, 
    ArrowRight,
    Scan,
    User,
    Tag,
    Hash,
    PartyPopper,
    Heart,
    ShieldCheck,
    BellOff,
    Clock,
    KeyRound,
    CloudOff,
    SendHorizontal,
    Globe,
    Zap,
    XCircle,
    Wifi,
    Eye,
    List,
    X,
    Search
} from 'lucide-react';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import { addExpiryWatchAction, fetchProductAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';

const steps = [
  { id: 1, name: 'Identify SKU', icon: Barcode },
  { id: 2, name: 'Log Details', icon: Info },
];

export function AddReminderStepperForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = useAccessControl();
  const { 
    products: cachedProducts, 
    uniqueStaffNames,
    addExpiryReminderLocal,
    refreshData,
    isOnline
  } = useDataCache();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const scanProcessedRef = useRef(false);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const thankYouAudioRef = useRef<HTMLAudioElement | null>(null);

  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();

  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const SCANNER_REGION_ID = 'scanner-diary-add';

  useEffect(() => {
    if (typeof window !== 'undefined') {
        thankYouAudioRef.current = new Audio('/thankyou.m4a');
        thankYouAudioRef.current.load();
    }
  }, []);

  const playThankYouAudio = useCallback(() => {
    if (thankYouAudioRef.current && permissions.isAudioEnabled !== false) {
        thankYouAudioRef.current.currentTime = 0;
        thankYouAudioRef.current.play().catch(() => {});
    }
  }, [permissions.isAudioEnabled]);

  const handleBarcodeLookup = useCallback(async (bc: string) => {
      if (!bc || !bc.trim()) return false;
      const cleanBc = bc.trim().toUpperCase();
      
      setIsFetchingProduct(true);
      setProductName('');
      setSupplierName('');
      
      const normalizedTerm = cleanBc.replace(/^0+/, '');
      const cachedProduct = cachedProducts.find(p => p.barcode === cleanBc || p.barcode.replace(/^0+/, '') === normalizedTerm);
      
      if (cachedProduct) {
        setProductName(cachedProduct.productName);
        setSupplierName(cachedProduct.supplierName || 'N/A');
        setIsFetchingProduct(false);
        setCurrentStep(1);
        return true;
      }

      if (!isOnline) {
          toast({ variant: "destructive", title: "Offline Mode", description: "Remote lookup unavailable. Use manual entry." });
          setIsFetchingProduct(false);
          return false;
      }

      const response = await fetchProductAction(cleanBc);
      if (response.success && response.data) {
          setProductName(response.data.productName);
          setSupplierName(response.data.supplierName || 'N/A');
          setIsFetchingProduct(false);
          setCurrentStep(1);
          return true;
      } else {
          setProductName('Unregistered Identity');
          setSupplierName('N/A');
          setIsFetchingProduct(false);
          setCurrentStep(1);
          return true;
      }
  }, [cachedProducts, isOnline, toast]);

  const onSubmit = async () => {
    if (isSubmitting || submitLockRef.current || !barcode || !staffName || !expiryDate) return;
    
    setIsSubmitting(true);
    submitLockRef.current = true;

    startTransition(async () => {
      try {
        const res = await addExpiryWatchAction({
            barcode: barcode.trim().toUpperCase(),
            productName,
            supplierName,
            staffName,
            expiryDate: format(expiryDate, 'yyyy-MM-dd')
        });

        if (res.success && res.data) {
            playThankYouAudio();
            addExpiryReminderLocal(res.data);
            setIsSuccessDialogOpen(true);
            
            setTimeout(() => {
                setIsSuccessDialogOpen(false);
                setBarcode('');
                setProductName('');
                setSupplierName('');
                setStaffName('');
                setExpiryDate(undefined);
                setCurrentStep(0);
                submitLockRef.current = false;
                setIsSubmitting(false);
                refreshData();
                setTimeout(() => barcodeInputRef.current?.focus(), 100);
            }, 1500);
        } else {
          setErrorMessage(res.message || 'Registry core connection failure.');
          setIsErrorDialogOpen(true);
          setIsSubmitting(false);
          submitLockRef.current = false;
        }
      } catch (err) {
        setErrorMessage('Industrial terminal handshake timeout.');
        setIsErrorDialogOpen(true);
        setIsSubmitting(false);
        submitLockRef.current = false;
      }
    });
  };

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current || !decodedText) return;
    scanProcessedRef.current = true;
    setBarcode(decodedText.toUpperCase());
    setIsScannerDialogOpen(false);
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.stop().catch(() => {});
      html5QrcodeScannerRef.current = null;
    }
    handleBarcodeLookup(decodedText);
    setTimeout(() => { scanProcessedRef.current = false; }, 1000); 
  }, [handleBarcodeLookup]);

  useEffect(() => {
    if (isScannerDialogOpen) {
      const timer = setTimeout(() => {
        if (!html5QrcodeScannerRef.current) {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID);
          scanner.start({ facingMode: 'environment' }, { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, onScanSuccess, () => {}).then(() => {
            html5QrcodeScannerRef.current = scanner;
          }).catch(() => {});
        }
      }, 800);
      return () => {
        clearTimeout(timer);
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.stop().catch(() => {});
          html5QrcodeScannerRef.current = null;
        }
      };
    }
  }, [isScannerDialogOpen, onScanSuccess]);

  return (
    <>
    <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 mb-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
                    DIARY <span className="text-primary">SIGNAL</span>
                </h1>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-2">Industrial Observation Registry</p>
            </div>
            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold border-primary/10 bg-background shadow-sm hover:bg-primary/5">
                <Link href="/expiry-watch">
                    <List className="mr-2 h-4 w-4 text-primary" /> Show List
                </Link>
            </Button>
        </div>

        <Card className="shadow-none border-0 sm:border sm:shadow-xl bg-transparent sm:bg-card rounded-2xl overflow-hidden transition-all duration-500">
            <CardHeader className="px-4 sm:px-6 pb-2 pt-4">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Progress value={((currentStep + 1) / steps.length) * 100} className="h-1.5" />
                        <p className="text-[10px] font-black text-center text-muted-foreground flex items-center justify-center gap-2 uppercase tracking-widest">
                            {React.createElement(steps[currentStep].icon, { className: "h-3 w-3" })} Step {currentStep + 1} of {steps.length}: {steps[currentStep].name}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 py-6">
                <div className="space-y-6">
                    {/* STEP 1: BARCODE */}
                    <div className={cn(currentStep !== 0 && "hidden", "space-y-6")}>
                        <div className="space-y-3">
                            <Label htmlFor="barcode" className="text-xs font-black uppercase text-muted-foreground tracking-widest ml-1">Identify Target Node</Label>
                            <div className="flex gap-2 items-start">
                                <div className="relative flex-grow group">
                                    <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        id="barcode"
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
                                        className="h-14 sm:h-12 pl-12 text-lg sm:text-base font-bold bg-muted/10 border-white/5 rounded-xl shadow-inner uppercase"
                                        autoFocus 
                                    />
                                </div>
                                <Button type="button" onClick={() => setIsScannerDialogOpen(true)} variant="outline" size="icon" className="h-14 w-14 sm:h-12 sm:w-12 shrink-0 bg-primary/5 border-primary/20 rounded-xl">
                                    <Scan className="h-6 w-6 text-primary" />
                                </Button>
                            </div>
                        </div>
                        <Button 
                            onClick={() => handleBarcodeLookup(barcode)}
                            disabled={!barcode.trim() || isFetchingProduct}
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 bg-primary text-white border-none"
                        >
                            {isFetchingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Initialize Protocol
                        </Button>
                    </div>

                    {/* STEP 2: DETAILS */}
                    <div className={cn(currentStep !== 1 && "hidden", "space-y-6")}>
                        {productName && (
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 shadow-sm relative overflow-hidden">
                                <div className="absolute inset-0 bg-tech-grid opacity-10" />
                                <div className="relative z-10 flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <ShieldCheck className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-sm uppercase text-slate-900 dark:text-white truncate">{productName}</h3>
                                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{supplierName || 'Unknown Vendor'}</p>
                                        <p className="text-[9px] font-mono text-muted-foreground/40 mt-1 uppercase tracking-tighter">{barcode}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Operating Personnel</Label>
                                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="h-14 sm:h-12 w-full justify-between font-bold text-base sm:text-sm bg-muted/10 border-white/5 rounded-xl shadow-inner px-4">
                                            <div className="flex items-center gap-2 truncate">
                                                <User className="h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="truncate">{staffName || "Select Personnel..."}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-20" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search registry..." />
                                            <CommandList className="max-h-72">
                                                <CommandEmpty className="py-6 text-[10px] font-black uppercase text-muted-foreground/40 text-center">Zero registry matches</CommandEmpty>
                                                <CommandGroup className="p-2">
                                                    {uniqueStaffNames.map(name => (
                                                        <CommandItem 
                                                            key={name} 
                                                            value={name} 
                                                            onSelect={() => { setStaffName(name); setStaffPopoverOpen(false); }}
                                                            className="font-black uppercase text-[10px] h-11 px-4 cursor-pointer rounded-lg"
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
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Threshold Expiry Date</Label>
                                <Popover modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("h-14 sm:h-12 w-full justify-start font-bold text-base sm:text-sm bg-muted/10 border-white/5 rounded-xl shadow-inner px-4", !expiryDate && "text-muted-foreground/40")}>
                                            <CalendarIcon className="mr-3 h-4 w-4 text-primary/40 shrink-0" />
                                            {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Identify Date..."}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="center">
                                        <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus captionLayout="dropdown" startMonth={new Date()} endMonth={new Date(2045, 11)} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setCurrentStep(0)} className="h-14 sm:h-12 px-6 font-black uppercase text-[10px] tracking-widest opacity-40 hover:opacity-100">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button 
                                onClick={onSubmit}
                                disabled={isSubmitting || !staffName || !expiryDate}
                                className="flex-1 h-14 sm:h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 bg-primary text-white border-none"
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-2 h-4 w-4" />}
                                Finalize Entry
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>

    <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-black">
            <DialogHeader className="p-8 pb-4 border-b border-white/5 bg-zinc-900/80 absolute top-0 left-0 right-0 z-20">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-white">Registry Visual Capture</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary">Position SKU for instant identification</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[450px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
            </div>
            <div className="p-1.5 bg-zinc-900/80 border-t border-white/5 relative z-20 flex justify-center">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10">
                    Abort Scanning Protocol
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-sm w-[90%] p-8 overflow-hidden rounded-2xl border-0 shadow-2xl bg-slate-950 text-white flex flex-col items-center text-center">
            <div className="bg-primary/20 p-4 rounded-full mb-6 animate-bounce"><PartyPopper className="h-12 w-12 text-primary" /></div>
            <DialogHeader className="space-y-2">
                <DialogTitle className="text-3xl font-black tracking-tighter text-primary uppercase">Logged Successfully!</DialogTitle>
                <DialogDescription className="text-slate-400 text-lg font-medium">Diary entry has been synchronized.</DialogDescription>
            </DialogHeader>
            <Separator className="my-6 bg-slate-800" />
            <div className="flex flex-col items-center gap-2">
                <Heart className="h-6 w-6 text-red-500 fill-red-500" />
                <p className="text-xl font-bold">Thank you, <span className="text-primary">{staffName}</span>!</p>
                <p className="text-slate-500 text-sm italic">Observing with precision.</p>
            </div>
        </DialogContent>
    </Dialog>

    <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-10 overflow-hidden rounded-2xl border-0 shadow-3xl bg-destructive text-destructive-foreground flex flex-col items-center text-center">
            <div className="bg-white/20 p-6 rounded-full mb-6 shadow-2xl"><XCircle className="h-16 w-16 text-white" /></div>
            <DialogHeader className="space-y-3">
                <DialogTitle className="text-4xl font-black uppercase tracking-tighter leading-none">Sync Failure</DialogTitle>
                <DialogDescription className="text-white/80 text-base font-bold uppercase tracking-widest opacity-90">Registry Node Disconnected</DialogDescription>
            </DialogHeader>
            <div className="mt-8 p-6 bg-black/20 rounded-xl border border-white/10 w-full">
                <p className="text-sm font-medium leading-relaxed italic">"{errorMessage}"</p>
            </div>
            <Button onClick={() => setIsErrorDialogOpen(false)} variant="secondary" className="mt-10 w-full h-16 text-lg font-black uppercase tracking-widest rounded-2xl shadow-2xl">
                Abort Protocol
            </Button>
        </DialogContent>
    </Dialog>
    </>
  );
}
