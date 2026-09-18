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
  Smartphone,
  User,
  Users,
  Zap,
  ArrowRight,
  Wifi,
  BellRing,
  Info
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
    <div className="space-y-6 p-1 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-1.5 border-b border-border/50 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-foreground">Manual Alert Dispatch</h3>
          </div>
          <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <Wifi className="mr-1.5 h-3 w-3" />
            Gateway Ready
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Identify a staff member to trigger immediate security notifications for their <span className="font-semibold text-foreground">On-Display</span> items.
        </p>
      </div>

      {/* CORE SELECTION */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Assign Target Personnel</Label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  'h-12 w-full justify-between rounded-xl border-border/60 bg-background px-4 text-sm font-medium transition-all shadow-sm',
                  popoverOpen && 'ring-2 ring-primary/20 border-primary/40'
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  {selectedStaff ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground/50" />
                  )}
                  <span className={cn(!selectedStaff && "text-muted-foreground/60")}>
                    {selectedStaff || 'Choose from registry...'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden shadow-2xl" align="start">
              <Command>
                <CommandInput placeholder="Search staff registry..." className="h-11" />
                <CommandList className="max-h-[240px]">
                  <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">No personnel identified.</CommandEmpty>
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

        {/* INFO BOX */}
        <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4 border border-border/40">
          <div className="mt-0.5 rounded-full bg-background p-1 shadow-sm">
            <Info className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-foreground">Industrial Handshake Protocol</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              A secure one-time token will be generated for every item identified under the 7-day threshold. SMS delivery is handled by the TextBee REST gateway.
            </p>
          </div>
        </div>

        {/* ACTION AREA */}
        <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                <BellRing className="h-4 w-4 text-primary mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-foreground">7-Day Threshold</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                <ShieldAlert className="h-4 w-4 text-orange-500 mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-foreground">Secure Tokens</span>
            </div>
        </div>

        <Button
          onClick={handleTrigger}
          disabled={!selectedStaff || isTriggering}
          className="h-12 w-full rounded-xl text-xs font-bold uppercase tracking-wide shadow-md transition-all active:scale-[0.985]"
        >
          {isTriggering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finalizing Handshake...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4 fill-current" />
              Dispatch Security Alert
              <ArrowRight className="ml-2 h-4 w-4 opacity-40" />
            </>
          )}
        </Button>
      </div>
      
      <div className="pt-2 text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Registry Control Terminal v5.2</p>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <label className={cn("block text-xs font-medium", className)}>
            {children}
        </label>
    );
}

