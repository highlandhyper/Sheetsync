'use client';

import { useState, useTransition, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  verifyOnDisplayTokenAction,
  submitOnDisplayRequestAction,
} from '@/app/actions';
import type { InventoryItem } from '@/lib/types';

import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  CheckCircle2,
  Clock3,
  Hash,
  KeyRound,
  Loader2,
  LockKeyhole,
  MapPin,
  Package,
  Save,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  ChevronRight,
  Info,
  Layers,
  ArrowLeft
} from 'lucide-react';

import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function OnDisplayStaffPage() {
  const { token } = useParams() as { token: string };
  const { toast } = useToast();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState(false);

  const [accessKey, setAccessKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [qty, setQty] = useState<number>(0);
  const [loc, setLoc] = useState('');
  const [requestType, setRequestType] = useState<'edit' | 'delete'>('edit');

  const handleVerify = async () => {
    if (!accessKey || accessKey.length < 4) return;

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await verifyOnDisplayTokenAction(token, accessKey);

      if (res.success && res.data) {
        setItem(res.data);
        setQty(res.data.quantity);
        setLoc(res.data.location);
        setIsVerified(true);

        toast({
          title: 'Identity Confirmed',
          description: 'Terminal session authorized.',
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

  const handleSubmit = async () => {
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
          description: 'Admin approval pending.',
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

  const expiryLabel = item?.expiryDate
    ? format(parseISO(item.expiryDate), 'dd MMM yyyy')
    : 'NO DATA';

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.03]" />
        <Card className="relative z-10 w-full max-w-sm overflow-hidden border-none bg-transparent shadow-none text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-8 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Sync Complete</h1>
          <p className="mt-4 text-sm font-medium text-muted-foreground leading-relaxed">
            Your request has been dispatched to the master registry for administrative review.
          </p>
          <div className="mt-10 p-6 rounded-3xl bg-muted/30 border border-border/50 text-left">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audit Trace Recorded</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.05]" />
        <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
        
        <div className="relative z-10 w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary shadow-sm border border-primary/20 rotate-3">
              <LockKeyhole className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Handshake</h1>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Security Protocol Required</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Access PIN</Label>
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
                    "h-16 w-full rounded-2xl border-none bg-muted/40 pl-14 pr-4 text-center text-3xl font-black tracking-[0.6em] transition-all focus:bg-muted/60 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/20",
                    errorMessage && "bg-destructive/5 ring-2 ring-destructive/20"
                  )}
                />
              </div>
              {errorMessage ? (
                <p className="text-[10px] font-bold text-destructive text-center uppercase tracking-widest">{errorMessage}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center font-medium opacity-50 uppercase tracking-widest">Check your SMS for the 4-digit key</p>
              )}
            </div>

            <Button
              onClick={handleVerify}
              disabled={accessKey.length < 4 || isVerifying}
              className="h-14 w-full rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
            >
              {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
            </Button>
          </div>

          <div className="pt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[8px] font-black uppercase tracking-[0.4em]">SheetSync Secure Node</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b bg-background/80 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black uppercase tracking-tight text-foreground">Personnel Portal</h2>
              <p className="text-[9px] font-bold text-primary uppercase tracking-widest leading-none">On-Display Registry</p>
            </div>
          </div>
          <Badge variant="outline" className="h-7 border-emerald-500/20 bg-emerald-500/5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
            <span className="mr-1.5 h-1 w-1 rounded-full bg-emerald-500" /> Authorized
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* PRODUCT CARD */}
        <Card className="overflow-hidden rounded-3xl border-none bg-background shadow-sm ring-1 ring-border/50">
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/40 text-primary">
                <Package className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Stock Item Identity</p>
                <CardTitle className="text-xl font-black text-foreground leading-tight">{item!.productName}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="font-mono text-[9px] h-6 bg-muted/20 border-none">{item!.barcode}</Badge>
                  <Badge variant="secondary" className="text-[9px] h-6 font-bold uppercase tracking-widest bg-primary/5 text-primary border-none">{item!.itemType}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/30 p-4 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">In Stock</span>
                </div>
                <p className="text-2xl font-black text-foreground">{item!.quantity} <span className="text-[10px] opacity-40 font-bold">UNITS</span></p>
              </div>
              <div className="rounded-2xl bg-muted/30 p-4 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Lifecycle</span>
                </div>
                <p className="text-sm font-black text-foreground uppercase">{expiryLabel}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* REQUEST SECTION */}
        <div className="space-y-4">
          <div className="px-1 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Adjust Registry</h3>
            <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.1em]">Verification Level 2</span>
          </div>

          <Card className="rounded-3xl border-none bg-background shadow-sm ring-1 ring-border/50 overflow-hidden">
            <div className="p-1">
              <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 rounded-[1.4rem]">
                <button
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    "h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'edit' ? "bg-background text-primary shadow-sm" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  Edit Count
                </button>
                <button
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    "h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    requestType === 'delete' ? "bg-background text-destructive shadow-sm" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  Request Removal
                </button>
              </div>
            </div>

            <div className="p-6 pt-2 space-y-6">
              {requestType === 'edit' ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Physical Count</Label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                      <Input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => setQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="h-14 rounded-2xl border-none bg-muted/30 pl-12 text-xl font-black focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Update Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                      <Input
                        value={loc}
                        onChange={(e) => setLoc(e.target.value)}
                        placeholder="Current Zone..."
                        className="h-14 rounded-2xl border-none bg-muted/30 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight text-destructive">Removal Protocol</p>
                      <p className="mt-1 text-[11px] font-medium leading-relaxed text-destructive/70">
                        Select this if the product is no longer present or needs to be purged from the active On-Display registry.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "h-14 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98]",
                  requestType === 'delete' ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <SendHorizontal className="mr-2 h-4 w-4" />
                    Dispatch Request
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-center gap-4 pt-4">
          <div className="h-px flex-1 bg-border/50" />
          <div className="flex items-center gap-1.5 opacity-20">
            <ShieldCheck className="h-3 w-3" />
            <span className="text-[7px] font-black uppercase tracking-[0.5em]">Identity Secured</span>
          </div>
          <div className="h-px flex-1 bg-border/50" />
        </div>
      </main>
    </div>
  );
}
