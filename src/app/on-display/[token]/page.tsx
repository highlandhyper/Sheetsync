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
  UserCheck,
  Barcode,
  Trophy,
  Zap,
  ArrowUpRight,
  Edit,
  Trash2,
  ChevronsUpDown
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
          title: 'Identity Confirmed',
          description: `Registry terminal established for ${res.data.length} identifying nodes.`,
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
          title: 'Registry Updated',
          description: `Adjustment for ${item.productName} synced successfully.`,
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
      <div className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12 overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.05]" />
        <div className="relative z-10 w-full max-w-sm text-center animate-in fade-in zoom-in-95 duration-1000">
          <div className="mb-10 inline-flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/30 blur-3xl rounded-full" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-[3rem] bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30 border-4 border-emerald-400">
                <Check className="h-14 w-14" strokeWidth={4} />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none mb-6">Mission<br/>Complete</h1>
          <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-[280px] mx-auto mb-10 opacity-70">
            All inventory adjustments have been synchronized with the master registry. Your secure identity handshake is now terminated.
          </p>
          <div className="p-6 rounded-[2.5rem] bg-card/40 border border-border/40 text-left backdrop-blur-xl">
             <div className="flex items-center justify-between mb-4">
               <ShieldCheck className="h-5 w-5 text-emerald-500" />
               <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-none px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">Registry Secured</Badge>
             </div>
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
               Secure Terminal Log: {new Date().toLocaleTimeString()}
               <br/>Link Status: Expired & Cleared
             </p>
          </div>
          <Button 
            variant="ghost" 
            className="mt-10 text-[9px] font-black uppercase tracking-[0.4em] opacity-30 hover:opacity-100"
            onClick={() => window.close()}
          >
            Close Terminal
          </Button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-8 py-12 overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.08]" />
        
        {/* ATMOSPHERIC BLOOMS */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-sm space-y-14 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="text-center space-y-6">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-card border border-white/5 shadow-2xl">
                <LockKeyhole className="h-10 w-10 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none mb-2">Registry HUD</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-40">Identity Handshake Required</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Mobile Access Key</Label>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/5 rounded-[2.2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
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
                    "relative h-24 w-full rounded-[2.2rem] border-2 border-white/5 bg-muted/30 text-center text-5xl font-black tracking-[0.6em] transition-all backdrop-blur-xl focus:border-primary/30 focus:bg-muted/50 focus:ring-8 focus:ring-primary/5 placeholder:text-muted-foreground/10 outline-none tabular-nums",
                    errorMessage && "border-destructive/30 bg-destructive/5 ring-destructive/5"
                  )}
                />
              </div>
              
              {errorMessage ? (
                <div className="flex items-center justify-center gap-2 text-destructive animate-in shake-1 duration-200 bg-destructive/10 py-3 rounded-2xl border border-destructive/20">
                  <ShieldAlert className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{errorMessage}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 opacity-30 pt-2">
                  <div className="h-px w-8 bg-muted-foreground" />
                  <span className="text-[8px] font-black uppercase tracking-[0.4em]">One-Time Node Key</span>
                  <div className="h-px w-8 bg-muted-foreground" />
                </div>
              )}
            </div>

            <Button
              onClick={handleVerify}
              disabled={accessKey.length < 4 || isVerifying}
              className="h-20 w-full rounded-[2.2rem] text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/20 active:scale-[0.98] transition-all border-none bg-primary hover:bg-primary/90 text-primary-foreground group"
            >
              {isVerifying ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <div className="flex items-center gap-3">
                  Establish Session
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </div>

          <p className="text-[9px] text-muted-foreground text-center font-bold opacity-30 uppercase tracking-[0.4em] leading-relaxed">
            SheetSync Core • Secured Staff Portal v6.0
          </p>
        </div>
      </div>
    );
  }

  const currentItem = displayItems[selectedItemIndex];
  const isCurrentItemSynced = syncedItemIds.has(currentItem?.id);

  return (
    <div className="min-h-screen bg-background pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-tech-grid opacity-[0.04] pointer-events-none" />

      {/* TOP NAVIGATION HUD */}
      <header className="sticky top-0 z-40 border-b bg-background/80 px-5 py-5 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 border border-white/10 ring-4 ring-primary/5">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1.5">Personnel Session</h2>
              <div className="flex items-center gap-2">
                 <Badge className="h-5 shrink-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 text-[8px] font-black uppercase tracking-widest">
                    <span className="mr-1.5 h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />Active Handshake
                 </Badge>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleFinalize} 
            disabled={isFinalizing}
            className="h-10 px-4 rounded-xl border border-destructive/10 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 active:scale-95 transition-all shadow-none"
          >
            {isFinalizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3.5 w-3.5 mr-2" />}
            Log Out
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl space-y-6 px-5 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-10">
        
        {/* MAIN ASSET HUB */}
        <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Registry Identification</h3>
                <Badge variant="outline" className="text-[8px] font-black border-primary/10 bg-primary/5 text-primary tracking-widest uppercase">Target Node</Badge>
            </div>
            <Card className="overflow-hidden rounded-[2.5rem] border-none bg-card shadow-2xl shadow-black/[0.04] ring-1 ring-border/50">
            <div className="p-8 sm:p-10">
                <div className="mb-10 flex flex-col sm:flex-row sm:items-start gap-8">
                <div className="relative h-24 w-24 shrink-0 mx-auto sm:mx-0">
                    <div className="absolute inset-0 bg-primary/5 rounded-[2.5rem] blur-2xl" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-muted/50 text-primary border border-white/5 shadow-inner">
                    <Package className="h-12 w-12" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h3 className="text-3xl font-black leading-tight text-foreground sm:text-5xl tracking-tighter mb-4">{currentItem?.productName}</h3>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                    <Badge variant="outline" className="font-mono text-[11px] h-9 bg-muted/30 border-border/50 px-4 flex gap-2.5 rounded-xl shadow-none">
                        <Barcode className="h-3.5 w-3.5 text-primary" />
                        {currentItem?.barcode}
                    </Badge>
                    <Badge className="text-[9px] h-9 font-black uppercase tracking-widest bg-primary/10 text-primary border-none px-4 rounded-xl">
                        {currentItem?.itemType} Batch
                    </Badge>
                    </div>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="rounded-[2rem] border border-border/40 bg-muted/20 p-6 flex flex-col justify-between h-32 transition-all hover:bg-muted/30">
                    <div className="flex items-center gap-2.5 text-muted-foreground/40 mb-2">
                    <Layers className="h-4 w-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Volume Observed</span>
                    </div>
                    <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter leading-none">
                    {currentItem?.quantity} <span className="text-xs opacity-20 font-bold uppercase tracking-widest ml-1">Units</span>
                    </p>
                </div>
                <div className="rounded-[2rem] border border-border/40 bg-muted/20 p-6 flex flex-col justify-between h-32 transition-all hover:bg-muted/30">
                    <div className="flex items-center gap-2.5 text-muted-foreground/40 mb-2">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Threshold Expiry</span>
                    </div>
                    <p className="text-[13px] font-black text-foreground uppercase tracking-tight leading-none mb-1">
                        {currentItem?.expiryLabel || 'NO DATA'}
                    </p>
                </div>
                </div>
            </div>
            </Card>
        </section>

        {/* BATCH CONTROL HUB */}
        {items.length > 1 && (
            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">Select Active Node</h3>
                  </div>
                  <Badge variant="secondary" className="h-6 px-3 bg-muted font-black text-[9px] uppercase tracking-widest border-none">
                    {syncedItemIds.size} / {items.length} COMPLETED
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((it, idx) => {
                    const isSynced = syncedItemIds.has(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => handleSelectBatch(idx)}
                        className={cn(
                          "group relative overflow-hidden rounded-[2.2rem] border-2 p-6 text-left transition-all active:scale-[0.97]",
                          selectedItemIndex === idx
                            ? "border-primary bg-primary text-primary-foreground shadow-2xl shadow-primary/20 ring-4 ring-primary/5"
                            : isSynced 
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-400" 
                                : "border-border/60 bg-card text-foreground shadow-lg hover:border-primary/20 hover:bg-muted/10"
                        )}
                      >
                        <div className="relative z-10 flex items-center justify-between gap-4">
                          <div className="min-w-0 flex items-center gap-5">
                            <div className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm shrink-0 border border-white/5",
                                selectedItemIndex === idx ? "bg-white/20" : isSynced ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-muted text-muted-foreground"
                            )}>
                               {isSynced ? <Check className="h-7 w-7" strokeWidth={4} /> : <Box className="h-6 w-6" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black uppercase tracking-tight leading-none mb-2">{it.productName}</p>
                              <div className={cn(
                                "flex items-center gap-2.5 font-mono text-[10px] font-bold",
                                selectedItemIndex === idx ? "text-white/60" : "text-muted-foreground/60"
                              )}>
                                <span className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded uppercase">QTY {it.quantity}</span>
                                <span className="opacity-40">•</span>
                                <span className="uppercase">{it.expiryDate ? format(parseISO(it.expiryDate), 'dd MMM') : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                          <div className={cn(
                             "transition-all duration-300",
                             selectedItemIndex === idx ? "translate-x-1 scale-110 opacity-100" : "opacity-10 group-hover:opacity-30"
                          )}>
                             <ChevronRight className="h-6 w-6" />
                          </div>
                        </div>
                        {selectedItemIndex === idx && (
                            <div className="absolute top-3 right-3">
                                <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                      </button>
                    );
                  })}
                </div>
            </section>
        )}

        {/* COMMAND INPUT HUD */}
        <section className="space-y-5">
          <div className="px-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">Registry Adjustment</h3>
            </div>
            {isCurrentItemSynced && (
              <Badge className="bg-emerald-500 text-white text-[9px] font-black uppercase h-7 px-4 border-none shadow-xl shadow-emerald-500/20 rounded-full animate-in zoom-in-95">
                <Check className="h-3 w-3 mr-2" strokeWidth={4} /> Synced Batch
              </Badge>
            )}
          </div>

          <Card className="rounded-[3rem] border-none bg-card shadow-2xl shadow-black/[0.04] ring-1 ring-border/50 overflow-hidden group/form">
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 p-2 bg-muted/50 rounded-[2.5rem] border border-border/40">
                <button
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    "flex items-center justify-center gap-2 h-14 rounded-[2.2rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'edit' ? "bg-background text-primary shadow-xl ring-1 ring-black/5" : "text-muted-foreground/40 hover:text-foreground"
                  )}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Adjust Count
                </button>
                <button
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    "flex items-center justify-center gap-2 h-14 rounded-[2.2rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'delete' ? "bg-background text-destructive shadow-xl ring-1 ring-black/5" : "text-muted-foreground/40 hover:text-foreground"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Log Removal
                </button>
              </div>
            </div>

            <div className="space-y-10 p-10 pt-4 sm:p-14 sm:pt-6">
              {requestType === 'edit' ? (
                <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Shelf Count Observed</Label>
                        <Badge variant="outline" className="text-[8px] font-black h-5 border-primary/10">Manual Input</Badge>
                    </div>
                    <div className="relative group/input">
                      <Hash className="absolute left-7 top-1/2 -translate-y-1/2 h-8 w-8 text-primary/10 group-focus-within/input:text-primary transition-colors" />
                      <Input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-24 rounded-[2.5rem] border-none bg-muted/20 pl-20 text-5xl font-black focus:ring-8 focus:ring-primary/5 transition-all tabular-nums text-foreground shadow-inner placeholder:opacity-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="on-display-location" className="ml-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Operational Zone Mapping</Label>
                    <div className="relative group/select">
                      <MapPin className="pointer-events-none absolute left-7 top-1/2 z-10 h-6 w-6 -translate-y-1/2 text-primary/30 group-focus-within/select:text-primary transition-colors" />
                      <select
                        id="on-display-location"
                        value={loc}
                        onChange={(e) => setLoc(e.target.value)}
                        className="h-20 w-full appearance-none rounded-[2rem] border-none bg-muted/20 py-0 pl-20 pr-10 text-base font-black uppercase tracking-[0.15em] text-foreground outline-none focus:ring-8 focus:ring-primary/5 transition-all shadow-inner cursor-pointer"
                      >
                        {availableLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                      <ChevronsUpDown className="pointer-events-none absolute right-8 top-1/2 h-5 w-5 -translate-y-1/2 opacity-20" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-[3rem] bg-destructive/[0.03] border-4 border-dashed border-destructive/10 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex flex-col items-center text-center gap-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-destructive/20 blur-2xl rounded-full" />
                        <div className="relative h-24 w-24 shrink-0 flex items-center justify-center rounded-[2.5rem] bg-destructive/10 text-destructive border border-destructive/20 shadow-2xl">
                          <AlertTriangle className="h-12 w-12" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div>
                      <p className="text-2xl font-black uppercase tracking-tight text-destructive mb-3">Removal Protocol</p>
                      <p className="text-[11px] font-bold leading-relaxed text-destructive/40 max-w-[260px] uppercase tracking-widest">
                        Initialize only if the SKU is absent from the designated shelf area or requires immediate registry purging.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "h-24 w-full rounded-[2.5rem] text-sm font-black uppercase tracking-[0.4em] shadow-2xl transition-all active:scale-[0.98] border-none",
                  requestType === 'delete' 
                    ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" 
                    : "bg-primary hover:bg-primary/90 shadow-primary/20"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : (
                  <div className="flex items-center justify-center gap-5">
                    <SendHorizontal className="h-8 w-8" strokeWidth={3} />
                    {isCurrentItemSynced ? "Update Request" : "Dispatch Sync"}
                  </div>
                )}
              </Button>
            </div>
          </Card>
        </section>

        {/* LOGISTIC GUIDANCE NODES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 bg-card/40 backdrop-blur-md border border-border/50 rounded-[2.2rem] flex items-start gap-5 shadow-xl">
               <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                 <Info className="h-5 w-5 text-primary" />
               </div>
               <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-foreground">Operational Protocol</p>
                  <p className="text-[10px] font-medium leading-relaxed text-muted-foreground opacity-70">
                    Process every identified node. Batches are unique registry entries.
                  </p>
               </div>
            </div>
            <div className="p-6 bg-card/40 backdrop-blur-md border border-border/50 rounded-[2.2rem] flex items-start gap-5 shadow-xl">
               <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
                 <Zap className="h-5 w-5 text-orange-500" />
               </div>
               <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-foreground">Session Security</p>
                  <p className="text-[10px] font-medium leading-relaxed text-muted-foreground opacity-70">
                    Finalize once updates are complete to secure the registry link.
                  </p>
               </div>
            </div>
        </div>

        <div className="flex items-center justify-center gap-10 py-10 opacity-10">
          <div className="h-px flex-1 bg-foreground" />
          <div className="flex items-center gap-4">
            <ShieldCheck className="h-6 w-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.6em]">Registry Core Link</span>
          </div>
          <div className="h-px flex-1 bg-foreground" />
        </div>
      </main>
      
      {/* PERSISTENT HUB FOOTER */}
      <div className="fixed bottom-0 inset-x-0 z-50 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-3xl border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
         <div className="mx-auto max-w-lg flex items-center justify-between gap-6">
            <div className="min-w-0 flex items-center gap-5">
               <div className="relative h-16 w-16 flex items-center justify-center">
                  <svg className="h-16 w-16 rotate-[-90deg]">
                    <circle cx="32" cy="32" r="28" className="stroke-muted fill-none" strokeWidth="4" />
                    <circle 
                      cx="32" cy="32" r="28" 
                      className="stroke-primary fill-none transition-all duration-1000 ease-in-out" 
                      strokeWidth="5" 
                      strokeDasharray={175.8}
                      strokeDashoffset={175.8 - (175.8 * syncedItemIds.size) / items.length}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-black tabular-nums">{Math.round((syncedItemIds.size / items.length) * 100)}%</span>
               </div>
               <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">Session Progress</p>
                  <p className="text-sm font-black text-foreground uppercase tracking-tight truncate">
                    {syncedItemIds.size} of {items.length} Synced
                  </p>
               </div>
            </div>
            <Button 
                onClick={handleFinalize} 
                disabled={isFinalizing || syncedItemIds.size === 0}
                className="h-16 px-10 rounded-[2rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-500/30 disabled:opacity-20 disabled:grayscale transition-all active:scale-95"
            >
                {isFinalizing ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <div className="flex items-center gap-2.5">
                    Finalize
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                )}
            </Button>
         </div>
      </div>
    </div>
  );
}
