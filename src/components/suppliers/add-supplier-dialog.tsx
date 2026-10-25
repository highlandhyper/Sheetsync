
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2, Building, Hash, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addSupplierSchema, type AddSupplierFormValues } from '@/lib/schemas';
import { addSupplierAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';

export function AddSupplierDialog() {
  const { toast } = useToast();
  const { refreshData } = useDataCache();
  const [isOpen, setIsOpen] = useState(false);
  const [isActionPending, startActionTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors }, 
  } = useForm<AddSupplierFormValues>({
    resolver: zodResolver(addSupplierSchema),
    defaultValues: {
      supplierName: '',
      supplierCode: '',
      email: '',
      phone: '',
    }
  });
  
  const processFormSubmit = (data: AddSupplierFormValues) => {
    startActionTransition(async () => {
      const formData = new FormData();
      formData.append('supplierName', data.supplierName.trim());
      formData.append('supplierCode', data.supplierCode.trim());
      formData.append('phone', data.phone.trim());
      formData.append('email', data.email?.trim() || '');
      
      const res = await addSupplierAction(undefined, formData);
      if (res.success && res.data) {
          toast({ title: 'Success', description: 'Supplier and phone number saved.' });
          await refreshData();
          setIsOpen(false);
      } else {
          toast({ variant: 'destructive', title: 'Error', description: res.message || 'Could not save supplier.' });
      }
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-bold h-11">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] border-none shadow-3xl">
        <DialogHeader className="p-2">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Register Supplier</DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Establish a new vendor node with automated reporting.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-4 py-4 px-2">
          <div className="space-y-2">
            <Label htmlFor="supplierName" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Company Name</Label>
            <Input id="supplierName" {...register('supplierName')} className="h-11 font-bold bg-muted/10" placeholder="e.g. Global Provisions" />
            {formErrors.supplierName && <p className="text-[10px] text-destructive font-bold">{formErrors.supplierName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplierCode" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Vendor Code</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                  <Input id="supplierCode" {...register('supplierCode')} className="h-11 font-black pl-9 bg-muted/10 uppercase" placeholder="142 / V025" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                  <Input id="phone" {...register('phone')} className="h-11 font-bold pl-9 bg-muted/10" placeholder="+974 XXXXXXXX" required />
                </div>
              </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Weekly Report Email (Optional)</Label>
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input id="email" type="email" {...register('email')} className="h-11 font-bold pl-9 bg-muted/10" placeholder="vendor@domain.com (optional)" />
            </div>
            {formErrors.email && <p className="text-[10px] text-destructive font-bold">{formErrors.email.message}</p>}
          </div>

          <DialogFooter className="pt-4 flex gap-2">
            <DialogClose asChild>
                <Button type="button" variant="ghost" className="font-bold">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isActionPending} className="flex-1 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-lg shadow-primary/20">
                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building className="mr-2 h-4 w-4" />}
                Initiate Registration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
