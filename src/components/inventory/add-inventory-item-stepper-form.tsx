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
    ShieldAlert,
    MapPin
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
            className="mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 cursor-pointer hover:bg-amber-500/20 transition-all group shadow-sm active:scale-[0.98]"
        >
            <div className="flex items-center gap-2">
                <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">{count} Pending Logs</span>
            </div>
            <Badge variant="outline" className="h-5 px-1.5 bg-white/50 dark:bg-black/50 border-amber-500/30 text-amber-700 font-black uppercase text-[7px] tracking-widest">
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

  const {
    ref: barcodeFormRef,
    ...barcodeFieldProps
  } = register('barcode');

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
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-2 overflow-x-hidden px-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:space-y-3 sm:px-4 md:px-0 md:pb-4">
        <OfflineOutboxBanner count={pendingActions.length} onOpen={() => setIsOutboxOpen(true)} />

        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            {currentStep === 0 && (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FilePlus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                                Log New Item
                            </h1>
                            {!isOnline && (
                                <Badge variant="destructive" className="h-5 shrink-0 rounded-md px-1.5 py-0 text-[8px] font-semibold">
                                    <CloudOff className="mr-1 h-2.5 w-2.5" /> Offline
                                </Badge>
                            )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                            Scan, verify, and add inventory in a few steps.
                        </p>
                    </div>
                </div>
            )}
            <div className={cn(
                "flex max-w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-hide",
                currentStep !== 0 && "ml-auto"
            )}>
                {activeSession && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {activeSession.type === 'timed' && activeSession.expiresAt && <SessionTimer expiresAt={activeSession.expiresAt} />}
                        <Badge variant="secondary" className="flex items-center gap-1 rounded-lg border-0 bg-primary/10 px-2 py-1 text-[8px] font-semibold text-primary whitespace-nowrap">
                            {isGlobalSession ? <Globe className="h-2.5 w-2.5" /> : <BellOff className="h-2.5 w-2.5" />}
                            Silent entry
                        </Badge>
                    </div>
                )}
                {pendingActivationSession && !activeSession && (
                    <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-lg border-0 bg-amber-500/10 px-2.5 text-[9px] font-semibold text-amber-600 shadow-none" onClick={() => setActivationDialogOpen(true)}>
                        <KeyRound className="mr-1 h-3 w-3" /> Activate
                    </Button>
                )}
            </div>
        </div>

        <Card className="w-full min-w-0 max-w-full overflow-visible rounded-none border-0 bg-transparent shadow-none">
            <CardHeader className="bg-transparent px-0 pb-2 pt-1 sm:pb-3 sm:pt-2">
                <div className="space-y-1.5 sm:space-y-2">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    {React.createElement(steps[currentStep].icon, { className: "h-3.5 w-3.5" })}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                        Step {currentStep + 1} of {steps.length}
                                    </p>
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {steps[currentStep].name}
                                    </p>
                                </div>
                            </div>
                            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                                {Math.round(((currentStep + 1) / steps.length) * 100)}%
                            </span>
                        </div>
                        <Progress value={((currentStep + 1) / steps.length) * 100} className="h-1" />
                        <div className="hidden grid-cols-4 gap-1.5 sm:grid">
                            {steps.map((step, index) => (
                                <div
                                    key={step.id}
                                    className={cn(
                                        "h-1 rounded-full transition-colors",
                                        index <= currentStep ? "bg-primary" : "bg-muted"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 px-0 py-2 sm:py-3">
                <div className="min-w-0 space-y-2.5 sm:space-y-3">
                    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-2.5 sm:space-y-3">
                        {/* STEP 1: BARCODE */}
                        <div className={cn(currentStep !== 0 && "hidden", "space-y-2.5 sm:space-y-3")}>
                            <Label htmlFor="barcode" className="ml-0.5 block text-[11px] font-semibold text-foreground">Barcode</Label>
                            <div className="flex w-full min-w-0 items-start gap-2">
                                <div className="group relative min-w-0 flex-1">
                                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        id="barcode"
                                        placeholder="Scan or enter barcode"
                                        {...barcodeFieldProps}
                                        ref={(element) => {
                                            barcodeFormRef(element);
                                            barcodeInputRef.current = element;
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setValue('barcode', e.currentTarget.value, { shouldValidate: true }); nextStep(); } }} 
                                        autoFocus 
                                        className={cn("h-11 w-full min-w-0 rounded-xl border-0 bg-muted/40 pl-10 pr-3 text-base font-semibold shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm", errors.barcode && "bg-destructive/10")} 
                                    />
                                    {errors.barcode && <p className="text-[9px] text-destructive mt-1 font-bold">{errors.barcode.message}</p>}
                                </div>
                                <Button type="button" onClick={() => setIsScannerDialogOpen(true)} variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-0 bg-primary/10 shadow-none hover:bg-primary/15">
                                    <Scan className="h-5 w-5 text-primary" />
                                </Button>
                            </div>
                            
                            {productLookupError && !isFetchingProduct && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    {!hasRequestedProduct ? (
                                        <div className="space-y-1.5">
                                            {foundInGlobalRegistry && suggestedProductName && (
                                                <div className="mb-1 flex items-center gap-2 rounded-xl border-0 bg-primary/5 px-3 py-2">
                                                    <Globe className="h-3 w-3 text-primary" />
                                                    <span className="text-[7px] font-black uppercase tracking-widest text-primary">Product match found</span>
                                                </div>
                                            )}
                                            <Button type="button" variant="default" className="h-11 w-full min-w-0 rounded-xl bg-primary px-3 text-xs font-semibold shadow-sm" onClick={handleRequestProductAdd}>
                                                <SendHorizontal className="mr-2 h-3 w-3 shrink-0" />
                                                <span className="min-w-0 truncate">{suggestedProductName ? `Request: ${suggestedProductName}` : "Request new product"}</span>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 rounded-xl border-0 bg-emerald-500/10 px-3 py-2.5 text-emerald-600 animate-in zoom-in-95 duration-300">
                                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-[8px] font-black uppercase tracking-widest leading-none">Request sent</p>
                                                <p className="text-[7px] font-medium opacity-80 leading-none uppercase mt-0.5">Waiting for admin to add this product</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* STEP 2: DETAILS */}
                        <div className={cn(currentStep !== 1 && "hidden", "space-y-2.5 sm:space-y-3")}>
                            {productName && (
                                <div className="relative overflow-hidden rounded-2xl border-0 bg-primary/[0.055] p-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                                            <PackageSearch className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/70">
                                                Product found
                                            </p>
                                            <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
                                                {productName}
                                            </h3>
                                            <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
                                                <span className="shrink-0 font-mono">{getValues('barcode')}</span>
                                                {productSupplier && (
                                                    <>
                                                        <span className="opacity-40">•</span>
                                                        <span className="truncate">{productSupplier}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Staff member</Label>
                                <Popover open={staffComboboxOpen} onOpenChange={(open) => { setStaffComboboxOpen(open); if (open) playIdentityAudio(); }} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" role="combobox" className={cn("h-11 w-full min-w-0 justify-between rounded-xl border-0 bg-muted/40 px-3 font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0", !allFormValues.staffName && "text-muted-foreground", errors.staffName && "bg-destructive/10")}>
                                            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                                <User className="h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="truncate text-xs">{allFormValues.staffName || "Select staff member..."}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-20" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] p-0 rounded-xl overflow-hidden shadow-2xl border-0" align="start">
                                        <Command>
                                            <CommandList>
                                                <CommandEmpty className="py-6 text-[10px] font-black text-center text-muted-foreground/40 uppercase">No staff members found</CommandEmpty>
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
                                {errors.staffName && <p className="text-[9px] text-destructive mt-0.5 font-bold uppercase">{errors.staffName.message}</p>}
                            </div>

                            <div className="grid min-w-0 grid-cols-[minmax(88px,0.72fr)_minmax(0,1.45fr)] gap-2">
                                <div className="min-w-0 space-y-1">
                                    <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Quantity</Label>
                                    <div className="relative group">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30 group-focus-within:text-primary" />
                                        <Input id="qty" type="number" min="1" inputMode="numeric" {...register('quantity', { valueAsNumber: true })} onKeyDown={(e) => { if (['-', 'e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }} className={cn('h-11 w-full min-w-0 rounded-xl border-0 bg-muted/40 pl-9 text-base font-semibold shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm', errors.quantity && 'bg-destructive/10')} />
                                    </div>
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Expiry date</Label>
                                    <Popover modal={true}>
                                        <PopoverTrigger asChild>
                                            <Button variant={'ghost'} className={cn('h-11 w-full min-w-0 justify-start rounded-xl border-0 bg-muted/40 px-2.5 text-left font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0', !allFormValues.expiryDate && 'text-muted-foreground', errors.expiryDate && 'bg-destructive/10')}>
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary/40 shrink-0" />
                                                <span className="text-xs truncate">{allFormValues.expiryDate ? format(allFormValues.expiryDate, 'dd/MM/yyyy') : "Pick Date"}</span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] overflow-auto rounded-2xl border-0 p-0 shadow-2xl" align="center" sideOffset={6}>
                                            <Calendar mode="single" selected={allFormValues.expiryDate} onSelect={(date) => { setValue('expiryDate', date || new Date()); }} initialFocus captionLayout="dropdown" startMonth={new Date(2020, 0)} endMonth={new Date(2045, 11)} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {/* STEP 3: LOCATION */}
                        <div className={cn(currentStep !== 2 && "hidden", "space-y-2.5 sm:space-y-3")}>
                            <div className="space-y-1">
                                <Label className="ml-0.5 text-[11px] font-semibold text-foreground">Storage location</Label>
                                <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" role="combobox" className={cn("h-11 w-full min-w-0 justify-between rounded-xl border-0 bg-muted/40 px-3 font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0", !allFormValues.location && "text-muted-foreground", errors.location && "bg-destructive/10")}>
                                            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                                <MapPin className="h-4 w-4 text-primary/40 shrink-0" />
                                                <span className="truncate text-xs">{allFormValues.location || "Select location..."}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-20" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)] p-0 rounded-xl overflow-hidden shadow-2xl border-0" align="start">
                                        <Command><CommandList><CommandEmpty className="py-6 text-[10px] font-black text-center text-muted-foreground/40 uppercase">No locations found</CommandEmpty><CommandGroup className="p-1.5">{(dynamicLocations.length > 0 ? dynamicLocations : []).map((loc) => (<CommandItem key={loc} value={loc} onSelect={() => { setValue("location", loc, { shouldValidate: true }); setLocationComboboxOpen(false);}} className="h-10 text-xs font-black uppercase cursor-pointer rounded-lg"><Check className={cn("mr-2 h-3.5 w-3.5", allFormValues.location === loc ? "opacity-100" : "opacity-0")}/>{loc}</CommandItem>))}</CommandGroup></CommandList></Command>
                                    </PopoverContent>
                                </Popover>
                                {errors.location && <p className="text-[9px] text-destructive mt-0.5 font-bold uppercase">{errors.location.message}</p>}
                            </div>
                            <div className={cn("flex min-w-0 items-center justify-between gap-3 rounded-xl border-0 px-3 py-2.5 transition-colors", allFormValues.itemType === "Damage" ? "bg-destructive/10" : "bg-muted/35")}>
                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <Label htmlFor="damage-toggle" className="text-xs font-semibold text-foreground">Damaged item</Label>
                                        {allFormValues.itemType === 'Damage' && <AlertTriangle className="h-3 w-3 text-destructive animate-pulse" />}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Mark this stock as damaged</p>
                                </div>
                                <Switch id="damage-toggle" checked={allFormValues.itemType === 'Damage'} onCheckedChange={(checked) => setValue('itemType', checked ? 'Damage' : 'Expiry', { shouldValidate: true })} className="shrink-0" />
                            </div>
                        </div>
                        
                        {/* STEP 4: REVIEW */}
                        <div className={cn(currentStep !== 3 && "hidden", "space-y-2.5")}>
                            <div className="space-y-2 rounded-xl bg-muted/25 p-3">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{productName}</h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <div className="min-w-0">
                                        <p className="text-[9px] text-muted-foreground">Quantity</p>
                                        <p className="truncate font-semibold">{allFormValues.quantity} units</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] text-muted-foreground">Type</p>
                                        <p className={cn("truncate font-semibold", allFormValues.itemType === 'Damage' && "text-destructive")}>{allFormValues.itemType}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] text-muted-foreground">Staff</p>
                                        <p className="truncate font-medium">{allFormValues.staffName}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] text-muted-foreground">Location</p>
                                        <p className="truncate font-medium">{allFormValues.location}</p>
                                    </div>
                                    {allFormValues.expiryDate && (
                                        <div className="col-span-2 min-w-0">
                                            <p className="text-[9px] text-muted-foreground">Expiry</p>
                                            <p className="font-medium">{format(allFormValues.expiryDate, "dd/MM/yyyy")}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* ACTION CONTROLS */}
                    <div className="flex min-w-0 gap-2 pt-1">
                        <Button
                            type="button"
                            onClick={prevStep}
                            variant="ghost"
                            disabled={isPending || isSubmitting || currentStep === 0}
                            className="h-11 shrink-0 rounded-xl border-0 bg-muted/30 px-3 text-xs font-semibold shadow-none hover:bg-muted/45"
                        >
                            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                            Back
                        </Button>
                        {currentStep < steps.length - 1 ? (
                            <Button
                                type="button"
                                onClick={nextStep}
                                disabled={isFetchingProduct || isPending || isSubmitting}
                                className="h-11 flex-1 rounded-xl bg-primary text-xs font-semibold shadow-none"
                            >
                                {isFetchingProduct && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                Continue
                                <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleFormSubmit}
                                disabled={isPending || isSubmitting}
                                className="h-11 flex-1 rounded-xl bg-primary text-xs font-semibold shadow-none"
                            >
                                {isPending || isSubmitting ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-1.5 h-4 w-4" />
                                )}
                                Log Item
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="hidden pt-4 text-center sm:block">
            <p className="px-2 text-[10px] text-muted-foreground/60">SheetSync Inventory • Secure sync enabled</p>
        </div>
    </div>

    {/* SCANNER INTERFACE */}
    <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem)] p-0 overflow-hidden rounded-2xl sm:rounded-3xl border-0 shadow-2xl bg-black">
            <DialogHeader className="p-4 pb-1 border-b border-0 bg-zinc-900/80 absolute top-0 left-0 right-0 z-20">
                <DialogTitle className="text-base font-black uppercase tracking-tighter text-white">Barcode Scanner</DialogTitle>
                <DialogDescription className="text-[7px] uppercase font-black tracking-widest text-primary">Position the barcode inside the frame</DialogDescription>
            </DialogHeader>
            <div className="relative scanner-container h-[min(450px,62dvh)] min-h-[300px] w-full">
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
            <div className="p-2.5 bg-zinc-900/80 border-t border-0 flex justify-center relative z-20">
                <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="h-9 w-full rounded-xl font-black uppercase tracking-widest text-[8px] text-destructive hover:bg-destructive/10 border-white/5">
                    Close Scanner
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    
    {/* SUCCESS TERMINAL */}
    <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-xs w-[85%] p-5 overflow-hidden rounded-3xl border-none shadow-3xl bg-slate-950 text-white flex flex-col items-center text-center">
            <div className="bg-primary/20 p-2 rounded-2xl mb-3 animate-bounce">
                <PartyPopper className="h-7 w-7 text-primary" />
            </div>
            <DialogHeader className="space-y-1">
                <DialogTitle className="text-lg font-black uppercase tracking-tighter text-primary leading-none">Sync Confirmed</DialogTitle>
                <DialogDescription className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Registry Node Updated</DialogDescription>
            </DialogHeader>
            <Separator className="my-4 bg-slate-800" />
            <div className="flex flex-col items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                <p className="text-sm font-black uppercase tracking-tight truncate max-w-[180px]">Thank you, {submittedStaffName}!</p>
                <p className="text-slate-500 text-[7px] font-black uppercase tracking-widest">Entry Synchronized with Cloud</p>
            </div>
        </DialogContent>
    </Dialog>

    {/* ERROR TERMINAL */}
    <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xs p-5 sm:p-6 overflow-hidden rounded-3xl border-none shadow-3xl bg-destructive text-destructive-foreground flex flex-col items-center text-center">
            <div className="bg-white/20 p-3 rounded-2xl mb-3 shadow-xl">
                <XCircle className="h-8 w-8 text-white" />
            </div>
            <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter leading-none">Couldn’t Log Item</DialogTitle>
                <DialogDescription className="text-white/70 text-[8px] font-black uppercase tracking-widest">Inventory sync error</DialogDescription>
            </DialogHeader>
            <div className="mt-5 p-3 bg-black/20 rounded-xl border border-0 w-full">
                <p className="text-[9px] font-bold leading-relaxed italic text-white/90">"{errorMessage}"</p>
            </div>
            <Button onClick={() => setIsErrorDialogOpen(false)} variant="secondary" className="mt-6 w-full h-11 text-[9px] font-black uppercase tracking-widest rounded-xl shadow-xl">
                Back to Form
            </Button>
        </DialogContent>
    </Dialog>

    {/* OUTBOX TERMINAL */}
    <Dialog open={isOutboxOpen} onOpenChange={setIsOutboxOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-0 shadow-3xl bg-background">
            <DialogHeader className="p-5 pb-1 bg-muted/20 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-2xl">
                        <CloudOff className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-amber-600 leading-none">Pending Sync</DialogTitle>
                        <DialogDescription className="font-bold text-[7px] uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Items waiting to upload</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <div className="max-h-[70dvh] overflow-y-auto p-3 pt-1 sm:p-8 sm:pt-1">
                <OfflineQueueTerminal />
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}