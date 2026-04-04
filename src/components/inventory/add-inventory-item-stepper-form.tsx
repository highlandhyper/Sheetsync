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
    ScanBarcode,
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
    Zap
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { addInventoryItemSchema, type AddInventoryItemFormValues } from '@/lib/schemas';
import { addInventoryItemAction, fetchProductAction, fetchProductExternalDataAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
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
        <div className="flex items-center gap-1.5 font-mono text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
            <Clock className="h-3 w-3" />
            <span>{timeLeft}</span>
        </div>
    );
}

const steps = [
  { id: 1, name: 'Scan Item', fields: ['barcode'], icon: Barcode },
  { id: 2, name: 'Add Details', fields: ['staffName', 'itemType', 'quantity', 'expiryDate'], icon: Info },
  { id: 3, name: 'Set Location', fields: ['location'], icon: Warehouse },
  { id: 4, name: 'Review & Log', icon: FilePlus },
];

const playProfessionalBeep = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); 

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio feedback failed:", e);
  }
};

export function AddInventoryItemStepperForm({ uniqueLocations: initialLocations, uniqueStaffNames }: { uniqueLocations: string[], uniqueStaffNames: string[] }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    products: cachedProducts, 
    uniqueLocations: dynamicLocations, 
    addInventoryItem,
    refreshData,
    queueAction,
    isOnline,
  } = useDataCache();
  const { activeSession, pendingActivationSession, setActivationDialogOpen, consumeSpecialEntry, requestSpecialEntry } = useSpecialEntry(); 
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const scanProcessedRef = useRef(false);

  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  const [staffComboboxOpen, setStaffComboboxOpen] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [productSupplier, setProductSupplier] = useState('');
  const [productLookupError, setProductLookupError] = useState('');
  const [suggestedProductName, setSuggestedProductName] = useState('');
  const [hasRequestedProduct, setHasRequestedProduct] = useState(false);
  const [foundInGlobalRegistry, setFoundInGlobalRegistry] = useState(false);

  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [submittedStaffName, setSubmittedStaffName] = useState('');

  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const SCANNER_REGION_ID = 'scanner';

  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<AddInventoryItemFormValues>({
    resolver: zodResolver(addInventoryItemSchema),
    defaultValues: {
      staffName: activeSession?.staffName || '',
      itemType: 'Expiry',
      barcode: '',
      quantity: 1,
      expiryDate: new Date(),
    },
    mode: 'onTouched'
  });
  
  const allFormValues = watch();

  useEffect(() => {
    if (activeSession?.staffName && !allFormValues.staffName) {
        setValue('staffName', activeSession.staffName);
    }
  }, [activeSession, setValue, allFormValues.staffName]);

  const onSubmit = async (data: AddInventoryItemFormValues) => {
    if (isSubmitting || submitLockRef.current) return;
    
    setIsSubmitting(true);
    submitLockRef.current = true;

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
    setSubmittedStaffName(data.staffName);
    setIsSuccessDialogOpen(true);
    setTimeout(() => setIsSuccessDialogOpen(false), 3000); 

    const savedStaffName = data.staffName; 
    reset();
    setValue('staffName', savedStaffName); 
    setProductName('');
    setProductSupplier('');
    setProductLookupError('');
    setSuggestedProductName('');
    setHasRequestedProduct(false);
    setFoundInGlobalRegistry(false);
    setCurrentStep(0);

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
                disableNotification: activeSession ? 'true' : 'false'
            }
        });
        if (activeSession) consumeSpecialEntry();
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('barcode', data.barcode);
      formData.append('staffName', data.staffName);
      formData.append('itemType', data.itemType);
      formData.append('quantity', data.quantity.toString());
      formData.append('location', data.location);
      
      if (user?.email) {
          formData.append('userEmail', user.email);
      }

      if (activeSession) {
          formData.append('disableNotification', 'true');
      }

      if (data.expiryDate) {
        formData.append('expiryDate', format(data.expiryDate, 'yyyy-MM-dd'));
      }

      try {
        const response = await addInventoryItemAction(undefined, formData);
        
        if (response.success && response.data) {
          if (activeSession) {
              consumeSpecialEntry(); 
          }
          refreshData(); 
        } else {
          toast({
            variant: 'destructive',
            title: 'Sync Error',
            description: response.message || 'Background log failed. Re-syncing...'
          });
          refreshData(); 
        }
      } catch (err) {
        console.warn("Background log error:", err);
      } finally {
        setIsSubmitting(false);
        submitLockRef.current = false;
      }
    });
  };

  const handleBarcodeLookup = useCallback(async (barcode: string) => {
      if (!barcode || !barcode.trim()) return false;
      
      setIsFetchingProduct(true);
      setProductLookupError('');
      setProductName('');
      setProductSupplier('');
      setHasRequestedProduct(false);
      setSuggestedProductName('');
      setFoundInGlobalRegistry(false);
      
      const cachedProduct = cachedProducts.find(p => p.barcode === barcode);
      if (cachedProduct) {
        setProductName(cachedProduct.productName);
        setProductSupplier(cachedProduct.supplierName || 'N/A');
        setIsFetchingProduct(false);
        return true;
      }

      if (!navigator.onLine) {
          setProductLookupError('Working Offline: Only items in local catalog can be verified.');
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
          
          setProductLookupError('Product not found in system.');
          setIsFetchingProduct(false);
          return false;
      }
  }, [cachedProducts]);

  const handleRequestProductAdd = () => {
    if (!allFormValues.barcode) return;
    requestSpecialEntry(
        allFormValues.staffName || 'Viewer', 
        'product_add', 
        allFormValues.barcode,
        suggestedProductName
    );
    setHasRequestedProduct(true);
    toast({
        title: "Request Sent",
        description: "Administrators have been notified about this new product.",
    });
  };

  type FieldName = keyof AddInventoryItemFormValues;

  const nextStep = async () => {
    if (isFetchingProduct || isSubmitting || submitLockRef.current) return;

    const fields = steps[currentStep].fields;
    
    if (currentStep >= steps.length - 1) {
      return;
    }

    const output = fields ? await trigger(fields as FieldName[], { shouldFocus: true }) : true;

    if (!output) return;

    if (currentStep === 0) {
        const barcodeOk = await handleBarcodeLookup(allFormValues.barcode);
        if(!barcodeOk) return;
    }

    setCurrentStep(step => step + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(step => step - 1);
    }
  };
  
  const handleFormSubmit = () => {
    if (isSubmitting || submitLockRef.current) return;
    formRef.current?.requestSubmit();
  };

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current || !decodedText) return;
    scanProcessedRef.current = true;

    playProfessionalBeep(); 
    setValue('barcode', decodedText, { shouldValidate: true });
    setIsScannerDialogOpen(false);
    
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.stop().catch(console.error);
      html5QrcodeScannerRef.current = null;
    }
    
    setTimeout(() => {
        nextStep();
        scanProcessedRef.current = false;
    }, 1000); 
  }, [setValue, nextStep]);

  useEffect(() => {
    if (isScannerDialogOpen) {
      const timer = setTimeout(() => {
        if (!html5QrcodeScannerRef.current) {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID);
          scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            onScanSuccess,
            () => {}
          ).then(() => {
            html5QrcodeScannerRef.current = scanner;
          }).catch(console.error);
        }
      }, 800);

      return () => {
        clearTimeout(timer);
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.stop().catch(console.error);
          html5QrcodeScannerRef.current = null;
        }
      };
    }
  }, [isScannerDialogOpen, onScanSuccess]);

  return (
    <>
    <Card className="w-full max-w-2xl mx-auto shadow-none border-0 sm:border sm:shadow-xl bg-transparent sm:bg-card">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                    Log New Inventory Item
                    {!isOnline && <Badge variant="destructive" className="animate-pulse"><CloudOff className="h-3 w-3 mr-1" /> Offline</Badge>}
                </CardTitle>
                <CardDescription>
                Follow the steps to log a new item into the inventory system.
                </CardDescription>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
                {activeSession && (
                    <div className="flex items-center gap-2">
                        {activeSession.type === 'timed' && activeSession.expiresAt && (
                            <SessionTimer expiresAt={activeSession.expiresAt} />
                        )}
                        <Badge variant="secondary" className="w-fit flex items-center gap-1.5 py-1.5 px-3 bg-primary/10 border-primary/20 text-primary">
                            <BellOff className="h-3.5 w-3.5" />
                            Authorized Silent Mode
                        </Badge>
                    </div>
                )}
                {pendingActivationSession && !activeSession && (
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-yellow-500/10 border-yellow-500/20 text-yellow-600 hover:bg-yellow-500/20 animate-pulse font-bold"
                        onClick={() => setActivationDialogOpen(true)}
                    >
                        <KeyRound className="mr-2 h-3.5 w-3.5" />
                        Activate Silent Mode
                    </Button>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="space-y-8">
            <div className="space-y-3">
                <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
                <p className="text-xs font-bold text-center text-muted-foreground flex items-center justify-center gap-2 uppercase tracking-wider">
                    {React.createElement(steps[currentStep].icon, { className: "h-3 w-3" })}
                    Step {currentStep + 1} of {steps.length}: {steps[currentStep].name}
                </p>
            </div>
            
            <form 
                ref={formRef} 
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
            >
                <div className={cn(currentStep !== 0 && "hidden", "space-y-4")}>
                    <Label htmlFor="barcode" className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase">
                        <Barcode className="h-4 w-4" /> Product Barcode
                    </Label>
                     <div className="flex gap-2 items-start">
                        <div className="flex-grow">
                            <Input
                                id="barcode"
                                placeholder="Enter barcode"
                                {...register('barcode')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        nextStep();
                                    }
                                }}
                                className={cn("h-14 sm:h-10 text-lg sm:text-base font-semibold", errors.barcode && 'border-destructive')}
                            />
                            {errors.barcode && <p className="text-sm text-destructive mt-1">{errors.barcode.message}</p>}
                        </div>
                        <Button type="button" onClick={() => setIsScannerDialogOpen(true)} variant="outline" size="icon" className="h-14 w-14 sm:h-10 sm:w-10 shrink-0 bg-primary/5 border-primary/20">
                           <ScanBarcode className="h-6 w-6 sm:h-5 sm:w-5 text-primary" />
                        </Button>
                    </div>
                    
                    <div className="min-h-[24px]">
                        {productLookupError && !isFetchingProduct && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                {!hasRequestedProduct ? (
                                    <Button 
                                        type="button" 
                                        variant="default"
                                        className="w-full h-12 text-sm font-black uppercase tracking-tight shadow-lg shadow-primary/20 rounded-xl"
                                        onClick={handleRequestProductAdd}
                                    >
                                        <SendHorizontal className="mr-2 h-4 w-4" />
                                        {suggestedProductName ? (
                                            <span className="flex items-center gap-2">
                                                Request: {suggestedProductName}
                                                <Globe className="h-3.5 w-3.5 opacity-70" />
                                            </span>
                                        ) : (
                                            "Notify Admin: New Barcode"
                                        )}
                                    </Button>
                                ) : (
                                    <div className="py-3 px-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 flex items-center gap-3 animate-in zoom-in-95 duration-300">
                                        <ShieldCheck className="h-5 w-5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5">Notification Sent</p>
                                            <p className="text-[9px] font-medium opacity-80 leading-none">Awaiting Admin catalog update.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className={cn(currentStep !== 1 && "hidden", "space-y-6")}>
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                        <h3 className="font-bold text-lg sm:text-base text-primary">{productName || "Unknown Item"}</h3>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Supplier: {productSupplier}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">SKU: {allFormValues.barcode}</p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Personnel</Label>
                        <Popover open={staffComboboxOpen} onOpenChange={setStaffComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className={cn("h-14 sm:h-10 w-full justify-between font-semibold text-lg sm:text-sm px-4", !allFormValues.staffName && "text-muted-foreground", errors.staffName && 'border-destructive')}>
                                     <div className="flex items-center gap-2">
                                        <User className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                                        <span>{allFormValues.staffName || "Select Staff Member..."}</span>
                                     </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandList>
                                        <CommandEmpty>No staff member found.</CommandEmpty>
                                        <CommandGroup>
                                            {(uniqueStaffNames.length > 0 ? uniqueStaffNames : []).map((staff) => (
                                                <CommandItem key={staff} value={staff} onSelect={() => { setValue("staffName", staff, { shouldValidate: true }); setStaffComboboxOpen(false); }} className="h-12 sm:h-10 text-base sm:text-sm font-medium">
                                                    <Check className={cn("mr-2 h-4 w-4", allFormValues.staffName === staff ? "opacity-100" : "opacity-0")}/>{staff}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {errors.staffName && <p className="text-sm text-destructive mt-1 font-medium">{errors.staffName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Classification</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <Button 
                                type="button" 
                                variant={allFormValues.itemType === 'Expiry' ? 'default' : 'outline'}
                                className={cn("h-14 sm:h-10 text-base sm:text-sm font-bold rounded-xl sm:rounded-md border-2", allFormValues.itemType === 'Expiry' ? "border-primary" : "border-muted")}
                                onClick={() => setValue('itemType', 'Expiry', { shouldValidate: true })}
                            >
                                <Tag className="mr-2 h-5 w-5 sm:h-4 sm:w-4" /> Expiry
                            </Button>
                            <Button 
                                type="button" 
                                variant={allFormValues.itemType === 'Damage' ? 'destructive' : 'outline'}
                                className={cn("h-14 sm:h-10 text-base sm:text-sm font-bold rounded-xl sm:rounded-md border-2", allFormValues.itemType === 'Damage' ? "border-destructive" : "border-muted")}
                                onClick={() => setValue('itemType', 'Damage', { shouldValidate: true })}
                            >
                                <AlertTriangle className="mr-2 h-5 w-5 sm:h-4 sm:w-4" /> Damage
                            </Button>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="w-1/3 space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Qty</Label>
                            <div className="relative">
                                <Hash className="absolute left-4 sm:left-3 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                                <Input 
                                    id="qty" 
                                    type="number" 
                                    min="1"
                                    {...register('quantity', { valueAsNumber: true })} 
                                    onKeyDown={(e) => {
                                        if (['-', 'e', 'E', '+', '.'].includes(e.key)) {
                                            e.preventDefault();
                                        }
                                    }}
                                    className={cn('h-14 sm:h-10 pl-11 text-lg sm:text-base font-bold', errors.quantity && 'border-destructive')}
                                />
                            </div>
                        </div>
                        <div className="flex-1 space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Date</Label>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button variant={'outline'} className={cn('h-14 sm:h-10 w-full pl-4 text-left font-semibold text-lg sm:text-sm', !allFormValues.expiryDate && 'text-muted-foreground', errors.expiryDate && 'border-destructive')}>
                                      <CalendarIcon className="mr-3 h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                                      {allFormValues.expiryDate ? format(allFormValues.expiryDate, 'dd/MM/yyyy') : <span>Pick Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar mode="single" selected={allFormValues.expiryDate} onSelect={(date) => { setValue('expiryDate', date || new Date()); }} initialFocus />
                                </PopoverContent>
                              </Popover>
                        </div>
                    </div>
                </div>

                 <div className={cn(currentStep !== 2 && "hidden", "space-y-4")}>
                    <Label className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                        Storage Zone
                    </Label>
                    <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className={cn("h-14 sm:h-10 w-full justify-between font-semibold text-lg sm:text-sm px-4", !allFormValues.location && "text-muted-foreground", errors.location && 'border-destructive')}>
                             <div className="flex items-center gap-2">
                                <span>{allFormValues.location || "Select Zone..."}</span>
                             </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search location..." />
                                <CommandList>
                                    <CommandEmpty>No location found.</CommandEmpty>
                                    <CommandGroup>
                                        {(dynamicLocations.length > 0 ? dynamicLocations : []).map((loc) => (
                                            <CommandItem key={loc} value={loc} onSelect={() => { setValue("location", loc, { shouldValidate: true }); setLocationComboboxOpen(false);}} className="h-12 sm:h-10 text-base sm:text-sm font-medium">
                                                <Check className={cn("mr-2 h-4 w-4", allFormValues.location === loc ? "opacity-100" : "opacity-0")}/>{loc}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {errors.location && <p className="text-sm text-destructive mt-1 font-medium">{errors.location.message}</p>}
                </div>
                
                <div className={cn(currentStep !== 3 && "hidden", "space-y-4")}>
                    <div className="p-6 rounded-2xl sm:rounded-lg bg-primary/5 border-2 border-primary/20 space-y-4 shadow-inner">
                        <h3 className="font-extrabold text-2xl sm:text-lg text-primary text-center">{productName}</h3>
                        <Separator className="bg-primary/10" />
                        <div className="grid grid-cols-1 gap-4 text-base sm:text-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Quantity</span>
                                <span className="font-black text-xl sm:text-lg">{allFormValues.quantity} units</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Logged By</span>
                                <span className="font-bold">{allFormValues.staffName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Type</span>
                                <span className={cn("font-black px-3 py-1 rounded-lg text-sm sm:text-xs", allFormValues.itemType === 'Damage' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>{allFormValues.itemType}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Location</span>
                                <span className="font-bold">{allFormValues.location}</span>
                            </div>
                            {allFormValues.expiryDate &&
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Date</span>
                                    <span className="font-bold">{format(allFormValues.expiryDate, "dd/MM/yyyy")}</span>
                                </div>
                            }
                        </div>
                        {activeSession && (
                            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-tight">
                                <ShieldCheck className="h-4 w-4" />
                                <span>Silent Entry Authorized - No Email Alert</span>
                            </div>
                        )}
                        {!isOnline && (
                            <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-black uppercase text-center">
                                Working Offline: Will Sync Automatically
                            </div>
                        )}
                    </div>
                </div>

            </form>
            <div className="flex gap-3 pt-4">
                <Button type="button" onClick={prevStep} variant="ghost" disabled={isPending || isSubmitting || currentStep === 0} className="h-14 sm:h-10 px-6 font-bold">
                    <ArrowLeft className="mr-2 h-5 w-5 sm:h-4 sm:w-4" /> Back
                </Button>

                {currentStep < steps.length - 1 ? (
                    <Button type="button" onClick={nextStep} disabled={isFetchingProduct || isPending || isSubmitting} className="h-14 sm:h-10 flex-1 text-lg sm:text-base font-black rounded-xl sm:rounded-md">
                        {isFetchingProduct ? <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin"/> : null}
                        Continue <ArrowRight className="ml-2 h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                ) : (
                    <Button type="button" onClick={handleFormSubmit} disabled={isPending || isSubmitting} className="h-14 sm:h-10 flex-1 text-lg sm:text-base font-black rounded-xl sm:rounded-md shadow-lg shadow-primary/20">
                        {isPending || isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />}
                        Complete Log
                    </Button>
                )}
            </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-3xl sm:rounded-lg border-0">
            <DialogHeader className="p-6 pb-2 border-b bg-muted/30">
                <DialogTitle className="font-black uppercase tracking-tighter">Scan Product</DialogTitle>
                <DialogDescription>Use your camera to capture the product barcode.</DialogDescription>
            </DialogHeader>
            <div id={SCANNER_REGION_ID} className="w-full aspect-square [&>span]:hidden" />
            <div className="p-4 bg-muted/30 flex justify-center">
                <Button variant="outline" onClick={() => setIsScannerDialogOpen(false)} className="h-12 w-full rounded-xl sm:rounded-md font-bold">
                  Cancel Scanning
                </Button>
            </div>
        </DialogContent>
    </Dialog>

    <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-sm w-[90%] p-8 overflow-hidden rounded-3xl sm:rounded-2xl border-0 shadow-2xl bg-slate-950 text-white flex flex-col items-center text-center animate-fade-in">
            <div className="bg-primary/20 p-4 rounded-full mb-6 animate-bounce">
                <PartyPopper className="h-12 w-12 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
                <DialogTitle className="text-3xl font-black tracking-tighter text-primary uppercase">
                    {navigator.onLine ? "Logged Successfully!" : "Saved Locally!"}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-lg font-medium">
                    {navigator.onLine ? "Inventory data has been saved to the cloud." : "Working offline. Data stored and will sync later."}
                </DialogDescription>
            </DialogHeader>
            <Separator className="my-6 bg-slate-800" />
            <div className="flex flex-col items-center gap-2">
                <Heart className="h-6 w-6 text-red-500 fill-red-500" />
                <p className="text-xl font-bold">Thank you, <span className="text-primary">{submittedStaffName}</span>!</p>
                <p className="text-slate-500 text-sm italic">You're doing a great job.</p>
            </div>
            <Button onClick={() => setIsSuccessDialogOpen(false)} className="mt-8 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl h-12">
                Got it!
            </Button>
        </DialogContent>
    </Dialog>
    </>
  );
}
