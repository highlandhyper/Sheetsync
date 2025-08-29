
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
    VideoOff,
    AlertTriangle,
    User,
    Tag,
    Hash,
    MapPin
} from 'lucide-react';
import { format } from 'date-fns';
import { Html5QrcodeScanner, type Html5QrcodeResult, type QrcodeError, type QrCodeSuccessCallback } from 'html5-qrcode';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';


import { addInventoryItemSchema, type AddInventoryItemFormValues } from '@/lib/schemas';
import type { ItemType } from '@/lib/types';
import { addInventoryItemAction, fetchProductAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/lib/types';

const steps = [
  { id: 1, name: 'Scan Item', fields: ['barcode'], icon: Barcode },
  { id: 2, name: 'Add Details', fields: ['staffName', 'itemType', 'quantity', 'expiryDate'], icon: Info },
  { id: 3, name: 'Set Location', fields: ['location'], icon: Warehouse },
  { id: 4, name: 'Review & Log', icon: FilePlus },
];

const SCANNER_REGION_ID = "stepper-barcode-scanner-region";

interface AddInventoryItemStepperFormProps {
  uniqueLocations: string[];
  uniqueStaffNames: string[];
}

export function AddInventoryItemStepperForm({ uniqueLocations, uniqueStaffNames }: AddInventoryItemStepperFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [isPending, startTransition] = useTransition();

  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  const [staffComboboxOpen, setStaffComboboxOpen] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [productSupplier, setProductSupplier] = useState('');
  const [productLookupError, setProductLookupError] = useState('');

  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<AddInventoryItemFormValues>({
    resolver: zodResolver(addInventoryItemSchema),
    defaultValues: {
      staffName: '',
      itemType: undefined,
      barcode: '',
      quantity: '',
      expiryDate: new Date(),
    },
    mode: 'onTouched'
  });
  
  const allFormValues = watch();

  const handleAction = async (formData: FormData) => {
    startTransition(async () => {
        const response = await addInventoryItemAction(undefined, formData);
        if (response?.success) {
            toast({
                title: 'Success!',
                description: response.message,
            });
            reset();
            setProductName('');
            setProductSupplier('');
            setProductLookupError('');
            setCurrentStep(0);
        } else if (response?.message) {
            toast({
                title: 'Error Logging Item',
                description: response.message,
                variant: 'destructive',
            });
        }
    });
  };

  const handleBarcodeLookup = useCallback(async (barcode: string) => {
      if (!barcode || !barcode.trim()) return false;
      setIsFetchingProduct(true);
      setProductLookupError('');
      setProductName('');
      setProductSupplier('');
      const response = await fetchProductAction(barcode);
      setIsFetchingProduct(false);
      if (response.success && response.data) {
          setProductName(response.data.productName);
          setProductSupplier(response.data.supplierName || 'N/A');
          return true;
      } else {
          setProductLookupError(response.message || 'Product not found. It must be created first via Manage Products.');
          return false;
      }
  }, []);

  type FieldName = keyof AddInventoryItemFormValues;

  const nextStep = async () => {
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
    formRef.current?.requestSubmit();
  };


  useEffect(() => {
    if (!isScannerDialogOpen) {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(err => console.error("Failed to clear scanner on dialog close:", err));
        html5QrcodeScannerRef.current = null;
      }
      return;
    }
  
    // Use a short timeout to ensure the dialog's DOM is ready before initializing the scanner.
    const timerId = setTimeout(() => {
      if (!document.getElementById(SCANNER_REGION_ID)) {
        console.error("Scanner region ID not found in DOM after timeout. The dialog might not be mounted correctly.");
        return;
      }
  
      const onScanSuccess: QrCodeSuccessCallback = async (decodedText, result) => {
        setValue('barcode', decodedText, { shouldValidate: true });
        setIsScannerDialogOpen(false); // Close dialog on success
        const lookupSuccess = await handleBarcodeLookup(decodedText);
        if (lookupSuccess) {
          toast({ title: "Product Found!", description: "Proceeding to the next step." });
          setCurrentStep(1);
        } else {
          toast({ title: "Product Not Found", description: "Please ensure this product exists in the catalog.", variant: "destructive" });
        }
      };
  
      const onScanFailure = (error: string | QrcodeError) => { /* ignore */ };
  
      const scanner = new Html5QrcodeScanner(
        SCANNER_REGION_ID,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.min(viewfinderWidth, viewfinderHeight) * 0.8,
            height: Math.min(viewfinderWidth, viewfinderHeight) * 0.8,
          }),
          rememberLastUsedCamera: true,
          supportedScanTypes: [0], // 0 for camera
          facingMode: 'environment' // Prefer back camera
        },
        false // verbose
      );
  
      scanner.render(onScanSuccess, onScanFailure)
        .catch(err => {
          console.error("Scanner render error:", err);
          let description = 'Please enable camera permissions in your browser settings.';
          if (typeof err === 'string' && err.toLowerCase().includes('permission denied')) {
            description = 'Camera access denied. Please enable it in your browser settings.';
          } else if (err?.name === 'NotAllowedError') {
            description = 'Camera access denied. Please enable it in your browser settings.';
          }
          toast({ variant: 'destructive', title: 'Camera Access Error', description });
          setIsScannerDialogOpen(false);
        });
  
      html5QrcodeScannerRef.current = scanner;
    }, 100); // 100ms delay to allow DOM to render
  
    return () => {
      clearTimeout(timerId);
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(err => console.error("Failed to clear scanner on cleanup:", err));
        html5QrcodeScannerRef.current = null;
      }
    };
  }, [isScannerDialogOpen, handleBarcodeLookup, setValue, toast]);


  return (
    <>
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Log New Inventory Item</CardTitle>
        <CardDescription>
          Follow the steps to log a new item into the inventory system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
            {/* Stepper Progress Bar */}
            <div className="space-y-3">
                <Progress value={((currentStep + 1) / steps.length) * 100} />
                <p className="text-sm font-medium text-center text-muted-foreground flex items-center justify-center gap-2">
                    {React.createElement(steps[currentStep].icon, { className: "h-4 w-4" })}
                    Step {currentStep + 1} of {steps.length}: {steps[currentStep].name}
                </p>
            </div>
            
            <form 
                ref={formRef} 
                onSubmit={handleSubmit(handleAction)}
                className="space-y-6"
            >
                {/* Step 1: Barcode */}
                <div className={cn(currentStep !== 0 && "hidden", "space-y-4")}>
                    <Label htmlFor="barcode" className="text-base font-semibold flex items-center gap-2">
                        <Barcode className="h-5 w-5" /> Product Barcode
                    </Label>
                    <p className="text-sm text-muted-foreground -mt-2">Scan or enter the item's barcode.</p>
                     <div className="flex gap-2 items-start">
                        <div className="flex-grow">
                            <Input
                                id="barcode"
                                placeholder="Enter barcode"
                                {...register('barcode')}
                                className={cn("text-base", errors.barcode && 'border-destructive')}
                            />
                            {errors.barcode && <p className="text-sm text-destructive mt-1">{errors.barcode.message}</p>}
                        </div>
                        <Button type="button" onClick={() => setIsScannerDialogOpen(true)} variant="outline" size="icon" className="h-10 w-10 shrink-0">
                           <ScanBarcode className="h-5 w-5" />
                           <span className="sr-only">Open Scanner</span>
                        </Button>
                    </div>
                    
                    <div className="pt-2 min-h-[20px]">
                        {productLookupError && !isFetchingProduct && <p className="text-sm text-destructive">! {productLookupError}</p>}
                    </div>
                </div>

                {/* Step 2: Details */}
                <div className={cn(currentStep !== 1 && "hidden", "space-y-6")}>
                    {/* Product Info Display */}
                    <div className="p-4 rounded-lg bg-muted/50 border border-muted">
                        <h3 className="font-semibold text-lg">{productName}</h3>
                        <p className="text-sm text-muted-foreground">Supplier: {productSupplier}</p>
                        <p className="text-sm text-muted-foreground">Barcode: {allFormValues.barcode}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                        <Label htmlFor="staffName" className="flex items-center gap-2"><User className="h-4 w-4" />Staff Name</Label>
                        <Popover open={staffComboboxOpen} onOpenChange={setStaffComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={staffComboboxOpen} className={cn("w-full justify-between font-normal", !allFormValues.staffName && "text-muted-foreground", errors.staffName && 'border-destructive')}>
                                    {allFormValues.staffName ? uniqueStaffNames.find((staff) => staff.toLowerCase() === allFormValues.staffName.toLowerCase()) || allFormValues.staffName : "Select or type staff name..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                                    <CommandInput placeholder="Search or create staff name..." value={allFormValues.staffName || ''} onValueChange={(v) => setValue('staffName', v, { shouldValidate: true })}/>
                                    <CommandList><CommandEmpty>No staff member found. Type to add.</CommandEmpty><CommandGroup>
                                        {uniqueStaffNames.map((staff) => (
                                            <CommandItem key={staff} value={staff} onSelect={() => { setValue("staffName", staff, { shouldValidate: true }); setStaffComboboxOpen(false);}}>
                                            <Check className={cn("mr-2 h-4 w-4", allFormValues.staffName?.toLowerCase() === staff.toLowerCase() ? "opacity-100" : "opacity-0")}/>{staff}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup></CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {errors.staffName && <p className="text-sm text-destructive mt-1">{errors.staffName.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="itemType" className="flex items-center gap-2"><Tag className="h-4 w-4" />Item Type</Label>
                            <Select onValueChange={(v: ItemType) => setValue('itemType', v, { shouldValidate: true })} value={allFormValues.itemType}>
                                <SelectTrigger id="itemType" className={cn(errors.itemType && 'border-destructive')}><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent><SelectItem value="Expiry">Expiry</SelectItem><SelectItem value="Damage">Damage</SelectItem></SelectContent>
                            </Select>
                            {errors.itemType && <p className="text-sm text-destructive mt-1">{errors.itemType.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                        <Label htmlFor="quantity" className="flex items-center gap-2"><Hash className="h-4 w-4" />Quantity</Label>
                        <Input id="quantity" type="number" placeholder="e.g., 10" {...register('quantity')} className={cn(errors.quantity && 'border-destructive')}/>
                        {errors.quantity && <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expiryDate" className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !allFormValues.expiryDate && "text-muted-foreground", errors.expiryDate && 'border-destructive')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {allFormValues.expiryDate ? format(allFormValues.expiryDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={allFormValues.expiryDate} onSelect={(d) => setValue('expiryDate', d, { shouldValidate: true })} initialFocus/></PopoverContent>
                            </Popover>
                            {errors.expiryDate && <p className="text-sm text-destructive mt-1">{errors.expiryDate.message}</p>}
                        </div>
                    </div>
                </div>

                {/* Step 3: Location */}
                 <div className={cn(currentStep !== 2 && "hidden", "space-y-4")}>
                    <Label htmlFor="location" className="text-base font-semibold flex items-center gap-2">
                        <MapPin className="h-5 w-5" /> Storage Location
                    </Label>
                    <p className="text-sm text-muted-foreground -mt-2">Where is this item being stored?</p>
                    <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={locationComboboxOpen} className={cn("w-full justify-between font-normal", !allFormValues.location && "text-muted-foreground", errors.location && 'border-destructive')}>
                            {allFormValues.location ? uniqueLocations.find((loc) => loc.toLowerCase() === allFormValues.location.toLowerCase()) || allFormValues.location : "Select or type location..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                                <CommandInput placeholder="Search or create location..." value={allFormValues.location || ''} onValueChange={(v) => setValue('location', v, { shouldValidate: true })}/>
                                <CommandList><CommandEmpty>No location found. Type to create new.</CommandEmpty><CommandGroup>
                                    {uniqueLocations.map((loc) => (
                                        <CommandItem key={loc} value={loc} onSelect={() => { setValue("location", loc, { shouldValidate: true }); setLocationComboboxOpen(false);}}>
                                            <Check className={cn("mr-2 h-4 w-4", allFormValues.location?.toLowerCase() === loc.toLowerCase() ? "opacity-100" : "opacity-0")}/>{loc}
                                        </CommandItem>
                                    ))}
                                </CommandGroup></CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
                </div>
                
                {/* Step 4: Review */}
                <div className={cn(currentStep !== 3 && "hidden", "space-y-4")}>
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Review Details</AlertTitle>
                        <AlertDescription>
                            Please confirm the details below are correct before logging the item.
                        </AlertDescription>
                    </Alert>
                    <div className="p-6 rounded-lg bg-muted/50 border border-muted space-y-4">
                        <h3 className="font-semibold text-xl mb-2">{productName}</h3>
                        <Separator />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <Barcode className="h-5 w-5 text-primary mt-0.5" />
                                <div><span className="font-medium text-muted-foreground block">Barcode</span>{allFormValues.barcode}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User className="h-5 w-5 text-primary mt-0.5" />
                                <div><span className="font-medium text-muted-foreground block">Logged By</span>{allFormValues.staffName}</div>
                            </div>
                             <div className="flex items-start gap-3">
                                <Warehouse className="h-5 w-5 text-primary mt-0.5" />
                                <div><span className="font-medium text-muted-foreground block">Supplier</span>{productSupplier}</div>
                            </div>
                             <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                                <div><span className="font-medium text-muted-foreground block">Location</span>{allFormValues.location}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Hash className="h-5 w-5 text-primary mt-0.5" />
                                <div><span className="font-medium text-muted-foreground block">Quantity</span>{allFormValues.quantity}</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Tag className="h-5 w-5 text-primary mt-0.5" />
                                <div><span className="font-medium text-muted-foreground block">Type</span>{allFormValues.itemType}</div>
                            </div>
                            {allFormValues.expiryDate &&
                                <div className="flex items-start gap-3 col-span-full">
                                    <CalendarIcon className="h-5 w-5 text-primary mt-0.5" />
                                    <div><span className="font-medium text-muted-foreground block">Date</span>{format(allFormValues.expiryDate, "PPP")}</div>
                                </div>
                            }
                        </div>
                    </div>
                </div>

            </form>
            <div className="flex justify-between pt-4">
                <Button type="button" onClick={prevStep} variant="outline" disabled={isPending || currentStep === 0}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>

                {currentStep < steps.length - 1 ? (
                    <Button type="button" onClick={nextStep} disabled={isFetchingProduct || isPending}>
                        {isFetchingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                ) : (
                    <Button type="button" onClick={handleFormSubmit} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus className="mr-2 h-4 w-4" />}
                        Log Item
                    </Button>
                )}
            </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="max-w-2xl w-full p-0">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>Scan Barcode</DialogTitle>
                <DialogDescription>
                    Position the barcode within the frame. The scanner will automatically detect it.
                </DialogDescription>
            </DialogHeader>
            <div id={SCANNER_REGION_ID} className="w-full aspect-video [&>span]:hidden" />
        </DialogContent>
    </Dialog>
    </>
  );
}
