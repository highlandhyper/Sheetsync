'use client';

import { useState, useTransition } from 'react';
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
  const [requestType, setRequestType] =
    useState<'edit' | 'delete'>('edit');

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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-5">
        <div className="absolute inset-0 bg-tech-grid opacity-20" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        <Card className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.98] shadow-2xl">
          <CardContent className="p-8 text-center sm:p-10">
            <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-emerald-50 text-emerald-600 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <Badge className="mb-4 border-emerald-200 bg-emerald-50 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700 hover:bg-emerald-50">
              Request Accepted
            </Badge>

            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              Update Submitted
            </h1>

            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-500">
              Your registry request has been securely dispatched to
              Highland Hypermarket Admin for approval.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Audit Status
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-700">
                    Trace recorded successfully
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-7 text-[8px] font-black uppercase tracking-[0.35em] text-slate-300">
              One-Time Token • Secure Node
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isVerified) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-4 sm:p-6">
        <div className="absolute inset-0 bg-tech-grid opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(241,245,249,0.92)_78%)]" />

        <Card className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.28)]">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-b from-primary/[0.07] to-white px-7 pb-7 pt-8 text-center sm:px-9 sm:pt-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-white text-primary shadow-lg ring-1 ring-primary/10">
              <LockKeyhole className="h-7 w-7" />
            </div>

            <Badge
              variant="outline"
              className="mx-auto mb-3 h-6 rounded-full border-primary/15 bg-primary/[0.06] px-3 text-[8px] font-black uppercase tracking-[0.18em] text-primary"
            >
              Verification Required
            </Badge>

            <CardTitle className="text-2xl font-black tracking-tight text-slate-950">
              Security Handshake
            </CardTitle>

            <CardDescription className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-500">
              Authenticate this terminal session to access the
              on-display registry record.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-7 p-7 sm:p-9">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label
                  htmlFor="pin"
                  className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500"
                >
                  Registry Access Key
                </Label>

                <span className="text-[9px] font-bold text-slate-300">
                  4 DIGITS
                </span>
              </div>

              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />

                <Input
                  id="pin"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="••••"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value.replace(/\D/g, ''));
                    setErrorMessage('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerify();
                  }}
                  className={cn(
                    'h-16 rounded-2xl border-slate-200 bg-slate-50 pl-12 text-center text-3xl font-black tracking-[0.65em] shadow-inner transition-all',
                    'placeholder:text-slate-200 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10',
                    errorMessage &&
                      'border-red-200 bg-red-50/40 focus-visible:ring-red-500/10'
                  )}
                  aria-invalid={Boolean(errorMessage)}
                />
              </div>

              {errorMessage ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em]">
                    {errorMessage}
                  </p>
                </div>
              ) : (
                <p className="px-4 text-center text-[10px] leading-5 text-slate-400">
                  Enter the 4-digit code provided in your SMS.
                </p>
              )}
            </div>

            <Button
              onClick={handleVerify}
              disabled={accessKey.length < 4 || isVerifying}
              className="h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.22em] shadow-xl shadow-primary/20 transition-all active:scale-[0.985]"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying Session
                </>
              ) : (
                <>
                  Authorize Session
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="justify-center border-t border-slate-100 bg-slate-50/70 px-6 py-5">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[8px] font-black uppercase tracking-[0.3em]">
                SheetSync Secure Node
              </span>
            </div>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-6 pb-12 sm:px-6 sm:py-10">
      <div className="absolute inset-0 bg-tech-grid opacity-25" />

      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-200/70">
              <ShieldAlert className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-slate-950">
                Highland Hypermarket
              </p>
              <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                On-Display Registry
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="shrink-0 rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700"
          >
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Authorized
          </Badge>
        </header>

        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-primary/[0.07] via-white to-white p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-primary/10">
                <Package className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Registry Record
                </p>

                <CardTitle className="truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {item!.productName}
                </CardTitle>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-lg border-slate-200 bg-white font-mono text-[9px] font-bold text-slate-500"
                  >
                    <Barcode className="mr-1.5 h-3 w-3 text-slate-400" />
                    {item!.barcode}
                  </Badge>

                  <Badge
                    variant="outline"
                    className="rounded-lg border-primary/10 bg-primary/[0.04] text-[9px] font-bold text-primary"
                  >
                    {item!.itemType}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-7 p-6 sm:p-7">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Current Record
                </p>
                <span className="text-[9px] font-bold text-slate-300">
                  READ ONLY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Hash className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Quantity
                    </span>
                  </div>

                  <p className="text-2xl font-black tracking-tight text-slate-950">
                    {item!.quantity}
                    <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      units
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Clock3 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Expiry
                    </span>
                  </div>

                  <p className="text-sm font-black uppercase tracking-tight text-slate-950">
                    {expiryLabel}
                  </p>
                </div>
              </div>
            </section>

            <Separator className="bg-slate-100" />

            <section>
              <div className="mb-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Request Type
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Select the change required for this registry entry.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 shadow-inner">
                <Button
                  type="button"
                  variant={requestType === 'edit' ? 'default' : 'ghost'}
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    'h-12 rounded-xl text-[9px] font-black uppercase tracking-[0.16em]',
                    requestType === 'edit'
                      ? 'shadow-md'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                  )}
                >
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Adjust Record
                </Button>

                <Button
                  type="button"
                  variant={requestType === 'delete' ? 'destructive' : 'ghost'}
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    'h-12 rounded-xl text-[9px] font-black uppercase tracking-[0.16em]',
                    requestType === 'delete'
                      ? 'bg-red-600 shadow-md hover:bg-red-600'
                      : 'text-slate-500 hover:bg-white/70 hover:text-red-600'
                  )}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Request Removal
                </Button>
              </div>
            </section>

            {requestType === 'edit' ? (
              <section className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="rounded-2xl border border-primary/10 bg-primary/[0.025] p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Physical Count
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Enter the quantity currently observed on display.
                    </p>
                  </div>

                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                    <Input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => {
                        const value = e.target.value;
                        setQty(value === '' ? 0 : parseFloat(value));
                      }}
                      className="h-14 rounded-xl border-slate-200 bg-white pl-11 text-lg font-black shadow-sm focus-visible:ring-4 focus-visible:ring-primary/10"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white">
                  <div className="border-b border-slate-100 px-4 pb-3 pt-4 sm:px-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Destination Zone
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Update the physical location if required.
                    </p>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                      <Input
                        value={loc}
                        onChange={(e) => setLoc(e.target.value)}
                        placeholder="Enter location"
                        className="h-14 rounded-xl border-slate-200 bg-slate-50 pl-11 text-sm font-bold shadow-inner focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm ring-1 ring-red-100">
                      <AlertTriangle className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-tight text-red-900">
                        Removal Request
                      </p>
                      <p className="mt-1.5 text-[11px] leading-5 text-red-700/75">
                        This will send a request to management to remove
                        this product from the On-Display registry. The
                        record is not deleted immediately.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                'h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.985]',
                requestType === 'delete'
                  ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700'
                  : 'shadow-primary/20'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Synchronizing Request
                </>
              ) : (
                <>
                  <SendHorizontal className="mr-2 h-4 w-4" />
                  Dispatch {requestType === 'delete' ? 'Removal' : 'Update'}
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[8px] font-black uppercase tracking-[0.25em]">
                  Audit Trace Logged
                </span>
              </div>

              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300">
                Secure Session
              </span>
            </div>
          </CardFooter>
        </Card>

        <div className="mt-5 flex items-center justify-center gap-2 text-slate-400">
          <ShieldCheck className="h-3 w-3" />
          <p className="text-[8px] font-bold uppercase tracking-[0.22em]">
            Authorized staff terminal
          </p>
        </div>
      </div>
    </main>
  );
}
