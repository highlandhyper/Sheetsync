'use client';

import { useEffect, useState, useActionState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Loader2, FilePlus, ChevronsUpDown, Check } from 'lucide-react';
import { format } from 'date-fns';

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

import { addInventoryItemSchema, type AddInventoryItemFormValues } from '@/lib/schemas';
import type { ItemType } from '@/lib/types';
import { addInventoryItemAction, fetchProductAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/lib/types';


function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus className="mr-2 h-4 w-4" />}
      Log Item
    </Button>
  );
}

interface AddInventoryItemFormProps {
  uniqueLocations: string[];
  uniqueStaffNames: string[];
}

export function AddInventoryItemForm({ uniqueLocations, uniqueStaffNames }: AddInventoryItemFormProps) {
  const { toast } = useToast();
  const [state, formAction] = useActionState<ActionResponse<InventoryItem> | undefined, FormData>(
    addInventoryItemAction,
    undefined
  );
  const [isPending, startTransition] = useTransition();

  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  const [staffComboboxOpen, setStaffComboboxOpen] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [productLookupError, setProductLookupError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
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

  const itemType = watch('itemType');
  const barcodeValue = watch('barcode');
  const locationValue = watch('location');
  const staffNameValue = watch('staffName');

  useEffect(() => {
    if (state?.success) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      reset();
      setProductName('');
      setProductLookupError('');
    } else if (state?.message && !state.success) {
      toast({
        title: 'Error Logging Item',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, reset]);

  // Debounced effect for barcode lookup
  useEffect(() => {
    setProductName('');
    setProductLookupError('');
    if (!barcodeValue || barcodeValue.length < 3) { // Minimum length to trigger search
      return;
    }

    const handler = setTimeout(() => {
      const fetchProduct = async () => {
        setIsFetchingProduct(true);
        const response = await fetchProductAction(barcodeValue);
        if (response.success && response.data) {
          setProductName(response.data.productName);
        } else {
          setProductName('');
          setProductLookupError(response.message || 'Product not found. It must be created first via Manage Products.');
        }
        setIsFetchingProduct(false);
      };
      fetchProduct();
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [barcodeValue]);
  
  // For handling controlled Select component
  const handleItemTypeChange = (value: ItemType) => {
    setValue('itemType', value, { shouldValidate: true });
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
  }


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Log New Inventory Item</CardTitle>
        <CardDescription>
          Enter the details for the item, its condition, and location. Product and supplier details will be looked up by barcode.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(processFormSubmit)}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="staffName">Staff Name</Label>
               <Popover open={staffComboboxOpen} onOpenChange={setStaffComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={staffComboboxOpen}
                      className={cn("w-full justify-between font-normal", !staffNameValue && "text-muted-foreground", (errors.staffName || state?.errors?.find(e => e.path.includes('staffName'))) && 'border-destructive')}
                    >
                      {staffNameValue
                        ? uniqueStaffNames.find((staff) => staff.toLowerCase() === staffNameValue.toLowerCase()) || staffNameValue
                        : "Select or type staff name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command
                      filter={(value, search) => {
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                        return 0;
                      }}
                    >
                      <CommandInput
                        placeholder="Search or create staff name..."
                        value={staffNameValue || ''}
                        onValueChange={(currentValue) => {
                           setValue('staffName', currentValue, { shouldValidate: true });
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>No staff member found. Type to add.</CommandEmpty>
                        <CommandGroup>
                          {uniqueStaffNames.map((staff) => (
                            <CommandItem
                              key={staff}
                              value={staff}
                              onSelect={(currentValue) => {
                                setValue("staffName", currentValue === staffNameValue ? "" : staff, { shouldValidate: true });
                                setStaffComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  staffNameValue?.toLowerCase() === staff.toLowerCase() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {staff}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              {errors.staffName && <p className="text-sm text-destructive mt-1">{errors.staffName.message}</p>}
              {state?.errors?.find(e => e.path.includes('staffName')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('staffName'))?.message}</p>}
            </div>

            <div>
              <Label htmlFor="itemType">Item Type</Label>
                <Select onValueChange={handleItemTypeChange} value={itemType} >
                  <SelectTrigger id="itemType" className={cn(errors.itemType || state?.errors?.find(e => e.path.includes('itemType')) ? 'border-destructive' : '')}>
                    <SelectValue placeholder="Select type (Expiry/Damage)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Expiry">Expiry</SelectItem>
                    <SelectItem value="Damage">Damage</SelectItem>
                  </SelectContent>
                </Select>
              {errors.itemType && <p className="text-sm text-destructive mt-1">{errors.itemType.message}</p>}
              {state?.errors?.find(e => e.path.includes('itemType')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('itemType'))?.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              placeholder="Scan or enter barcode"
              {...register('barcode')}
              className={cn(errors.barcode || state?.errors?.find(e => e.path.includes('barcode')) ? 'border-destructive' : '')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
            />
             {errors.barcode && <p className="text-sm text-destructive mt-1">{errors.barcode.message}</p>}
             {state?.errors?.find(e => e.path.includes('barcode')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('barcode'))?.message}</p>}

              <div className="pt-2 min-h-[20px]">
                {isFetchingProduct && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up barcode...</p>}
                {productName && !isFetchingProduct && <p className="text-sm text-green-600 font-medium">✓ Product: {productName}</p>}
                {productLookupError && !isFetchingProduct && <p className="text-sm text-destructive">! {productLookupError}</p>}
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="e.g., 10"
                {...register('quantity')}
                className={cn(errors.quantity || state?.errors?.find(e => e.path.includes('quantity')) ? 'border-destructive' : '')}
              />
              {errors.quantity && <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>}
              {state?.errors?.find(e => e.path.includes('quantity')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('quantity'))?.message}</p>}
            </div>

            <div>
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watch('expiryDate') && "text-muted-foreground",
                       (errors.expiryDate || state?.errors?.find(e => e.path.includes('expiryDate'))) && itemType === 'Expiry' ? 'border-destructive' : ''
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('expiryDate') ? format(watch('expiryDate')!, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('expiryDate')}
                    onSelect={(date) => setValue('expiryDate', date, { shouldValidate: true })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.expiryDate && itemType === 'Expiry' && <p className="text-sm text-destructive mt-1">{errors.expiryDate.message}</p>}
              {state?.errors?.find(e => e.path.includes('expiryDate')) && itemType === 'Expiry' && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('expiryDate'))?.message}</p>}
            </div>
          </div>

           <div>
              <Label htmlFor="location">Location</Label>
               <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={locationComboboxOpen}
                      className={cn("w-full justify-between font-normal", !locationValue && "text-muted-foreground", (errors.location || state?.errors?.find(e => e.path.includes('location'))) && 'border-destructive')}
                    >
                      {locationValue
                        ? uniqueLocations.find((loc) => loc.toLowerCase() === locationValue.toLowerCase()) || locationValue
                        : "Select or type location..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command
                      filter={(value, search) => {
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                        return 0;
                      }}
                    >
                      <CommandInput
                        placeholder="Search or create location..."
                        value={locationValue || ''}
                        onValueChange={(currentValue) => {
                           setValue('location', currentValue, { shouldValidate: true });
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>No location found. Type to create new.</CommandEmpty>
                        <CommandGroup>
                          {uniqueLocations.map((loc) => (
                            <CommandItem
                              key={loc}
                              value={loc}
                              onSelect={(currentValue) => {
                                setValue("location", currentValue === locationValue ? "" : loc, { shouldValidate: true });
                                setLocationComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  locationValue?.toLowerCase() === loc.toLowerCase() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {loc}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
              {state?.errors?.find(e => e.path.includes('location')) && <p className="text-sm text-destructive mt-1">{state.errors.find(e => e.path.includes('location'))?.message}</p>}
            </div>

          <div className="flex justify-end pt-4">
            <SubmitButton isPending={isPending} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
