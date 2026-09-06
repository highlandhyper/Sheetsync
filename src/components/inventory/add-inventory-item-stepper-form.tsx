'use client';

import React, { useEffect, useState, useTransition, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
    AlertTriangle,
    PartyPopper,
    Heart,
    ShieldCheck,
    BellOff,
    Clock,
    KeyRound,
    CloudOff,
    MessageSquare,
    PackageSearch,
    SendHorizontal,
    Globe,
    Zap,
    XCircle,
    Wifi,
    ShieldAlert
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { addInventoryItemSchema, type AddInventoryItemFormValues } from '@/lib/schemas';
import { addInventoryItemAction, fetchProductAction, fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { OfflineQueueTerminal } from '@/components/inventory/offline-queue-terminal';
import type { InventoryItem } from '@/lib/types';

function SessionTimer({ expiresAt }: { expiresAt: string }) {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const end = new Date(expiresAt);
            const seconds = differenceInSeconds(end, now);
            
            if (seconds <= 0) {
                setTimeLeft('00:00');
                return;
            }

            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        };

        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    return (
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20">
            <Clock className="h-2.5 w-2.5" />
            <span>{timeLeft}</span>
        </div>
    );
}

function OfflineOutboxBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
    if (count === 0) return null;
    return (
        <div 
            onClick={onOpen}
            className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 cursor-pointer hover:bg-amber-500/20 transition-all group shadow-sm active:scale-[0.98]"
        >
            <div className="flex items-center gap-3">
                <div className="relative h-8 w-8 flex items-center justify-center bg-amber-500/20 rounded-lg overflow-hidden shrink-0 transition-transform group-hover:scale-110">
                    <CloudOff className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-800 leading-none mb-0.5">Outbox</h4>
                    <p className="text-[10px] font-bold text-amber-700/70">{count} pending logs</p>
                </div>
            </div>
            <Badge variant="outline" className="h-6 px-2 bg-white/50 dark:bg-black/50 border-amber-500/30 text-amber-700 font-black uppercase text-[8px] tracking-widest group-hover:bg-amber-500 group-hover:text-white transition-colors">
                Queue
            </Badge>
        </div>
    );
}

const steps = [
  { id: 1, name: 'Scan Item', fields: ['barcode'], icon: Barcode },
  { id: 2, name: 'Add Details', fields: ['staffName', 'quantity', 'expiryDate'], icon: Info },
  { id: 3, name: 'Set Location', fields: ['location', 'itemType'], icon: Warehouse },
  { id: 4, name: 'Review & Log', icon: FilePlus },
];

export function AddInventoryItemStepperForm({ uniqueLocations: initialLocations, uniqueStaffNames }: { uniqueLocations: string[], uniqueStaffNames: string[] }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = useAccessControl();
  const { 
    products: cachedProducts, 
    uniqueLocations: dynamicLocations, 
    addInventoryItem,
    refreshData,
    queueAction,
    isOnline,
    pendingActions,
  } = useDataCache();
  const { activeSession, pendingActivationSession, setActivationDialogOpen, consumeSpecialEntry, requestSpecialEntry } = useSpecialEntry(); 
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const scanProcessedRef = useRef(false);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const thankYouAudioRef = useRef<HTMLAudioElement | null>(null);
  const identityAudioRef = useRef<HTMLAudioElement | null>(null);
  const identityAudio1Ref = useRef<HTMLAudioElement | null>(null);

  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedStaffName, setSubmittedStaffName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
        thankYouAudioRef.current = new Audio('/thankyou.m4a');
        thankYouAudioRef.current.load();
        identityAudioRef.current = new Audio('/whoareyou.mp3');
        identityAudioRef.current.load();
        identityAudio1Ref.current = new Audio('/whoareyou1.mp3');
        identityAudio1Ref.current.load();
    }
  }, []);

  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  const [staffComboboxOpen, setStaffComboboxOpen] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [productSupplier, setProductSupplier] = useState('');
  const [productLookupError, setProductLookupError] = useState('');
  const [suggestedProductName, setSuggestedProductName] = useState('');
  const [hasRequestedProduct, setHasRequestedProduct] = useState(false);
  const [foundInGlobalRegistry, setFoundInGlobalRegistry] = useState(false);

  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const SCANNER_REGION_ID = 'scanner-log-new';

  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<AddInventoryItemFormValues>({
    resolver: zodResolver(addInventoryItemSchema),
    defaultValues: {
      staffName: activeSession?.staffName !== "ALL PERSONNEL (GLOBAL)" ? (activeSession?.staffName || '') : '',
      itemType: 'Expiry',
      barcode: '',
      quantity: 1,
      expiryDate: new Date(),
    },
    mode: 'onTouched'
  });
  
  const allFormValues = watch();

  useEffect(() => {
    if (activeSession?.staffName && activeSession.staffName !== "ALL PERSONNEL (GLOBAL)" && !allFormValues.staffName) {
        setValue('staffName', activeSession.staffName);
    }
  }, [activeSession, setValue, allFormValues.staffName]);

  const playThankYouAudio = useCallback(() => {
    if (thankYouAudioRef.current && permissions.isAudioEnabled !== false) {
        thankYouAudioRef.current.currentTime = 0;
        thankYouAudioRef.current.play().catch(() => {});
    }
  }, [permissions.isAudioEnabled]);

  const playIdentityAudio = useCallback(() => {
    if (!permissions.isAudioEnabled || permissions.isIdentityAudioEnabled === false) return;
    const audio = permissions.identityAudioType === 'whoareyou1' ? identityAudio1Ref.current : identityAudioRef.current;
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
  }, [permissions.isAudioEnabled, permissions.isIdentityAudioEnabled, permissions.identityAudioType]);

  const handleBarcodeLookup = useCallback(async (barcode: string) => {
      if (!barcode || !barcode.trim()) return false;
      
      setIsFetchingProduct(true);
      setProductLookupError('');
      setProductName('');
      setProductSupplier('');
      setHasRequestedProduct(false);
      setSuggestedProductName('');
      setFoundInGlobalRegistry(false);
      
      const normalizedTerm = barcode.replace(/^0+/, '');
      const cachedProduct = cachedProducts.find(p => p.barcode === barcode || p.barcode.replace(/^0+/, '') === normalizedTerm);
      
      if (cachedProduct) {
        setProductName(cachedProduct.productName);
        setProductSupplier(cachedProduct.supplierName || 'N/A');
        setIsFetchingProduct(false);
        return true;
      }

      if (!navigator.onLine) {
          setProductLookupError('Working Offline: Only local catalog items verifiable.');
          setIsFetchingProduct(false);
          return false;
      }

      const response = await fetchProductAction(barcode);
      if (response.success && response.data) {
          setProductName(response.data.productName);
          setProductSupplier(response.data.supplierName || 'N/A');
          setIsFetchingProduct(false);
          return true;
      } else {
          const externalRes = await fetchProductExternalDataAction(barcode);
          if (externalRes.success && externalRes.data?.name) {
              setSuggestedProductName(externalRes.data.name);
              setFoundInGlobalRegistry(true);
          }
          setProductLookupError('Asset not found in Registry.');
          setIsFetchingProduct(false);
          return false;
      }
  }, [cachedProducts]);

  const onSubmit = async (data: AddInventoryItemFormValues) => {
    if (isSubmitting || submitLockRef.current) return;
    
    playThankYouAudio();
    setIsSuccessDialogOpen(true);
    setIsSubmitting(true);
    submitLockRef.current = true;
    setSubmittedStaffName(data.staffName);

    const now = new Date();
    const tempId = `log_${now.getTime()}`;
    const formattedExpiry = data.expiryDate ? format(data.expiryDate, 'yyyy-MM-dd') : '';

    const optimisticItem: InventoryItem = {
        id: tempId,
        barcode: data.barcode,
        quantity: data.quantity,
        expiryDate: formattedExpiry,
        location: data.location,
        staffName: data.staffName,
        productName: productName || 'Syncing...',
        supplierName: productSupplier || '...',
        itemType: data.itemType,
        timestamp: now.toISOString()
    };

    addInventoryItem(optimisticItem);
    
    const savedStaffName = data.staffName; 
    setTimeout(() => {
        setIsSuccessDialogOpen(false);
        reset({ ...data, barcode: '', quantity: 1 });
        setValue('staffName', savedStaffName); 
        setProductName('');
        setProductSupplier('');
        setProductLookupError('');
        setSuggestedProductName('');
        setHasRequestedProduct(false);
        setFoundInGlobalRegistry(false);
        setCurrentStep(0);
        submitLockRef.current = false;
        setIsSubmitting(false);
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }, 800);

    if (!navigator.onLine) {
        queueAction({
            type: 'LOG_INVENTORY',
            data: {
                barcode: data.barcode,
                staffName: data.staffName,
                itemType: data.itemType,
                quantity: data.quantity,
                location: data.location,
                expiryDate: formattedExpiry,
                userEmail: user?.email,
                disableNotification: activeSession ? 'true' : 'false',
                supplier: productSupplier
            }
        });
        if (activeSession) consumeSpecialEntry();
        return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('barcode', data.barcode);
      formData.append('staffName', data.staffName);
      formData.append('itemType', data.itemType);
      formData.append('quantity', data.quantity.toString());
      formData.append('location', data.location);
      formData.append('supplier', productSupplier);
      if (user?.email) formData.append('userEmail', user.email);
      if (activeSession) formData.append('disableNotification', 'true');
      if (data.expiryDate) formData.append('expiryDate', format(data.expiryDate, 'yyyy-MM-dd'));

      try {
        const response = await addInventoryItemAction(undefined, formData);
        if (response.success && response.data) {
          if (activeSession) consumeSpecialEntry(); 
        } else {
          setErrorMessage(response.message || 'The Google Sheets registry refused the connection.');
          setIsErrorDialogOpen(true);
        }
      } catch (err) {
        setErrorMessage('Industrial terminal handshake timeout. Check connectivity.');
        setIsErrorDialogOpen(true);
      }
    });
  };

  const handleRequestProductAdd = () => {
    const currentBarcode = getValues('barcode');
    if (!currentBarcode) return;
    requestSpecialEntry(allFormValues.staffName || 'Viewer', 'product_add', currentBarcode, suggestedProductName);
    setHasRequestedProduct(true);
    toast({ title: "Request Dispatched", description: "Administrators notified." });
  };

  type FieldName = keyof AddInventoryItemFormValues;

  const nextStep = async () => {
    if (isFetchingProduct || isSubmitting || submitLockRef.current) return;
    const fields = steps[currentStep].fields;
    if (currentStep >= steps.length - 1) return;
    const output = fields ? await trigger(fields as FieldName[], { shouldFocus: true }) : true;
    if (!output) return;
    if (currentStep === 0) {
        const currentBarcode = getValues('barcode');
        const barcodeOk = await handleBarcodeLookup(currentBarcode);
        if(!barcodeOk) return;
    }
    setCurrentStep(step => step + 1);
  };

  const prevStep = () => { if (currentStep > 0) setCurrentStep(step => step - 1); };
  const handleFormSubmit = () => { if (isSubmitting || submitLockRef.current) return; formRef.current?.requestSubmit(); };

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current || !decodedText) return;
    scanProcessedRef.current = true;
    setValue('barcode', decodedText, { shouldValidate: true });
    setIsScannerDialogOpen(false);
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.stop().catch(() => {});
      html5QrcodeScannerRef.current = null;
    }
    setTimeout(() => { nextStep(); scanProcessedRef.current = false; }, 500); 
  }, []);

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

  const isGlobalSession = activeSession?.staffName === "ALL PERSONNEL (GLOBAL)";

  return (
    <>
    <div className="w-full max-w-2xl mx-auto space-y-3 sm:space-y-4">
        <OfflineOutboxBanner count={pendingActions.length} onOpen={() => setIsOutboxOpen(true)} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 mb-2 sm:mb-4">
            <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight truncate">
                    Log <span className="text-primary">New Item</span>
                </h1>
                {!isOnline && (
                    <Badge variant="destructive" className="animate-pulse shadow-sm h-5 py-0 px-2 text-[8px] font-black uppercase mt-1">
                        <CloudOff className="h-2.5 w-2.5 mr-1" /> Offline Mode
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                {activeSession && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {activeSession.type === 'timed' && activeSession.expiresAt && <SessionTimer expiresAt={activeSession.expiresAt} />}
                        <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2 bg-primary/10 border-primary/20 text-primary text-[8px] font-black uppercase whitespace-nowrap">
                            {isGlobalSession ? <Globe className="h-2.5 w-2.5" /> : <BellOff className="h-2.5 w-2.5" />}
                            Silent Mode
                        </Badge>
                    </div>
                )}
                {pendingActivationSession && !activeSession && (
                    <Button size="sm" variant="outline" className="h-8 px-2.5 bg-yellow-500/10 border-yellow-500/20 text-yellow-600 animate-pulse font-black text-[9px] uppercase tracking-widest shrink-0" onClick={() => setActivationDialogOpen(true)}>
                        <KeyRound className="mr-1.5 h-3 w-3" /> Activate Silent
                    </Button>
                )}
            </div>
        </div>

        <Card className="shadow-none border-0 sm:border sm:shadow-xl bg-transparent sm:bg-card rounded-2xl overflow-hidden">
            <CardHeader className={cn("px-3 sm:px-6", currentStep !== 0 ? "pb-1 pt-3 sm:pt-4" : "pb-3")}>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Progress value={((currentStep + 1) / steps.length) * 100} className="h-1" />
                        <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <span className="flex items-center gap-1.5">
                                {React.createElement(steps[currentStep].icon, { className: "h-2.5 w-2.5 sm:h-3 sm:w-3" })} 
                                Step {currentStep + 1}: {steps[currentStep].name}
                            </span>
                            <span className="opacity-40">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 py-4 sm:py-6">
                <div className="space-y-4">
                    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* STEP 1: BARCODE */}
                        <div className={cn(currentStep !== 0 && "hidden", "space-y-4")}>
                            <Label htmlFor="barcode" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 block">Asset Identification Node</Label>
                            <div className="flex gap-2 items-start">
                                <div className="flex-grow group relative">
                                    <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        id="barcode" 
                                        ref={(e) => { register('barcode').ref(e); (barcodeInputRef as any).current = e; }} 
                                        placeholder="SCAN OR ENTER SKU..." 
                                        {...register('barcode')} 
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setValue('barcode', e.currentTarget.value, { shouldValidate: true }); nextStep(); } }} 
                                        autoFocus 
                                        className={cn("h-12 sm:h-11 pl-10 text-base font-black bg-muted/10 border-white/5 rounded-xl uppercase shadow-inner", errors.barcode && 'border-destructive')} 
                                    />
                                    {errors.barcode && <p className="text-[10px] text-destructive mt-1 font-bold">{errors.barcode.message}</p>}
                                </div>
                                <Button type="button" onClick={() => setIsScannerDialogOpen(true)} variant="outline" size="icon" className="h-12 w-12 sm:h-11 sm:w-11 shrink-0 bg-primary/5 border-primary/20 rounded-xl">
                                    <Scan className="h-5 w-5 text-primary" />
                                </Button>
                            </div>
                            
                            {productLookupError && !isFetchingProduct && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    {!hasRequestedProduct ? (
                                        <div className="space-y-2">
                                            {foundInGlobalRegistry && suggestedProductName && (
                                                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg animate-pulse">
                                                    <Globe className="h-3 w-3 text-primary" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-primary">Registry Match Found</span>
                                                </div>
                                            )}
                                            <Button type="button" variant="default" className="w-full h-11 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 rounded-xl bg-primary" onClick={handleRequestProductAdd}>
                                                <SendHorizontal className="mr-2 h-3.5 w-3.5" />
                                                {suggestedProductName ? `Request: ${suggestedProductName}` : "Notify Admin: New SKU"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="py-2.5 px-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 flex items-center gap-3 animate-in zoom-in-95 duration-300">
                                            <ShieldCheck className="h-4 w-4 shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest leading-none mb-0.5">Notification Sent</p>
                                                <p className="text-[8px] font-medium opacity-80 leading-none uppercase">Awaiting Admin Catalog Update</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* STEP 2: DETAILS */}
                        <div className={cn(currentStep !== 1 && "hidden", "space-y-4 sm:space-y-5")}>
                            {productName && (
                                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 shadow-sm relative overflow-hidden">
                                    <div className="absolute inset-0 bg-tech-grid opacity-10" />
                                    <div className="relative z-10 flex items-center gap-3">
                                        <div className="p-1.5 bg-primary/10 rounded-lg">
                                            <ShieldCheck className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-xs uppercase text-slate-900 dark:text-white truncate tracking-tight">{productName}</h3>
                                            <p className="text-[8px] font-mono text-muted-foreground mt-0.5 tracking-widest uppercase">{getValues('barcode')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Operating Personnel</Label>
                                <Popover open={staffComboboxOpen} onOpenChange={(open) => { setStaffComboboxOpen(open); if (open) playIdentityAudio(); }} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className={cn("h-11 sm:h-10 w-full justify-between font-bold bg-muted/10 border-white/5 rounded-xl px-3.5 shadow-none", !allFormValues.staffName && "text-muted-foreground", errors.staffName && 'border-destructive')}>
                                            <div className="flex items-center gap-2 truncate">
                                                <User className="h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="truncate text-xs">{allFormValues.staffName || "Select Personnel..."}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-20" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-white/10" align="start">
                                        <Command>
                                            <CommandList>
                                                <CommandEmpty className="py-6 text-[10px] font-black text-center text-muted-foreground/40 uppercase">Zero registry matches</CommandEmpty>
                                                <CommandGroup className="p-1.5">
                                                    {(uniqueStaffNames.length > 0 ? uniqueStaffNames : []).map((staff) => (
                                                        <CommandItem 
                                                            key={staff} 
                                                            value={staff} 
                                                            onSelect={() => { 
                                                                setValue("staffName", staff, { shouldValidate: true }); 
                                                                setStaffComboboxOpen(false); 
                                                            }} 
                                                            className="h-10 text-xs font-black uppercase cursor-pointer rounded-lg"
                                                        >
                                                            <Check className={cn("mr-2 h-3.5 w-3.5", allFormValues.staffName === staff ? "opacity-100" : "opacity-0")}/>
                                                            {staff}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {errors.staffName && <p className="text-[10px] text-destructive mt-1 font-bold uppercase">{errors.staffName.message}</p>}
                            </div>

                            <div className="flex gap-2.5">
                                <div className="w-1/3 space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Volume</Label>
                                    <div className="relative group">
                                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30 group-focus-within:text-primary" />
                                        <Input id="qty" type="number" min="1" {...register('quantity', { valueAsNumber: true })} onKeyDown={(e) => { if (['-', 'e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }} className={cn('h-11 sm:h-10 pl-9 font-black bg-muted/10 border-white/5 rounded-xl shadow-none text-base', errors.quantity && 'border-destructive')} />
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Lifecycle Expiry</Label>
                                    <Popover modal={true}>
                                        <PopoverTrigger asChild>
                                            <Button variant={'outline'} className={cn('h-11 sm:h-10 w-full px-3.5 text-left font-bold bg-muted/10 border-white/5 rounded-xl shadow-none', !allFormValues.expiryDate && 'text-muted-foreground', errors.expiryDate && 'border-destructive')}>
                                                <CalendarIcon className="mr-2 h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="text-xs truncate">{allFormValues.expiryDate ? format(allFormValues.expiryDate, 'dd/MM/yyyy') : "Pick Date"}</span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-white/10" align="end">
                                            <Calendar mode="single" selected={allFormValues.expiryDate} onSelect={(date) => { setValue('expiryDate', date || new Date()); }} initialFocus captionLayout="dropdown" startMonth={new Date(2020, 0)} endMonth={new Date(2045, 11)} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {/* STEP 3: LOCATION */}
                        <div className={cn(currentStep !== 2 && "hidden", "space-y-4 sm:space-y-5")}>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Registry Storage Zone</Label>
                                <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className={cn("h-11 sm:h-10 w-full justify-between font-bold bg-muted/10 border-white/5 rounded-xl px-3.5 shadow-none", !allFormValues.location && "text-muted-foreground", errors.location && 'border-destructive')}>
                                            <div className="flex items-center gap-2 truncate">
                                                <MapPin className="h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="truncate text-xs">{allFormValues.location || "Identify Zone..."}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-20" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-white/10">
                                        <Command><CommandList><CommandEmpty className="py-6 text-[10px] font-black text-center text-muted-foreground/40 uppercase">Zero location matches</CommandEmpty><CommandGroup className="p-1.5">{(dynamicLocations.length > 0 ? dynamicLocations : []).map((loc) => (<CommandItem key={loc} value={loc} onSelect={() => { setValue("location", loc, { shouldValidate: true }); setLocationComboboxOpen(false);}} className="h-10 text-xs font-black uppercase cursor-pointer rounded-lg"><Check className={cn("mr-2 h-3.5 w-3.5", allFormValues.location === loc ? "opacity-100" : "opacity-0")}/>{loc}</CommandItem>))}</CommandGroup></CommandList></Command>
                                    </PopoverContent>
                                </Popover>
                                {errors.location && <p className="text-[10px] text-destructive mt-1 font-bold uppercase">{errors.location.message}</p>}
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-muted/10 shadow-inner transition-colors">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <Label htmlFor="damage-toggle" className="text-[10px] font-black uppercase tracking-tight">Industrial Damage</Label>
                                        {allFormValues.itemType === 'Damage' && <AlertTriangle className="h-3 w-3 text-destructive animate-pulse" />}
                                    </div>
                                    <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-tighter opacity-60">Log as unusable stock</p>
                                </div>
                                <Switch id="damage-toggle" checked={allFormValues.itemType === 'Damage'} onCheckedChange={(checked) => setValue('itemType', checked ? 'Damage' : 'Expiry', { shouldValidate: true })} className="scale-75 origin-right" />
                            </div>
                        </div>
                        
                        {/* STEP 4: REVIEW */}
                        <div className={cn(currentStep !== 3 && "hidden", "space-y-4")}>
                            <div className="p-4 sm:p-5 rounded-xl bg-primary/5 border border-primary/20 space-y-3.5 shadow-inner relative overflow-hidden">
                                <div className="absolute inset-0 bg-tech-grid opacity-10" />
                                <h3 className="font-black text-sm uppercase text-primary text-center truncate relative z-10">{productName}</h3>
                                <Separator className="bg-primary/10 relative z-10" />
                                <div className="grid grid-cols-1 gap-2.5 text-[10px] relative z-10 font-bold">
                                    <div className="flex items-center justify-between"><span className="text-muted-foreground uppercase text-[8px] tracking-[0.2em]">Volume</span><span className="font-black text-primary uppercase">{allFormValues.quantity} units</span></div>
                                    <div className="flex items-center justify-between"><span className="text-muted-foreground uppercase text-[8px] tracking-[0.2em]">Identity</span><span className="uppercase truncate max-w-[120px]">{allFormValues.staffName}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-muted-foreground uppercase text-[8px] tracking-[0.2em]">Registry</span><span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase", allFormValues.itemType === 'Damage' ? "bg-destructive text-white" : "bg-primary text-white")}>{allFormValues.itemType}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-muted-foreground uppercase text-[8px] tracking-[0.2em]">Zone</span><span className="uppercase truncate max-w-[120px]">{allFormValues.location}</span></div>
                                    {allFormValues.expiryDate && <div className="flex items-center justify-between"><span className="text-muted-foreground uppercase text-[8px] tracking-[0.2em]">Expiry</span><span className="uppercase">{format(allFormValues.expiryDate, "dd/MM/yyyy")}</span></div>}
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* ACTION CONTROLS */}
                    <div className="flex gap-2.5 pt-2">
                        <Button type="button" onClick={prevStep} variant="ghost" disabled={isPending || isSubmitting || currentStep === 0} className="h-11 sm:h-10 px-4 font-black uppercase text-[9px] tracking-widest"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back</Button>
                        {currentStep < steps.length - 1 ? (
                            <Button type="button" onClick={nextStep} disabled={isFetchingProduct || isPending || isSubmitting} className="h-11 sm:h-10 flex-1 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 bg-primary">
                                {isFetchingProduct && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>}
                                Continue <ArrowRight className="ml-2 h-3.5 w-3.5" />
                            </Button>
                        ) : (
                            <Button type="button" onClick={handleFormSubmit} disabled={isPending || isSubmitting} className="h-11 sm:h-10 flex-1 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/30 bg-primary">
                                {isPending || isSubmitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                                Finalize Log
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="pt-8 pb-4 text-center">
            <p className="text-[7px] font-black uppercase tracking-[0.8em] text-muted-foreground/10">SheetSync Industrial Protocol • Secure Link</p>
        </div>
    </div>

    {/* SCANNER INTERFACE */}
    <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-black">
            <DialogHeader className="p-5 pb-2 border-b border-white/10 bg-zinc-900/80 absolute top-0 left-0 right-0 z-20">
                <DialogTitle className="text-lg font-black uppercase tracking-tighter text-white">Visual Identification</DialogTitle>
                <DialogDescription className="text-[8px] uppercase font-black tracking-widest text-primary">Align SKU barcode with registry window</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[450px] w-full">
                <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                <div className="scanner-overlay">
                    <div className="scanner-focus">
                        <div className="scanner-laser" />
                        <div className="scanner-corner scanner-corner-tl" />
                        <div className="scanner-corner scanner-corner-tr" />
                        <div className="scanner-corner scanner-corner-bl" />
                        <div className="scanner-corner scanner-corner-br" />
                    </div>
                </div>
            </div>
            <div className="p-3 bg-zinc-900/80 border-t border-white/10 flex justify-center relative z-20">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="h-10 w-full rounded-xl font-black uppercase tracking-widest text-[9px] text-destructive hover:bg-destructive/10 border-white/5">
                    Abort Scanning Protocol
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    
    {/* SUCCESS TERMINAL */}
    <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-xs w-[85%] p-6 overflow-hidden rounded-3xl border-none shadow-3xl bg-slate-950 text-white flex flex-col items-center text-center">
            <div className="bg-primary/20 p-3 rounded-2xl mb-4 animate-bounce">
                <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <DialogHeader className="space-y-1.5">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary leading-none">Sync Confirmed</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest">Registry Node Updated</DialogDescription>
            </DialogHeader>
            <Separator className="my-5 bg-slate-800" />
            <div className="flex flex-col items-center gap-1.5">
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                <p className="text-base font-black uppercase tracking-tight truncate max-w-[200px]">Thank you, {submittedStaffName}!</p>
                <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Entry Synchronized with Cloud</p>
            </div>
        </DialogContent>
    </Dialog>

    {/* ERROR TERMINAL */}
    <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="max-w-xs w-[85%] p-8 overflow-hidden rounded-3xl border-none shadow-3xl bg-destructive text-destructive-foreground flex flex-col items-center text-center">
            <div className="bg-white/20 p-4 rounded-2xl mb-4 shadow-xl">
                <XCircle className="h-10 w-10 text-white" />
            </div>
            <DialogHeader className="space-y-1.5">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter leading-none">Handshake Failure</DialogTitle>
                <DialogDescription className="text-white/70 text-[9px] font-black uppercase tracking-widest">Protocol Sync Error 0x884</DialogDescription>
            </DialogHeader>
            <div className="mt-6 p-4 bg-black/20 rounded-xl border border-white/10 w-full">
                <p className="text-[10px] font-bold leading-relaxed italic text-white/90">"{errorMessage}"</p>
            </div>
            <Button onClick={() => setIsErrorDialogOpen(false)} variant="secondary" className="mt-8 w-full h-12 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl">
                Back to Terminal
            </Button>
        </DialogContent>
    </Dialog>

    {/* OUTBOX TERMINAL */}
    <Dialog open={isOutboxOpen} onOpenChange={setIsOutboxOpen}>
        <DialogContent className="sm:max-w-2xl w-[95%] p-0 overflow-hidden rounded-[2rem] border-none shadow-3xl bg-background">
            <DialogHeader className="p-6 pb-2 bg-muted/20 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-amber-500/10 rounded-2xl">
                        <CloudOff className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-amber-600 leading-none">Sync Queue</DialogTitle>
                        <DialogDescription className="font-bold text-[8px] uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Transmission Buffer</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <div className="p-4 sm:p-8 pt-2">
                <OfflineQueueTerminal />
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}