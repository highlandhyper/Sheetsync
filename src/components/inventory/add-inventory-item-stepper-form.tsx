
'use client';

import { useEffect, useState, useActionState, useTransition, useRef, useCallback } from 'react';
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
    AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { Html5QrcodeScanner, type Html5QrcodeResult, type QrcodeError } from 'html5-qrcode';


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

import { addInventoryItemSchema, type AddInventoryItemFormValues } from '@/lib/schemas';
import type { ItemType } from '@/lib/types';
import { addInventoryItemAction, fetchProductAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/lib/types';

const steps = [
  { id: 1, name: 'Scan Item', fields: ['barcode'] },
  { id: 2, name: 'Add Details', fields: ['staffName', 'itemType', 'quantity', 'expiryDate'] },
  { id: 3, name: 'Set Location', fields: ['location'] },
  { id: 4, name: 'Review & Log' },
];

const SCANNER_REGION_ID = "stepper-barcode-scanner-region";

interface AddInventoryItemStepperFormProps {
  uniqueLocations: string[];
  uniqueStaffNames: string[];
}

export function AddInventoryItemStepperForm({ uniqueLocations, uniqueStaffNames }: AddInventoryItemStepperFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [state, formAction] = useActionState<ActionResponse<InventoryItem> | undefined, FormData>(
    addInventoryItemAction,
    undefined
  );
  const [isPending, startTransition] = useTransition();

  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  const [staffComboboxOpen, setStaffComboboxOpen] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [productSupplier, setProductSupplier] = useState('');
  const [productLookupError, setProductLookupError] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraPermissionAttempted, setCameraPermissionAttempted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<AddInventoryItemFormValues>({
    resolver: zodResolver(addInventoryItemSchema),
    defaultValues: {
      staffName: '',
      itemType: undefined,
      barcode: '',
      quantity: '',
      location: '',
      expiryDate: undefined,
    },
  });

  const allFormValues = watch();

  useEffect(() => {
    if (state?.success) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      reset();
      setProductName('');
      setProductSupplier('');
      setProductLookupError('');
      setCurrentStep(0);
    } else if (state?.message && !state.success) {
      toast({
        title: 'Error Logging Item',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, reset]);
  
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
    const output = await trigger(fields as FieldName[], { shouldFocus: true });

    if (!output) return;

    if (currentStep === 0) { // Barcode step
        const barcodeOk = await handleBarcodeLookup(allFormValues.barcode);
        if(!barcodeOk) return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(step => step + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(step => step - 1);
    }
  };
  
  const processFormSubmit = (data: AddInventoryItemFormValues) => {
    startTransition(() => {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (value instanceof Date) {
            formData.append(key, value.toISOString());
          } else if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        formAction(formData);
    });
  };

  const handleToggleScanner = () => {
      setIsScanning(prev => !prev);
  };

  useEffect(() => {
    let scannerInstance: Html5QrcodeScanner | null = null;
    const attemptScannerSetup = async () => {
      if (isScanning) {
        setCameraPermissionAttempted(false);
        setHasCameraPermission(null);
        
        try {
          // Check permission without starting stream immediately
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          stream.getTracks().forEach(track => track.stop());

          if (!document.getElementById(SCANNER_REGION_ID)) {
             console.warn("Scanner region ID not found. Aborting scanner render.");
             setIsScanning(false);
             return;
          }

          scannerInstance = new Html5QrcodeScanner(
            SCANNER_REGION_ID,
            { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true, supportedScanTypes: [0] },
            false
          );

          const onScanSuccess = async (decodedText: string, result: Html5QrcodeResult) => {
            console.log(`Scan success: ${decodedText}`);
            setValue('barcode', decodedText, { shouldValidate: true });
            setIsScanning(false);
            const lookupSuccess = await handleBarcodeLookup(decodedText);
            if (lookupSuccess) {
                toast({ title: "Product Found!", description: "Proceeding to the next step." });
                setCurrentStep(1);
            } else {
                 toast({ title: "Product Not Found", description: "Please ensure this product exists in the catalog.", variant: "destructive" });
            }
          };

          const onScanFailure = (error: string | QrcodeError) => { /* ignore */ };
          
          scannerInstance.render(onScanSuccess, onScanFailure);
          html5QrcodeScannerRef.current = scannerInstance;

        } catch (error: any) {
          console.error('Error with camera scanner:', error);
          setHasCameraPermission(false);
          let description = 'Please enable camera permissions in your browser settings.';
          if (error.name === 'NotAllowedError') {
            description = 'Camera access denied. Please enable it in your browser settings.';
          } else if (error.name === 'NotFoundError') {
            description = 'No camera found. Please ensure a camera is connected.';
          } else if (error.message?.toLowerCase().includes('secure context')) {
            description = 'Camera access requires a secure connection (HTTPS or localhost).';
          }
          toast({ variant: 'destructive', title: 'Camera Access Error', description });
          setIsScanning(false);
        } finally {
            setCameraPermissionAttempted(true);
        }
      } else {
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.clear().catch(err => console.error("Failed to clear scanner:", err));
          html5QrcodeScannerRef.current = null;
        }
      }
    };
    attemptScannerSetup();
    return () => {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(err => console.error("Failed to clear scanner on cleanup:", err));
        html5QrcodeScannerRef.current = null;
      }
    };
  }, [isScanning, toast, setValue, handleBarcodeLookup]);


  return (
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
                <p className="text-sm font-medium text-center text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}: {steps[currentStep].name}
                </p>
            </div>
            
            <form
            onSubmit={handleSubmit(processFormSubmit)}
            className="space-y-6"
            >
                {/* Step 1: Barcode */}
                <div className={cn(currentStep !== 0 && "hidden")}>
                    <Label htmlFor="barcode" className="text-lg font-semibold">Product Barcode</Label>
                    <p className="text-sm text-muted-foreground mb-2">Scan or enter the item's barcode.</p>
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
                        <Button type="button" onClick={handleToggleScanner} variant="outline" size="icon" className="h-10 w-10 shrink-0">
                            {isScanning ? <VideoOff className="h-5 w-5" /> : <ScanBarcode className="h-5 w-5" />}
                            <span className="sr-only">{isScanning ? "Close Scanner" : "Open Scanner"}</span>
                        </Button>
                    </div>
                     {isScanning && (
                        <div id={SCANNER_REGION_ID} className="w-full md:w-1/2 lg:w-1/3 mx-auto aspect-video border-2 border-dashed border-primary rounded-md overflow-hidden mt-4 bg-muted/30 flex items-center justify-center">
                            <p className="text-sm text-muted-foreground p-4 text-center">Initializing scanner...</p>
                        </div>
                    )}
                    {cameraPermissionAttempted && hasCameraPermission === false && !isScanning && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>
                                Could not start the scanner. Please enable camera permissions for this site in your browser settings.
                            </AlertDescription>
                        </Alert>
                    )}
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
                        <div>
                        <Label htmlFor="staffName">Staff Name</Label>
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

                        <div>
                            <Label htmlFor="itemType">Item Type</Label>
                            <Select onValueChange={(v: ItemType) => setValue('itemType', v, { shouldValidate: true })} value={allFormValues.itemType}>
                                <SelectTrigger id="itemType" className={cn(errors.itemType && 'border-destructive')}><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent><SelectItem value="Expiry">Expiry</SelectItem><SelectItem value="Damage">Damage</SelectItem></SelectContent>
                            </Select>
                            {errors.itemType && <p className="text-sm text-destructive mt-1">{errors.itemType.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input id="quantity" type="number" placeholder="e.g., 10" {...register('quantity')} className={cn(errors.quantity && 'border-destructive')}/>
                        {errors.quantity && <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>}
                        </div>
                        {allFormValues.itemType === 'Expiry' && (
                            <div>
                                <Label htmlFor="expiryDate">Expiry Date</Label>
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
                        )}
                    </div>
                </div>

                {/* Step 3: Location */}
                <div className={cn(currentStep !== 2 && "hidden")}>
                    <Label htmlFor="location" className="text-lg font-semibold">Storage Location</Label>
                    <p className="text-sm text-muted-foreground mb-2">Where is this item being stored?</p>
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
                    <div className="p-4 rounded-lg bg-muted/50 border border-muted space-y-3">
                        <h3 className="font-semibold text-lg">{productName}</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><span className="font-medium text-muted-foreground">Barcode:</span> {allFormValues.barcode}</div>
                            <div><span className="font-medium text-muted-foreground">Supplier:</span> {productSupplier}</div>
                            <div><span className="font-medium text-muted-foreground">Quantity:</span> {allFormValues.quantity}</div>
                            <div><span className="font-medium text-muted-foreground">Type:</span> {allFormValues.itemType}</div>
                            <div><span className="font-medium text-muted-foreground">Logged By:</span> {allFormValues.staffName}</div>
                            <div><span className="font-medium text-muted-foreground">Location:</span> {allFormValues.location}</div>
                            {allFormValues.itemType === 'Expiry' && allFormValues.expiryDate &&
                                <div className="col-span-2"><span className="font-medium text-muted-foreground">Expiry Date:</span> {format(allFormValues.expiryDate, "PPP")}</div>
                            }
                        </div>
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                {currentStep > 0 ? (
                    <Button type="button" onClick={prevStep} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                ) : <div />}

                {currentStep < steps.length - 1 ? (
                    <Button type="button" onClick={nextStep} disabled={isFetchingProduct}>
                        {isFetchingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4" />}
                        Next
                    </Button>
                ) : (
                    <Button type="submit" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus className="mr-2 h-4 w-4" />}
                        Log Item
                    </Button>
                )}
                </div>

            </form>
        </div>
      </CardContent>
    </Card>
  );
}

    