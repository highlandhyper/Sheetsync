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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const handleVerify = useCallback(
    async (providedPin?: string) => {
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
    },
    [accessKey, token]
  );

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
          title:
            requestType === 'delete'
              ? 'Removal protocol logged'
              : 'Registry update submitted',
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
      <div className="min-h-[100dvh] bg-white dark:bg-[#0a0a0f] text-black dark:text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 55%)',
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-[340px]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 mb-8">
            <UserCheck
              className="h-7 w-7 text-neutral-700 dark:text-neutral-300"
              strokeWidth={1.75}
            />
          </div>

          <h1 className="text-[28px] font-semibold tracking-tight mb-2">
            Protocol complete
          </h1>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mb-10">
            Session synchronized. Access key has been revoked.
          </p>

          <div className="w-full p-4 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 flex items-start gap-3 text-left mb-10">
            <ShieldCheck
              className="h-5 w-5 text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Identity handshake terminated. Registry session synchronized and
              access key revoked.
            </p>
          </div>

          <Button
            className="w-full h-11 rounded-xl bg-black dark:bg-white text-[14px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all border-none shadow-none"
            onClick={() => window.close()}
          >
            Close secure portal
          </Button>
        </div>
      </div>
    );
  }

  // --- OTP / VERIFICATION VIEW ---
  if (!isVerified) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#0a0a0f] text-black dark:text-white flex flex-col items-center justify-start pt-10 pb-12 px-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 55%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[340px] flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <button
              onClick={() => window.close()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <span className="text-[13px] text-neutral-400 dark:text-neutral-500">
              Help?
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="space-y-2 mb-10 text-center">
              <h1 className="text-[28px] font-semibold tracking-tight">
                Confirmation
              </h1>
              <p className="text-[14px] text-neutral-500 dark:text-neutral-400">
                Enter the 4-digit code sent to you by SMS.
              </p>
            </div>

            {/* OTP boxes */}
            <div className="relative flex items-center justify-center gap-3 mb-8">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-xl border text-2xl font-semibold transition-all',
                    'bg-neutral-50 dark:bg-white/5 text-black dark:text-white',
                    accessKey.length === index && !errorMessage
                      ? 'border-neutral-400 dark:border-white/30 ring-2 ring-black/5 dark:ring-white/10'
                      : 'border-neutral-200 dark:border-white/10',
                    errorMessage &&
                      'border-red-400/60 dark:border-red-400/40 bg-red-50/50 dark:bg-red-500/5'
                  )}
                >
                  {accessKey[index] ? (
                    <span className="animate-in zoom-in-75 duration-200">
                      {accessKey[index]}
                    </span>
                  ) : (
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 transition-all',
                        accessKey.length === index &&
                          'animate-pulse bg-neutral-500 dark:bg-neutral-400'
                      )}
                    />
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

            {errorMessage && (
              <p className="text-[13px] text-red-500 dark:text-red-400 mb-4 text-center">
                {errorMessage}
              </p>
            )}

            {isVerifying && (
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400 mb-4" />
            )}

            <p className="text-[13px] text-neutral-400 dark:text-neutral-500 text-center">
              You can request a new code if needed
            </p>
          </div>

          {/* Footer */}
          <div className="pt-10 flex flex-col items-center">
            <button
              onClick={() => window.close()}
              className="flex items-center gap-2 text-[14px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Return to portal
            </button>
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
    <div className="min-h-[100dvh] bg-white dark:bg-[#0a0a0f] text-black dark:text-white pb-28 relative overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-40 px-5 py-4 flex items-center justify-between bg-white/90 dark:bg-[#0a0a0f]/90 backdrop-blur-md border-b border-neutral-100 dark:border-white/5">
        <button
          onClick={() => router.push('/login')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-pulse" />
          Protocol active
        </div>

        <span className="text-[13px] text-neutral-400 dark:text-neutral-500 w-9 text-right">
          Help
        </span>
      </header>

      <main className="mx-auto max-w-[360px] px-5 py-6">
        {view === 'products' ? (
          <section className="space-y-6">
            <div className="space-y-1.5 text-center pt-2">
              <h1 className="text-[26px] font-semibold tracking-tight">
                Action queue
              </h1>
              <p className="text-[14px] text-neutral-500 dark:text-neutral-400">
                Select an item to update or remove.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {displayItems.map((it, idx) => {
                const isSynced = syncedItemIds.has(it.id);

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleSelectBatch(idx)}
                    className={cn(
                      'group flex items-center gap-3.5 w-full rounded-xl p-3.5 text-left transition-all active:scale-[0.99]',
                      'border border-neutral-150 dark:border-white/10',
                      'bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/[0.07]',
                      isSynced &&
                        'border-neutral-300 dark:border-white/20 bg-neutral-100/80 dark:bg-white/[0.08]'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
                        isSynced
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-neutral-200/80 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'
                      )}
                    >
                      {isSynced ? (
                        <Check className="h-5 w-5" strokeWidth={2.5} />
                      ) : (
                        <Package className="h-5 w-5" strokeWidth={1.75} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2
                        className={cn(
                          'line-clamp-1 text-[15px] font-medium leading-tight',
                          isSynced
                            ? 'text-neutral-600 dark:text-neutral-300'
                            : 'text-black dark:text-white'
                        )}
                      >
                        {it.productName}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                        <span>{it.quantity} units</span>
                        <span className="text-neutral-300 dark:text-neutral-600">
                          ·
                        </span>
                        <span>{it.location || 'Unmapped'}</span>
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform group-active:translate-x-0.5',
                        isSynced
                          ? 'text-neutral-300 dark:text-neutral-600'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}
                      strokeWidth={1.75}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setView('products')}
              className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Back to queue
            </button>

            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                <Package
                  className="h-6 w-6 text-neutral-700 dark:text-neutral-300"
                  strokeWidth={1.75}
                />
              </div>
              <div>
                <p className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
                  Selected item
                </p>
                <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
                  {currentItem?.productName}
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 p-4">
                <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  Current count
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {currentItem?.quantity}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 p-4">
                <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  Zone
                </p>
                <p className="truncate text-[13px] font-medium">
                  {currentItem?.location || 'Unmapped'}
                </p>
              </div>
            </div>

            <div className="space-y-5 pt-2">
              {/* Edit / Delete toggle */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setRequestType('edit')}
                  className={cn(
                    'flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-all',
                    requestType === 'edit'
                      ? 'bg-white dark:bg-white text-black shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                  )}
                >
                  <Edit className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Adjust
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('delete')}
                  className={cn(
                    'flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-all',
                    requestType === 'delete'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Remove
                </button>
              </div>

              {requestType === 'edit' ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
                      Units observed
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={qty}
                      onChange={(e) =>
                        setQty(
                          e.target.value === '' ? 0 : parseFloat(e.target.value)
                        )
                      }
                      className="h-16 text-center rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-3xl font-semibold tabular-nums text-black dark:text-white focus-visible:ring-0 focus-visible:border-neutral-400 dark:focus-visible:border-white/25 shadow-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
                      Zone mapping
                    </Label>
                    <button
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                      className="relative flex h-11 w-full items-center rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 pl-10 pr-10 text-left text-[14px] font-medium outline-none hover:bg-neutral-100 dark:hover:bg-white/[0.07] transition-all"
                    >
                      <MapPin
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                        strokeWidth={1.75}
                      />
                      <span className="truncate text-black dark:text-white">
                        {loc || 'Select zone'}
                      </span>
                      <ChevronsUpDown
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 mb-3">
                    <Trash2 className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h4 className="text-[15px] font-semibold text-black dark:text-white">
                    Permanent removal
                  </h4>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-[200px] mx-auto">
                    This will request removal of the item from the registry.
                  </p>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  'h-11 w-full rounded-xl text-[14px] font-medium transition-all active:scale-[0.98] border-none shadow-none',
                  requestType === 'delete'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <SendHorizontal className="h-4 w-4" strokeWidth={1.75} />
                    {requestType === 'delete'
                      ? 'Authorize removal'
                      : 'Synchronize'}
                  </span>
                )}
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER PROGRESS */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0a0a0f] dark:via-[#0a0a0f]">
        <div className="mx-auto flex max-w-[360px] items-center gap-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-2.5 rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/30">
          <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <svg className="h-9 w-9 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 15}`}
                  strokeDashoffset={`${2 * Math.PI * 15 * (1 - progress / 100)}`}
                  className="text-black dark:text-white transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-semibold tabular-nums">
                  {progress}%
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Synced
              </p>
              <p className="text-[13px] font-medium tabular-nums">
                {syncedItemIds.size} / {items.length}
              </p>
            </div>
          </div>

          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || syncedItemIds.size === 0}
            className="h-9 shrink-0 rounded-xl bg-black dark:bg-white px-4 text-[13px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-30 transition-all border-none shadow-none"
          >
            {isFinalizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5">
                Finalize
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Location picker */}
      <Dialog open={isLocationPickerOpen} onOpenChange={setIsLocationPickerOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 p-0 shadow-2xl bg-white dark:bg-neutral-950">
          <DialogHeader className="border-b border-neutral-100 dark:border-white/5 px-5 py-5 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-black dark:text-white">
              Zone mapping
            </DialogTitle>
            <DialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              Select target storage region
            </DialogDescription>
          </DialogHeader>
          <Command className="min-h-0 flex-1 rounded-none bg-transparent">
            <CommandInput
              placeholder="Search zones..."
              className="h-12 px-5 text-[14px] border-b border-neutral-100 dark:border-white/5"
            />
            <CommandList className="max-h-[min(52dvh,360px)] p-2">
              <CommandEmpty className="py-10 text-[13px] text-neutral-400 text-center">
                No zones found
              </CommandEmpty>
              <CommandGroup>
                {availableLocations.map((location) => (
                  <CommandItem
                    key={location}
                    value={location}
                    onSelect={() => {
                      setLoc(location);
                      setIsLocationPickerOpen(false);
                    }}
                    className="h-12 rounded-xl text-[14px] font-medium px-4 cursor-pointer mb-0.5 data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-white/10"
                  >
                    <Check
                      className={cn(
                        'mr-3 h-4 w-4',
                        loc === location ? 'opacity-100' : 'opacity-0'
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate">{location}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t border-neutral-100 dark:border-white/5 p-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsLocationPickerOpen(false)}
              className="h-10 w-full rounded-xl text-[13px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
