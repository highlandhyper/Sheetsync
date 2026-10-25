'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Edit,
  Loader2,
  Mail,
  PlusCircle,
  Save,
  Search,
  Smartphone,
  X,
  ShieldAlert,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { editSupplierSchema, type EditSupplierFormValues } from '@/lib/schemas';
import { saveProductAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/lib/types';

interface QuickSupplierEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickSupplierEditDialog({
  isOpen,
  onOpenChange,
}: QuickSupplierEditDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { supplierContacts, products, updateSupplier, refreshData } = useDataCache();

  const [isActionPending, startActionTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [matchedSupplier, setMatchedSupplier] = useState<Supplier | null>(null);
  const [isSyncWarningOpen, setIsSyncWarningOpen] = useState(false);
  const [stagedData, setStagedData] = useState<EditSupplierFormValues | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditSupplierFormValues>({
    resolver: zodResolver(editSupplierSchema),
  });

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setMatchedSupplier(null);
      setStagedData(null);
      setIsSyncWarningOpen(false);
      reset();
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isOpen, reset]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const termLower = term.toLowerCase().trim();

    if (!termLower) {
      setMatchedSupplier(null);
      return;
    }

    // 1. Search in contact registry
    const match = supplierContacts.find(
      (s) =>
        s.name.toLowerCase().includes(termLower) ||
        s.supplierCode?.toLowerCase() === termLower
    );

    if (match) {
      setMatchedSupplier(match);
      reset({
        supplierId: match.id,
        currentSupplierName: match.name,
        newSupplierName: match.name,
        supplierCode: match.supplierCode || '',
        email: match.email || '',
        phone: match.phone || '',
      });
    } else {
      // 2. Search in product catalog for un-registered names
      const catalogMatch = products.find(p => p.supplierName?.toLowerCase().includes(termLower));
      if (catalogMatch && catalogMatch.supplierName) {
          setMatchedSupplier({
              id: '', // Empty ID signifies it needs registration
              name: catalogMatch.supplierName,
              lastReportValue: 0
          });
          reset({
              supplierId: '',
              currentSupplierName: catalogMatch.supplierName,
              newSupplierName: catalogMatch.supplierName,
              supplierCode: '',
              email: '',
              phone: ''
          });
      } else {
          setMatchedSupplier(null);
      }
    }
  };

  const onFormSubmit = (data: EditSupplierFormValues) => {
    if (!matchedSupplier) return;

    if (data.newSupplierName.trim() !== matchedSupplier.name.trim()) {
      setStagedData(data);
      setIsSyncWarningOpen(true);
      return;
    }

    executeSave(data);
  };

  const executeSave = async (data: EditSupplierFormValues) => {
    if (!matchedSupplier) return;

    startActionTransition(async () => {
      try {
        await updateSupplier(matchedSupplier.id, matchedSupplier.name, data.newSupplierName, {
          supplierCode: data.supplierCode,
          email: data.email,
          phone: data.phone,
        });
        toast({ title: 'Registry Synchronized', description: 'Vendor data updated.' });
        onOpenChange(false);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Sync Failure', description: 'Handshake failed.' });
      }
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[92dvh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl sm:max-w-lg sm:rounded-3xl"
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          {/* Header */}
          <div className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
            <DialogHeader className="relative text-left">
              <div className="flex items-start gap-3 pr-10">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold tracking-tight sm:text-xl uppercase">
                    Quick Supplier Edit
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs leading-5 sm:text-sm">
                    Maintain vendor identities and contact terminal nodes.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 h-9 w-9 rounded-xl text-muted-foreground hover:bg-background/80 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-5 p-4 sm:p-6">
              {/* Search section */}
              <section className="space-y-2">
                <Label htmlFor="quick-supplier-search" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Identify Node
                </Label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <Input
                    id="quick-supplier-search"
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="ENTER NAME OR CODE..."
                    className="h-12 rounded-xl border-border/60 bg-muted/20 pl-10 pr-10 text-sm font-black uppercase tracking-tight shadow-none focus-visible:bg-background placeholder:font-bold placeholder:text-muted-foreground/20"
                  />
                  {searchTerm && (
                    <Button variant="ghost" size="icon" onClick={() => handleSearch('')} className="absolute right-1.5 top-1/2 h-9 w-9">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </section>

              {matchedSupplier ? (
                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center font-black text-primary">
                        {matchedSupplier.name.slice(0,1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Selected Identity</span>
                            {matchedSupplier.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Badge variant="outline" className="text-[7px] font-black uppercase px-1 h-3.5">New Registry</Badge>}
                        </div>
                        <h4 className="text-sm font-black uppercase truncate">{matchedSupplier.name}</h4>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Company Identity</Label>
                        <Input {...register('newSupplierName')} className="h-11 font-bold bg-background border-border/60" />
                        {errors.newSupplierName && <p className="text-[10px] text-destructive font-black uppercase">{errors.newSupplierName.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Vendor Code</Label>
                            <Input {...register('supplierCode')} className="h-11 font-black uppercase bg-background border-border/60" placeholder="142" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">SMS Node</Label>
                            <Input {...register('phone')} className="h-11 font-bold bg-background border-border/60" placeholder="+974 XXXXXXXX" required />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Dispatch Email (Optional)</Label>
                        <Input type="email" {...register('email')} className="h-11 font-bold bg-background border-border/60" placeholder="vendor@domain.com" />
                    </div>
                  </div>

                  <Button type="submit" disabled={isActionPending} className="h-14 w-full rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/10 transition-all active:scale-[0.98]">
                    {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save & Sync Registry
                  </Button>
                </form>
              ) : searchTerm ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
                  <div className="bg-muted/40 p-4 rounded-xl mb-3">
                    <Building className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-widest">No Node Identified</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">No registry or catalog match for term: <span className="text-primary font-bold">{searchTerm}</span></p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/5 py-10 text-center opacity-40">
                  <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Identification</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-4 py-3 sm:px-6">
            <p className="hidden text-[10px] font-medium text-muted-foreground sm:block">
              Changes sync to the product catalog
            </p>

            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="ml-auto h-9 rounded-xl px-4 text-xs font-semibold text-muted-foreground"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncWarningOpen} onOpenChange={setIsSyncWarningOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-3xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary font-black uppercase tracking-tight">
                    <ShieldAlert className="h-6 w-6" />
                    Confirm Global Rename
                </DialogTitle>
                <DialogDescription className="pt-2 text-sm leading-relaxed font-medium">
                    Registry rename detected: <span className="text-primary font-black">{matchedSupplier?.name}</span> → <span className="text-primary font-black">{stagedData?.newSupplierName}</span>.
                    <br /><br />
                    This protocol will ripple through all database nodes including the Product Catalog and Historical Logs.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4 flex gap-2">
                <Button variant="ghost" onClick={() => setIsSyncWarningOpen(false)} className="font-bold h-12 flex-1">Abort</Button>
                <Button onClick={() => { setIsSyncWarningOpen(false); if (stagedData) executeSave(stagedData); }} className="h-12 flex-[2] font-black uppercase tracking-widest text-[10px] bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                    Sync All Registry Nodes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
