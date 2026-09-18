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
  ArrowRight,
  Terminal,
  Wifi,
  BellRing
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
          description: res.message || `Successfully notified ${selectedStaff} of On-Display items.`,
        });
        setSelectedStaff('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Dispatch Blocked',
          description: res.message || 'The protocol handshake could not be finalized.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Registry Error',
        description: 'Communication failure with industrial registry core.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-700">
      <div className="overflow-hidden rounded-[2.5rem] border border-border/60 bg-card shadow-3xl">
        {/* HEADER: INDUSTRIAL BRANDING */}
        <div className="relative overflow-hidden border-b border-border/50 bg-muted/20 px-6 py-8 sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-tech-grid opacity-30" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30">
              <Terminal className="h-7 w-7" strokeWidth={2.5} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-black uppercase tracking-tighter text-foreground sm:text-2xl">
                  SMS Control <span className="text-primary">Center</span>
                </h3>

                <Badge
                  variant="outline"
                  className="h-6 rounded-lg border-emerald-500/20 bg-emerald-500/10 px-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400"
                >
                  <Wifi className="mr-1.5 h-3 w-3 animate-pulse" />
                  Link Ready
                </Badge>
              </div>

              <p className="mt-2 max-w-xl text-[11px] font-medium leading-relaxed text-muted-foreground sm:text-xs">
                Immediately trigger the 7-day expiry protocol for a specific staff member.
                The system will generate secure one-time tokens for all their items in the <span className="font-bold text-foreground">On Display</span> registry.
              </p>
            </div>
          </div>
        </div>

        {/* BODY: SELECTION & ACTION */}
        <div className="p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-1">
            
            {/* PERSONNEL SELECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Identify Personnel
                  </label>
                </div>

                <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">
                  {staffList.length} IN REGISTRY
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
                    className={cn(
                      'h-16 w-full justify-between rounded-3xl border-border/60 bg-muted/30 px-6 shadow-inner transition-all',
                      'hover:border-primary/30 hover:bg-background',
                      popoverOpen && 'border-primary/50 bg-background ring-4 ring-primary/10'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
                        selectedStaff ? "bg-primary text-primary-foreground shadow-lg" : "bg-background text-muted-foreground border border-border/50"
                      )}>
                        <User className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0 text-left">
                        <p className={cn(
                          "truncate text-[13px] font-black uppercase tracking-wide leading-none",
                          !selectedStaff && "text-muted-foreground/30 font-bold"
                        )}>
                          {selectedStaff || 'Choose from registry...'}
                        </p>
                        <p className="mt-1 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                          Target Recipient Node
                        </p>
                      </div>
                    </div>

                    <ChevronsUpDown className="ml-3 h-5 w-5 shrink-0 text-muted-foreground/30" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[--radix-popover-trigger-width] overflow-hidden rounded-[2rem] border-border/60 p-0 shadow-3xl"
                  align="start"
                >
                  <Command className="w-full">
                    <div className="border-b border-border/50 bg-muted/20 p-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                        <CommandInput
                          placeholder="SEARCH PERSONNEL..."
                          className="h-11 border-none bg-transparent pl-9 text-[11px] font-bold uppercase tracking-widest focus:ring-0"
                        />
                      </div>
                    </div>

                    <CommandList className="max-h-[280px] p-2">
                      <CommandEmpty className="py-12 text-center">
                        <Users className="mx-auto h-8 w-8 text-muted-foreground/20 mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Zero Matches</p>
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
                            className="flex h-12 cursor-pointer items-center rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition-all data-[selected=true]:bg-primary/5 data-[selected=true]:text-primary"
                          >
                            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:text-primary">
                              <User className="h-4 w-4" />
                            </div>

                            <span className="flex-1 truncate">{name}</span>

                            {selectedStaff === name && (
                              <Check className="h-4 w-4 text-primary" strokeWidth={3} />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* ACTION GRID */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                 <div className="flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Execution
                    </p>
                </div>
                <Button
                  onClick={handleTrigger}
                  disabled={!selectedStaff || isTriggering}
                  className={cn(
                    'h-16 w-full rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.22em] shadow-xl transition-all active:scale-[0.98]',
                    selectedStaff 
                      ? 'bg-primary shadow-primary/25 hover:bg-primary/90' 
                      : 'bg-muted text-muted-foreground/40 opacity-50'
                  )}
                >
                  {isTriggering ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5 fill-current" />
                      Dispatch Alert
                      <ArrowRight className="ml-2 h-4 w-4 opacity-40" />
                    </>
                  )}
                </Button>
              </div>

              {/* PROTOCOL STATUS CARDS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-muted/10 p-4 text-center">
                  <ShieldAlert className="mb-2 h-5 w-5 text-orange-500" />
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Scope</p>
                  <p className="mt-1 text-[10px] font-black text-foreground uppercase tracking-tight">7-Day Expiry</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-muted/10 p-4 text-center">
                  <BellRing className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Channel</p>
                  <p className="mt-1 text-[10px] font-black text-foreground uppercase tracking-tight">TextBee SMS</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER: SYSTEM TRACE */}
        <div className="flex items-center justify-between gap-4 border-t border-border/50 bg-muted/20 px-8 py-5">
          <div className="flex items-center gap-2.5 text-muted-foreground/30">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em]">
              Secured Registry Tunnel
            </span>
          </div>

          <Badge variant="outline" className="h-6 border-transparent bg-background/50 px-2 text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
            Handshake v5.2
          </Badge>
        </div>
      </div>
    </div>
  );
}
