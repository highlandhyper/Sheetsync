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
  Smartphone,
  User,
  Users,
  Zap,
  ArrowRight,
  Wifi,
  BellRing,
  Info,
  KeyRound
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
import { Label } from '@/components/ui/label';

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
          title: 'Protocol Dispatched',
          description: res.message || `Alerts successfully routed to ${selectedStaff}.`,
        });
        setSelectedStaff('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Handshake Failed',
          description: res.message || 'The registry protocol could not be initiated.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'System Error',
        description: 'Communication timeout with industrial registry.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">SMS Alert Dispatch</h3>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">On-Display protocol</p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5">
          <Wifi className="mr-1 h-3 w-3" />
          Active
        </Badge>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold text-muted-foreground ml-1">Select Target Personnel</Label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={popoverOpen}
                className={cn(
                  'h-12 w-full justify-between rounded-xl border-border/60 bg-background px-4 text-sm font-medium transition-all shadow-none',
                  popoverOpen && 'border-primary/40 ring-2 ring-primary/10'
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  {selectedStaff ? (
                    <User className="h-4 w-4 text-primary" />
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground/50" />
                  )}
                  <span className={cn(!selectedStaff && "text-muted-foreground/60")}>
                    {selectedStaff || 'Search personnel...'}
                  </span>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-40" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl border-border/60" align="start">
              <Command>
                <CommandInput placeholder="Type staff name..." className="h-11" />
                <CommandList className="max-h-[240px]">
                  <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">No staff found.</CommandEmpty>
                  <CommandGroup>
                    {staffList.map((name) => (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => {
                          setSelectedStaff(name);
                          setPopoverOpen(false);
                        }}
                        className="flex h-11 items-center px-4 text-sm font-medium cursor-pointer"
                      >
                        <Check className={cn("mr-2 h-4 w-4 text-primary", selectedStaff === name ? "opacity-100" : "opacity-0")} />
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="rounded-2xl bg-muted/40 p-4 border border-border/40 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-background p-1.5 shadow-sm">
              <Info className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground">Registry Handshake</p>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Triggering this will scan for items expiring within 7 days and dispatch one-time access links via the SMS gateway.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-xl bg-background/50 p-2.5 text-center">
              <BellRing className="mx-auto h-3.5 w-3.5 text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-tight">7D Threshold</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-background/50 p-2.5 text-center">
              <KeyRound className="mx-auto h-3.5 w-3.5 text-orange-500" />
              <span className="text-[9px] font-bold uppercase tracking-tight">One-Time PIN</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleTrigger}
          disabled={!selectedStaff || isTriggering}
          className="h-14 w-full rounded-2xl text-xs font-black uppercase tracking-[0.1em] shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
        >
          {isTriggering ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing Dispatch...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4 fill-current" />
              Start Manual Trigger
              <ArrowRight className="ml-2 h-4 w-4 opacity-40" />
            </>
          )}
        </Button>
      </div>

      <div className="pt-2 text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">SheetSync Registry Control Terminal</p>
      </div>
    </div>
  );
}
