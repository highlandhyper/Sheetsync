'use client';

import { useState, useTransition, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  verifyOnDisplayTokenAction,
  submitOnDisplayRequestAction,
  finalizeOnDisplaySessionAction,
} from '@/app/actions';
import type { InventoryItem } from '@/lib/types';

import {
  AlertTriangle,
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
  Edit3,
} from 'lucide-react';

import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
  const [view, setView] = useState<'products' | 'edit'>('products');

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
          title: 'Access confirmed',
          description: `${res.data.length} item${res.data.length === 1 ? '' : 's'} loaded.`,
        });
      } else {
        setErrorMessage(res.message || 'Invalid access key.');
      }
    } catch {
      setErrorMessage('Connection failed. Please try again.');
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
          title: requestType === 'delete' ? 'Removal logged' : 'Update submitted',
          description: `${item.productName} has been synced.`,
        });
        setView('products');
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync failed',
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
            title: 'Session error',
            description: res.message,
          });
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Session error',
          description: 'Could not finalize the session.',
        });
      }
    });
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center">
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/25">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
          </div>

          <Badge className="mb-4 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-500/10">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Session secured
          </Badge>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            All done
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Your inventory adjustments have been synchronized successfully.
          </p>

          <Card className="mt-7 w-full rounded-3xl border bg-card p-5 text-left shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold">Registry secured</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Link expired and cleared
                </p>
              </div>
            </div>
          </Card>

          <Button
            variant="outline"
            className="mt-5 h-12 w-full rounded-2xl"
            onClick={() => window.close()}
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <div className="pt-8 text-center sm:pt-0">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 ring-8 ring-primary/5">
              <LockKeyhole className="h-9 w-9 text-primary" strokeWidth={1.8} />
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight">
              Staff access
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
              Enter the 4-digit access key to open this On Display session.
            </p>
          </div>

          <Card className="mt-8 rounded-3xl border p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
              <div>
                <Label
                  htmlFor="access-key"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Access key
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
                    'mt-2 h-20 rounded-2xl text-center text-4xl font-black tracking-[0.45em] tabular-nums',
                    errorMessage && 'border-destructive focus-visible:ring-destructive'
                  )}
                />

                {errorMessage && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-destructive">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs font-medium leading-5">{errorMessage}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={handleVerify}
                disabled={accessKey.length < 4 || isVerifying}
                className="h-14 w-full rounded-2xl text-sm font-bold"
              >
                {isVerifying ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </Card>

          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure staff portal
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
    <div className="min-h-[100dvh] bg-muted/20 pb-32">
      {/* Mobile-first sticky header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">On Display</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active session
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="h-10 shrink-0 rounded-xl px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="mr-1.5 h-4 w-4" />
                Exit
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:space-y-6 sm:py-8">
        {view === 'products' ? (
          <>
            {/* Product-first landing screen */}
            <section>
              <div className="mb-3 px-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Products to check
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap a product name to open its adjustment page.
                </p>
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
                        'group flex min-h-[92px] w-full items-center gap-4 rounded-3xl border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.985]',
                        isSynced
                          ? 'border-emerald-500/25 bg-emerald-500/[0.035]'
                          : 'border-border hover:border-primary/30 hover:bg-primary/[0.02]'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
                          isSynced
                            ? 'bg-emerald-500 text-white'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {isSynced ? (
                          <Check className="h-6 w-6" strokeWidth={3} />
                        ) : (
                          <Package className="h-6 w-6" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="line-clamp-2 text-base font-black leading-tight tracking-tight">
                            {it.productName}
                          </h2>
                          {isSynced && (
                            <Badge className="shrink-0 rounded-full bg-emerald-500/10 text-[9px] text-emerald-600 hover:bg-emerald-500/10">
                              Done
                            </Badge>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold">
                            Qty {it.quantity}
                          </span>
                          <span>•</span>
                          <span>{it.location || 'No location'}</span>
                          <span>•</span>
                          <span>
                            {it.expiryDate
                              ? format(parseISO(it.expiryDate), 'dd MMM yyyy')
                              : 'No expiry'}
                          </span>
                        </div>

                        {it.barcode && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                            <Barcode className="h-3 w-3" />
                            <span className="font-mono">{it.barcode}</span>
                          </div>
                        )}
                      </div>

                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/40 transition-transform group-active:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">Quick workflow</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Tap the product you want to check, update the quantity or
                    location, then return here for the next product.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Edit page */}
            <section>
              <button
                type="button"
                onClick={() => setView('products')}
                className="mb-4 flex min-h-10 items-center gap-1 rounded-xl px-1 text-sm font-semibold text-primary"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Products
              </button>

              <Card className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Package className="h-7 w-7" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Edit product
                      </p>
                      <h1 className="mt-1 text-xl font-black leading-tight tracking-tight sm:text-2xl">
                        {currentItem?.productName}
                      </h1>

                      {currentItem?.barcode && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Barcode className="h-3.5 w-3.5" />
                          <span className="font-mono">
                            {currentItem.barcode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-muted/60 p-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Layers className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Current qty
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-black tabular-nums">
                        {currentItem?.quantity}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-muted/60 p-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Expiry
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-bold">
                        {currentItem?.expiryLabel || 'No expiry'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </section>

            <section>
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <Database className="h-4 w-4 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Adjustment
                </p>
              </div>

              <Card className="rounded-3xl border bg-card shadow-sm">
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setRequestType('edit')}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all',
                        requestType === 'edit'
                          ? 'bg-background text-primary shadow-sm'
                          : 'text-muted-foreground'
                      )}
                    >
                      <Edit3 className="h-4 w-4" />
                      Adjust quantity
                    </button>

                    <button
                      type="button"
                      onClick={() => setRequestType('delete')}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all',
                        requestType === 'delete'
                          ? 'bg-background text-destructive shadow-sm'
                          : 'text-muted-foreground'
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove item
                    </button>
                  </div>

                  {requestType === 'edit' ? (
                    <div className="mt-5 space-y-5">
                      <div>
                        <Label
                          htmlFor="on-display-qty"
                          className="text-xs font-bold text-muted-foreground"
                        >
                          Observed quantity
                        </Label>

                        <div className="relative mt-2">
                          <Hash className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
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
                            className="h-16 rounded-2xl pl-11 text-2xl font-black tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <Label
                          htmlFor="on-display-location"
                          className="text-xs font-bold text-muted-foreground"
                        >
                          Display location
                        </Label>

                        <div className="relative mt-2">
                          <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                          <select
                            id="on-display-location"
                            value={loc}
                            onChange={(e) => setLoc(e.target.value)}
                            className="h-16 w-full appearance-none rounded-2xl border border-input bg-background pl-11 pr-10 text-sm font-semibold outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                          >
                            {availableLocations.map((location) => (
                              <option key={location} value={location}>
                                {location}
                              </option>
                            ))}
                          </select>
                          <ChevronsUpDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-destructive">
                            Remove this item?
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Use this only when the item is no longer present in
                            the designated display area.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={cn(
                      'mt-5 h-14 w-full rounded-2xl text-sm font-bold',
                      requestType === 'delete' &&
                        'bg-destructive hover:bg-destructive/90'
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <SendHorizontal className="mr-2 h-5 w-5" />
                        {requestType === 'delete'
                          ? 'Submit removal'
                          : isCurrentItemSynced
                            ? 'Update request'
                            : 'Submit adjustment'}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </section>
          </>
        )}

        {/* Compact guidance */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Process every item</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Each batch is a separate registry entry.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Finalize when finished</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Close the session after all required updates are submitted.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}% 100%)`,
              }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-[10px] font-black tabular-nums">
                {progress}%
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <p className="truncate text-sm font-bold">
                {syncedItemIds.size} of {items.length} completed
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-12 shrink-0 rounded-2xl bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Finish
                <Check className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
