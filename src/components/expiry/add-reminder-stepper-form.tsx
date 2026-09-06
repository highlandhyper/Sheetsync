
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
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-2 overflow-x-hidden px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:space-y-3 sm:px-4 md:px-0 md:pb-4">
        <div className="mb-2 px-0.5 sm:mb-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        Diary <span className="text-primary">Signal</span>
                    </h1>
                </div>

                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 rounded-lg bg-muted/35 px-2.5 text-[10px] font-semibold shadow-none hover:bg-muted/50"
                >
                    <Link href="/expiry-watch">
                        <List className="mr-1.5 h-3.5 w-3.5 text-primary" />
                        Show List
                    </Link>
                </Button>
            </div>

            <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
                Industrial Observation Registry
            </p>
        </div>

        <Card className="w-full min-w-0 overflow-visible rounded-none border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pb-2 pt-1 sm:pb-3 sm:pt-2">
                <div className="space-y-2">
                    <div className="space-y-1.5">
                        <Progress value={((currentStep + 1) / steps.length) * 100} className="h-1" />
                        <p className="flex items-center justify-center gap-1.5 text-center text-[9px] font-semibold text-muted-foreground">
                            {React.createElement(steps[currentStep].icon, { className: "h-3 w-3" })} Step {currentStep + 1} of {steps.length}: {steps[currentStep].name}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 px-0 py-2 sm:py-3">
                <div className="space-y-3">
                    {/* STEP 1: BARCODE */}
                    <div className={cn(currentStep !== 0 && "hidden", "space-y-3")}>
                        <div className="space-y-1.5">
                            <Label htmlFor="barcode" className="ml-0.5 text-[11px] font-semibold text-foreground">Barcode</Label>
                            <div className="flex min-w-0 items-start gap-2">
                                <div className="group relative min-w-0 flex-1">
                                    <Barcode className="pointer-events-none absolute left-3 top-[22px] h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
                                    <Input 
                                        id="barcode"
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
                                        className="h-11 w-full min-w-0 rounded-xl border-0 bg-muted/40 pl-9 pr-3 text-base font-semibold uppercase shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                                        autoFocus 
                                    />
                                </div>
                                <Button type="button" onClick={() => setIsScannerDialogOpen(true)} variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-0 bg-primary/10 shadow-none hover:bg-primary/15">
                                    <Scan className="h-5 w-5 text-primary" />
                                </Button>
                            </div>
                        </div>
                        <Button 
                            onClick={() => handleBarcodeLookup(barcode)}
                            disabled={!barcode.trim() || isFetchingProduct}
                            className="h-11 w-full rounded-xl border-0 bg-primary text-xs font-semibold text-primary-foreground shadow-none"
                        >
                            {isFetchingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Continue
                        </Button>
                    </div>

                    {/* STEP 2: DETAILS */}
                    <div className={cn(currentStep !== 1 && "hidden", "space-y-3")}>
                        {productName && (
                            <div className="rounded-2xl bg-primary/[0.055] p-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-semibold text-primary/70">
                                            Product found
                                        </p>
                                        <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
                                            {productName}
                                        </h3>
                                        <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
                                            <span className="truncate">{supplierName || 'Unknown Vendor'}</span>
                                            <span className="opacity-40">•</span>
                                            <span className="shrink-0 font-mono">{barcode}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Staff member</Label>
                                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" role="combobox" className="h-11 w-full min-w-0 justify-between rounded-xl border-0 bg-muted/40 px-3 text-sm font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">
                                            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                                <User className="h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="truncate">{staffName || "Select staff member..."}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-20" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border-0 p-0 shadow-xl" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search staff..." />
                                            <CommandList className="max-h-72">
                                                <CommandEmpty className="py-6 text-[10px] font-black uppercase text-muted-foreground/40 text-center">No staff members found</CommandEmpty>
                                                <CommandGroup className="p-2">
                                                    {uniqueStaffNames.map(name => (
                                                        <CommandItem 
                                                            key={name} 
                                                            value={name} 
                                                            onSelect={() => { setStaffName(name); setStaffPopoverOpen(false); }}
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

                            <div className="space-y-1.5">
                                <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Expiry date</Label>
                                <Popover modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" className={cn("h-11 w-full min-w-0 justify-start rounded-xl border-0 bg-muted/40 px-3 text-left text-sm font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0", !expiryDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-3 h-4 w-4 text-primary/40 shrink-0" />
                                            {expiryDate ? format(expiryDate, 'dd MMM yyyy') : "Select date..."}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] overflow-auto rounded-2xl border-0 p-0 shadow-2xl" align="center" sideOffset={6}>
                                        <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus captionLayout="dropdown" startMonth={new Date()} endMonth={new Date(2045, 11)} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex min-w-0 gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setCurrentStep(0)} className="h-11 shrink-0 rounded-xl bg-muted/30 px-3 text-xs font-semibold opacity-100 shadow-none hover:bg-muted/45">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button 
                                onClick={onSubmit}
                                disabled={isSubmitting || !staffName || !expiryDate}
                                className="h-11 flex-1 rounded-xl border-0 bg-primary text-xs font-semibold text-primary-foreground shadow-none"
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-2 h-4 w-4" />}
                                Log Entry
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>

    <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border-0 bg-black p-0 shadow-2xl sm:rounded-3xl">
            <DialogHeader className="absolute inset-x-0 top-0 z-20 bg-zinc-900/85 p-4 pb-2">
                <DialogTitle className="text-base font-semibold text-white">Barcode Scanner</DialogTitle>
                <DialogDescription className="text-[10px] text-zinc-400">Position the barcode inside the frame</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[62dvh] min-h-[300px] max-h-[450px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
            </div>
            <div className="relative z-20 flex justify-center bg-zinc-900/85 p-1.5">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10">
                    Close Scanner
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
