
'use client';

import { useEffect, useActionState, useTransition, useMemo, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Loader2, Save, AlertTriangle, Tag, MapPin, Hash, ShieldQuestion, KeyRound, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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
import { Separator } from '@/components/ui/separator';

import { editInventoryItemSchema, type EditInventoryItemFormValues } from '@/lib/schemas';
import type { InventoryItem, ItemType } from '@/lib/types';
import { editInventoryItemAction, type ActionResponse } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

interface EditInventoryItemDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  uniqueLocationsFromDb: string[]; 
}


function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

export function EditInventoryItemDialog({ item, isOpen, onOpenChange, onSuccess, uniqueLocationsFromDb }: EditInventoryItemDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isActionPending, startActionTransition] = useTransition();
  const { verifyCredentials } = useLocalSettingsAuth();
  
  const [state, formAction] = useActionState<ActionResponse<InventoryItem> | undefined, FormData>(
    editInventoryItemAction,
    undefined
  );

  const [initialQuantity, setInitialQuantity] = useState<number | null>(null);
  const [quantityChanged, setQuantityChanged] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setError,
    formState: { errors: formErrors, isDirty },
  } = useForm<EditInventoryItemFormValues>({
    resolver: zodResolver(editInventoryItemSchema),
    defaultValues: {
      itemId: item?.id || '',
      location: item?.location || '',
      itemType: item?.itemType || 'Expiry',
      quantity: item?.quantity || 0,
      expiryDate: item?.expiryDate ? parseISO(item.expiryDate) : null,
      authUsername: '',
      authPassword: '',
    },
  });

  const currentItemType = watch('itemType');
  const watchedQuantity = watch('quantity');

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

  useEffect(
    function handleItemChange() {
      if (item) {
        setInitialQuantity(item.quantity);
        reset({
          itemId: item.id,
          location: item.location,
          itemType: item.itemType,
          quantity: item.quantity,
          expiryDate: item.expiryDate ? parseISO(item.expiryDate) : null,
          authUsername: '',
          authPassword: '',
        });
      } else {
        setInitialQuantity(null);
      }
      setQuantityChanged(false);
    },
    [item, reset, isOpen] 
  );

  const handleSuccess = useCallback(() => {
    if (state?.success) {
        toast({
            title: 'Success!',
            description: state.message || 'Item updated successfully.',
        });
        onSuccess?.();
        onOpenChange(false);
    }
  }, [state, toast, onOpenChange, onSuccess]);


  useEffect(
    function handleActionState() {
      if (!state) return;
      if (state.success) {
        handleSuccess();
      } else {
        toast({
          title: 'Error Updating Item',
          description: state.message || 'Could not update the item.',
          variant: 'destructive',
        });
      }
    },
    [state, toast, onOpenChange, onSuccess, handleSuccess]
  );

  const processFormSubmit = (data: EditInventoryItemFormValues) => {
    if (!item) return;

    const actualQuantityChanged = initialQuantity !== data.quantity;
    
    if (actualQuantityChanged) {
        const isAuthorized = verifyCredentials(data.authUsername, data.authPassword);
        if (!isAuthorized) {
            setError("authUsername", { type: "manual", message: "Invalid username or password." });
            setError("authPassword", { type: "manual", message: "" });
            toast({ variant: "destructive", title: "Authorization Failed", description: "The local admin credentials provided are incorrect." });
            return;
        }
    } else if (!isDirty) {
      toast({ title: "No Changes", description: "No changes were made to the item." });
      onOpenChange(false);
      return;
    }

    const formData = new FormData();
    formData.append('itemId', item.id);
    formData.append('location', data.location);
    formData.append('itemType', data.itemType);
    if(user?.email) formData.append('userEmail', user.email);
    
    // The schema requires quantity, so we must always send it.
    // The check for `actualQuantityChanged` above is only to trigger the auth UI.
    formData.append('quantity', String(data.quantity));

    if (data.expiryDate) {
      formData.append('expiryDate', data.expiryDate.toISOString());
    } else if (data.itemType === 'Expiry') {
        toast({title: "Validation Error", description: "Expiry date is required for 'Expiry' type items.", variant: "destructive"});
        return;
    }
    
    startActionTransition(() => {
      formAction(formData);
    });
  };
  
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Inventory Item: {item.productName}</DialogTitle>
          <DialogDescription>
            Update the details for this inventory item. Barcode: {item.barcode}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Location */}
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
                            {availableLocationsForSelect.length > 0 ? (
                            availableLocationsForSelect.map((loc) => (
                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))
                            ) : (
                            <div className="p-2 text-sm text-muted-foreground">No locations available.</div>
                            )}
                        </SelectContent>
                        </Select>
                    )}
                    />
                    {formErrors.location && <p className="text-sm text-destructive mt-1">{formErrors.location.message}</p>}
                </div>

                {/* Quantity */}
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                   <div className="relative">
                     <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Controller
                        name="quantity"
                        control={control}
                        render={({ field }) => (
                            <Input
                            id="quantity"
                            type="number"
                            {...field}
                            className={cn('pl-8', formErrors.quantity && 'border-destructive')}
                            />
                        )}
                        />
                   </div>
                  {formErrors.quantity && <p className="text-sm text-destructive mt-1">{formErrors.quantity.message}</p>}
                </div>

                {/* Item Type */}
                <div>
                <Label htmlFor="itemType">Item Type</Label>
                <Controller
                    name="itemType"
                    control={control}
                    render={({ field }) => (
                    <Select onValueChange={(value) => { field.onChange(value as ItemType); }} value={field.value} >
                        <SelectTrigger id="itemType" className={cn(formErrors.itemType && 'border-destructive')}>
                        <div className="flex items-center">
                            {field.value === 'Damage' ? 
                            <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" /> :
                            <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                            }
                            <SelectValue placeholder="Select type" />
                        </div>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Expiry"><Tag className="mr-2 h-4 w-4 inline-block" />Expiry</SelectItem>
                        <SelectItem value="Damage"><AlertTriangle className="mr-2 h-4 w-4 inline-block text-orange-500" />Damage</SelectItem>
                        </SelectContent>
                    </Select>
                    )}
                />
                {formErrors.itemType && <p className="text-sm text-destructive mt-1">{formErrors.itemType.message}</p>}
                </div>

                {/* Expiry Date */}
                <div>
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Controller
                    name="expiryDate"
                    control={control}
                    render={({ field }) => (
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                            formErrors.expiryDate && currentItemType === 'Expiry' && 'border-destructive'
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date)} initialFocus />
                        </PopoverContent>
                    </Popover>
                    )}
                />
                {formErrors.expiryDate && currentItemType === 'Expiry' && <p className="text-sm text-destructive mt-1">{formErrors.expiryDate.message}</p>}
                </div>
            </div>

            {quantityChanged && (
                <div className="space-y-4 pt-4 mt-4 border-t border-dashed">
                     <div className="flex items-center gap-3 text-sm font-semibold text-destructive">
                        <ShieldQuestion className="h-5 w-5" />
                        <p>Admin authorization is required to change quantity.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                             <Label htmlFor="authUsername">Local Admin Username</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="authUsername" {...register('authUsername')} className={cn('pl-8', formErrors.authUsername && 'border-destructive')} placeholder="Username" />
                              </div>
                            {formErrors.authUsername && <p className="text-sm text-destructive mt-1">{formErrors.authUsername.message}</p>}
                        </div>
                         <div>
                             <Label htmlFor="authPassword">Local Admin Password</Label>
                              <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="authPassword" type="password" {...register('authPassword')} className={cn('pl-8', formErrors.authPassword && 'border-destructive')} placeholder="Password" />
                              </div>
                            {formErrors.authPassword && <p className="text-sm text-destructive mt-1">{formErrors.authPassword.message}</p>}
                        </div>
                    </div>
                </div>
            )}
          
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton isPending={isActionPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
