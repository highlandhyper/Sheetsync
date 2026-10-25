
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Hash, Mail, Phone, ExternalLink, ShieldAlert, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { editSupplierSchema, type EditSupplierFormValues } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { Separator } from '../ui/separator';
import { sendManualSupplierReportAction } from '@/app/actions';

export function EditSupplierDialog({ isOpen, onOpenChange, supplier }: { isOpen: boolean, onOpenChange: (open: boolean) => void, supplier: Supplier | null }) {
  const { toast } = useToast();
  const { updateSupplier } = useDataCache();
  const [isActionPending, startActionTransition] = useTransition();
  const [isReporting, setIsReporting] = useState(false);
  const [isSyncWarningOpen, setIsSyncWarningOpen] = useState(false);
  const [stagedData, setStagedData] = useState<EditSupplierFormValues | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isDirty },
  } = useForm<EditSupplierFormValues>({
    resolver: zodResolver(editSupplierSchema),
  });
  
  useEffect(() => {
    if (supplier && isOpen) {
      reset({
        supplierId: supplier.id,
        currentSupplierName: supplier.name,
        newSupplierName: supplier.name,
        supplierCode: supplier.supplierCode || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
      });
    }
  }, [supplier, reset, isOpen]);

  const handleDispatchReport = async () => {
    if (!supplier) return;
    setIsReporting(true);
    try {
        const res = await sendManualSupplierReportAction(supplier.name);
        if (res.success) {
            toast({ title: 'Report Dispatched', description: `Manual email report sent to ${supplier.name}.` });
        } else {
            toast({ variant: 'destructive', title: 'Dispatch Error', description: res.message || 'The vendor has no new logs.' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Handshake Error', description: 'Communication with registry failed.' });
    } finally {
        setIsReporting(false);
    }
  };

  const handleFormSubmit = (data: EditSupplierFormValues) => {
    if (!supplier) return;

    if (data.newSupplierName.trim() !== supplier.name.trim()) {
        setStagedData(data);
        setIsSyncWarningOpen(true);
        return;
    }

    executeSave(data);
  };

  const executeSave = async (data: EditSupplierFormValues) => {
      if (!supplier) return;
      
      startActionTransition(async () => {
          try {
            await updateSupplier(supplier.id, supplier.name, data.newSupplierName, {
                supplierCode: data.supplierCode,
                email: data.email,
                phone: data.phone
            });
            toast({ title: 'Registry Synchronized', description: 'Vendor data and cascading name updates initiated.' });
            onOpenChange(false);
          } catch (e) {
              toast({ variant: 'destructive', title: 'Sync Failure', description: 'Could not connect to master registry.' });
          }
      });
  };
  
  if (!supplier) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] border-none shadow-3xl">
        <DialogHeader className="p-2">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Sync Registry Node</DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Manage identification codes and contact terminal nodes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-4 px-2">
          <div className="space-y-2">
            <Label htmlFor="newSupplierName" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Company Identity</Label>
            <Input id="newSupplierName" {...register('newSupplierName')} className="h-11 font-bold bg-muted/10" />
            {formErrors.newSupplierName && <p className="text-[10px] text-destructive font-bold">{formErrors.newSupplierName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplierCode" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Vendor Code</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                  <Input id="supplierCode" {...register('supplierCode')} className="h-11 font-black pl-9 bg-muted/10 uppercase" placeholder="142" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">SMS Node</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                  <Input id="phone" {...register('phone')} className="h-11 font-bold pl-9 bg-muted/10" placeholder="+974 XXXXXXXX" required />
                </div>
              </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Dispatch Email (Optional)</Label>
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input id="email" type="email" {...register('email')} className="h-11 font-bold pl-9 bg-muted/10" />
            </div>
          </div>

          <Separator className="my-4 opacity-50" />

          <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-primary/5 p-4 border border-primary/10 flex flex-col justify-between">
                  <div>
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Manual Report</p>
                      <p className="text-[8px] font-medium text-muted-foreground mt-1.5 leading-snug">Dispatch email report immediately.</p>
                  </div>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    disabled={isReporting || !supplier.email}
                    className="h-8 mt-4 font-black uppercase text-[8px] tracking-widest text-primary hover:bg-primary/5"
                    onClick={handleDispatchReport}
                  >
                      {isReporting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                      Dispatch Email
                  </Button>
              </div>

              <div className="rounded-xl bg-muted/20 p-4 border border-border/40 flex flex-col justify-between">
                  <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Portal Link</p>
                      <p className="text-[8px] font-medium text-muted-foreground/60 mt-1.5 leading-snug">Preview secure vendor portal.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 mt-4 font-black uppercase text-[8px] tracking-widest text-muted-foreground" asChild>
                      <a href={`/supplier-portal/${supplier.supplierCode}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" /> Open Portal
                      </a>
                  </Button>
              </div>
          </div>

          <DialogFooter className="pt-4 flex gap-2">
            <DialogClose asChild>
                <Button type="button" variant="ghost" className="font-bold">Discard</Button>
            </DialogClose>
            <Button type="submit" disabled={isActionPending} className="flex-1 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-lg shadow-primary/20 bg-primary text-primary-foreground">
                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sync Registry Node
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={isSyncWarningOpen} onOpenChange={setIsSyncWarningOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-3xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary font-black uppercase tracking-tight">
                    <ShieldAlert className="h-6 w-6" />
                    Confirm Global Rename
                </DialogTitle>
                <DialogDescription className="pt-2 text-sm leading-relaxed">
                    You are changing <span className="font-bold text-foreground">"{supplier?.name}"</span> to <span className="font-bold text-foreground">"{stagedData?.newSupplierName}"</span>.
                    <br /><br />
                    This is an industrial-level sync. The system will ripple this name across all product identities and log entries in the registry. 
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
                <Button variant="ghost" onClick={() => setIsSyncWarningOpen(false)} className="font-bold h-12 sm:flex-1">Abort</Button>
                <Button onClick={() => { setIsSyncWarningOpen(false); if (stagedData) executeSave(stagedData); }} className="h-12 sm:flex-[2] font-black uppercase tracking-widest text-[10px] bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                    Sync All Registry Nodes
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
