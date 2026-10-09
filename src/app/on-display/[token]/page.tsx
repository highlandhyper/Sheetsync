'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  verifyOnDisplayTokenAction,
  submitOnDisplayRequestAction,
  finalizeOnDisplaySessionAction,
} from '@/app/actions';
import type { InventoryItem } from '@/lib/types';

import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Database,
  Hash,
  Info,
  Layers,
  Loader2,
  LogOut,
  MapPin,
  Package,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Zap,
  Edit,
  X,
} from 'lucide-react';

import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import Image from 'next/image';

const DEFAULT_ON_DISPLAY_LOCATIONS = ['On Display', 'Front Side', 'Back side'];

export default function OnDisplayStaffPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token as string;
  const urlPin = searchParams?.get('pin');
  
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
  const [view, setView] = useState<'products' | 'edit'>('products');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  const verificationProcessedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleVerify = useCallback(async (providedPin?: string) => {
    const pinToUse = providedPin || accessKey;
    if (!pinToUse || pinToUse.length < 4) return;

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await verifyOnDisplayTokenAction(token, pinToUse);

      if (res.success && res.data && res.data.length > 0) {
        setItems(res.data);
        const first = res.data[0];
        setQty(first.quantity);
        setLoc(first.location);
        setIsVerified(true);
      } else {
        setErrorMessage(res.message || 'Access key rejection.');
        setAccessKey('');
        inputRef.current?.focus();
      }
    } catch {
      setErrorMessage('Registry handshake failure.');
    } finally {
      setIsVerifying(false);
    }
  }, [accessKey, token]);

  useEffect(() => {
    if (urlPin && token && !isVerified && !verificationProcessedRef.current) {
        verificationProcessedRef.current = true;
        setAccessKey(urlPin);
        handleVerify(urlPin);
    }
  }, [urlPin, token, isVerified, handleVerify]);

  const availableLocations = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_ON_DISPLAY_LOCATIONS,
          ...items.map((i) => i.location).filter(Boolean),
        ])
      ),
    [items]
  );

  const displayItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        expiryLabel:
          item.expiryDate && isValid(parseISO(item.expiryDate))
            ? format(parseISO(item.expiryDate), 'dd MMM yyyy')
            : 'No expiry',
      })),
    [items]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setAccessKey(val);
    setErrorMessage('');
    if (val.length === 4) {
        handleVerify(val);
    }
  };

  const handleSelectBatch = (index: number) => {
    setSelectedItemIndex(index);
    const item = items[index];
    setQty(item.quantity);
    setLoc(item.location);
    setRequestType('edit');
    setView('edit');
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
        setSyncedItemIds((prev) => new Set(prev).add(item.id));
        toast({
          title: requestType === 'delete' ? 'Removal protocol logged' : 'Registry update submitted',
          description: `${item.productName} synchronized.`,
        });
        setView('products');
      } else {
        toast({
          variant: 'destructive',
          title: 'Protocol Failure',
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
          toast({
            variant: 'destructive',
            title: 'Protocol Error',
            description: res.message,
          });
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Handshake Error',
          description: 'Failed to finalize session.',
        });
      }
    });
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-[#09090b] px-8 py-8 sm:flex sm:items-center sm:justify-center overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center relative z-10 animate-in fade-in zoom-in-95 duration-700">
          <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-emerald-500/10 ring-8 ring-emerald-500/5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-500 text-white shadow-xl shadow-emerald-500/25">
              <Check className="h-8 w-8" strokeWidth={4} />
            </div>
          </div>

          <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter uppercase leading-none text-white">
                PROTOCOL <br/> <span className="text-emerald-500">COMPLETE</span>
              </h1>
              <p className="max-w-xs mx-auto text-[11px] font-bold uppercase tracking-widest text-zinc-500 leading-relaxed opacity-60">
                Identity handshake terminated. Registry synchronized.
              </p>
          </div>

          <Card className="mt-12 w-full rounded-[2.5rem] border-zinc-800 bg-zinc-900/20 p-8 text-left shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-tight text-white">Security Handshake</p>
                <p className="mt-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  Access Key Expired & Logged
                </p>
              </div>
            </div>
          </Card>

          <Button
            variant="ghost"
            className="mt-10 h-14 w-full rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] text-zinc-600 hover:text-white hover:bg-white/[0.03] transition-colors"
            onClick={() => window.close()}
          >
            Close Secure Portal
          </Button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-[100dvh] bg-black relative overflow-hidden flex flex-col items-center justify-start pt-8 pb-12 animate-in fade-in duration-700">
        {/* ATMOSPHERIC LAYER */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-[360px] px-6 flex flex-col h-full">
            <div className="flex-1 flex flex-col">
                {/* TOP NAVIGATION */}
                <div className="flex items-center justify-between mb-12">
                    <button 
                        onClick={() => window.close()}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white transition-all active:scale-90"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    
                    <Button variant="ghost" size="sm" className="h-8 rounded-full bg-zinc-900/80 text-[11px] text-zinc-400 px-3 hover:text-white border-none shadow-none">
                        Help?
                    </Button>
                </div>

                {/* CONTENT AREA */}
                <div className="space-y-3 mb-8 text-left">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Confirmation
                    </h1>
                    <p className="text-[14px] font-medium text-zinc-500">
                        Enter a 4-digit code sent to you by SMS.
                    </p>
                </div>

                {/* PIN SLOTS */}
                <div className="relative flex items-center justify-start gap-3 mb-16">
                    {[0, 1, 2, 3].map((index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-all duration-300",
                                "bg-zinc-900/30 text-white",
                                accessKey.length === index && !errorMessage ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-800",
                                errorMessage ? "border-destructive/40 bg-destructive/5" : ""
                            )}
                        >
                            {accessKey[index] ? (
                                <span className="text-white animate-in zoom-in-75 duration-200">{accessKey[index]}</span>
                            ) : (
                                <div className={cn(
                                    "h-1.5 w-1.5 rounded-full bg-zinc-700 transition-all",
                                    accessKey.length === index && "animate-pulse bg-emerald-500"
                                )} />
                            )}
                        </div>
                    ))}
                    
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={accessKey}
                        onChange={handleInputChange}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-default"
                        autoFocus
                    />
                </div>

                {/* STATUS / INFO AREA */}
                <div className="flex flex-col items-center justify-center space-y-24">
                    <p className="text-[11px] font-medium text-zinc-600 text-center">
                        You can request a new code
                    </p>

                    <div className="flex flex-col items-center space-y-6">
                        <button 
                            onClick={() => window.close()}
                            className="flex items-center gap-2 text-[15px] font-medium text-zinc-600 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Return to Portal
                        </button>

                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Industrial Protocol
                        </div>
                    </div>
                </div>

                {isVerifying && (
                    <div className="mt-8 flex items-center justify-center gap-2 text-emerald-500 animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Verifying Identity...</span>
                    </div>
                )}
                
                {errorMessage && (
                    <div className="mt-8 flex items-center justify-center gap-2 text-destructive animate-in shake-in duration-300">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <p className="text-[10px] font-black leading-relaxed uppercase tracking-widest">{errorMessage}</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  const currentItem = displayItems[selectedItemIndex];
  const isCurrentItemSynced = syncedItemIds.has(currentItem?.id);
  const progress = items.length
    ? Math.round((syncedItemIds.size / items.length) * 100)
    : 0;

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <div className="fixed inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 px-6 py-5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.25rem] overflow-hidden bg-primary/5 border border-primary/20 shadow-sm">
              <Image src="/logo-pwa.jpg" alt="Logo" width={44} height={44} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-tighter">On Display Protocol</p>
              <div className="mt-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Handshake Active
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="h-11 shrink-0 rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 hover:text-destructive border border-destructive/10"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Exit
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-6 py-8 sm:py-12 relative z-10">
        {view === 'products' ? (
          <>
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">
                    Action Queue
                  </p>
                  <p className="text-sm font-bold text-muted-foreground">
                    Identify and update batch nodes.
                  </p>
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[10px] uppercase tracking-widest h-7 px-3">
                    {items.length} Units
                </Badge>
              </div>

              <div className="space-y-4">
                {displayItems.map((it, idx) => {
                  const isSynced = syncedItemIds.has(it.id);

                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => handleSelectBatch(idx)}
                      className={cn(
                        'group flex min-h-[110px] w-full items-center gap-6 rounded-[2.5rem] border bg-card p-6 text-left shadow-sm transition-all active:scale-[0.985] hover:shadow-xl',
                        isSynced
                          ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                          : 'border-border/50 hover:border-primary/20 hover:bg-primary/[0.01]'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] transition-all duration-300',
                          isSynced
                            ? 'bg-emerald-500 text-white scale-90'
                            : 'bg-primary/10 text-primary group-hover:scale-105 group-hover:bg-primary/20'
                        )}
                      >
                        {isSynced ? (
                          <Check className="h-8 w-8" strokeWidth={4} />
                        ) : (
                          <Package className="h-8 w-8" strokeWidth={2.5} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h2 className={cn(
                              "line-clamp-2 text-base font-black leading-tight tracking-tight uppercase",
                              isSynced && "text-emerald-700 dark:text-emerald-400"
                          )}>
                            {it.productName}
                          </h2>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-80">
                          <span className={cn("px-2.5 py-1 rounded-lg", isSynced ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-primary")}>
                            {it.quantity} Units
                          </span>
                          <span className="truncate">{it.location || 'Registry'}</span>
                          <span>{it.expiryDate ? format(parseISO(it.expiryDate), 'dd MMM yy') : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-muted/30 group-hover:bg-primary/10 transition-colors">
                         <ChevronRight className={cn(
                             "h-6 w-6 transition-all group-active:translate-x-1",
                             isSynced ? "text-emerald-500/40" : "text-muted-foreground/30 group-hover:text-primary"
                         )} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <button
              type="button"
              onClick={() => setView('products')}
              className="flex items-center gap-3 px-2 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:opacity-70 transition-all"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={3} />
              Protocol Queue
            </button>

            <Card className="overflow-hidden rounded-[3rem] border-none bg-card/50 backdrop-blur-xl shadow-3xl">
              <div className="p-8 sm:p-10">
                <div className="flex items-start gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Package className="h-9 w-9" strokeWidth={2.5} />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest px-3 h-6 mb-1">
                      BATCH HUD
                    </Badge>
                    <h1 className="text-3xl font-black leading-tight tracking-tighter uppercase sm:text-4xl">
                      {currentItem?.productName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-muted-foreground">
                        <Barcode className="h-4 w-4 text-primary/50" />
                        {currentItem?.barcode}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-4">
                  <div className="rounded-[2rem] bg-muted/30 p-6 border border-white/[0.03]">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">Registry Count</p>
                    <p className="text-4xl font-black tabular-nums tracking-tighter leading-none">{currentItem?.quantity}</p>
                  </div>
                  <div className="rounded-[2rem] bg-muted/30 p-6 border border-white/[0.03]">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">Operating Zone</p>
                    <p className="truncate text-[11px] font-black uppercase tracking-tight text-primary">{currentItem?.location || 'Unmapped'}</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-3 px-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Registry Sync</p>
              </div>

              <Card className="rounded-[3rem] border-none bg-card shadow-3xl overflow-hidden">
                <div className="p-8 sm:p-10">
                  <div className="grid grid-cols-2 gap-3 p-1.5 rounded-[1.75rem] bg-muted/30 mb-10">
                    <button
                      type="button"
                      onClick={() => setRequestType('edit')}
                      className={cn(
                        'flex h-14 items-center justify-center gap-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all',
                        requestType === 'edit'
                          ? 'bg-background text-primary shadow-xl'
                          : 'text-muted-foreground/40 hover:text-foreground'
                      )}
                    >
                      <Edit className="h-4 w-4" />
                      Adjust
                    </button>

                    <button
                      type="button"
                      onClick={() => setRequestType('delete')}
                      className={cn(
                        'flex h-14 items-center justify-center gap-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all',
                        requestType === 'delete'
                          ? 'bg-background text-destructive shadow-xl'
                          : 'text-muted-foreground/40 hover:text-foreground'
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                      Purge
                    </button>
                  </div>

                  {requestType === 'edit' ? (
                    <div className="space-y-10 animate-in fade-in duration-300">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-2">Units Observed</Label>
                        <div className="relative group">
                          <Hash className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                          <Input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            value={qty}
                            onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            className="h-24 rounded-[2rem] border-none bg-muted/30 pl-16 text-5xl font-black tabular-nums shadow-inner focus-visible:ring-primary/10"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-2">Target Zone</Label>
                        <button
                          type="button"
                          onClick={() => setIsLocationPickerOpen(true)}
                          className="relative flex h-16 w-full items-center rounded-2xl bg-muted/30 pl-14 pr-12 text-left text-sm font-black uppercase tracking-widest outline-none shadow-inner"
                        >
                          <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/20" />
                          <span className="truncate">{loc || 'Select Zone'}</span>
                          <ChevronsUpDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center animate-in zoom-in-95 duration-300">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive mb-6">
                        <AlertTriangle className="h-10 w-10" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-xl font-black uppercase tracking-tight text-destructive">Registry Purge</h4>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mt-2 max-w-[200px] mx-auto leading-relaxed">
                        Acknowledge permanent removal from shelf.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={cn(
                      'mt-12 h-18 w-full rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98]',
                      requestType === 'delete'
                        ? 'bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20'
                        : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-3">
                        <SendHorizontal className="h-5 w-5" strokeWidth={3} />
                        {requestType === 'delete' ? 'Authorize Removal' : 'Sync Adjustment'}
                      </div>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[2.5rem] border border-border/40 bg-card/40 p-8 shadow-sm">
            <div className="flex gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-widest">Integrity</p>
                <p className="text-xs leading-relaxed text-muted-foreground font-medium">
                  Each node represents a verified registry entry.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-border/40 bg-card/40 p-8 shadow-sm">
            <div className="flex gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/5 text-orange-600">
                <Zap className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-widest">Handshake</p>
                <p className="text-xs leading-relaxed text-muted-foreground font-medium">
                  PIN will expire automatically upon session exit.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90 transition-all duration-700">
                <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-muted/10" />
                <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 24}`} strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`} className="text-primary transition-all duration-700 ease-in-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-black tabular-nums">{progress}%</span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
                SESSION
              </p>
              <p className="truncate text-sm font-black uppercase tracking-tight">
                {syncedItemIds.size} / {items.length} COMPLETE
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-16 shrink-0 rounded-2xl bg-emerald-600 px-8 text-[11px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-20 shadow-xl shadow-emerald-500/20"
          >
            {isFinalizing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <span>Finalize</span>
                <Check className="h-4 w-4" strokeWidth={4} />
              </div>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={isLocationPickerOpen} onOpenChange={setIsLocationPickerOpen}>
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[2.5rem] border-none p-0 shadow-3xl bg-background">
              <DialogHeader className="border-b bg-muted/20 px-6 py-6 text-left">
                  <DialogTitle className="text-lg font-black uppercase tracking-tight">Operating Zone</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Identify shelf mapping.</DialogDescription>
              </DialogHeader>
              <Command className="min-h-0 flex-1 rounded-none bg-transparent">
                  <CommandInput placeholder="Search zones..." className="h-14 px-6 font-bold" />
                  <CommandList className="max-h-[min(52dvh,380px)] p-2">
                      <CommandEmpty className="py-12 text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center">Zero zones found</CommandEmpty>
                      <CommandGroup>
                          {availableLocations.map((location) => (
                              <CommandItem
                                  key={location}
                                  value={location}
                                  onSelect={() => {
                                      setLoc(location);
                                      setIsLocationPickerOpen(false);
                                  }}
                                  className="h-14 rounded-2xl text-sm font-black uppercase tracking-tight px-4 cursor-pointer"
                              >
                                  <Check className={cn('mr-4 h-4 w-4 text-primary', loc === location ? 'opacity-100' : 'opacity-0')} />
                                  <span className="truncate">{location}</span>
                              </CommandItem>
                          ))}
                      </CommandGroup>
                  </CommandList>
              </Command>
              <div className="border-t bg-muted/10 p-4">
                  <Button type="button" variant="ghost" onClick={() => setIsLocationPickerOpen(false)} className="h-12 w-full rounded-xl text-[10px] font-black uppercase tracking-widest text-destructive">
                      Cancel Selection
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
