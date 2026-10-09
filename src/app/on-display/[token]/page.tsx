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
      <div className="min-h-[100dvh] bg-black px-8 py-8 flex flex-col items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-[360px] flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-1000">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-inner mb-10 ring-8 ring-emerald-500/5">
            <UserCheck className="h-10 w-10" strokeWidth={2.5} />
          </div>

          <div className="space-y-4 mb-12">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500">Identity Confirmed</p>
              <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
                PROTOCOL <br/> COMPLETE
              </h1>
          </div>

          <div className="p-6 bg-zinc-900/40 rounded-[2rem] border border-white/5 flex items-start gap-4 text-left w-full mb-12">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed uppercase tracking-tighter">
              Identity handshake terminated. Registry session has been synchronized and access key revoked.
            </p>
          </div>

          <Button
            className="w-full h-16 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-2xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/10 transition-all active:scale-[0.98]"
            onClick={() => window.close()}
          >
            Close Secure Portal
          </Button>
          
          <p className="mt-8 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-800">
            Secure Session Finalized
          </p>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-[100dvh] bg-black relative overflow-hidden flex flex-col items-center justify-start pt-8 pb-12 animate-in fade-in duration-700">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-[360px] px-6 flex flex-col h-full">
            <div className="flex-1 flex flex-col">
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

                <div className="space-y-3 mb-8 text-left">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Confirmation
                    </h1>
                    <p className="text-[14px] font-medium text-zinc-500">
                        Enter a 4-digit code sent to you by SMS.
                    </p>
                </div>

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
    <div className="min-h-[100dvh] bg-black text-white pb-32 relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-black/95 px-6 py-5 backdrop-blur-xl supports-[backdrop-filter]:bg-black/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-emerald-500/[0.06] border border-emerald-500/20 shadow-sm">
              <Image src="/logo-pwa.jpg" alt="Logo" width={44} height={44} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-tighter">On Display Protocol</p>
              <div className="mt-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-500">
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
            className="h-11 shrink-0 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 hover:text-destructive border border-destructive/10"
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
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">
                  Action Queue
                </p>
                <p className="text-sm font-bold text-zinc-500">
                  Identify and update batch nodes.
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/[0.06] text-emerald-500 border-emerald-500/20 font-black text-[10px] uppercase tracking-widest h-7 px-3">
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
                      'group flex min-h-[96px] w-full items-center gap-4 rounded-[2rem] border border-zinc-800/80 bg-zinc-900/40 p-5 text-left shadow-sm transition-all active:scale-[0.985] hover:shadow-xl hover:bg-white/[0.02]',
                      isSynced && 'border-emerald-500/20 bg-emerald-500/[0.03] opacity-80'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-300',
                        isSynced
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-500/10 text-emerald-500 group-hover:scale-105'
                      )}
                    >
                      {isSynced ? (
                        <Check className="h-7 w-7" strokeWidth={4} />
                      ) : (
                        <Package className="h-7 w-7" strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className={cn(
                          "line-clamp-1 text-base font-black leading-tight tracking-tight uppercase",
                          isSynced && "text-emerald-400"
                      )}>
                        {it.productName}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        <span className={cn("px-2.5 py-1 rounded-lg", isSynced ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-900/70 text-emerald-500")}>
                          {it.quantity} Units
                        </span>
                        <span className="truncate">{it.location || 'Registry'}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-white/[0.035] group-hover:bg-emerald-500/10 transition-colors">
                       <ChevronRight className={cn(
                           "h-6 w-6 transition-all group-active:translate-x-1",
                           isSynced ? "text-emerald-500/40" : "text-zinc-500 group-hover:text-emerald-400"
                       )} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <button
              type="button"
              onClick={() => setView('products')}
              className="flex items-center gap-3 px-2 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 hover:opacity-70 transition-all"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={3} />
              Return to Queue
            </button>

            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5">
                  <Package className="h-9 w-9" strokeWidth={2.5} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-2">Identification Node</p>
                  <h1 className="text-3xl font-black leading-[0.95] tracking-tighter uppercase sm:text-4xl text-white">
                    {currentItem?.productName}
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[2rem] bg-zinc-900/40 p-6 border border-white/5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Registry Count</p>
                  <p className="text-4xl font-black tabular-nums tracking-tighter leading-none text-white">{currentItem?.quantity}</p>
                </div>
                <div className="rounded-[2rem] bg-zinc-900/40 p-6 border border-white/5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Operating Zone</p>
                  <p className="truncate text-base font-black uppercase tracking-tight text-emerald-500">{currentItem?.location || 'Unmapped'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-3 p-1.5 rounded-[1.5rem] bg-zinc-900/40 border border-white/5">
                <button
                  type="button"
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    'flex h-14 items-center justify-center gap-2 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest transition-all',
                    requestType === 'edit'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-zinc-500 hover:text-white'
                  )}
                >
                  <Edit className="h-4 w-4" />
                  Adjust Node
                </button>

                <button
                  type="button"
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    'flex h-14 items-center justify-center gap-2 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest transition-all',
                    requestType === 'delete'
                      ? 'bg-destructive text-white shadow-lg'
                      : 'text-zinc-500 hover:text-white'
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                  Purge Batch
                </button>
              </div>

              {requestType === 'edit' ? (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-6">Units Observed</Label>
                    <div className="relative group">
                      <Hash className="absolute left-8 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-800 group-focus-within:text-emerald-500 transition-colors" />
                      <Input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-28 rounded-[2.5rem] border-zinc-900 bg-zinc-900/40 pl-20 text-6xl font-black tabular-nums shadow-inner focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500/30 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-6">Target Zone Mapping</Label>
                    <button
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                      className="relative flex h-20 w-full items-center rounded-[1.5rem] bg-zinc-900/40 border border-zinc-900 pl-16 pr-12 text-left text-base font-black uppercase tracking-widest outline-none shadow-inner group hover:border-emerald-500/20 transition-all"
                    >
                      <MapPin className="absolute left-7 top-1/2 -translate-y-1/2 h-6 w-6 text-zinc-800 group-hover:text-emerald-500 transition-colors" />
                      <span className="truncate text-white">{loc || 'Select Zone'}</span>
                      <ChevronsUpDown className="absolute right-7 top-1/2 -translate-y-1/2 h-6 w-6 opacity-10" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center animate-in zoom-in-95 duration-300 bg-destructive/[0.03] rounded-[2.5rem] border border-destructive/10">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-destructive/10 text-destructive mb-6 ring-8 ring-destructive/5">
                    <AlertTriangle className="h-12 w-12" strokeWidth={2.5} />
                  </div>
                  <h4 className="text-2xl font-black uppercase tracking-tight text-white">Permanent Purge</h4>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mt-3 max-w-[240px] mx-auto leading-relaxed">
                    Authorize full removal of this batch from the industrial registry.
                  </p>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  'h-20 w-full rounded-full text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] mt-4',
                  requestType === 'delete'
                    ? 'bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/10'
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <div className="flex items-center gap-4">
                    <SendHorizontal className="h-6 w-6" strokeWidth={3} />
                    {requestType === 'delete' ? 'Authorize Removal' : 'Synchronize Node'}
                  </div>
                )}
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* FIXED PROGRESS HUB */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-900/80 bg-black/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-8">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90 transition-all duration-700">
                <circle cx="28" cy="28" r="25" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-zinc-900" />
                <circle cx="28" cy="28" r="25" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 25}`} strokeDashoffset={`${2 * Math.PI * 25 * (1 - progress / 100)}`} className="text-emerald-500 transition-all duration-1000 ease-in-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-black tabular-nums text-white">{progress}%</span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">
                REGISTRY SYNC
              </p>
              <p className="truncate text-sm font-black uppercase tracking-tight text-zinc-300">
                {syncedItemIds.size} / {items.length} VERIFIED
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-14 shrink-0 rounded-full bg-zinc-900 border border-white/5 px-8 text-[11px] font-black uppercase tracking-widest text-white hover:bg-zinc-800 disabled:opacity-20 transition-all"
          >
            {isFinalizing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-3">
                <span>Finalize</span>
                <Check className="h-4 w-4" strokeWidth={4} />
              </div>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={isLocationPickerOpen} onOpenChange={setIsLocationPickerOpen}>
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[2.5rem] border-none p-0 shadow-3xl bg-black">
              <DialogHeader className="border-b border-white/5 bg-zinc-900/40 px-8 py-8 text-left">
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Zone Mapping</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">Target storage region</DialogDescription>
              </DialogHeader>
              <Command className="min-h-0 flex-1 rounded-none bg-transparent">
                  <CommandInput placeholder="SEARCH REGIONS..." className="h-16 px-8 font-black uppercase tracking-widest text-white border-b-white/5" />
                  <CommandList className="max-h-[min(52dvh,400px)] p-3">
                      <CommandEmpty className="py-12 text-[10px] text-zinc-700 uppercase font-black tracking-widest text-center">Zero regions identified</CommandEmpty>
                      <CommandGroup>
                          {availableLocations.map((location) => (
                              <CommandItem
                                  key={location}
                                  value={location}
                                  onSelect={() => {
                                      setLoc(location);
                                      setIsLocationPickerOpen(false);
                                  }}
                                  className="h-16 rounded-[1.2rem] text-sm font-black uppercase tracking-widest px-6 cursor-pointer mb-2 data-[selected=true]:bg-emerald-500/10 data-[selected=true]:text-emerald-500 transition-all"
                              >
                                  <Check className={cn('mr-4 h-5 w-5', loc === location ? 'opacity-100' : 'opacity-0')} strokeWidth={3} />
                                  <span className="truncate">{location}</span>
                              </CommandItem>
                          ))}
                      </CommandGroup>
                  </CommandList>
              </Command>
              <div className="border-t border-white/5 bg-zinc-900/20 p-4">
                  <Button type="button" variant="ghost" onClick={() => setIsLocationPickerOpen(false)} className="h-12 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 hover:text-white transition-colors">
                      Cancel Protocol
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
