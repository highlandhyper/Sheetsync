'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  verifyOnDisplayTokenAction,
  submitOnDisplayRequestAction,
} from '@/app/actions';
import type { InventoryItem } from '@/lib/types';

import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  MapPin,
  Package,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Layers,
  Hash,
  Clock3,
  Calendar,
  X,
  History,
  Info,
  Building2,
  ArrowRight
} from 'lucide-react';

import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const DEFAULT_ON_DISPLAY_LOCATIONS = ['On Display', 'Front Side', 'Back side'];

type OnDisplayLocationSelectProps = {
  location: string;
  itemLocations: string[];
  onChange: (location: string) => void;
};

function OnDisplayLocationSelect({ location, itemLocations, onChange }: OnDisplayLocationSelectProps) {
  const options = Array.from(new Set([
    ...DEFAULT_ON_DISPLAY_LOCATIONS,
    ...itemLocations.filter(Boolean),
  ]));

  return (
    <select
      id="on-display-location"
      value={location}
      onChange={(event) => onChange(event.target.value)}
      className="h-16 w-full appearance-none rounded-2xl border-none bg-slate-50 py-0 pl-14 pr-4 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
    >
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

export default function OnDisplayStaffPage() {
  const params = useParams();
  const token = params?.token as string;
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState(false);

  const [accessKey, setAccessKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [qty, setQty] = useState<number>(0);
  const [loc, setLoc] = useState('');
  const [requestType, setRequestType] = useState<'edit' | 'delete'>('edit');

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
        setSuccess(true);
        toast({
          title: 'Request Synchronized',
          description: 'Admin review pending.',
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

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.05]" />
        <Card className="relative z-10 w-full max-w-sm overflow-hidden border-none bg-transparent shadow-none text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase leading-none">Sync Confirmed</h1>
          <p className="mt-4 text-sm font-medium text-muted-foreground leading-relaxed">
            Your request has been dispatched to the master registry for administrative review.
          </p>
          <div className="mt-10 p-6 rounded-3xl bg-white border border-border/50 text-left shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audit Trace Recorded</span>
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
              <span className="text-[8px] font-black uppercase tracking-[0.4em]">SheetSync Secure Node v6.0</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = displayItems[selectedItemIndex];
  const expiryLabel = currentItem?.expiryLabel || 'NO DATA';

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 sm:h-10 sm:w-10">
              <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black uppercase tracking-tight text-foreground">Personnel Portal</h2>
              <p className="text-[9px] font-bold text-primary uppercase tracking-widest leading-none">On-Display Registry</p>
            </div>
          </div>
          <Badge variant="outline" className="h-7 shrink-0 border-emerald-500/20 bg-emerald-500/5 px-2 text-[9px] font-black uppercase tracking-widest text-emerald-600">
            <span className="mr-1.5 h-1 w-1 rounded-full bg-emerald-500" /><span className="hidden sm:inline">Authorized </span>Session
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-3 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:space-y-6 sm:px-4 sm:py-6">
        <Card className="overflow-hidden rounded-[1.5rem] border-none bg-white shadow-sm ring-1 ring-border/50 sm:rounded-[2rem]">
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex items-start gap-3 sm:mb-6 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-primary sm:h-16 sm:w-16">
                <Package className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Asset Identity</p>
                <h3 className="text-lg font-black leading-tight text-foreground sm:text-xl">{currentItem?.productName}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="font-mono text-[9px] h-6 bg-slate-50 border-none">{currentItem?.barcode}</Badge>
                  <Badge variant="secondary" className="text-[9px] h-6 font-bold uppercase tracking-widest bg-primary/5 text-primary border-none">
                    {currentItem?.itemType}
                  </Badge>
                </div>
              </div>
            </div>

            {items.length > 1 && (
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Products in this alert</span>
                  <span className="text-[10px] font-black text-primary">{items.length} LOGS FOUND</span>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <button
                      key={it.id}
                      onClick={() => handleSelectBatch(idx)}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition-all",
                        selectedItemIndex === idx
                          ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                          : "border-border/50 bg-slate-50 text-foreground"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black uppercase">{it.productName}</p>
                          <p className={cn(
                            "mt-1 font-mono text-[10px] font-bold",
                            selectedItemIndex === idx ? "text-white/75" : "text-muted-foreground"
                          )}>
                            Barcode: {it.barcode}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[9px] font-black uppercase">Qty {it.quantity}</p>
                          <p className={cn(
                            "mt-1 text-[9px] font-bold uppercase",
                            selectedItemIndex === idx ? "text-white/75" : "text-muted-foreground"
                          )}>
                            {it.expiryDate ? format(parseISO(it.expiryDate), 'dd MMM yyyy') : 'No expiry'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div className="rounded-2xl border border-border/40 bg-slate-50 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">In Stock</span>
                </div>
                <p className="text-2xl font-black text-foreground">{currentItem?.quantity} <span className="text-[10px] opacity-40 font-bold">UNITS</span></p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-slate-50 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Batch Expiry</span>
                </div>
                <p className="text-sm font-black text-foreground uppercase">{expiryLabel}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="px-1 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Adjust Registry</h3>
            <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.1em]">Verification Level 2</span>
          </div>

          <Card className="rounded-[2.5rem] border-none bg-white shadow-sm ring-1 ring-border/50 overflow-hidden">
            <div className="p-1.5">
              <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-[2rem]">
                <button
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    "h-12 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'edit' ? "bg-white text-primary shadow-sm" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  Edit Count
                </button>
                <button
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    "h-12 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'delete' ? "bg-white text-destructive shadow-sm" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  Request Removal
                </button>
              </div>
            </div>

            <div className="space-y-6 p-5 pt-4 sm:space-y-8 sm:p-8 sm:pt-4">
              {requestType === 'edit' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Physical Count Update</Label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                      <Input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-16 rounded-2xl border-none bg-slate-50 pl-14 text-2xl font-black focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="on-display-location" className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Zone</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-primary/40" />
                      <select
                        id="on-display-location"
                        value={loc}
                        onChange={(e) => setLoc(e.target.value)}
                        className="h-16 w-full appearance-none rounded-2xl border-none bg-slate-50 py-0 pl-14 pr-4 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {availableLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                    </div>
                    <p className="px-1 text-[10px] font-medium text-muted-foreground">Select the zone where this product is currently placed.</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-destructive/[0.03] border border-destructive/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-[1.2rem] bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-destructive">Purge Protocol</p>
                      <p className="mt-1.5 text-xs font-medium leading-relaxed text-destructive/70">
                        Submit this request if the product is physically absent or requires total removal from the active registry.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "h-16 w-full rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98]",
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
                    Dispatch Sync Request
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-center gap-6 pt-6">
          <div className="h-px flex-1 bg-border/50" />
          <div className="flex items-center gap-2 opacity-30">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[8px] font-black uppercase tracking-[0.5em]">Identity Secured</span>
          </div>
          <div className="h-px flex-1 bg-border/50" />
        </div>
      </main>
    </div>
  );
}
