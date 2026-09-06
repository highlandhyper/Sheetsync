'use client';

import { type DashboardMetrics, type StockBySupplier, type StockTrendData, type Product } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Ban,
  Calendar as CalendarIcon,
  CalendarClock,
  Check,
  ChevronsUpDown,
  Clock,
  Globe,
  ShieldCheck,
  ShieldQuestion,
  Timer,
  TrendingUp,
  User,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRouter } from 'next/navigation';
import { useSpecialEntry } from '@/context/special-entry-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { useDataCache } from '@/context/data-cache-context';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

type MetricTone = 'default' | 'warning' | 'danger';

const metricToneClasses: Record<MetricTone, { card: string; icon: string; dot: string }> = {
  default: {
    card: 'hover:border-primary/25',
    icon: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
  },
  warning: {
    card: 'border-amber-500/20 bg-amber-500/[0.035] hover:border-amber-500/35',
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  danger: {
    card: 'border-destructive/20 bg-destructive/[0.025] hover:border-destructive/35',
    icon: 'bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
};

function MetricCard({
  title,
  value,
  iconNode,
  description,
  href,
  className,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  iconNode: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  className?: string;
  tone?: MetricTone;
}) {
  const toneClasses = metricToneClasses[tone];

  const content = (
    <Card
      className={cn(
        'group relative min-h-[95px] overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-xl transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20',
        toneClasses.card,
        className,
      )}
    >
      <CardContent className="relative z-10 flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', toneClasses.dot)} />
            {title}
          </div>
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105', toneClasses.icon)}>
            <div className="flex h-3.5 w-3.5 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">{iconNode}</div>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xl font-black tracking-tighter text-foreground">{value}</div>
          <div className="text-[9px] font-bold text-muted-foreground truncate max-w-[50%]">{description}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}

function VolumeGaugeCard({
  value,
  onIconClick,
  href,
}: {
  value: number;
  onIconClick?: (e: React.MouseEvent) => void;
  href: string;
}) {
  const MAX_CAPACITY = 10000;
  const active = Math.min(Math.max(value, 0), MAX_CAPACITY);
  const remainder = Math.max(0, MAX_CAPACITY - active);
  const data = [
    { name: 'Active', value: active },
    { name: 'Remainder', value: remainder },
  ];

  return (
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2">
      <Card className="group relative min-h-[95px] overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card/80 to-card/70 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
        <CardContent className="relative z-10 flex h-full flex-col p-4 justify-between">
          <div className="flex items-start justify-between">
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              REGISTRY VOLUME
            </div>
            <div
              role="button"
              aria-label="Open stock trend"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onIconClick?.(e);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <Activity className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="relative flex flex-col items-center">
            <div className="h-[45px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius="82%"
                    outerRadius="108%"
                    dataKey="value"
                    stroke="none"
                    isAnimationActive
                    animationDuration={1000}
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--primary) / 0.15)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xl font-black tracking-tighter text-slate-900 dark:text-white mt-[-18px] z-20">
                {value.toLocaleString()}
            </div>
            <div className="text-[8px] font-black uppercase tracking-widest text-primary/40 mt-0.5">UNITS ACTIVE</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAuthorizeCard() {
  const { uniqueStaffNames } = useDataCache();
  const { grantProactiveEntry } = useSpecialEntry();
  const { toast } = useToast();
  const [selectedStaff, setSelectedStaff] = useState('');
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [grantParams, setGrantParams] = useState<{ duration?: number } | null>(null);
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);

  const handleOpenGrant = () => {
    if (selectedStaff) setIsGrantDialogOpen(true);
  };

  const confirmGrant = (duration?: number) => {
    setGrantParams({ duration });
    setIsAuthDialogOpen(true);
  };

  const handleAuthorizationSuccess = () => {
    setIsAuthDialogOpen(false);
    grantProactiveEntry(selectedStaff, grantParams?.duration);
    toast({ title: 'Access Granted', description: `Key sent to ${selectedStaff}.` });
    setSelectedStaff('');
    setGrantParams(null);
  };

  return (
    <>
      <Card className="group relative min-h-[95px] overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.045] shadow-sm">
        <CardContent className="relative z-10 flex h-full flex-col p-4 justify-between">
          <div className="flex items-start justify-between gap-4">
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              QUICK ACCESS
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-9 flex-1 justify-between rounded-xl border-primary/15 bg-background/70 px-3 text-[10px] font-black uppercase tracking-widest shadow-none"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {selectedStaff === 'ALL PERSONNEL (GLOBAL)' ? (
                      <Globe className="h-3 w-3 shrink-0 text-primary" />
                    ) : (
                      <User className="h-3 w-3 shrink-0 text-primary" />
                    )}
                    <span className="truncate">{selectedStaff || 'SELECT STAFF'}</span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border-border/70 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search personnel..." className="h-10 text-xs" />
                  <CommandList>
                    <CommandEmpty className="py-5 text-center text-xs text-muted-foreground">No personnel found.</CommandEmpty>
                    <CommandGroup heading="Global access">
                      <CommandItem
                        value="ALL PERSONNEL (GLOBAL)"
                        onSelect={() => {
                          setSelectedStaff('ALL PERSONNEL (GLOBAL)');
                          setStaffPopoverOpen(false);
                        }}
                        className="h-9 text-[10px] font-black uppercase text-primary"
                      >
                        <Globe className="mr-2 h-3.5 w-3.5" />
                        All personnel
                        <Check className={cn('ml-auto h-3.5 w-3.5', selectedStaff === 'ALL PERSONNEL (GLOBAL)' ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Personnel">
                      {uniqueStaffNames.map((name) => (
                        <CommandItem
                          key={name}
                          value={name}
                          onSelect={() => {
                            setSelectedStaff(name);
                            setStaffPopoverOpen(false);
                          }}
                          className="h-9 text-[10px] font-black uppercase"
                        >
                          <Check className={cn('mr-2 h-3.5 w-3.5', selectedStaff === name ? 'opacity-100' : 'opacity-0')} />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button size="sm" className="h-9 rounded-xl font-black uppercase tracking-widest text-[9px] px-3 shadow-lg shadow-primary/20" disabled={!selectedStaff} onClick={handleOpenGrant}>
              GRANT
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProactiveGrantDialog
        isOpen={isGrantDialogOpen}
        onOpenChange={setIsGrantDialogOpen}
        staffName={selectedStaff}
        onGrant={confirmGrant}
      />
      <AuthorizeActionDialog
        isOpen={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        onAuthorizationSuccess={handleAuthorizationSuccess}
        actionDescription={`Authorizing access for ${selectedStaff}. Clearance required.`}
      />
    </>
  );
}

function StockBySupplierChart({ data }: { data: StockBySupplier[] }) {
  const router = useRouter();

  const chartConfig = {
    totalStock: {
      label: 'Units',
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Zero supplier stock data.</p>
      </div>
    );
  }

  let chartDisplayData = data;
  let otherSuppliersData: StockBySupplier[] | null = null;

  if (data.length > 10) {
    const topSuppliers = data.slice(0, 9);
    otherSuppliersData = data.slice(9);
    const otherStock = otherSuppliersData.reduce((sum, supplier) => sum + supplier.totalStock, 0);
    chartDisplayData = [...topSuppliers, { name: 'Other Suppliers', totalStock: otherStock }];
  }

  const handleBarClick = (barPayload: any) => {
    if (barPayload?.payload?.name === 'Other Suppliers' && otherSuppliersData) {
      const supplierNames = otherSuppliersData.map((supplier) => supplier.name);
      if (supplierNames.length > 0) {
        router.push(`/inventory?filterType=otherSuppliers&suppliers=${encodeURIComponent(supplierNames.join(','))}`);
      }
      return;
    }

    if (barPayload?.payload?.name) {
      router.push(`/inventory?filterType=specificSupplier&suppliers=${encodeURIComponent(barPayload.payload.name)}`);
    }
  };

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={chartDisplayData}
          layout="vertical"
          margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
          barCategoryGap={12}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.08} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={110}
            tickMargin={10}
            tickFormatter={(value) => (value.length > 15 ? `${value.slice(0, 15)}…` : value)}
            className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60"
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--primary))', opacity: 0.04 }}
            content={<ChartTooltipContent className="rounded-xl border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur-xl" />}
          />
          <Bar
            dataKey="totalStock"
            fill="hsl(var(--primary))"
            radius={[0, 8, 8, 0]}
            onClick={(payload) => handleBarClick(payload)}
            className="cursor-pointer"
            animationDuration={1000}
          >
            <LabelList dataKey="totalStock" position="right" offset={10} className="fill-foreground text-[10px] font-black tabular-nums" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function StockTrendDetailedDialog({
  isOpen,
  onOpenChange,
  initialData,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: StockTrendData[];
}) {
  const { inventoryItems } = useDataCache();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    if (isOpen && !dateRange) {
      setDateRange({ from: subDays(new Date(), 14), to: new Date() });
    }
  }, [isOpen, dateRange]);

  const trendData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return initialData;

    const data: StockTrendData[] = [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const currentTotal = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

    days.forEach((day) => {
      const addedSince = inventoryItems
        .filter((item) => {
          if (!item.timestamp) return false;
          return isAfter(parseISO(item.timestamp), endOfDay(day));
        })
        .reduce((sum, item) => sum + item.quantity, 0);

      data.push({
        date: format(day, 'MMM dd'),
        totalStock: Math.max(0, currentTotal - addedSince),
      });
    });

    return data;
  }, [dateRange, inventoryItems, initialData]);

  const chartConfig = {
    totalStock: { label: 'Total units', color: 'hsl(var(--primary))' },
  } satisfies ChartConfig;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96%] max-w-5xl overflow-hidden rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl">
        <div className="border-b border-border/60 bg-muted/20 p-6 sm:p-8">
          <DialogHeader>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight sm:text-3xl">Inventory trend</DialogTitle>
                <DialogDescription className="mt-1 text-sm">Review historical registry volume for the selected period.</DialogDescription>
              </div>

              <Popover modal>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 justify-start rounded-xl bg-background/70 px-4 text-sm font-semibold">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>{format(dateRange.from, 'MMM dd')} — {format(dateRange.to, 'MMM dd')}</>
                      ) : (
                        format(dateRange.from, 'MMM dd')
                      )
                    ) : (
                      'Choose period'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-2xl p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </DialogHeader>
        </div>

        <div className="p-5 sm:p-8">
          <div className="h-[320px] w-full sm:h-[440px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={trendData} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="inventoryTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.08} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={12} className="text-[10px] text-muted-foreground" />
                <YAxis axisLine={false} tickLine={false} tickMargin={12} className="text-[10px] text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent className="rounded-xl shadow-xl" />} />
                <Area
                  type="monotone"
                  dataKey="totalStock"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#inventoryTrendFill)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 p-5 sm:p-6">
          <Button variant="secondary" className="h-11 w-full rounded-xl px-8 font-semibold sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveAuthorizations() {
  const { activeSessions, revokeRequest } = useSpecialEntry();
  const { toast } = useToast();

  if (activeSessions.length === 0) return null;

  const handleRevoke = (id: string, name: string) => {
    revokeRequest(id);
    toast({ title: 'Access Revoked', description: `Session for ${name} terminated.` });
  };

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Active Access</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Temporary authorization sessions currently in use.</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase tracking-widest px-3 py-1">
          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activeSessions.length} SESSIONS
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeSessions.map((session) => {
          const isGlobal = session.staffName === 'ALL PERSONNEL (GLOBAL)';

          return (
            <Card key={session.id} className={cn('rounded-2xl border-border/60 bg-card/70 shadow-sm', isGlobal && 'border-primary/20 bg-primary/[0.025]')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner', isGlobal ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
                      {isGlobal ? <Globe className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black uppercase tracking-tight text-foreground">{isGlobal ? 'Universal Grant' : session.staffName}</p>
                      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{session.type} PROTOCOL</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center shadow-sm">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Key</p>
                    <p className="mt-0.5 font-mono text-sm font-black tracking-[0.2em] text-primary">{session.otp || '----'}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2.5 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRevoke(session.id, session.staffName)}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Revoke
                  </Button>

                  {session.expiresAt && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      {format(parseISO(session.expiresAt), 'HH:mm')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function PendingApprovalsSummary() {
  const { pendingRequests } = useSpecialEntry();

  if (pendingRequests.length === 0) return null;

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-primary/[0.045] to-card/70 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ShieldQuestion className="h-6 w-6" />
            <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-slate-900 px-1 text-[10px] font-black text-white">
              {pendingRequests.length}
            </span>
          </div>
          <div>
            <p className="text-base font-black uppercase tracking-tight text-foreground">Pending Authorizations</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {pendingRequests.length} access {pendingRequests.length === 1 ? 'request' : 'requests'} awaiting security clearance.
            </p>
          </div>
        </div>

        <Button asChild className="h-11 rounded-xl px-6 font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20">
          <Link href="/approvals">
            Review Protocol
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ProactiveGrantDialog({
  isOpen,
  onOpenChange,
  staffName,
  onGrant,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  onGrant: (duration?: number) => void;
}) {
  const [selectedDuration, setSelectedDuration] = useState('single');
  const [customMins, setCustomMins] = useState('15');

  const handleGrant = () => {
    let duration: number | undefined;

    if (selectedDuration === '10') duration = 10;
    else if (selectedDuration === '30') duration = 30;
    else if (selectedDuration === 'custom') duration = parseInt(customMins, 10);

    onGrant(duration);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95%] max-w-md rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl">
        <div className="border-b border-border/60 p-6">
          <DialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Authorize Access</DialogTitle>
            <DialogDescription className="pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Identifying session duration for <span className="text-foreground">{staffName}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Session Protocol</Label>
            <div className="grid grid-cols-2 gap-3">
              {['single', '10', '30', 'custom'].map((option) => (
                <Button
                  key={option}
                  variant={selectedDuration === option ? 'default' : 'outline'}
                  onClick={() => setSelectedDuration(option)}
                  className="h-14 rounded-xl font-black uppercase tracking-widest text-[9px]"
                >
                  {option === 'single' ? 'Single Use' : option === 'custom' ? 'Custom' : (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {option} Min
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {selectedDuration === 'custom' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <Label htmlFor="custom-mins" className="text-[10px] font-black uppercase tracking-widest ml-1">Temporal Value (Mins)</Label>
              <Input
                id="custom-mins"
                type="number"
                min={1}
                value={customMins}
                onChange={(event) => setCustomMins(event.target.value)}
                className="h-12 rounded-xl bg-muted/20 text-base font-black shadow-inner"
              />
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 p-5 sm:p-6 gap-3">
          <Button variant="ghost" className="h-12 rounded-xl font-black uppercase tracking-widest text-[9px] opacity-40 hover:opacity-100" onClick={() => onOpenChange(false)}>
            Abort
          </Button>
          <Button onClick={handleGrant} className="h-12 rounded-xl px-8 font-black uppercase tracking-widest text-[9px] shadow-xl shadow-primary/20">
            Confirm Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VendorAnalytics({ data }: { data: StockBySupplier[] }) {
  const topSuppliers = data.slice(0, 5);
  const maxSupplierStock = topSuppliers[0]?.totalStock || 1;

  return (
    <Card className="overflow-hidden rounded-[2.5rem] border-border/60 bg-card/70 shadow-sm backdrop-blur-xl">
      <CardHeader className="border-b border-border/50 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
              <TrendingUp className="h-6 w-6" strokeWidth={3} />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tighter">Supplier Matrix</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-1">Industrial stock distribution analysis.</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 px-4 py-1.5 font-black text-[9px] uppercase tracking-widest text-primary">
            {data.length} VENDORS IDENTIFIED
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[380px] min-w-0">
            <StockBySupplierChart data={data} />
          </div>

          <div className="rounded-[2rem] border-2 border-muted bg-muted/5 p-6 shadow-inner flex flex-col h-full">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                <p className="text-xs font-black uppercase tracking-widest">Master Suppliers</p>
              </div>
              <p className="text-[8px] font-black uppercase text-muted-foreground/30 tracking-widest">BY VOLUME</p>
            </div>

            {topSuppliers.length === 0 ? (
              <p className="py-12 text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground/20">Zero Registry Data</p>
            ) : (
              <div className="space-y-6 flex-1">
                {topSuppliers.map((supplier, index) => (
                  <div key={supplier.name} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-background border border-muted shadow-sm text-[10px] font-black text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="truncate text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">{supplier.name}</span>
                      </div>
                      <span className="shrink-0 text-xs font-black tabular-nums text-primary">{supplier.totalStock.toLocaleString()}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-primary/5 border border-primary/10">
                      <div
                        className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(41,171,226,0.5)] transition-all duration-1000"
                        style={{ width: `${Math.max(6, (supplier.totalStock / maxSupplierStock) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-muted-foreground/10 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.4em] text-muted-foreground/20 italic">Click bar to inspect log traces</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[140px] w-full rounded-[2.5rem]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[95px] w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[500px] w-full rounded-[2.5rem]" />
    </div>
  );
}

export default function DashboardPage() {
  const { isCacheReady, isSyncing, inventoryItems, products } = useDataCache();
  const [mountedDate, setMountedDate] = useState('');
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setMountedDate(format(new Date(), 'EEEE, MMM d').toUpperCase());
    setIsMounted(true);
  }, []);

  const metrics = useMemo<DashboardMetrics>(() => {
    if (!isMounted) {
      return {
        totalProducts: 0,
        totalStockQuantity: 0,
        itemsExpiringSoon: 0,
        damagedItemsCount: 0,
        totalSuppliers: 0,
        totalStockValue: 0,
        stockBySupplier: [],
        netItemsAddedToday: 0,
        dailyStockChangeDirection: 'none',
        stockTrend: [],
      };
    }

    const today = startOfDay(new Date());
    const productsMap = new Map<string, Product>(products.map((product) => [product.barcode, product]));
    let totalValue = 0;
    let addedToday = 0;
    let expiringSoon = 0;
    const supplierStock: Record<string, number> = {};

    inventoryItems.forEach((item) => {
      if (item.quantity <= 0) return;

      const product = productsMap.get(item.barcode);
      if (product?.costPrice) totalValue += item.quantity * product.costPrice;

      const supplier = item.supplierName || 'Unknown';
      supplierStock[supplier] = (supplierStock[supplier] || 0) + item.quantity;

      if (item.timestamp && isSameDay(startOfDay(parseISO(item.timestamp)), today)) {
        addedToday += item.quantity;
      }

      if (item.itemType === 'Expiry' && item.expiryDate) {
        try {
          const expiry = startOfDay(parseISO(item.expiryDate));
          if (!isBefore(expiry, today) && isBefore(expiry, addDays(today, 7))) {
            expiringSoon++;
          }
        } catch {
          // Ignore malformed dates in dashboard aggregation.
        }
      }
    });

    const trend: StockTrendData[] = [];
    const currentTotalStock = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

    for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
      const day = subDays(today, daysAgo);
      const addedAfterDay = inventoryItems
        .filter((item) => item.timestamp && isAfter(parseISO(item.timestamp), endOfDay(day)))
        .reduce((sum, item) => sum + item.quantity, 0);

      trend.push({
        date: format(day, 'MMM dd'),
        totalStock: Math.max(0, currentTotalStock - addedAfterDay),
      });
    }

    return {
      totalProducts: products.length,
      totalStockQuantity: currentTotalStock,
      itemsExpiringSoon: expiringSoon,
      damagedItemsCount: inventoryItems
        .filter((item) => item.itemType === 'Damage')
        .reduce((sum, item) => sum + item.quantity, 0),
      totalSuppliers: new Set(products.map((product) => product.supplierName)).size,
      totalStockValue: totalValue,
      stockBySupplier: Object.entries(supplierStock)
        .map(([name, totalStock]) => ({ name, totalStock }))
        .sort((a, b) => b.totalStock - a.totalStock),
      netItemsAddedToday: addedToday,
      dailyStockChangeDirection: addedToday > 0 ? 'increase' : 'none',
      stockTrend: trend,
    };
  }, [inventoryItems, products, isMounted]);

  if (!isCacheReady || !isMounted) {
    return (
      <div className="pb-24 pt-2">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 pt-2 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-card/70 p-6 sm:p-10 shadow-2xl backdrop-blur-xl group">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-primary/[0.12] blur-[120px] transition-all duration-1000 group-hover:bg-primary/[0.2]" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-52 w-52 rounded-full bg-primary/[0.04] blur-[80px]" />

        <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-primary/20 bg-primary/[0.07] px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-primary shadow-sm">
                Industrial Meta-Core
              </Badge>
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] shadow-sm',
                  isSyncing
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full shadow-sm', isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
                {isSyncing ? 'Linking Registry' : 'Identity Synced'}
              </div>
            </div>

            <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white sm:text-6xl uppercase leading-none">Mission <span className="text-primary">Control</span></h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed font-medium text-muted-foreground/60 sm:text-lg uppercase tracking-tight">
                Operational status overview for industrial stock volume, asset valuation, and personnel clearances.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap xl:justify-end shrink-0">
            <div className="rounded-2xl border border-white/5 bg-background/60 p-5 shadow-2xl backdrop-blur-3xl flex flex-col items-center justify-center min-w-[120px]">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-1">Temporal Node</p>
              <p className="text-sm font-black text-foreground text-center leading-none">{mountedDate}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/60 p-5 shadow-2xl backdrop-blur-3xl flex flex-col items-center justify-center min-w-[120px]">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-1">Vendor Total</p>
              <p className="text-2xl font-black text-primary leading-none">{metrics.totalSuppliers}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <VolumeGaugeCard
          value={metrics.totalStockQuantity}
          href="/inventory"
          onIconClick={() => setIsStockTrendDialogOpen(true)}
        />

        <MetricCard
          title="Stock Valuation"
          value={`QAR ${Math.round(metrics.totalStockValue).toLocaleString()}`}
          iconNode={<Wallet />}
          description="Registry Asset Value"
        />

        <MetricCard
          title="Priority Alerts"
          value={metrics.itemsExpiringSoon.toLocaleString()}
          iconNode={<CalendarClock />}
          description="Expiry Threshold [7D]"
          href="/inventory?filterType=expiringSoon"
          tone={metrics.itemsExpiringSoon > 0 ? 'warning' : 'default'}
        />

        <MetricCard
          title="Damage Reports"
          value={(metrics.damagedItemsCount || 0).toLocaleString()}
          iconNode={<AlertTriangle />}
          description="Registry Risk Units"
          href="/inventory?filterType=damaged"
          tone={(metrics.damagedItemsCount || 0) > 0 ? 'danger' : 'default'}
        />

        <QuickAuthorizeCard />
      </section>

      <PendingApprovalsSummary />
      <ActiveAuthorizations />
      <VendorAnalytics data={metrics.stockBySupplier} />

      {metrics.stockTrend && (
        <StockTrendDetailedDialog
          isOpen={isStockTrendDialogOpen}
          onOpenChange={setIsStockTrendDialogOpen}
          initialData={metrics.stockTrend}
        />
      )}

      <footer className="pt-12 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.8em] text-muted-foreground/10">SheetSync Industrial Protocol • Secure Link Active</p>
      </footer>
    </div>
  );
}
