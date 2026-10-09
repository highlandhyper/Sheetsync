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
  PackageSearch,
  Activity,
  Send,
  Boxes
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
  const progress = items.length
    ? Math.round((syncedItemIds.size / items.length) * 100)
    : 0;

  return (
    <div className="min-h-[100dvh] bg-black text-white pb-32 relative overflow-x-hidden animate-in fade-in duration-700">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-tech-grid opacity-[0.05] pointer-events-none" />

      {/* TOP NAVIGATION */}
      <header className="sticky top-0 z-40 px-6 py-6 sm:py-8 flex items-center justify-between">
          <button 
              onClick={() => router.push('/login')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white transition-all active:scale-90"
          >
              <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500/60 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Protocol Active
          </div>

          <Button variant="ghost" size="sm" className="h-8 rounded-full bg-zinc-900/80 text-[11px] text-zinc-400 px-3 hover:text-white border-none shadow-none">
              Help?
          </Button>
      </header>

      <main className="mx-auto max-w-[360px] space-y-10 px-6 py-4 relative z-10">
        {view === 'products' ? (
          <section className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="space-y-3 text-left">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    Action Queue
                </h1>
                <p className="text-[14px] font-medium text-zinc-500">
                    Identify and synchronize the following nodes.
                </p>
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
                      'group flex min-h-[100px] w-full items-center gap-5 rounded-[2rem] bg-zinc-900/30 p-5 text-left transition-all active:scale-[0.985] hover:bg-zinc-900/50',
                      isSynced && 'bg-emerald-500/[0.03] ring-1 ring-emerald-500/20 opacity-90'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500',
                        isSynced
                          ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                          : 'bg-zinc-800 text-zinc-600 group-hover:text-emerald-500'
                      )}
                    >
                      {isSynced ? (
                        <Check className="h-6 w-6" strokeWidth={4} />
                      ) : (
                        <Package className="h-6 w-6" strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className={cn(
                          "line-clamp-1 text-[16px] font-bold leading-tight tracking-tight uppercase",
                          isSynced ? "text-emerald-400" : "text-white"
                      )}>
                        {it.productName}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 text-emerald-500/60">
                          <Activity className="h-3 w-3" />
                          {it.quantity} UNITS
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <MapPin className="h-3 w-3" />
                          {it.location || 'UNMAPPED'}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                       <ChevronRight className={cn(
                           "h-5 w-5 transition-all group-active:translate-x-1",
                           isSynced ? "text-emerald-500/20" : "text-zinc-800 group-hover:text-emerald-400"
                       )} />
                    </div>
                  </button>
                );
              })}
            </div>
            
            <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-zinc-800 py-10">
                End of Action Queue
            </p>
          </section>
        ) : (
          <section className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
            <button
              type="button"
              onClick={() => setView('products')}
              className="flex items-center gap-3 px-2 py-2 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 hover:opacity-70 transition-all"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={3} />
              Return to Queue
            </button>

            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5">
                  <Package className="h-9 w-9" strokeWidth={2.5} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500/60 mb-2">IDENTIFICATION NODE</p>
                  <h1 className="text-3xl font-black leading-[0.95] tracking-tighter uppercase sm:text-4xl text-white">
                    {currentItem?.productName}
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[2rem] bg-zinc-900/20 p-6 border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Current Count</p>
                  <p className="text-4xl font-black tabular-nums tracking-tighter leading-none text-white">{currentItem?.quantity}</p>
                </div>
                <div className="rounded-[2rem] bg-zinc-900/20 p-6 border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Registry Zone</p>
                  <p className="truncate text-xs font-black uppercase tracking-tight text-emerald-500/80">{currentItem?.location || 'Unmapped'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="grid grid-cols-2 gap-3 p-1.5 rounded-full bg-zinc-900/30 border border-white/5">
                <button
                  type="button"
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
                    requestType === 'edit'
                      ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/10'
                      : 'text-zinc-600 hover:text-white'
                  )}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Adjust Node
                </button>

                <button
                  type="button"
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
                    requestType === 'delete'
                      ? 'bg-destructive text-white shadow-xl shadow-destructive/20'
                      : 'text-zinc-600 hover:text-white'
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Purge Batch
                </button>
              </div>

              {requestType === 'edit' ? (
                <div className="space-y-10 animate-in fade-in duration-300">
                  <div className="space-y-4 text-center">
                    <Label className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700">UNITS OBSERVED</Label>
                    <div className="relative group">
                      <Input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-28 text-center rounded-[2.5rem] border-none bg-zinc-900/40 text-7xl font-black tabular-nums shadow-inner focus-visible:ring-emerald-500/10 text-white placeholder:text-zinc-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700 ml-4">ZONE MAPPING</Label>
                    <button
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                      className="relative flex h-16 w-full items-center rounded-full bg-zinc-900/40 border-none pl-14 pr-10 text-left text-[11px] font-black uppercase tracking-widest outline-none shadow-inner group hover:bg-zinc-900/60 transition-all"
                    >
                      <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                      <span className="truncate text-white">{loc || 'Select Zone'}</span>
                      <ChevronsUpDown className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 opacity-10" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center animate-in zoom-in-95 duration-300 bg-destructive/[0.03] rounded-[2.5rem] border border-destructive/10">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-destructive/10 text-destructive mb-6 ring-8 ring-destructive/5">
                    <AlertTriangle className="h-10 w-10" strokeWidth={2.5} />
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight text-white">Permanent Purge</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-3 max-w-[200px] mx-auto leading-relaxed">
                    Authorize removal of this node from the registry.
                  </p>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  'h-20 w-full rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] mt-4 border-none',
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
                    {requestType === 'delete' ? 'AUTHORIZE REMOVAL' : 'SYNCHRONIZE NODE'}
                  </div>
                )}
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* FIXED PROGRESS HUB */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex max-w-[360px] items-center gap-6 bg-zinc-900/90 border border-white/5 p-4 rounded-full backdrop-blur-3xl shadow-3xl">
          <div className="flex min-w-0 flex-1 items-center gap-4 pl-2">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <svg className="h-11 w-11 -rotate-90 transition-all duration-700">
                <circle cx="22" cy="22" r="19" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-zinc-800" />
                <circle cx="22" cy="22" r="19" fill="transparent" stroke="currentColor" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 19}`} strokeDashoffset={`${2 * Math.PI * 19 * (1 - progress / 100)}`} className="text-emerald-500 transition-all duration-1000 ease-in-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black tabular-nums text-white">{progress}%</span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">
                STATUS
              </p>
              <p className="truncate text-[11px] font-bold uppercase tracking-tight text-zinc-400">
                {syncedItemIds.size} / {items.length} Synced
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-12 shrink-0 rounded-full bg-emerald-600 px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-20 transition-all shadow-xl shadow-emerald-500/10 border-none"
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
