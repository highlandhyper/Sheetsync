'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
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
  LockKeyhole,
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
} from 'lucide-react';

import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

  const verificationProcessedRef = useRef(false);

  // AUTO-HANDSHAKE: If a PIN is provided in the URL (from the Handshake page), verify automatically
  useEffect(() => {
    if (urlPin && token && !isVerified && !verificationProcessedRef.current) {
        verificationProcessedRef.current = true;
        setAccessKey(urlPin);
        handleVerify(urlPin);
    }
  }, [urlPin, token, isVerified]);

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

  const handleVerify = async (providedPin?: string) => {
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

        toast({
          title: 'Registry Handshake Successful',
          description: `${res.data.length} Batch Nodes loaded for identification.`,
        });
      } else {
        setErrorMessage(res.message || 'Access Key rejection. Registry protocol failed.');
      }
    } catch {
      setErrorMessage('Handshake handshake timeout. Please check your signal.');
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
          description: `${item.productName} batch node synchronized.`,
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
          description: 'Failed to finalize session with registry.',
        });
      }
    });
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center">
        <div className="absolute inset-0 bg-tech-grid opacity-10" />
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center relative z-10">
          <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-emerald-500/10 ring-8 ring-emerald-500/5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-500 text-white shadow-xl shadow-emerald-500/25">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
          </div>

          <Badge className="mb-4 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 hover:bg-emerald-500/10">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Registry Nominal
          </Badge>

          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">
            PROTOCOL <br/> <span className="text-emerald-500">COMPLETE</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-muted-foreground">
            Identity handshake terminated. Your inventory adjustments have been synchronized with the master registry.
          </p>

          <Card className="mt-8 w-full rounded-[2rem] border-border/60 bg-card p-6 text-left shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-tight">Security Handshake</p>
                <p className="mt-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Access Key Expired & Logged
                </p>
              </div>
            </div>
          </Card>

          <Button
            variant="outline"
            className="mt-6 h-14 w-full rounded-2xl font-black uppercase tracking-widest text-[10px]"
            onClick={() => window.close()}
          >
            Close Portal
          </Button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center overflow-hidden">
        {/* ATMOSPHERIC LAYER */}
        <div className="absolute inset-0 bg-tech-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="mx-auto flex w-full max-w-md flex-col relative z-10 animate-in fade-in zoom-in-95 duration-700">
          <div className="pt-8 text-center sm:pt-0">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-8 ring-8 ring-primary/5 shadow-2xl shadow-primary/10">
                <Image src="/logo-pwa.jpg" alt="Logo" width={60} height={60} className="rounded-2xl" />
            </div>

            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">
              REGISTRY <br/> <span className="text-primary">HANDSHAKE</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xs text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50">
              Identity Verification Required
            </p>
          </div>

          <Card className="mt-10 rounded-[2.5rem] border-border/60 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-3xl">
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="access-key"
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1"
                >
                  One-Time PIN
                </Label>

                <Input
                  id="access-key"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value.replace(/\D/g, ''));
                    setErrorMessage('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  className={cn(
                    'mt-3 h-24 rounded-3xl border-none bg-muted/20 text-center text-5xl font-black tracking-[0.5em] tabular-nums shadow-inner focus-visible:ring-primary/20 transition-all',
                    errorMessage && 'bg-destructive/10 ring-2 ring-destructive/20'
                  )}
                />

                {errorMessage && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive border border-destructive/10 animate-in shake-in duration-300">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-[10px] font-bold leading-relaxed uppercase tracking-tighter">{errorMessage}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleVerify()}
                disabled={accessKey.length < 4 || isVerifying}
                className="h-16 w-full rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
              >
                {isVerifying ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    Confirm Identity
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </Card>

          <div className="mt-10 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            SECURE INDUSTRIAL PORTAL
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
      {/* ATMOSPHERIC LAYER */}
      <div className="fixed inset-0 bg-tech-grid opacity-10 pointer-events-none" />

      {/* Mobile-first sticky header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shadow-sm">
              <Image src="/logo-pwa.jpg" alt="Logo" width={40} height={40} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-tight">On Display Protocol</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Registry Link Active
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="h-10 shrink-0 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/10"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Exit
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-10 relative z-10">
        {view === 'products' ? (
          <>
            {/* Product-first landing screen */}
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="px-1 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                    Action Queue
                  </p>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">
                    Identify and update specific batch nodes.
                  </p>
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[9px] uppercase tracking-widest h-6">
                    {items.length} Batches
                </Badge>
              </div>

              <div className="space-y-3">
                {displayItems.map((it, idx) => {
                  const isSynced = syncedItemIds.has(it.id);

                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => handleSelectBatch(idx)}
                      className={cn(
                        'group flex min-h-[100px] w-full items-center gap-5 rounded-[2rem] border bg-card p-5 text-left shadow-sm transition-all active:scale-[0.985] hover:shadow-md',
                        isSynced
                          ? 'border-emerald-500/25 bg-emerald-500/[0.045]'
                          : 'border-border/60 hover:border-primary/30 hover:bg-primary/[0.02]'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-all duration-300',
                          isSynced
                            ? 'bg-emerald-500 text-white scale-90'
                            : 'bg-primary/10 text-primary group-hover:scale-105'
                        )}
                      >
                        {isSynced ? (
                          <Check className="h-8 w-8" strokeWidth={3} />
                        ) : (
                          <Package className="h-8 w-8" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className={cn(
                              "line-clamp-2 text-base font-black leading-tight tracking-tight uppercase",
                              isSynced && "text-emerald-700 dark:text-emerald-400"
                          )}>
                            {it.productName}
                          </h2>
                          {isSynced && (
                            <Badge className="shrink-0 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-500/10">
                              Nominal
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          <span className={cn("px-2 py-0.5 rounded bg-muted/60", isSynced ? "bg-emerald-500/10 text-emerald-600" : "text-primary")}>
                            {it.quantity} Units
                          </span>
                          <span className="opacity-30">|</span>
                          <span className="truncate">{it.location || 'Registry'}</span>
                          <span className="opacity-30">|</span>
                          <span>
                            {it.expiryDate
                              ? format(parseISO(it.expiryDate), 'dd MMM yy')
                              : 'No expiry'}
                          </span>
                        </div>

                        {it.barcode && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground/40 uppercase">
                            <Barcode className="h-3 w-3" />
                            <span>{it.barcode}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1">
                         <ChevronRight className={cn(
                             "h-6 w-6 shrink-0 transition-all group-active:translate-x-1",
                             isSynced ? "text-emerald-500/40" : "text-muted-foreground/30 group-hover:text-primary"
                         )} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border-border/60 bg-muted/30 p-6 shadow-inner">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/10">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Handshake Protocol</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">
                    Tap any batch card to load its registry data. Update the observed count or zone mapping to synchronize the shelf with the central system.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Edit page */}
            <section className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <button
                type="button"
                onClick={() => setView('products')}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/5 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Protocol Queue
              </button>

              <Card className="overflow-hidden rounded-[2.5rem] border-border/60 bg-card/70 backdrop-blur-xl shadow-3xl">
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary border border-primary/10">
                      <Package className="h-8 w-8" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[8px] font-black uppercase tracking-widest px-2 h-5 mb-1.5">
                        BATCH HUD
                      </Badge>
                      <h1 className="text-2xl font-black leading-[1.1] tracking-tighter uppercase sm:text-3xl">
                        {currentItem?.productName}
                      </h1>

                      <div className="mt-4 flex flex-wrap items-center gap-2.5">
                        <Badge variant="outline" className="font-mono text-[10px] h-8 bg-muted/50 border-border/50 px-3 flex gap-2">
                          <Barcode className="h-3 w-3 text-primary" />
                          {currentItem?.barcode}
                        </Badge>
                        <Badge className="text-[9px] h-8 font-black uppercase tracking-widest bg-primary/5 text-primary border-none px-3">
                            <Clock3 className="mr-1.5 h-3 w-3" />
                            {currentItem?.expiryLabel || 'No expiry'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-muted/40 p-5 border border-white/5">
                      <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                        <Layers className="h-4 w-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Registry Qty</span>
                      </div>
                      <p className="text-3xl font-black tabular-nums tracking-tighter leading-none">
                        {currentItem?.quantity}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-muted/40 p-5 border border-white/5">
                      <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                        <MapPin className="h-4 w-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Registry Zone</span>
                      </div>
                      <p className="truncate text-xs font-black uppercase tracking-tight text-primary">
                        {currentItem?.location || 'Unmapped'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Database className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Sync Adjustment
                    </p>
                </div>

                <Card className="rounded-[2.5rem] border-border/60 bg-card/70 backdrop-blur-xl shadow-3xl">
                  <div className="p-5 sm:p-8">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1.5 border border-white/5 mb-8">
                      <button
                        type="button"
                        onClick={() => setRequestType('edit')}
                        className={cn(
                          'flex h-12 items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                          requestType === 'edit'
                            ? 'bg-background text-primary shadow-sm'
                            : 'text-muted-foreground/40 hover:text-foreground'
                        )}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Adjust Count
                      </button>

                      <button
                        type="button"
                        onClick={() => setRequestType('delete')}
                        className={cn(
                          'flex h-12 items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                          requestType === 'delete'
                            ? 'bg-background text-destructive shadow-sm'
                            : 'text-muted-foreground/40 hover:text-foreground'
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Purge Node
                      </button>
                    </div>

                    {requestType === 'edit' ? (
                      <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="space-y-3">
                          <Label
                            htmlFor="on-display-qty"
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1"
                          >
                            Count Observed
                          </Label>

                          <div className="relative group">
                            <Hash className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                            <Input
                              id="on-display-qty"
                              type="number"
                              min={0}
                              inputMode="decimal"
                              value={qty}
                              onChange={(e) =>
                                setQty(
                                  e.target.value === ''
                                    ? 0
                                    : parseFloat(e.target.value)
                                )
                              }
                              className="h-20 rounded-[1.5rem] border-none bg-muted/40 pl-14 text-4xl font-black tabular-nums shadow-inner focus-visible:ring-primary/20"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="on-display-location"
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1"
                          >
                            Operating Zone
                          </Label>

                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground/30" />
                            <select
                              id="on-display-location"
                              value={loc}
                              onChange={(e) => setLoc(e.target.value)}
                              className="h-16 w-full appearance-none rounded-[1.25rem] border-none bg-muted/40 pl-14 pr-12 text-sm font-black uppercase tracking-wider outline-none ring-0 focus:ring-2 focus:ring-primary/20 shadow-inner"
                            >
                              {availableLocations.map((location) => (
                                <option key={location} value={location}>
                                  {location}
                                </option>
                              ))}
                            </select>
                            <ChevronsUpDown className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/20" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-3xl border-2 border-dashed border-destructive/20 bg-destructive/5 p-6 space-y-4 text-center animate-in zoom-in-95 duration-300">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-destructive/10 text-destructive shadow-lg shadow-destructive/10">
                          <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-base font-black uppercase tracking-tight text-destructive">
                            Registry Purge
                          </p>
                          <p className="text-xs font-bold leading-relaxed text-destructive/60 uppercase tracking-tighter">
                            Acknowledge removal of batch node from the On-Display zone.
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={cn(
                        'mt-10 h-16 w-full rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]',
                        requestType === 'delete'
                          ? 'bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20'
                          : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <SendHorizontal className="h-5 w-5" />
                          {requestType === 'delete'
                            ? 'Authorize Removal'
                            : isCurrentItemSynced
                              ? 'Update Registry'
                              : 'Sync Adjustment'}
                        </div>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </section>
          </>
        )}

        {/* Compact guidance */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-border/60 bg-card/60 p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1.5">Data Integrity</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                  Each batch node represents a unique registry entry. Verify every SKU.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/60 p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1.5">Finalization</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                  Ensure you "Exit" to finalize the handshake and expire the PIN.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90 transition-all duration-700">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/20"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                  className="text-primary transition-all duration-700 ease-in-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black tabular-nums">{progress}%</span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                SESSION PROGRESS
              </p>
              <p className="truncate text-sm font-black uppercase tracking-tight">
                {syncedItemIds.size} / {items.length} COMPLETED
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-14 shrink-0 rounded-2xl bg-emerald-600 px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-30 shadow-lg shadow-emerald-500/20"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Finalize
                <Check className="ml-2 h-4 w-4" strokeWidth={3} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
