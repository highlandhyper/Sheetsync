'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Loader2, Save, AlertTriangle, Tag, MapPin, Hash, ShieldQuestion } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

import { editInventoryItemSchema, type EditInventoryItemFormValues } from '@/lib/schemas';
import type { InventoryItem } from '@/lib/types';
import { editInventoryItemAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { AuthorizeActionDialog } from './authorize-action-dialog';

interface EditInventoryItemDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  uniqueLocationsFromDb: string[]; 
}

/**
 * Robust local date parsing to prevent timezone shifting.
 */
function parseDateStringLocal(dateStr?: string): Date | null {
  if (!dateStr) return null;
  
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    } else {
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      y = parseInt(parts[2], 10);
    }
    const date = new Date(y, m, d);
    return isValid(date) ? date : null;
  }
  
  const isoDate = parseISO(dateStr);
  return isValid(isoDate) ? isoDate : null;
}

export function EditInventoryItemDialog({ item, isOpen, onOpenChange, onSuccess, uniqueLocationsFromDb }: EditInventoryItemDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isActionPending, startActionTransition] = useTransition();
  const { updateInventoryItem } = useDataCache();
  
  const [initialQuantity, setInitialQuantity] = useState<number | null>(null);
  const [quantityChanged, setQuantityChanged] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [stagedData, setStagedData] = useState<EditInventoryItemFormValues | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors: formErrors, isDirty },
  } = useForm<EditInventoryItemFormValues>({
    resolver: zodResolver(editInventoryItemSchema),
    defaultValues: {
      itemId: '',
      location: '',
      itemType: 'Expiry',
      quantity: 0,
      expiryDate: null,
    },
  });

  const watchedQuantity = watch('quantity');
  const watchedExpiryDate = watch('expiryDate');

  useEffect(() => {
    if (initialQuantity !== null && watchedQuantity !== initialQuantity) {
        setQuantityChanged(true);
    } else {
        setQuantityChanged(false);
    }
  }, [watchedQuantity, initialQuantity]);

  const availableLocationsForSelect = useMemo(() => {
    const locationsSet = new Set<string>();
    if (item?.location) {
      locationsSet.add(item.location);
    }
    uniqueLocationsFromDb.forEach(loc => locationsSet.add(loc));
    return Array.from(locationsSet).filter(Boolean).sort();
  }, [item?.location, uniqueLocationsFromDb]);

  useEffect(() => {
    if (item && isOpen) {
      setInitialQuantity(item.quantity);
      const parsedDate = parseDateStringLocal(item.expiryDate);

      reset({
        itemId: item.id,
        location: item.location,
        itemType: item.itemType,
        quantity: item.quantity,
        expiryDate: parsedDate,
      });
    }
  }, [item, reset, isOpen]);
  
  const executeSave = (data: EditInventoryItemFormValues) => {
    if (!item || !user?.email) return;

    const formData = new FormData();
    formData.append('itemId', item.id);
    formData.append('location', data.location);
    formData.append('itemType', data.itemType);
    formData.append('userEmail', user.email);
    formData.append('quantity', String(data.quantity));

    if (data.expiryDate) {
      formData.append('expiryDate', format(data.expiryDate, 'yyyy-MM-dd'));
    }
    
    startActionTransition(async () => {
      const result = await editInventoryItemAction(undefined, formData);
      if (result.success && result.data) {
        toast({ title: 'Success', description: 'Item updated successfully.' });
        updateInventoryItem(result.data);
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({ title: 'Error', description: result.message || 'Update failed.', variant: 'destructive' });
      }
    });
  }

  const handlePrimarySubmit = (data: EditInventoryItemFormValues) => {
    if (!isDirty) {
      onOpenChange(false);
      return;
    }
    if (quantityChanged) {
        setStagedData(data);
        setIsAuthDialogOpen(true);
    } else {
        executeSave(data);
    }
  };
  
  const handleAuthorizationSuccess = () => {
    setIsAuthDialogOpen(false);
    if (stagedData) {
      executeSave(stagedData);
      setStagedData(null);
    }
  };

  if (!item) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Inventory Item: {item.productName}</DialogTitle>
          <DialogDescription>Update details for barcode: {item.barcode}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handlePrimarySubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                    <Label htmlFor="location">Location</Label>
                    <Controller
                    name="location"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="location" className={cn(formErrors.location && 'border-destructive')}>
                            <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Select location" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {availableLocationsForSelect.map((loc) => (
                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                    />
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                   <div className="relative">
                     <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Controller
                        name="quantity"
                        control={control}
                        render={({ field }) => (
                            <Input id="quantity" type="number" {...field} className={cn('pl-8', formErrors.quantity && 'border-destructive')} />
                        )}
                        />
                   </div>
                  {quantityChanged && (
                    <div className="flex items-center gap-1.5 text-xs text-yellow-600 mt-1.5 font-medium">
                      <ShieldQuestion className="h-3.5 w-3.5" />
                      <span>Authorization required.</span>
                    </div>
                  )}
                </div>

                <div>
                <Label htmlFor="itemType">Item Type</Label>
                <Controller
                    name="itemType"
                    control={control}
                    render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} >
                        <SelectTrigger id="itemType" className={cn(formErrors.itemType && 'border-destructive')}>
                        <div className="flex items-center">
                            {field.value === 'Damage' ? <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" /> : <Tag className="mr-2 h-4 w-4 text-muted-foreground" />}
                            <SelectValue placeholder="Select type" />
                        </div>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Expiry">Expiry</SelectItem>
                        <SelectItem value="Damage">Damage</SelectItem>
                        </SelectContent>
                    </Select>
                    )}
                />
                </div>

                <div>
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen} modal={true}>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal h-10", !watchedExpiryDate && "text-muted-foreground", formErrors.expiryDate && 'border-destructive')}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watchedExpiryDate ? format(watchedExpiryDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar 
                        mode="single" 
                        selected={watchedExpiryDate || undefined} 
                        onSelect={(date) => {
                            setValue('expiryDate', date || null, { shouldDirty: true });
                            if (date) setIsCalendarOpen(false);
                        }} 
                        initialFocus 
                        defaultMonth={watchedExpiryDate || undefined}
                    />
                    </PopoverContent>
                </Popover>
                {formErrors.expiryDate && <p className="text-xs text-destructive mt-1">{formErrors.expiryDate.message}</p>}
                </div>
            </div>
          
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isActionPending}>
                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AuthorizeActionDialog
        isOpen={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        onAuthorizationSuccess={handleAuthorizationSuccess}
        actionDescription="Changing item quantity requires local admin authorization."
    />
    </>
  );
}
