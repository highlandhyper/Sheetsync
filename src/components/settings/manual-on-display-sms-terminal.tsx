'use client';

import { useMemo, useState } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Zap,
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { triggerManualOnDisplaySmsAction } from '@/app/actions';
import { cn } from '@/lib/utils';

export function ManualOnDisplaySmsTerminal() {
  const { uniqueStaffNames } = useDataCache();
  const { toast } = useToast();

  const [selectedStaff, setSelectedStaff] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const staffList = useMemo(() => {
    if (!uniqueStaffNames || !Array.isArray(uniqueStaffNames)) return [];

    return [...uniqueStaffNames]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [uniqueStaffNames]);

  const handleTrigger = async () => {
    if (!selectedStaff) return;

    setIsTriggering(true);

    try {
      const res = await triggerManualOnDisplaySmsAction(selectedStaff);

      if (res.success) {
        toast({
          title: 'Alert Dispatched',
          description:
            res.message ||
            `Successfully notified ${selectedStaff} of On-Display items.`,
        });
        setSelectedStaff('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Action Blocked',
          description:
            res.message || 'The protocol could not be finalized.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: 'Communication failure with registry core.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)]">
        {/* HEADER */}
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-primary/[0.08] via-white to-white px-5 py-6 sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-primary/[0.07] blur-2xl" />

          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Smartphone className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">
                  Manual SMS Dispatch
                </h3>

                <Badge
                  variant="outline"
                  className="h-5 rounded-full border-emerald-200 bg-emerald-50 px-2 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700"
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ready
                </Badge>
              </div>

              <p className="mt-1.5 max-w-xl text-[10px] leading-5 text-slate-500 sm:text-[11px]">
                Select a staff member to immediately send their On-Display
                expiry alert. Only items within the 7-day expiry threshold
                are included.
              </p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr] lg:items-end">
            {/* STAFF SELECTOR */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Assigned Personnel
                  </label>
                </div>

                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300">
                  {staffList.length} Available
                </span>
              </div>

              <Popover
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                modal={true}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className={cn(
                      'h-14 w-full justify-between rounded-2xl border-slate-200 bg-slate-50 px-4 shadow-inner transition-all',
                      'hover:bg-white hover:border-primary/20',
                      popoverOpen &&
                        'border-primary/30 bg-white ring-4 ring-primary/10'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-100">
                        <User className="h-3.5 w-3.5" />
                      </div>

                      <span
                        className={cn(
                          'truncate text-left text-xs font-black uppercase tracking-wide',
                          !selectedStaff &&
                            'font-medium normal-case tracking-normal text-slate-400'
                        )}
                      >
                        {selectedStaff || 'Select personnel...'}
                      </span>
                    </div>

                    <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 text-slate-300" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[--radix-popover-trigger-width] overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Command
                    className="w-full"
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase())
                        ? 1
                        : 0
                    }
                  >
                    <div className="border-b border-slate-100 p-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                        <CommandInput
                          placeholder="Search personnel..."
                          className="h-10 border-0 bg-slate-50 pl-9 text-xs font-semibold focus:ring-0"
                        />
                      </div>
                    </div>

                    <CommandList className="max-h-64 overflow-y-auto p-1">
                      <CommandEmpty className="py-8 text-center text-[9px] font-black uppercase tracking-widest text-slate-300">
                        No personnel found
                      </CommandEmpty>

                      <CommandGroup>
                        {staffList.map((name) => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => {
                              setSelectedStaff(name);
                              setPopoverOpen(false);
                            }}
                            className="h-11 cursor-pointer rounded-xl px-3 text-xs font-bold transition-colors data-[selected=true]:bg-primary/5"
                          >
                            <div className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                              <User className="h-3.5 w-3.5" />
                            </div>

                            <span className="min-w-0 flex-1 truncate uppercase">
                              {name}
                            </span>

                            <Check
                              className={cn(
                                'h-4 w-4 text-primary',
                                selectedStaff === name
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedStaff ? (
                <div className="flex items-center gap-2 px-1 pt-0.5 text-[9px] font-bold text-emerald-600">
                  <Check className="h-3 w-3" />
                  Recipient selected
                </div>
              ) : (
                <p className="px-1 text-[9px] text-slate-400">
                  Choose the staff member who should receive the alert.
                </p>
              )}
            </div>

            {/* DISPATCH */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Dispatch Action
                </p>
              </div>

              <Button
                onClick={handleTrigger}
                disabled={!selectedStaff || isTriggering}
                className={cn(
                  'h-14 w-full rounded-2xl text-[9px] font-black uppercase tracking-[0.18em] shadow-xl shadow-primary/20 transition-all active:scale-[0.985]',
                  'disabled:cursor-not-allowed disabled:opacity-45'
                )}
              >
                {isTriggering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Alert...
                  </>
                ) : (
                  <>
                    <SendIcon className="mr-2 h-4 w-4" />
                    Dispatch Manual Alert
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* PROTOCOL INFORMATION */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Alert Scope
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-600">
                  Expiry threshold: 7 days
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Delivery
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-600">
                  Secure SMS dispatch
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="text-[8px] font-black uppercase tracking-[0.22em]">
              Secure Handshake
            </span>
          </div>

          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300">
            Protocol v5.1
          </span>
        </div>
      </div>
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
