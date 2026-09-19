'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  verifyOnDisplayTokenAction,
  submitOnDisplayRequestAction,
  finalizeOnDisplaySessionAction,
} from '@/app/actions';
import type { InventoryItem } from '@/lib/types';

import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  MapPin,
  Package,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Layers,
  Hash,
  Clock3,
  Check,
  ChevronRight,
  Info,
  X,
  History,
  Box,
  LogOut
} from 'lucide-react';

import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  Card,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const DEFAULT_ON_DISPLAY_LOCATIONS = ['On Display', 'Front Side', 'Back side'];

export default function OnDisplayStaffPage() {
  const params = useParams();
  const token = params?.token as string;
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [isFinalizing, startFinalizingTransition] = useTransition();
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [syncedItemIds, setSyncedItemIds] = useState<Set<string>>(new Set());

  const [accessKey, setAccessKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [qty, setQty] = useState<number>(0);
  const [loc, setLoc] = useState('');
  const [requestType, setRequestType] = useState<'edit' | 'delete'>('edit');

  const availableLocations = useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_ON_DISPLAY_LOCATIONS,
      ...items.map(i => i.location).filter(Boolean)
    ]));
  }, [items]);

  const displayItems = useMemo(() => items.map(item => ({
    ...item,
    expiryLabel: item.expiryDate && isValid(parseISO(item.expiryDate))
      ? format(parseISO(item.expiryDate), 'dd MMM yyyy')
      : 'No expiry',
  })), [items]);

  const handleVerify = async () => {
    if (!accessKey || accessKey.length < 4) return;

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await verifyOnDisplayTokenAction(token, accessKey);

      if (res.success && res.data && res.data.length > 0) {
        setItems(res.data);
        const first = res.data[0];
        setQty(first.quantity);
        setLoc(first.location);
        setIsVerified(true);

        toast({
          title: 'Identity Confirmed',
          description: `Registry session authorized for ${res.data.length} batches.`,
        });
      } else {
        setErrorMessage(res.message || 'Invalid Access Key.');
      }
    } catch {
      setErrorMessage('Handshake timeout. Check connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectBatch = (index: number) => {
    setSelectedItemIndex(index);
    const item = items[index];
    setQty(item.quantity);
    setLoc(item.location);
    setRequestType('edit');
  };

  const handleSubmit = async () => {
    const item = items[selectedItemIndex];
    if (!item) return;

    startTransition(async () => {
      const res = await submitOnDisplayRequestAction(token, accessKey, {
        editDetails: {
          itemId: item.id,
          productName: item.productName,
          quantity: qty,
          location: loc,
          itemType: item.itemType,
          expiryDate: item.expiryDate,
          requestType,
        },
      });

      if (res.success) {
        setSyncedItemIds(prev => new Set(prev).add(item.id));
        toast({
          title: 'Batch Synchronized',
          description: `Update for ${item.productName} dispatched.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Blocked',
          description: res.message,
        });
      }
    });
  };

  const handleFinalize = async () => {
    startFinalizingTransition(async () => {
      try {
        const res = await finalizeOnDisplaySessionAction(token);
        if (res.success) {
          setSuccess(true);
        } else {
          toast({ variant: 'destructive', title: 'Session Error', description: res.message });
        }
      } catch {
        toast({ variant: 'destructive', title: 'Session Error', description: "Failed to finalize session." });
      }
    });
  };

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.05]" />
        <Card className="relative z-10 w-full max-w-sm overflow-hidden border-none bg-transparent shadow-none text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase leading-none">Protocol Finalized</h1>
          <p className="mt-4 text-sm font-medium text-muted-foreground leading-relaxed">
            All inventory adjustments have been successfully dispatched. This authorization link has been terminated.
          </p>
          <div className="mt-10 p-6 rounded-3xl bg-white border border-border/50 text-left shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registry Handshake Terminated</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12 overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.08]" />
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/20" />
        
        <div className="relative z-10 w-full max-w-sm space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-5">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-primary/10 text-primary shadow-sm border border-primary/20 rotate-3">
              <LockKeyhole className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Security Gate</h1>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Identity Verification Required</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">SMS Access Key</Label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value.replace(/\D/g, ''));
                    setErrorMessage('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  className={cn(
                    "h-16 w-full rounded-2xl border-none bg-slate-100 pl-14 pr-4 text-center text-3xl font-black tracking-[0.6em] transition-all focus:bg-slate-200 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/20",
                    errorMessage && "bg-destructive/5 ring-2 ring-destructive/20"
                  )}
                />
              </div>
              {errorMessage ? (
                <p className="text-[10px] font-bold text-destructive text-center uppercase tracking-widest">{errorMessage}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center font-medium opacity-50 uppercase tracking-widest">Enter the 4-digit key from your SMS</p>
              )}
            </div>

            <Button
              onClick={handleVerify}
              disabled={accessKey.length < 4 || isVerifying}
              className="h-16 w-full rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all"
            >
              {isVerifying ? <Loader2 className="h-6 w-6 animate-spin" /> : "Establish Handshake"}
            </Button>
          </div>

          <div className="pt-8 text-center border-t border-border/50">
            <div className="flex items-center justify-center gap-2 text-muted-foreground/40">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[8px] font-black uppercase tracking-[0.4em]">SheetSync Secure Node v7.0</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = displayItems[selectedItemIndex];
  const isCurrentItemSynced = syncedItemIds.has(currentItem?.id);

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />

      {/* STICKY HEADER */}
      <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black uppercase tracking-tight text-foreground leading-none mb-1">Personnel Portal</h2>
              <div className="flex items-center gap-2">
                 <Badge variant="outline" className="h-5 shrink-0 border-emerald-500/20 bg-emerald-500/5 px-1.5 text-[7px] font-black uppercase tracking-widest text-emerald-600 shadow-none">
                    <span className="mr-1 h-1 w-1 rounded-full bg-emerald-500" />Verified
                 </Badge>
                 <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">v7.0 Registry Node</span>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleFinalize} 
            disabled={isFinalizing}
            className="h-9 rounded-xl border border-destructive/10 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5"
          >
            {isFinalizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Finalize Session</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl space-y-5 px-4 py-6 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:space-y-8 sm:px-6">
        {/* PRODUCT SUMMARY CARD */}
        <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-xl shadow-black/[0.03] ring-1 ring-border/50">
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex items-start gap-4 sm:mb-8 sm:gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-slate-100 text-primary sm:h-20 sm:w-20">
                <Package className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 mb-2">Asset Identity</p>
                <h3 className="text-xl font-black leading-tight text-foreground sm:text-3xl tracking-tight">{currentItem?.productName}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] h-7 bg-slate-50 border-slate-200 px-2.5">{currentItem?.barcode}</Badge>
                  <Badge variant="secondary" className="text-[9px] h-7 font-black uppercase tracking-widest bg-primary/5 text-primary border-none px-2.5">
                    {currentItem?.itemType}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-100 mb-6" />

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                  <Layers className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Current Stock</span>
                </div>
                <p className="text-2xl font-black text-foreground tabular-nums">{currentItem?.quantity} <span className="text-[10px] opacity-40 font-bold uppercase">Units</span></p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                  <Clock3 className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Batch Threshold</span>
                </div>
                <p className="text-sm font-black text-foreground uppercase tracking-tight">
                    {currentItem?.expiryLabel || 'NO DATA'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* BATCH SELECTOR (Only if multiple) */}
        {items.length > 1 && (
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Select Targeted Batch</h3>
                  <span className="text-[10px] font-black text-primary uppercase">{syncedItemIds.size} / {items.length} COMPLETED</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((it, idx) => {
                    const isSynced = syncedItemIds.has(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => handleSelectBatch(idx)}
                        className={cn(
                          "group relative overflow-hidden rounded-[1.25rem] border-2 p-4 text-left transition-all active:scale-[0.98]",
                          selectedItemIndex === idx
                            ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                            : isSynced 
                                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-900" 
                                : "border-white bg-white text-foreground shadow-sm hover:border-slate-200"
                        )}
                      >
                        <div className="relative z-10 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-3">
                            <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm shrink-0",
                                selectedItemIndex === idx ? "bg-white/20" : isSynced ? "bg-emerald-500 text-white" : "bg-slate-100 text-muted-foreground"
                            )}>
                               {isSynced ? <Check className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black uppercase tracking-tight">{it.productName}</p>
                              <p className={cn(
                                "mt-0.5 font-mono text-[10px] font-bold",
                                selectedItemIndex === idx ? "text-white/80" : "text-muted-foreground"
                              )}>
                                Qty {it.quantity} • {it.expiryDate ? format(parseISO(it.expiryDate), 'dd MMM yy') : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={cn("h-5 w-5 opacity-20 group-hover:opacity-40", selectedItemIndex === idx && "opacity-100")} />
                        </div>
                        {selectedItemIndex === idx && (
                            <div className="absolute top-0 right-0 p-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                      </button>
                    );
                  })}
                </div>
            </section>
        )}

        {/* REGISTRY ADJUSTMENT FORM */}
        <section className="space-y-4">
          <div className="px-1 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Registry Adjustment</h3>
            <div className="flex items-center gap-2">
                 {isCurrentItemSynced && <Badge className="bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase h-5 border-none"><Check className="h-2 w-2 mr-1" /> Synced Batch</Badge>}
            </div>
          </div>

          <Card className="rounded-[2.5rem] border-none bg-white shadow-xl shadow-black/[0.03] ring-1 ring-border/50 overflow-hidden">
            <div className="p-2">
              <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-[2.2rem]">
                <button
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    "h-14 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'edit' ? "bg-white text-primary shadow-md" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  Edit Record
                </button>
                <button
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    "h-14 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'delete' ? "bg-white text-destructive shadow-md" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  Log Removal
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6 pt-2 sm:space-y-8 sm:p-10 sm:pt-4">
              {requestType === 'edit' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Physical Count Observed</Label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/30 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-16 rounded-3xl border-none bg-slate-50 pl-14 text-3xl font-black focus:ring-4 focus:ring-primary/10 transition-all tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="on-display-location" className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operating Zone</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-6 w-6 -translate-y-1/2 text-primary/30" />
                      <select
                        id="on-display-location"
                        value={loc}
                        onChange={(e) => setLoc(e.target.value)}
                        className="h-16 w-full appearance-none rounded-3xl border-none bg-slate-50 py-0 pl-14 pr-6 text-base font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-none"
                      >
                        {availableLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 rotate-90 text-muted-foreground/30" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-[2rem] bg-destructive/[0.03] border-2 border-destructive/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-5">
                    <div className="h-14 w-14 shrink-0 flex items-center justify-center rounded-[1.5rem] bg-destructive/10 text-destructive shadow-sm">
                      <AlertTriangle className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-base font-black uppercase tracking-tight text-destructive">Removal Protocol</p>
                      <p className="mt-2 text-xs font-medium leading-relaxed text-destructive/70">
                        Proceed only if this SKU is physically absent from the shelf or requires immediate removal from the active registry.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "h-16 w-full rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl transition-all active:scale-[0.98] border-none",
                  requestType === 'delete' 
                    ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" 
                    : "bg-primary hover:bg-primary/90 shadow-primary/20"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <SendHorizontal className="mr-3 h-5 w-5" />
                    {isCurrentItemSynced ? "Update Registry Request" : "Dispatch Sync Request"}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </section>

        {/* GUIDANCE NODE */}
        <div className="p-6 bg-white border border-border/50 rounded-[2rem] flex items-start gap-4 shadow-sm">
           <Info className="h-5 w-5 text-primary mt-1 shrink-0 opacity-50" />
           <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Operational Protocol</p>
              <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                You may update multiple batches sequentially. After all identified batches are synchronized, ensure you finalize the session using the button in the header.
              </p>
           </div>
        </div>

        <div className="flex items-center justify-center gap-8 pt-8">
          <div className="h-px flex-1 bg-slate-200" />
          <div className="flex items-center gap-3 opacity-30">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-[9px] font-black uppercase tracking-[0.5em]">Identity Secured</span>
          </div>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      </main>
      
      {/* MOBILE PERSISTENT STATUS BAR */}
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white/80 backdrop-blur-xl border-t border-border/50 md:hidden">
         <div className="mx-auto max-w-sm flex items-center justify-between gap-4">
            <div className="min-w-0">
               <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Session Progress</p>
               <p className="text-xs font-black text-foreground">{syncedItemIds.size} / {items.length} BATCHES DONE</p>
            </div>
            <Button 
                onClick={handleFinalize} 
                disabled={isFinalizing || syncedItemIds.size === 0}
                className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-emerald-500/20 disabled:opacity-40"
            >
                {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize & Exit"}
            </Button>
         </div>
      </div>
    </div>
  );
}
