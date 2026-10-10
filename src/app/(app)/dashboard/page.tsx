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
    card: 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20',
    icon: 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300',
    dot: 'bg-neutral-400',
  },
  warning: {
    card: 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.05]',
    icon: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  danger: {
    card: 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.05]',
    icon: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
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
        'group relative h-full min-h-[120px] overflow-hidden rounded-2xl border bg-white dark:bg-neutral-950 shadow-sm transition-all duration-200 sm:min-h-[150px]',
        toneClasses.card,
        className,
      )}
    >
      <CardContent className="relative z-10 flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            <span className={cn('h-1.5 w-1.5 rounded-full', toneClasses.dot)} />
            {title}
          </div>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', toneClasses.icon)}>
            <div className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{iconNode}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-1 items-end">
          <div className="text-2xl font-semibold tracking-tight text-black dark:text-white sm:text-[28px]">{value}</div>
        </div>

        {description && (
          <div className="mt-3 border-t border-neutral-100 dark:border-white/5 pt-2.5 text-[12px] text-neutral-500 dark:text-neutral-400">
            {description}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
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
    <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
      <Card className="group relative h-full min-h-[140px] overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-sm transition-all duration-200 sm:min-h-[150px]">
        <CardContent className="relative z-10 flex h-full flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Inventory volume</p>
              <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">Current units in registry</p>
            </div>
            <button
              type="button"
              aria-label="Open stock trend"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onIconClick?.(e);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-black dark:bg-white text-white dark:text-black transition-all hover:opacity-80 active:scale-95"
            >
              <Activity className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-3 flex flex-1 items-center gap-3">
            <div className="relative h-[64px] w-[80px] shrink-0 sm:h-[72px] sm:w-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="80%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={28}
                    outerRadius={38}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive
                    animationDuration={800}
                  >
                    <Cell fill="hsl(var(--foreground))" />
                    <Cell fill="hsl(var(--foreground) / 0.08)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-x-0 bottom-1.5 text-center text-[11px] font-semibold text-black dark:text-white">{percentage}%</div>
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold tracking-tight text-black dark:text-white sm:text-[28px]">{value.toLocaleString()}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">of {MAX_CAPACITY.toLocaleString()} capacity</div>
            </div>
          </div>

          <div className="mt-3 border-t border-neutral-100 dark:border-white/5 pt-2.5">{description}</div>
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
    totalStock: { label: 'Units', color: 'hsl(var(--foreground))' },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No supplier stock data available.</p>
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
      const supplierNames = otherSuppliersData.map((s) => s.name);
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
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.06} />
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
            className="text-[10px] text-neutral-500 dark:text-neutral-400"
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.04 }}
            content={<ChartTooltipContent className="rounded-xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-3 shadow-xl" />}
          />
          <Bar
            dataKey="totalStock"
            fill="hsl(var(--foreground))"
            radius={[0, 6, 6, 0]}
            onClick={(payload) => handleBarClick(payload)}
            className="cursor-pointer"
            animationDuration={800}
          >
            <LabelList dataKey="totalStock" position="right" offset={isCompactChart ? 5 : 8} className="fill-foreground text-[10px] font-medium" />
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
    totalStock: { label: 'Total units', color: 'hsl(var(--foreground))' },
  } satisfies ChartConfig;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[96%] max-w-5xl overflow-y-auto rounded-2xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl sm:overflow-hidden">
        <div className="border-b border-neutral-100 dark:border-white/5 p-5 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/5">
                  <Activity className="h-5 w-5 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
                </div>
                <DialogTitle className="text-xl font-semibold tracking-tight text-black dark:text-white sm:text-2xl">Inventory trend</DialogTitle>
                <DialogDescription className="mt-1 text-[14px] text-neutral-500 dark:text-neutral-400">
                  Historical registry volume for the selected period.
                </DialogDescription>
              </div>

              <Popover modal>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-start rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 text-[13px] font-medium sm:w-auto">
                    <CalendarIcon className="mr-2 h-4 w-4 text-neutral-500" strokeWidth={1.75} />
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
                <PopoverContent className="max-w-[92vw] overflow-x-auto rounded-2xl p-0 sm:max-w-none" align="end">
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

        <div className="p-5 sm:p-6">
          <div className="h-[280px] w-full sm:h-[400px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={trendData} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="inventoryTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.06} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={12} className="text-[10px] text-neutral-500" />
                <YAxis axisLine={false} tickLine={false} tickMargin={12} className="text-[10px] text-neutral-500" />
                <ChartTooltip content={<ChartTooltipContent className="rounded-xl shadow-xl" />} />
                <Area
                  type="monotone"
                  dataKey="totalStock"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#inventoryTrendFill)"
                  animationDuration={800}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        <DialogFooter className="border-t border-neutral-100 dark:border-white/5 p-4">
          <Button variant="secondary" className="h-10 w-full rounded-xl text-[14px] font-medium sm:w-auto" onClick={() => onOpenChange(false)}>
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
      <Card className="group relative h-full min-h-[140px] overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-sm sm:min-h-[150px]">
        <CardContent className="relative z-10 flex h-full flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Quick access</p>
              <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">Authorize a staff session</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black dark:bg-white text-white dark:text-black">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>

          <div className="mt-4 flex flex-1 flex-col justify-center gap-2.5">
            <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-10 w-full justify-between rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 text-[13px] font-medium shadow-none"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {selectedStaff === 'ALL PERSONNEL (GLOBAL)' ? (
                      <Globe className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.75} />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.75} />
                    )}
                    <span className="truncate">{selectedStaff || 'Select personnel'}</span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border-neutral-200 dark:border-white/10 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search personnel..." className="h-10 text-[13px]" />
                  <CommandList>
                    <CommandEmpty className="py-5 text-center text-[13px] text-neutral-500">No personnel found.</CommandEmpty>
                    <CommandGroup heading="Global access">
                      <CommandItem
                        value="ALL PERSONNEL (GLOBAL)"
                        onSelect={() => {
                          setSelectedStaff('ALL PERSONNEL (GLOBAL)');
                          setStaffPopoverOpen(false);
                        }}
                        className="h-10 text-[13px] font-medium"
                      >
                        <Globe className="mr-2 h-4 w-4" strokeWidth={1.75} />
                        All personnel
                        <Check className={cn('ml-auto h-4 w-4', selectedStaff === 'ALL PERSONNEL (GLOBAL)' ? 'opacity-100' : 'opacity-0')} strokeWidth={2} />
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
                          className="h-10 text-[13px]"
                        >
                          <Check className={cn('mr-2 h-4 w-4', selectedStaff === name ? 'opacity-100' : 'opacity-0')} strokeWidth={2} />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button
              className="h-10 w-full rounded-xl bg-black dark:bg-white text-[13px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 border-none shadow-none"
              disabled={!selectedStaff}
              onClick={handleOpenGrant}
            >
              Authorize access
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

function ActiveAuthorizations() {
  const { activeSessions, revokeRequest } = useSpecialEntry();
  const { toast } = useToast();

  if (activeSessions.length === 0) return null;

  const handleRevoke = (id: string, name: string) => {
    revokeRequest(id);
    toast({ title: 'Access Revoked', description: `Session for ${name} terminated.` });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-[15px] font-semibold text-black dark:text-white">Active access</h2>
          <p className="hidden text-[13px] text-neutral-500 dark:text-neutral-400 sm:block">Temporary authorization sessions in use.</p>
        </div>
        <Badge variant="outline" className="border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 text-[12px] font-medium">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400" />
          {activeSessions.length} active
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeSessions.map((session) => {
          const isGlobal = session.staffName === 'ALL PERSONNEL (GLOBAL)';

          return (
            <Card key={session.id} className="rounded-2xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
                      {isGlobal ? <Globe className="h-4 w-4" strokeWidth={1.75} /> : <User className="h-4 w-4" strokeWidth={1.75} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-black dark:text-white">{isGlobal ? 'Universal grant' : session.staffName}</p>
                      <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">{session.type} access</p>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-1.5 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Passkey</p>
                    <p className="mt-0.5 font-mono text-[13px] font-semibold tracking-wider text-black dark:text-white">{session.otp || '----'}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 dark:border-white/5 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-[12px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    onClick={() => handleRevoke(session.id, session.staffName)}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                    Revoke
                  </Button>

                  {session.expiresAt && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-neutral-50 dark:bg-white/5 px-2 py-1 text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
                      <Timer className="h-3.5 w-3.5" strokeWidth={1.75} />
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
    <Card className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
            <ShieldQuestion className="h-5 w-5" strokeWidth={1.75} />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black dark:bg-white px-1 text-[10px] font-semibold text-white dark:text-black">
              {pendingRequests.length}
            </span>
          </div>
          <div>
            <p className="text-[15px] font-medium text-black dark:text-white">Approvals need attention</p>
            <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
              {pendingRequests.length} access {pendingRequests.length === 1 ? 'request is' : 'requests are'} waiting.
            </p>
          </div>
        </div>

        <Button asChild className="h-10 w-full rounded-xl bg-black dark:bg-white text-[13px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 border-none shadow-none sm:w-auto">
          <Link href="/approvals">
            Review approvals
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.75} />
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
      <DialogContent className="max-h-[90dvh] w-[96%] max-w-md overflow-y-auto rounded-2xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-0 shadow-2xl">
        <div className="border-b border-neutral-100 dark:border-white/5 p-5">
          <DialogHeader>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/5">
              <ShieldCheck className="h-5 w-5 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-black dark:text-white">Authorize access</DialogTitle>
            <DialogDescription className="pt-1 text-[14px] text-neutral-500 dark:text-neutral-400">
              Choose duration for <span className="font-medium text-black dark:text-white">{staffName}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Duration</Label>
            <div className="grid grid-cols-2 gap-2">
              {['single', '10', '30', 'custom'].map((option) => (
                <Button
                  key={option}
                  variant={selectedDuration === option ? 'default' : 'outline'}
                  onClick={() => setSelectedDuration(option)}
                  className={cn(
                    'h-12 rounded-xl text-[13px] font-medium',
                    selectedDuration === option
                      ? 'bg-black dark:bg-white text-white dark:text-black border-none'
                      : 'border-neutral-200 dark:border-white/10'
                  )}
                >
                  {option === 'single' ? 'Single use' : option === 'custom' ? 'Custom' : (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" strokeWidth={1.75} />
                      {option} min
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {selectedDuration === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-mins" className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Custom minutes</Label>
              <Input
                id="custom-mins"
                type="number"
                min={1}
                value={customMins}
                onChange={(e) => setCustomMins(e.target.value)}
                className="h-11 rounded-xl border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-[14px] font-medium shadow-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-neutral-100 dark:border-white/5 p-4 gap-2">
          <Button variant="ghost" className="h-10 w-full rounded-xl text-[13px] font-medium sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGrant} className="h-10 w-full rounded-xl bg-black dark:bg-white text-[13px] font-medium text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 border-none shadow-none sm:w-auto">
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
    <Card className="overflow-hidden rounded-2xl border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-sm">
      <CardHeader className="border-b border-neutral-100 dark:border-white/5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
              <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-semibold tracking-tight text-black dark:text-white">Supplier distribution</CardTitle>
              <CardDescription className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">Click a bar to open that supplier.</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
            {data.length} suppliers
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="order-2 h-[280px] min-w-0 sm:order-none sm:h-[340px]">
            <StockBySupplierChart data={data} />
          </div>

          <div className="order-1 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 p-4 sm:order-none">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-black dark:text-white">Top suppliers</p>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">By current stock</p>
              </div>
              <Warehouse className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
            </div>

            {topSuppliers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-neutral-500">No supplier data.</p>
            ) : (
              <div className="space-y-3">
                {topSuppliers.map((supplier, index) => (
                  <div key={supplier.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white dark:bg-neutral-950 text-[10px] font-semibold text-neutral-500 border border-neutral-200 dark:border-white/10">
                          {index + 1}
                        </span>
                        <span className="truncate text-[12px] font-medium text-black dark:text-white">{supplier.name}</span>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-black dark:text-white">{supplier.totalStock.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-black dark:bg-white transition-all duration-500"
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
    <div className="space-y-4 sm:space-y-5">
      <Skeleton className="h-[140px] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn('h-[120px] w-full rounded-2xl sm:h-[150px]', (index === 0 || index === 4) && 'col-span-2 sm:col-span-1')}
          />
        ))}
      </div>
      <Skeleton className="h-[380px] w-full rounded-2xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { isCacheReady, isSyncing, inventoryItems, products } = useDataCache();
  const [mountedDate, setMountedDate] = useState('');
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setMountedDate(format(new Date(), 'EEEE, MMM d'));
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
    const productsMap = new Map<string, Product>(products.map((p) => [p.barcode, p]));
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
          // ignore
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
      totalSuppliers: new Set(products.map((p) => p.supplierName)).size,
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
    <div className="space-y-4 pb-24 pt-1 sm:space-y-5 sm:pb-28 sm:pt-2">
      {/* Header */}
      <section className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Overview
              </Badge>
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  isSyncing
                    ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-500 dark:text-neutral-400',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-neutral-400')} />
                {isSyncing ? 'Syncing' : 'Synced'}
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white sm:text-3xl">Inventory dashboard</h1>
            <p className="mt-1.5 max-w-xl text-[14px] text-neutral-500 dark:text-neutral-400">
              Stock volume, value, risk alerts, suppliers, and staff access.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap xl:justify-end">
            <div className="min-w-0 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Today</p>
              <p className="mt-0.5 truncate text-[12px] font-medium text-black dark:text-white">{mountedDate}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Suppliers</p>
              <p className="mt-0.5 text-[15px] font-semibold text-black dark:text-white">{metrics.totalSuppliers.toLocaleString()}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Products</p>
              <p className="mt-0.5 text-[15px] font-semibold text-black dark:text-white">{metrics.totalProducts.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <VolumeGaugeCard
            value={metrics.totalStockQuantity}
            description={
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-neutral-500 dark:text-neutral-400">Added today</span>
                <span className="inline-flex items-center gap-1 font-semibold text-black dark:text-white">
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {(metrics.netItemsAddedToday ?? 0).toLocaleString()}
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
          iconNode={<Wallet strokeWidth={1.75} />}
          description="Estimated inventory cost value"
        />

        <MetricCard
          title="Expiring soon"
          value={metrics.itemsExpiringSoon.toLocaleString()}
          iconNode={<CalendarClock strokeWidth={1.75} />}
          description="Within the next 7 days"
          href="/inventory?filterType=expiringSoon"
          tone={metrics.itemsExpiringSoon > 0 ? 'warning' : 'default'}
        />

        <MetricCard
          title="Damaged stock"
          value={(metrics.damagedItemsCount || 0).toLocaleString()}
          iconNode={<AlertTriangle strokeWidth={1.75} />}
          description="Reported damaged units"
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

      <footer className="pt-4 text-center">
        <p className="text-[12px] text-neutral-300 dark:text-neutral-600">SheetSync inventory control</p>
      </footer>
    </div>
  );
}
