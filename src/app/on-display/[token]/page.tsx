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
  LogOut,
  Sparkles,
  ArrowRight,
  Database,
  Activity,
  UserCheck
} from 'lucide-react';

import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Card } from '@/components/ui/card';
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
          title: 'Registry Link Established',
          description: `Authorized session for ${res.data.length} identifying batches.`,
        });
      } else {
        setErrorMessage(res.message || 'Access Key Invalid.');
      }
    } catch {
      setErrorMessage('Protocol timeout. Verify connection.');
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
          title: 'Adjustment Registered',
          description: `Sync request for ${item.productName} has been queued.`,
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
        toast({ variant: 'destructive', title: 'Session Error', description: "Registry finalization failed." });
      }
    });
  };

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.05]" />
        <Card className="relative z-10 w-full max-w-sm overflow-hidden border-none bg-transparent shadow-none text-center animate-in fade-in zoom-in-95 duration-700">
          <div className="mb-10 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
                <Check className="h-12 w-12" strokeWidth={3} />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-tight mb-4">Protocol<br/>Success</h1>
          <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            All inventory adjustments were synchronized. This secure handshake has been terminated.
          </p>
          <div className="mt-12 p-6 rounded-[2rem] bg-card border border-border/50 text-left shadow-lg">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Encrypted Link Expired</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.08]" />
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-primary/50 to-primary" />
        
        <div className="relative z-10 w-full max-w-sm space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-6">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary border-2 border-primary/20 shadow-inner">
                <LockKeyhole className="h-9 w-9" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Security Gate</h1>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-60">Identity Handshake Required</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Mobile Access Key</Label>
                <Badge variant="outline" className="h-5 border-primary/20 text-[8px] uppercase font-black text-primary">4-Digit PIN</Badge>
              </div>
              <div className="relative group">
                <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
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
                    "h-20 w-full rounded-[2rem] border-none bg-muted/50 pl-16 pr-4 text-center text-4xl font-black tracking-[0.6em] transition-all focus:bg-muted/80 focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/10",
                    errorMessage && "bg-destructive/5 ring-4 ring-destructive/10"
                  )}
                />
              </div>
              {errorMessage ? (
                <div className="flex items-center justify-center gap-2 text-destructive animate-in shake-1 duration-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{errorMessage}</p>
                </div>
              ) : (
                <p className="text-[9px] text-muted-foreground text-center font-bold opacity-40 uppercase tracking-widest leading-relaxed">
                  Enter the unique key dispatched<br/>to your authorized mobile terminal
                </p>
              )}
            </div>

            <Button
              onClick={handleVerify}
              disabled={accessKey.length < 4 || isVerifying}
              className="h-16 w-full rounded-[2rem] text-xs font-black uppercase tracking-[0.25em] shadow-2xl shadow-primary/20 active:scale-[0.98] transition-all border-none bg-primary hover:bg-primary/90"
            >
              {isVerifying ? <Loader2 className="h-6 w-6 animate-spin" /> : "Verify Identity"}
            </Button>
          </div>

          <div className="pt-8 text-center">
            <div className="flex items-center justify-center gap-3 opacity-20">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[8px] font-black uppercase tracking-[0.5em]">SheetSync Secured Node</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = displayItems[selectedItemIndex];
  const isCurrentItemSynced = syncedItemIds.has(currentItem?.id);

  return (
    <div className="min-h-screen bg-background pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="absolute inset-0 bg-tech-grid opacity-[0.04] pointer-events-none" />

      {/* ADVANCED HEADER */}
      <header className="sticky top-0 z-40 border-b bg-background/80 px-4 py-4 backdrop-blur-2xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 ring-4 ring-primary/10">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black uppercase tracking-tight text-foreground leading-none mb-1.5">Personnel Terminal</h2>
              <div className="flex items-center gap-2">
                 <Badge className="h-5 shrink-0 bg-emerald-500 text-white border-none px-2 text-[8px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/10">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />Live Session
                 </Badge>
                 <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Handshake Active</span>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleFinalize} 
            disabled={isFinalizing}
            className="h-10 px-4 rounded-xl border border-destructive/10 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 active:scale-95 transition-all"
          >
            {isFinalizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3.5 w-3.5 mr-2" />}
            Finalize Session
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl space-y-6 px-4 py-6 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:space-y-10 sm:px-6">
        
        {/* ASSET SUMMARY TERMINAL */}
        <Card className="overflow-hidden rounded-[2.5rem] border-none bg-card shadow-2xl shadow-black/[0.04] ring-1 ring-border/50">
          <div className="p-6 sm:p-10">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="relative h-20 w-20 shrink-0 mx-auto sm:mx-0">
                <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-xl" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-muted text-primary border border-white/5">
                  <Package className="h-10 w-10" />
                </div>
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 mb-3">Registry Identification</p>
                <h3 className="text-2xl font-black leading-tight text-foreground sm:text-4xl tracking-tighter">{currentItem?.productName}</h3>
                <div className="mt-5 flex flex-wrap justify-center sm:justify-start gap-2.5">
                  <Badge variant="outline" className="font-mono text-[10px] h-8 bg-muted/50 border-border/50 px-3 flex gap-2">
                    <Barcode className="h-3 w-3 text-primary" />
                    {currentItem?.barcode}
                  </Badge>
                  <Badge className="text-[9px] h-8 font-black uppercase tracking-widest bg-primary/5 text-primary border-none px-3">
                    {currentItem?.itemType} Batch
                  </Badge>
                </div>
              </div>
            </div>

            <Separator className="bg-border/30 mb-8" />

            <div className="grid grid-cols-2 gap-4 sm:gap-8">
              <div className="rounded-[1.75rem] border border-border/50 bg-muted/20 p-5">
                <div className="flex items-center gap-2.5 text-muted-foreground/50 mb-3">
                  <Layers className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Active Quantity</span>
                </div>
                <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter leading-none">
                  {currentItem?.quantity} <span className="text-xs opacity-30 font-bold uppercase tracking-widest ml-1">Units</span>
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-border/50 bg-muted/20 p-5">
                <div className="flex items-center gap-2.5 text-muted-foreground/50 mb-3">
                  <Clock3 className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Critical Threshold</span>
                </div>
                <p className="text-sm font-black text-foreground uppercase tracking-tight leading-none pt-2">
                    {currentItem?.expiryLabel || 'NO DATA'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* BATCH SELECTOR HUB */}
        {items.length > 1 && (
            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">Identify Target Batch</h3>
                  </div>
                  <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded-full">{syncedItemIds.size} / {items.length} COMPLETE</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {items.map((it, idx) => {
                    const isSynced = syncedItemIds.has(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => handleSelectBatch(idx)}
                        className={cn(
                          "group relative overflow-hidden rounded-[2rem] border-2 p-5 text-left transition-all active:scale-[0.97]",
                          selectedItemIndex === idx
                            ? "border-primary bg-primary text-primary-foreground shadow-2xl shadow-primary/20"
                            : isSynced 
                                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-900" 
                                : "border-border/60 bg-card text-foreground shadow-lg hover:border-primary/30"
                        )}
                      >
                        <div className="relative z-10 flex items-center justify-between gap-4">
                          <div className="min-w-0 flex items-center gap-4">
                            <div className={cn(
                                "flex h-11 w-11 items-center justify-center rounded-[1rem] shadow-sm shrink-0",
                                selectedItemIndex === idx ? "bg-white/20" : isSynced ? "bg-emerald-500 text-white" : "bg-muted/80 text-muted-foreground"
                            )}>
                               {isSynced ? <Check className="h-6 w-6" strokeWidth={3} /> : <Box className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black uppercase tracking-tight leading-none mb-1.5">{it.productName}</p>
                              <p className={cn(
                                "font-mono text-[10px] font-bold",
                                selectedItemIndex === idx ? "text-white/60" : "text-muted-foreground/60"
                              )}>
                                QTY {it.quantity} • {it.expiryDate ? format(parseISO(it.expiryDate), 'dd MMM') : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={cn("h-5 w-5 transition-transform", selectedItemIndex === idx ? "translate-x-1" : "opacity-10 group-hover:opacity-30")} />
                        </div>
                        {selectedItemIndex === idx && (
                            <div className="absolute top-2 right-2">
                                <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                      </button>
                    );
                  })}
                </div>
            </section>
        )}

        {/* REGISTRY SYNCHRONIZER */}
        <section className="space-y-5">
          <div className="px-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">Registry Adjustment</h3>
            </div>
            {isCurrentItemSynced && (
              <Badge className="bg-emerald-500 text-white text-[8px] font-black uppercase h-6 px-3 border-none shadow-lg shadow-emerald-500/10">
                <Check className="h-2.5 w-2.5 mr-1.5" strokeWidth={3} /> Synced Batch
              </Badge>
            )}
          </div>

          <Card className="rounded-[3rem] border-none bg-card shadow-2xl shadow-black/[0.04] ring-1 ring-border/50 overflow-hidden">
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded-[2.5rem]">
                <button
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    "h-14 rounded-[2.2rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'edit' ? "bg-card text-primary shadow-xl ring-1 ring-black/5" : "text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  Adjust Count
                </button>
                <button
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    "h-14 rounded-[2.2rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'delete' ? "bg-card text-destructive shadow-xl ring-1 ring-black/5" : "text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  Log Removal
                </button>
              </div>
            </div>

            <div className="space-y-8 p-8 pt-4 sm:p-12 sm:pt-6">
              {requestType === 'edit' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Shelf Count Observed</Label>
                    <div className="relative group">
                      <Hash className="absolute left-6 top-1/2 -translate-y-1/2 h-7 w-7 text-primary/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-20 rounded-[2rem] border-none bg-muted/30 pl-16 text-4xl font-black focus:ring-8 focus:ring-primary/5 transition-all tabular-nums text-foreground shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="on-display-location" className="ml-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Zone</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-6 top-1/2 z-10 h-6 w-6 -translate-y-1/2 text-primary/30" />
                      <select
                        id="on-display-location"
                        value={loc}
                        onChange={(e) => setLoc(e.target.value)}
                        className="h-16 w-full appearance-none rounded-[1.75rem] border-none bg-muted/30 py-0 pl-16 pr-8 text-sm font-black uppercase tracking-widest text-foreground outline-none focus:ring-8 focus:ring-primary/5 transition-all shadow-inner"
                      >
                        {availableLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-6 top-1/2 h-5 w-5 -translate-y-1/2 rotate-90 text-muted-foreground/30" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-10 rounded-[2.5rem] bg-destructive/[0.02] border-2 border-dashed border-destructive/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col items-center text-center gap-6">
                    <div className="h-20 w-20 shrink-0 flex items-center justify-center rounded-[2rem] bg-destructive/10 text-destructive shadow-lg shadow-destructive/5">
                      <AlertTriangle className="h-10 w-10" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-xl font-black uppercase tracking-tight text-destructive">Removal Protocol</p>
                      <p className="mt-3 text-xs font-bold leading-relaxed text-destructive/50 max-w-[240px] uppercase tracking-widest">
                        Initialize only if the SKU is absent from the shelf or requires immediate purging.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "h-20 w-full rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-2xl transition-all active:scale-[0.98] border-none",
                  requestType === 'delete' 
                    ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" 
                    : "bg-primary hover:bg-primary/90 shadow-primary/20"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <SendHorizontal className="h-6 w-6" strokeWidth={3} />
                    {isCurrentItemSynced ? "Update Registry Request" : "Dispatch Sync Request"}
                  </div>
                )}
              </Button>
            </div>
          </Card>
        </section>

        {/* GUIDANCE HUB */}
        <div className="p-8 bg-card border border-border/50 rounded-[2.5rem] flex items-start gap-6 shadow-xl shadow-black/[0.02]">
           <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
             <Info className="h-6 w-6 text-primary" />
           </div>
           <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">Operational Guidance</p>
              <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                Process each batch sequentially. Once all identified shelf adjustments are complete, click <span className="text-primary font-black">FINALIZE SESSION</span> to secure the registry link.
              </p>
           </div>
        </div>

        <div className="flex items-center justify-center gap-8 pt-10 px-4">
          <div className="h-px flex-1 bg-border/50" />
          <div className="flex items-center gap-3 opacity-20 group">
            <ShieldCheck className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-[0.6em]">Registry Secured</span>
          </div>
          <div className="h-px flex-1 bg-border/50" />
        </div>
      </main>
      
      {/* MOBILE PERSISTENT PROGRESS BAR */}
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-3xl border-t border-border/50">
         <div className="mx-auto max-w-sm flex items-center justify-between gap-6">
            <div className="min-w-0 flex items-center gap-4">
               <div className="relative h-12 w-12 flex items-center justify-center">
                  <svg className="h-12 w-12 rotate-[-90deg]">
                    <circle cx="24" cy="24" r="20" className="stroke-muted fill-none" strokeWidth="4" />
                    <circle 
                      cx="24" cy="24" r="20" 
                      className="stroke-primary fill-none transition-all duration-1000" 
                      strokeWidth="4" 
                      strokeDasharray={125.6}
                      strokeDashoffset={125.6 - (125.6 * syncedItemIds.size) / items.length}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{Math.round((syncedItemIds.size / items.length) * 100)}%</span>
               </div>
               <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">Session Progress</p>
                  <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{syncedItemIds.size} / {items.length} Batches Synced</p>
               </div>
            </div>
            <Button 
                onClick={handleFinalize} 
                disabled={isFinalizing || syncedItemIds.size === 0}
                className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-500/20 disabled:opacity-30 disabled:grayscale transition-all"
            >
                {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize & Exit"}
            </Button>
         </div>
      </div>
    </div>
  );
}
