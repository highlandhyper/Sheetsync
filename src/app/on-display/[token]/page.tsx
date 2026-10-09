'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  verifyOnDisplayTokenAction,
  submitOnDisplayRequestAction,
  finalizeOnDisplaySessionAction,
} from '@/app/actions';
import type { InventoryItem } from '@/lib/types';

import {
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Edit,
  Loader2,
  MapPin,
  Package,
  SendHorizontal,
  ShieldCheck,
  Trash2,
  UserCheck,
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

const DEFAULT_ON_DISPLAY_LOCATIONS = ['On Display', 'Front Side', 'Back side'];

export default function OnDisplayStaffPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
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

  // --- SUCCESS VIEW ---
  if (success) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_60%)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-[320px] animate-in fade-in zoom-in-95 duration-700">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-8 ring-8 ring-emerald-500/5">
            <UserCheck className="h-9 w-9 text-emerald-500" strokeWidth={2.5} />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-500 mb-4">Identity Confirmed</p>
          <h1 className="text-3xl font-bold tracking-tight mb-10 leading-tight">
            PROTOCOL<br/>COMPLETE
          </h1>

          <div className="w-full p-5 bg-zinc-900/40 rounded-2xl border border-white/5 flex items-start gap-4 text-left mb-10">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed uppercase tracking-tight">
              Identity handshake terminated. Registry session synchronized and access key revoked.
            </p>
          </div>

          <Button
            className="w-full h-14 rounded-full text-xs font-bold uppercase tracking-[0.2em] bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
            onClick={() => window.close()}
          >
            Close Secure Portal
          </Button>
          
          <div className="mt-10 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-800">
            <ShieldCheck className="h-3 w-3" />
            Industrial Protocol
          </div>
        </div>
      </div>
    );
  }

  // --- OTP / VERIFICATION VIEW ---
  if (!isVerified) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-start pt-12 pb-12 px-6 relative overflow-hidden animate-in fade-in duration-700">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="w-full max-w-[320px] flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-16">
                <button 
                    onClick={() => window.close()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/60 text-zinc-400 hover:text-white transition-all active:scale-90"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                
                <Button variant="ghost" size="sm" className="h-8 rounded-full bg-zinc-900/60 text-[11px] text-zinc-500 px-3 hover:text-white border-none">
                    Help?
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="space-y-3 mb-10 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Confirmation
                    </h1>
                    <p className="text-[14px] font-medium text-zinc-500">
                        Enter a 4-digit code sent to you by SMS.
                    </p>
                </div>

                {/* OTP Input */}
                <div className="relative flex items-center justify-center gap-3 mb-12">
                    {[0, 1, 2, 3].map((index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex h-14 w-14 items-center justify-center rounded-xl border text-2xl font-bold transition-all duration-300",
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

                <p className="text-[11px] font-medium text-zinc-600 text-center mb-auto">
                    You can request a new code
                </p>
            </div>

            {/* Footer */}
            <div className="pt-12 flex flex-col items-center space-y-8">
                <button 
                    onClick={() => window.close()}
                    className="flex items-center gap-2 text-[14px] font-medium text-zinc-600 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Return to Portal
                </button>

                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Industrial Protocol
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- MAIN PORTAL VIEW ---
  const currentItem = displayItems[selectedItemIndex];
  const progress = items.length
    ? Math.round((syncedItemIds.size / items.length) * 100)
    : 0;

  return (
    <div className="min-h-[100dvh] bg-black text-white pb-24 relative overflow-x-hidden animate-in fade-in duration-700">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />

      {/* HEADER */}
      <header className="sticky top-0 z-40 px-6 py-6 flex items-center justify-between bg-black/80 backdrop-blur-md">
          <button 
              onClick={() => router.push('/login')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/60 text-zinc-400 hover:text-white transition-all active:scale-90"
          >
              <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-500/80 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Protocol Active
          </div>

          <Button variant="ghost" size="sm" className="h-8 rounded-full bg-zinc-900/60 text-[11px] text-zinc-500 px-3 hover:text-white border-none">
              Help?
          </Button>
      </header>

      <main className="mx-auto max-w-[320px] px-6 py-4">
        {view === 'products' ? (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2 text-center pt-4">
                <h1 className="text-3xl font-bold tracking-tight">
                    Action Queue
                </h1>
                <p className="text-[14px] font-medium text-zinc-500">
                    Identify and synchronize the following nodes.
                </p>
            </div>

            <div className="space-y-3 pt-2">
              {displayItems.map((it, idx) => {
                const isSynced = syncedItemIds.has(it.id);

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleSelectBatch(idx)}
                    className={cn(
                      'group flex items-center gap-4 w-full rounded-2xl bg-zinc-900/20 p-4 text-left transition-all active:scale-[0.99] hover:bg-zinc-900/40 border border-white/5',
                      isSynced && 'bg-emerald-500/[0.03] border-emerald-500/20'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-500',
                        isSynced
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-800 text-zinc-600 group-hover:text-emerald-500'
                      )}
                    >
                      {isSynced ? (
                        <Check className="h-5 w-5" strokeWidth={3} />
                      ) : (
                        <Package className="h-5 w-5" strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className={cn(
                          "line-clamp-1 text-[15px] font-bold leading-tight tracking-tight",
                          isSynced ? "text-emerald-400" : "text-white"
                      )}>
                        {it.productName}
                      </h2>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 text-emerald-500/60">
                          {it.quantity} UNITS
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          {it.location || 'UNMAPPED'}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                       <ChevronRight className={cn(
                           "h-5 w-5 transition-all group-active:translate-x-1",
                           isSynced ? "text-emerald-500/20" : "text-zinc-700 group-hover:text-emerald-400"
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
              className="flex items-center gap-2 px-2 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500 hover:opacity-70 transition-all"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={3} />
              Return to Queue
            </button>

            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5">
                <Package className="h-8 w-8" strokeWidth={2.5} />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-500/60">Identification Node</p>
                <h1 className="text-3xl font-bold leading-[0.95] tracking-tight sm:text-4xl text-white">
                  {currentItem?.productName}
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-zinc-900/20 p-5 border border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">Current Count</p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-white">{currentItem?.quantity}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900/20 p-5 border border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">Registry Zone</p>
                  <p className="truncate text-[11px] font-bold uppercase tracking-tight text-emerald-500/80">{currentItem?.location || 'Unmapped'}</p>
                </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-3 p-1.5 rounded-full bg-zinc-900/20 border border-white/5">
                <button
                  type="button"
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all',
                    requestType === 'edit'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/10'
                      : 'text-zinc-600 hover:text-white'
                  )}
                >
                  <Edit className="h-4 w-4" />
                  Adjust Node
                </button>

                <button
                  type="button"
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all',
                    requestType === 'delete'
                      ? 'bg-destructive text-white shadow-lg shadow-destructive/20'
                      : 'text-zinc-600 hover:text-white'
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                  Purge Batch
                </button>
              </div>

              {requestType === 'edit' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-3 text-center">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-700">UNITS OBSERVED</Label>
                    <div className="relative group">
                      <Input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-24 text-center rounded-2xl border-none bg-zinc-900/40 text-5xl font-bold tabular-nums shadow-inner focus-visible:ring-emerald-500/10 text-white placeholder:text-zinc-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-700 ml-4">ZONE MAPPING</Label>
                    <button
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                      className="relative flex h-14 w-full items-center rounded-2xl bg-zinc-900/40 border-none pl-12 pr-10 text-left text-[11px] font-bold uppercase tracking-widest outline-none shadow-inner group hover:bg-zinc-900/60 transition-all"
                    >
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                      <span className="truncate text-white">{loc || 'Select Zone'}</span>
                      <ChevronsUpDown className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-10" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center animate-in zoom-in-95 duration-300 bg-destructive/[0.03] rounded-2xl border border-destructive/10">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4 ring-6 ring-destructive/5">
                    <Trash2 className="h-8 w-8" strokeWidth={2.5} />
                  </div>
                  <h4 className="text-lg font-bold uppercase tracking-tight text-white">Permanent Purge</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-2 max-w-[180px] mx-auto leading-relaxed">
                    Authorize removal of this node from the registry.
                  </p>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  'h-14 w-full rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] mt-2 border-none',
                  requestType === 'delete'
                    ? 'bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/10'
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <div className="flex items-center gap-3">
                    <SendHorizontal className="h-5 w-5" strokeWidth={3} />
                    {requestType === 'delete' ? 'Authorize Removal' : 'Synchronize Node'}
                  </div>
                )}
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER PROGRESS BAR */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-black via-black to-transparent">
        <div className="mx-auto flex max-w-[320px] items-center gap-4 bg-zinc-900/80 border border-white/5 p-3 rounded-full backdrop-blur-xl shadow-2xl">
          <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <svg className="h-10 w-10 -rotate-90 transition-all duration-700">
                <circle cx="20" cy="20" r="17" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-zinc-800" />
                <circle cx="20" cy="20" r="17" fill="transparent" stroke="currentColor" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 17}`} strokeDashoffset={`${2 * Math.PI * 17 * (1 - progress / 100)}`} className="text-emerald-500 transition-all duration-1000 ease-in-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-bold tabular-nums text-white">{progress}%</span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                Synced
              </p>
              <p className="truncate text-[11px] font-bold uppercase tracking-tight text-zinc-400">
                {syncedItemIds.size} / {items.length}
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-10 shrink-0 rounded-full bg-emerald-600 px-5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-20 transition-all shadow-lg shadow-emerald-500/10 border-none"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <span>Finalize</span>
                <Check className="h-3.5 w-3.5" strokeWidth={4} />
              </div>
            )}
          </Button>
        </div>
        
        <div className="mt-4 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Industrial Protocol
        </div>
      </div>

      <Dialog open={isLocationPickerOpen} onOpenChange={setIsLocationPickerOpen}>
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[2.5rem] border-none p-0 shadow-3xl bg-black">
              <DialogHeader className="border-b border-white/5 bg-zinc-900/40 px-8 py-8 text-left">
                  <DialogTitle className="text-2xl font-bold uppercase tracking-tight text-white">Zone Mapping</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">Target storage region</DialogDescription>
              </DialogHeader>
              <Command className="min-h-0 flex-1 rounded-none bg-transparent">
                  <CommandInput placeholder="SEARCH REGIONS..." className="h-16 px-8 font-bold uppercase tracking-widest text-white border-b-white/5" />
                  <CommandList className="max-h-[min(52dvh,400px)] p-3">
                      <CommandEmpty className="py-12 text-[10px] text-zinc-700 uppercase font-bold tracking-widest text-center">Zero regions identified</CommandEmpty>
                      <CommandGroup>
                          {availableLocations.map((location) => (
                              <CommandItem
                                  key={location}
                                  value={location}
                                  onSelect={() => {
                                      setLoc(location);
                                      setIsLocationPickerOpen(false);
                                  }}
                                  className="h-16 rounded-2xl text-sm font-bold uppercase tracking-widest px-6 cursor-pointer mb-2 data-[selected=true]:bg-emerald-500/10 data-[selected=true]:text-emerald-500 transition-all"
                              >
                                  <Check className={cn('mr-4 h-5 w-5', loc === location ? 'opacity-100' : 'opacity-0')} strokeWidth={3} />
                                  <span className="truncate">{location}</span>
                              </CommandItem>
                          ))}
                      </CommandGroup>
                  </CommandList>
              </Command>
              <div className="border-t border-white/5 bg-zinc-900/20 p-4">
                  <Button type="button" variant="ghost" onClick={() => setIsLocationPickerOpen(false)} className="h-12 w-full rounded-2xl text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-600 hover:text-white transition-colors">
                      Cancel Protocol
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}