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
        'group relative h-full min-h-[132px] overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-xl transition-all duration-300 sm:min-h-[172px] sm:rounded-3xl',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20',
        toneClasses.card,
        className,
      )}
    >
      <CardContent className="relative z-10 flex h-full flex-col p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:gap-2 sm:text-[11px] sm:tracking-[0.14em]">
              <span className={cn('h-1.5 w-1.5 rounded-full', toneClasses.dot)} />
              {title}
            </div>
          </div>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10 sm:rounded-2xl', toneClasses.icon)}>
            <div className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4 sm:h-5 sm:w-5 sm:[&>svg]:h-5 sm:[&>svg]:w-5">{iconNode}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-1 items-end sm:mt-5">
          <div className="break-words text-[clamp(1.15rem,5vw,1.5rem)] font-bold tracking-[-0.04em] text-foreground sm:text-[34px]">{value}</div>
        </div>

        <div className="mt-3 border-t border-border/50 pt-2.5 text-[10px] font-medium leading-4 text-muted-foreground sm:mt-4 sm:pt-3 sm:text-[11px]">
          {description}
        </div>
      </CardContent>
      <div className="pointer-events-none absolute -bottom-14 -right-14 h-36 w-36 rounded-full bg-primary/[0.04] blur-3xl" />
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:rounded-3xl">
      {content}
    </Link>
  );
}

function VolumeGaugeCard({
  value,
  description,
  onIconClick,
  href,
}: {
  value: number;
  description: React.ReactNode;
  onIconClick?: (e: React.MouseEvent) => void;
  href: string;
}) {
  const MAX_CAPACITY = 10000;
  const active = Math.min(Math.max(value, 0), MAX_CAPACITY);
  const remainder = Math.max(0, MAX_CAPACITY - active);
  const percentage = Math.min(100, Math.round((value / MAX_CAPACITY) * 100));
  const data = [
    { name: 'Active', value: active },
    { name: 'Remainder', value: remainder },
  ];

  return (
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:rounded-3xl">
      <Card className="group relative h-full min-h-[154px] overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card/80 to-card/70 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/[0.06] sm:min-h-[172px] sm:rounded-3xl">
        <CardContent className="relative z-10 flex h-full flex-col p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary sm:text-[11px] sm:tracking-[0.14em]">Inventory volume</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">Current units in registry</p>
            </div>
            <div
              role="button"
              aria-label="Open stock trend"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onIconClick?.(e);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95 sm:rounded-2xl"
            >
              <Activity className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-2 flex flex-1 items-center gap-3 sm:mt-3 sm:gap-4">
            <div className="relative h-[72px] w-[88px] shrink-0 sm:h-[82px] sm:w-[104px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="80%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={32}
                    outerRadius={43}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive
                    animationDuration={1000}
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--primary) / 0.10)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-x-0 bottom-2 text-center text-xs font-bold text-primary">{percentage}%</div>
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-[34px]">{value.toLocaleString()}</div>
              <div className="mt-1 text-[10px] font-medium leading-4 text-muted-foreground sm:text-xs">of {MAX_CAPACITY.toLocaleString()} reference capacity</div>
            </div>
          </div>

          <div className="mt-2 border-t border-primary/10 pt-3">{description}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StockBySupplierChart({ data }: { data: StockBySupplier[] }) {
  const router = useRouter();
  const [isCompactChart, setIsCompactChart] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const syncChartMode = () => setIsCompactChart(mediaQuery.matches);

    syncChartMode();
    mediaQuery.addEventListener('change', syncChartMode);
    return () => mediaQuery.removeEventListener('change', syncChartMode);
  }, []);

  const chartConfig = {
    totalStock: {
      label: 'Units',
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20">
        <p className="text-sm font-medium text-muted-foreground">No supplier stock data available.</p>
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
          margin={{ top: 4, right: isCompactChart ? 34 : 50, left: 0, bottom: 4 }}
          barCategoryGap={isCompactChart ? 8 : 12}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.08} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={isCompactChart ? 82 : 118}
            tickMargin={isCompactChart ? 6 : 10}
            tickFormatter={(value) => {
              const limit = isCompactChart ? 10 : 17;
              return value.length > limit ? `${value.slice(0, limit)}…` : value;
            }}
            className="text-[9px] font-medium text-muted-foreground sm:text-[10px]"
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
            <LabelList dataKey="totalStock" position="right" offset={isCompactChart ? 5 : 8} className="fill-foreground text-[9px] font-semibold sm:text-[10px]" />
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
      <DialogContent className="max-h-[92dvh] w-[96%] max-w-5xl overflow-y-auto rounded-2xl border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:overflow-hidden sm:rounded-3xl">
        <div className="border-b border-border/60 bg-muted/20 p-4 sm:p-8">
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
                  <Button variant="outline" className="h-11 w-full justify-start rounded-xl bg-background/70 px-4 text-sm font-semibold sm:w-auto">
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
                <PopoverContent className="max-w-[92vw] overflow-x-auto rounded-2xl p-0 sm:max-w-none sm:overflow-visible" align="end">
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

        <div className="p-4 sm:p-8">
          <div className="h-[280px] w-full sm:h-[440px]">
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

        <DialogFooter className="border-t border-border/60 bg-muted/20 p-4 sm:p-6">
          <Button variant="secondary" className="h-11 w-full rounded-xl px-8 font-semibold sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <Card className="group relative h-full min-h-[154px] overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.045] shadow-sm sm:min-h-[172px] sm:rounded-3xl">
        <CardContent className="relative z-10 flex h-full flex-col p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary sm:text-[11px] sm:tracking-[0.14em]">Quick access</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">Authorize a staff session</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:rounded-2xl">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 flex flex-1 flex-col justify-center gap-2.5 sm:mt-5">
            <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-11 w-full justify-between rounded-xl border-primary/15 bg-background/70 px-3 text-xs font-semibold shadow-none sm:h-10"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {selectedStaff === 'ALL PERSONNEL (GLOBAL)' ? (
                      <Globe className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="truncate">{selectedStaff || 'Select personnel'}</span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border-border/70 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search personnel..." className="h-11 text-sm" />
                  <CommandList>
                    <CommandEmpty className="py-5 text-center text-xs text-muted-foreground">No personnel found.</CommandEmpty>
                    <CommandGroup heading="Global access">
                      <CommandItem
                        value="ALL PERSONNEL (GLOBAL)"
                        onSelect={() => {
                          setSelectedStaff('ALL PERSONNEL (GLOBAL)');
                          setStaffPopoverOpen(false);
                        }}
                        className="h-10 text-xs font-semibold text-primary"
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        All personnel
                        <Check className={cn('ml-auto h-4 w-4', selectedStaff === 'ALL PERSONNEL (GLOBAL)' ? 'opacity-100' : 'opacity-0')} />
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
                          className="h-10 text-xs"
                        >
                          <Check className={cn('mr-2 h-4 w-4', selectedStaff === name ? 'opacity-100' : 'opacity-0')} />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button className="h-11 w-full rounded-xl font-semibold shadow-sm sm:h-10" disabled={!selectedStaff} onClick={handleOpenGrant}>
              Authorize access
            </Button>
          </div>
        </CardContent>
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
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

function ActiveAuthorizations() {
  const { activeSessions, revokeRequest } = useSpecialEntry();
  const { toast } = useToast();

  if (activeSessions.length === 0) return null;

  const handleRevoke = (id: string, name: string) => {
    revokeRequest(id);
    toast({ title: 'Access Revoked', description: `Session for ${name} terminated.` });
  };

  return (
    <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:space-y-4">
      <div className="flex items-center justify-between gap-3 px-1 sm:gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Active access</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">Temporary authorization sessions currently in use.</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {activeSessions.length} active
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeSessions.map((session) => {
          const isGlobal = session.staffName === 'ALL PERSONNEL (GLOBAL)';

          return (
            <Card key={session.id} className={cn('rounded-2xl border-border/60 bg-card/70 shadow-sm', isGlobal && 'border-primary/20 bg-primary/[0.025]')}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', isGlobal ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
                      {isGlobal ? <Globe className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{isGlobal ? 'Universal grant' : session.staffName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{session.type} access</p>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-center sm:px-3">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Passkey</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tracking-[0.16em] text-primary">{session.otp || '----'}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 sm:mt-5 sm:pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-lg px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRevoke(session.id, session.staffName)}
                  >
                    <Ban className="mr-1.5 h-4 w-4" />
                    Revoke
                  </Button>

                  {session.expiresAt && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      Ends {format(parseISO(session.expiresAt), 'HH:mm')}
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
    <Card className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-primary/[0.045] to-card/70 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 sm:rounded-3xl">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl">
            <ShieldQuestion className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-foreground px-1 text-[9px] font-bold text-background">
              {pendingRequests.length}
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Approvals need attention</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pendingRequests.length} access {pendingRequests.length === 1 ? 'request is' : 'requests are'} waiting for review.
            </p>
          </div>
        </div>

        <Button asChild className="h-11 w-full rounded-xl px-5 font-semibold shadow-sm sm:h-10 sm:w-auto">
          <Link href="/approvals">
            Review approvals
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
      <DialogContent className="max-h-[90dvh] w-[96%] max-w-md overflow-y-auto rounded-2xl border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:w-[95%] sm:rounded-3xl">
        <div className="border-b border-border/60 p-5 sm:p-6">
          <DialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Authorize access</DialogTitle>
            <DialogDescription className="pt-1 text-sm">
              Choose how long <span className="font-semibold text-foreground">{staffName}</span> should have access.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-5 sm:space-y-5 sm:p-6">
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground">Duration</Label>
            <div className="grid grid-cols-2 gap-3">
              {['single', '10', '30', 'custom'].map((option) => (
                <Button
                  key={option}
                  variant={selectedDuration === option ? 'default' : 'outline'}
                  onClick={() => setSelectedDuration(option)}
                  className="h-14 rounded-xl font-semibold"
                >
                  {option === 'single' ? 'Single use' : option === 'custom' ? 'Custom' : (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {option} min
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {selectedDuration === 'custom' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <Label htmlFor="custom-mins" className="text-xs font-semibold text-muted-foreground">Custom minutes</Label>
              <Input
                id="custom-mins"
                type="number"
                min={1}
                value={customMins}
                onChange={(event) => setCustomMins(event.target.value)}
                className="h-11 rounded-xl bg-muted/20 text-base font-semibold"
              />
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 p-4 sm:p-6">
          <Button variant="ghost" className="h-11 w-full rounded-xl font-semibold sm:h-10 sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGrant} className="h-11 w-full rounded-xl px-5 font-semibold shadow-sm sm:h-10 sm:w-auto">
            Continue
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
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/70 shadow-sm backdrop-blur-xl sm:rounded-3xl">
      <CardHeader className="border-b border-border/50 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Supplier distribution</CardTitle>
              <CardDescription className="mt-0.5 text-xs">Click any bar to open that supplier in inventory.</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-border/70 bg-background/60 font-medium text-muted-foreground">
            {data.length} suppliers with stock
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="order-2 h-[300px] min-w-0 sm:order-none sm:h-[360px]">
            <StockBySupplierChart data={data} />
          </div>

          <div className="order-1 rounded-2xl border border-border/60 bg-muted/[0.18] p-4 sm:order-none sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Top suppliers</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">By current stock units</p>
              </div>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </div>

            {topSuppliers.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No supplier data.</p>
            ) : (
              <div className="space-y-4">
                {topSuppliers.map((supplier, index) => (
                  <div key={supplier.name} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-background text-[10px] font-bold text-muted-foreground shadow-sm">
                          {index + 1}
                        </span>
                        <span className="truncate text-xs font-semibold text-foreground">{supplier.name}</span>
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">{supplier.totalStock.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${Math.max(6, (supplier.totalStock / maxSupplierStock) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Skeleton className="h-[172px] w-full rounded-2xl sm:h-[190px] sm:rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn(
              "h-[132px] w-full rounded-2xl sm:h-[172px] sm:rounded-3xl",
              (index === 0 || index === 4) && "col-span-2 sm:col-span-1",
            )}
          />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-2xl sm:h-[500px] sm:rounded-3xl" />
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
    <div className="space-y-4 pb-24 pt-1 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:space-y-6 sm:pb-28 sm:pt-2">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-xl sm:rounded-3xl sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-52 w-52 rounded-full bg-primary/[0.04] blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
              <Badge variant="outline" className="border-primary/20 bg-primary/[0.07] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary sm:px-2.5 sm:text-[10px] sm:tracking-[0.12em]">
                SheetSync overview
              </Badge>
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] sm:gap-2 sm:px-2.5 sm:text-[10px] sm:tracking-[0.1em]',
                  isSyncing
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
                {isSyncing ? 'Syncing' : 'Synced'}
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">Inventory dashboard</h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-base sm:leading-6">
              A clear view of stock volume, asset value, risk alerts, suppliers, and staff access.
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap xl:justify-end">
            <div className="min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Today</p>
              <p className="mt-1 truncate text-[10px] font-bold text-foreground sm:text-xs">{mountedDate}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Suppliers</p>
              <p className="mt-1 text-base font-bold leading-none text-foreground sm:text-lg">{metrics.totalSuppliers.toLocaleString()}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Products</p>
              <p className="mt-1 text-base font-bold leading-none text-foreground sm:text-lg">{metrics.totalProducts.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <VolumeGaugeCard
          value={metrics.totalStockQuantity}
          description={
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">Added today</span>
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                <ArrowUp className="h-3.5 w-3.5" />
                {metrics.netItemsAddedToday.toLocaleString()}
              </span>
            </div>
          }
          href="/inventory"
          onIconClick={() => setIsStockTrendDialogOpen(true)}
          />
        </div>

        <MetricCard
          title="Stock valuation"
          value={`QAR ${Math.round(metrics.totalStockValue).toLocaleString()}`}
          iconNode={<Wallet />}
          description="Estimated active inventory cost value"
        />

        <MetricCard
          title="Expiring soon"
          value={metrics.itemsExpiringSoon.toLocaleString()}
          iconNode={<CalendarClock />}
          description="Items expiring within the next 7 days"
          href="/inventory?filterType=expiringSoon"
          tone={metrics.itemsExpiringSoon > 0 ? 'warning' : 'default'}
        />

        <MetricCard
          title="Damaged stock"
          value={(metrics.damagedItemsCount || 0).toLocaleString()}
          iconNode={<AlertTriangle />}
          description="Reported damaged units requiring review"
          href="/inventory?filterType=damaged"
          tone={(metrics.damagedItemsCount || 0) > 0 ? 'danger' : 'default'}
        />

        <div className="col-span-2 sm:col-span-1">
          <QuickAuthorizeCard />
        </div>
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

      <footer className="pt-5 text-center sm:pt-8">
        <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-muted-foreground/40">SheetSync inventory control</p>
      </footer>
    </div>
  );
}
