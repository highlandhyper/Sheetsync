'use client'; 

import { type DashboardMetrics, type StockBySupplier, type StockTrendData, type InventoryItem, type Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown, ShieldCheck, Check, Clock, Plus, UserPlus, ShieldQuestion, Timer, Calendar as CalendarIcon, BellOff, User, Ban, Key, ArrowRight, ChevronsUpDown, RefreshCw, Layers, Globe, History, Fingerprint, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRouter } from 'next/navigation';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { useDataCache } from '@/context/data-cache-context';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format, parseISO, subDays, eachDayOfInterval, isAfter, endOfDay, startOfDay, isSameDay, addDays, isBefore } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';

function MetricCard({ title, value, iconNode, description, isLoading, href, className, children, onIconClick }: { title: string; value: string | number; iconNode: React.ReactNode; description?: React.ReactNode, isLoading?: boolean, href?: string, className?: string, children?: React.ReactNode, onIconClick?: (e: React.MouseEvent) => void }) {
  const cardInnerContent = (
    <>
      <div className="absolute inset-0 z-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
        {children}
      </div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-20 px-8 pt-8">
        <CardTitle className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">{title}</CardTitle>
        <div 
            className={cn(
                "w-10 h-10 flex items-center justify-center bg-primary/5 rounded-2xl text-primary transition-all duration-500", 
                onIconClick ? "cursor-pointer hover:bg-primary/20 hover:scale-110 active:scale-95 pointer-events-auto" : ""
            )}
            onClick={(e) => {
                if (onIconClick) {
                    e.preventDefault();
                    e.stopPropagation();
                    onIconClick(e);
                }
            }}
        >
            <div className="h-5 w-5">{iconNode}</div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-full relative z-20 px-8 pb-8 pt-2">
        {isLoading ? (
            <Skeleton className="h-12 w-3/4" />
        ) : (
            <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {value}
            </div>
        )}
        {description && !isLoading && <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 pt-4 flex items-center min-h-[1.5rem]">{description}</div>}
        {isLoading && <Skeleton className="h-4 w-1/2 mt-4" />}
      </CardContent>
      {/* GLOW EFFECT */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none" />
    </>
  );

  const cardContainerClassName = cn(
    "group relative transition-all duration-700 rounded-[2.5rem] border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl h-full shadow-2xl shadow-black/[0.03] overflow-hidden",
    href ? "hover:border-primary/20 hover:shadow-primary/5 cursor-pointer active:scale-[0.98]" : "",
    className
  );
  
  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[2.5rem] block h-full">
        <Card className={cardContainerClassName}>
          {cardInnerContent}
        </Card>
      </Link>
    );
  }
  return (
    <Card className={cardContainerClassName}>
        {cardInnerContent}
    </Card>
  );
}

function VolumeGaugeCard({ title, value, description, onIconClick, href }: { title: string, value: number, description: React.ReactNode, onIconClick?: (e: React.MouseEvent) => void, href: string }) {
    // Capacity 6,000: 3000 for Round 1, 3000 for Round 2
    const MAX_CAPACITY = 6000;
    const tier1 = Math.min(value, 3000);
    const tier2 = Math.max(0, Math.min(value - 3000, 3000));
    const remainder = Math.max(0, MAX_CAPACITY - value);

    const data = [
        { name: 'Tier 1', value: tier1 },
        { name: 'Tier 2', value: tier2 },
        { name: 'Remainder', value: remainder },
    ];

    const cardContent = (
        <>
            <div className="absolute inset-0 z-0 flex items-center justify-center pt-24 pointer-events-none">
                <ResponsiveContainer width="120%" height="200%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius="78%"
                            outerRadius="95%"
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={true}
                            animationDuration={2500}
                        >
                            <Cell fill="hsl(var(--primary))" />
                            <Cell fill="hsl(var(--primary) / 0.5)" />
                            <Cell fill="hsl(var(--primary) / 0.1)" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="relative z-10 p-8 h-full flex flex-col items-center justify-between text-center pointer-events-none">
                <div className="w-full flex justify-between items-start pointer-events-auto">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">{title}</span>
                    <div 
                        className="w-8 h-8 flex items-center justify-center bg-primary/5 rounded-xl text-primary transition-all duration-500 cursor-pointer hover:bg-primary/20 hover:scale-110 active:scale-95"
                        onClick={(e) => {
                            if (onIconClick) {
                                e.preventDefault();
                                e.stopPropagation();
                                onIconClick(e);
                            }
                        }}
                    >
                        <Warehouse className="h-4 w-4" />
                    </div>
                </div>
                
                <div className="flex flex-col items-center justify-center mt-4">
                    <div className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                        {value}
                    </div>
                    <div className="mt-4 flex items-center justify-center">
                        {description}
                    </div>
                </div>
                
                <div className="w-full h-4" />
            </div>
            {/* GLOW EFFECT */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none" />
        </>
    );

    const className = "group relative transition-all duration-700 rounded-[2.5rem] border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl h-full shadow-2xl shadow-black/[0.03] overflow-hidden hover:border-primary/20 hover:shadow-primary/5 cursor-pointer active:scale-[0.98]";

    return (
        <Link href={href} className="col-span-2 lg:col-span-1 h-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[2.5rem]">
            <Card className={className}>{cardContent}</Card>
        </Link>
    );
}

const MAX_SUPPLIERS_IN_CHART = 10;

function StockBySupplierChart({ data }: { data: StockBySupplier[] }) {
  const router = useRouter();

  const chartConfig = {
    totalStock: {
      label: "Units",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-12 font-bold uppercase tracking-widest text-xs opacity-20">Registry Data Missing</p>;
  }
  
  let chartDisplayData = data;
  let otherSuppliersData: StockBySupplier[] | null = null;

  if (data.length > MAX_SUPPLIERS_IN_CHART) {
    const topSuppliers = data.slice(0, MAX_SUPPLIERS_IN_CHART - 1);
    otherSuppliersData = data.slice(MAX_SUPPLIERS_IN_CHART - 1);
    const otherStock = otherSuppliersData.reduce((sum, s) => sum + s.totalStock, 0);

    if (otherStock > 0) {
        chartDisplayData = [...topSuppliers, { name: "Other Suppliers", totalStock: otherStock }];
    } else {
        chartDisplayData = topSuppliers;
    }
  }

  const handleBarClick = (barPayload: any) => {
    if (barPayload && barPayload.payload.name === "Other Suppliers" && otherSuppliersData) {
      const otherActualSupplierNames = otherSuppliersData.map(s => s.name);
      if (otherActualSupplierNames.length > 0) {
        const suppliersQueryParam = encodeURIComponent(otherActualSupplierNames.join(','));
        router.push(`/inventory?filterType=otherSuppliers&suppliers=${suppliersQueryParam}`);
      }
    } else if (barPayload && barPayload.payload.name) {
      router.push(`/inventory?filterType=specificSupplier&suppliers=${encodeURIComponent(barPayload.payload.name)}`);
    }
  };

  return (
    <ChartContainer config={chartConfig} className="h-full w-full max-h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
            accessibilityLayer
            data={chartDisplayData}
            margin={{ top: 40, right: 10, left: 10, bottom: 0 }}
        >
            <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" opacity={0.05} />
            <XAxis dataKey="name" hide />
            <YAxis 
                type="number" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8} 
                className="text-[10px] font-black opacity-20"
            />
            <ChartTooltip
                cursor={{ fill: 'hsl(var(--primary))', opacity: 0.03 }}
                content={<ChartTooltipContent className="bg-background/90 backdrop-blur-3xl shadow-3xl rounded-3xl p-4 border-white/10" />}
            />
            <Bar 
                dataKey="totalStock" 
                fill="hsl(var(--primary))" 
                radius={[8, 8, 0, 0]}
                onClick={(payload) => handleBarClick(payload)} 
                className="cursor-pointer"
                animationDuration={2000}
            >
            <LabelList 
                dataKey="totalStock" 
                position="top" 
                offset={12} 
                className="fill-foreground text-[10px] font-black" 
            />
            </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function StockTrendSparkline({ data }: { data: StockTrendData[] }) {
  const chartConfig = {
    totalStock: {
      label: "Volume",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorStock" x1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['dataMin - 10', 'auto']} />
          <Area 
            type="monotone" 
            dataKey="totalStock" 
            stroke="hsl(var(--primary))" 
            strokeWidth={4}
            fillOpacity={1} 
            fill="url(#colorStock)" 
            animationDuration={2500}
          />
        </AreaChart>
    </ChartContainer>
  );
}

function StockTrendDetailedDialog({ 
    isOpen, 
    onOpenChange, 
    initialData 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    initialData: StockTrendData[] 
}) {
    const { inventoryItems } = useDataCache();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    useEffect(() => {
        if (isOpen && !dateRange) {
            setDateRange({
                from: subDays(new Date(), 14),
                to: new Date(),
            });
        }
    }, [isOpen, dateRange]);

    const trendData = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return initialData;
        
        const data: StockTrendData[] = [];
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        const currentTotal = inventoryItems.reduce((s, i) => s + i.quantity, 0);

        days.forEach(day => {
            const addedSince = inventoryItems.filter(i => {
                if (!i.timestamp) return false;
                const logDate = parseISO(i.timestamp);
                return isAfter(logDate, endOfDay(day));
            }).reduce((s, i) => s + i.quantity, 0);

            data.push({
                date: format(day, 'MMM dd'),
                totalStock: Math.max(0, currentTotal - addedSince)
            });
        });

        return data;
    }, [dateRange, inventoryItems, initialData]);

    const chartConfig = {
        totalStock: {
            label: "Total Units",
            color: "hsl(var(--primary))",
        },
    } satisfies ChartConfig;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl rounded-[3rem] border-none shadow-3xl p-8 overflow-hidden bg-background/95 backdrop-blur-2xl">
                <DialogHeader className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <DialogTitle className="flex items-center gap-3 text-3xl font-black uppercase tracking-tighter">
                                <Activity className="h-8 w-8 text-primary" strokeWidth={3} />
                                Asset <span className="text-primary">Pulse</span>
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                                Global Registry Volume Analysis
                            </DialogDescription>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-12 text-[10px] font-black uppercase tracking-widest px-6 rounded-2xl bg-muted/20 border-primary/10 shadow-sm transition-all hover:bg-primary/5">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "MMM dd")} — {format(dateRange.to, "MMM dd")}</>
                                            ) : (
                                                format(dateRange.from, "MMM dd")
                                            )
                                        ) : (
                                            <span>Set Analysis Period</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-3xl" align="end">
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
                    </div>
                </DialogHeader>
                
                <div className="h-[300px] sm:h-[450px] w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                            <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorStockDetailed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.05} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickMargin={15} 
                                    className="text-[10px] font-black uppercase text-muted-foreground/30 tracking-widest" 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickMargin={15} 
                                    className="text-[10px] font-black text-muted-foreground/30"
                                />
                                <ChartTooltip content={<ChartTooltipContent className="rounded-[1.5rem] shadow-3xl" />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="totalStock" 
                                    stroke="hsl(var(--primary))" 
                                    strokeWidth={5}
                                    fillOpacity={1} 
                                    fill="url(#colorStockDetailed)" 
                                    animationDuration={2000}
                                />
                            </AreaChart>
                    </ChartContainer>
                </div>
                
                <DialogFooter className="mt-8">
                    <Button variant="secondary" className="rounded-2xl font-black uppercase tracking-widest text-[10px] px-12 h-14 w-full sm:w-auto" onClick={() => onOpenChange(false)}>Close Analysis</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function QuickAuthorizeCard() {
    const { uniqueStaffNames } = useDataCache();
    const { grantProactiveEntry } = useSpecialEntry();
    const { toast } = useToast();
    const [selectedStaff, setSelectedStaff] = useState<string>("");
    const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [grantParams, setGrantParams] = useState<{ duration?: number } | null>(null);
    const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);

    const handleOpenGrant = () => {
        if (!selectedStaff) return;
        setIsGrantDialogOpen(true);
    };

    const confirmGrant = (duration?: number) => {
        setGrantParams({ duration });
        setIsAuthDialogOpen(true);
    };

    const handleAuthorizationSuccess = () => {
        setIsAuthDialogOpen(false);
        grantProactiveEntry(selectedStaff, grantParams?.duration);
        toast({
            title: "Access Granted",
            description: selectedStaff === "ALL PERSONNEL (GLOBAL)" ? "Universal silent mode initialized." : `Key sent to ${selectedStaff}.`,
        });
        setSelectedStaff("");
        setGrantParams(null);
    };

    const handleActionClick = () => {
        if (!selectedStaff) return;
        handleOpenGrant();
    };

    return (
        <>
        <Card className="shadow-none rounded-[2.5rem] border-white/5 bg-primary/5 dark:bg-primary/[0.02] h-full flex flex-col group overflow-hidden transition-all hover:bg-primary/[0.08] relative">
            <div className="absolute top-0 right-0 p-6 opacity-20">
                <ShieldCheck className="h-12 w-12 text-primary" strokeWidth={1} />
            </div>
            <CardHeader className="pb-1 px-8 pt-8">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Terminal Access</CardTitle>
                <CardDescription className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Proactive Authorization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 flex-grow flex flex-col justify-center px-8 pb-8">
                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline" 
                            role="combobox" 
                            className="w-full h-14 text-xs justify-between font-black uppercase tracking-tight rounded-2xl border-primary/10 bg-background/50 backdrop-blur-xl shadow-inner"
                        >
                            <div className="flex items-center gap-3 truncate">
                                {selectedStaff === "ALL PERSONNEL (GLOBAL)" ? <Globe className="h-4 w-4 text-primary shrink-0" /> : <User className="h-4 w-4 text-primary shrink-0" />}
                                {selectedStaff || "SELECT PERSONNEL"}
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-3xl overflow-hidden border-primary/10" align="start">
                        <Command className="bg-background/95 backdrop-blur-3xl">
                            <CommandInput placeholder="Search personnel registry..." className="h-14 text-sm font-bold" />
                            <CommandList>
                                <CommandEmpty className="text-[10px] font-black uppercase tracking-widest py-6 text-center opacity-40">Zero Results</CommandEmpty>
                                <CommandGroup heading="Industrial Broadcast">
                                    <CommandItem
                                        value="ALL PERSONNEL (GLOBAL)"
                                        onSelect={() => {
                                            setSelectedStaff("ALL PERSONNEL (GLOBAL)");
                                            setStaffPopoverOpen(false);
                                        }}
                                        className="text-xs font-black text-primary h-12 px-6 hover:bg-primary/5"
                                    >
                                        <Globe className="mr-3 h-4 w-4" />
                                        ALL PERSONNEL (GLOBAL)
                                        <Check className={cn("ml-auto h-4 w-4", selectedStaff === "ALL PERSONNEL (GLOBAL)" ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                </CommandGroup>
                                <CommandGroup heading="Individual Registry">
                                    {uniqueStaffNames.map(name => (
                                        <CommandItem 
                                            key={name} 
                                            value={name} 
                                            onSelect={() => {
                                                setSelectedStaff(name);
                                                setStaffPopoverOpen(false);
                                            }}
                                            className="text-xs font-bold h-12 px-6"
                                        >
                                            <Check className={cn("mr-3 h-4 w-4", selectedStaff === name ? "opacity-100" : "opacity-0")} />
                                            {name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                
                <Button 
                    className="w-full h-14 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 bg-primary hover:bg-primary/90 text-white" 
                    disabled={!selectedStaff}
                    onClick={handleActionClick}
                >
                    AUTHORIZE
                </Button>
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
            actionDescription={selectedStaff === "ALL PERSONNEL (GLOBAL)" ? "Initiating global broadcast authorization. Administrator clearance required." : `Granting secure silent access to ${selectedStaff}.`}
        />
        </>
    );
}

function ActiveAuthorizations() {
    const { activeSessions, revokeRequest } = useSpecialEntry();
    const { toast } = useToast();

    if (activeSessions.length === 0) return null;

    const handleRevokeClick = (id: string, name: string) => {
        revokeRequest(id);
        toast({
            title: "Access Revoked",
            description: `Session for ${name} terminated.`,
        });
    };

    return (
        <div className="space-y-6 pt-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-[0.1em]">
                    <ShieldCheck className="h-5 w-5 text-green-500" strokeWidth={3} />
                    Active Access Grants
                </h2>
                <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/10 font-black uppercase text-[9px] tracking-widest px-3 py-1">
                    {activeSessions.length} Online
                </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeSessions.map(session => {
                    const isGlobal = session.staffName === "ALL PERSONNEL (GLOBAL)";
                    return (
                        <Card key={session.id} className={cn("border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl shadow-none rounded-[2rem] overflow-hidden flex flex-col group hover:border-green-500/20 transition-all duration-500", isGlobal && "border-primary/20 bg-primary/[0.01]")}>
                            <CardContent className="p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-2xl transition-all group-hover:scale-110", isGlobal ? "bg-primary/10 text-primary" : "bg-green-500/10 text-green-600")}>
                                            {isGlobal ? <Globe className="h-6 w-6" /> : <User className="h-6 w-6" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-base font-black tracking-tight">{isGlobal ? "Universal Grant" : session.staffName}</span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground/40 tracking-widest">{session.type} Entry Protocol</span>
                                        </div>
                                    </div>
                                    <div className="py-2 px-4 bg-background dark:bg-black/20 rounded-2xl border border-primary/5 shadow-inner flex flex-col items-center">
                                        <span className="text-[8px] font-black uppercase text-primary/40 tracking-widest mb-1">Passkey</span>
                                        <span className="font-mono font-black text-lg text-primary tracking-[0.2em] leading-none">{session.otp || '----'}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-10 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-xl px-4 transition-all"
                                        onClick={() => handleRevokeClick(session.id, session.staffName)}
                                    >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Terminate
                                    </Button>
                                    {session.expiresAt && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 rounded-xl">
                                            <Timer className="h-3.5 w-3.5 text-destructive animate-pulse" />
                                            <span className="text-[10px] font-black text-destructive tracking-widest">{format(parseISO(session.expiresAt), 'HH:mm')}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function PendingApprovalsSummary() {
    const { pendingRequests } = useSpecialEntry();
    
    if (pendingRequests.length === 0) return null;

    return (
        <Card className="border-primary/10 bg-primary/5 backdrop-blur-3xl shadow-3xl shadow-primary/5 rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="bg-primary p-5 rounded-[1.5rem] shadow-2xl shadow-primary/30 relative">
                        <ShieldQuestion className="h-8 w-8 text-primary-foreground" />
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-white rounded-full flex items-center justify-center text-[10px] font-black text-primary animate-bounce">
                            !
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black tracking-tight uppercase leading-none">Security Pending</h3>
                        <p className="text-muted-foreground/60 font-bold uppercase text-[10px] tracking-widest">
                            <span className="text-primary font-black">{pendingRequests.length} High-priority requests</span> awaiting verified clearance.
                        </p>
                    </div>
                </div>
                <Button asChild size="lg" className="h-14 px-10 font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all bg-primary hover:bg-primary/90">
                    <Link href="/approvals">
                        Initiate Review <ArrowRight className="ml-3 h-5 w-5" />
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
    onGrant 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    staffName: string;
    onGrant: (duration?: number) => void;
}) {
    const [selectedDuration, setSelectedDuration] = useState<string>("single");
    const [customMins, setCustomMins] = useState("15");

    const handleGrant = () => {
        let duration: number | undefined;
        if (selectedDuration === "10") duration = 10;
        else if (selectedDuration === "30") duration = 30;
        else if (selectedDuration === "custom") duration = parseInt(customMins);
        
        onGrant(duration);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95%] rounded-[3rem] border-none shadow-3xl p-8 bg-background/95 backdrop-blur-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tighter">
                        <ShieldCheck className="h-10 w-10 text-primary" strokeWidth={3} />
                        Identity Access
                    </DialogTitle>
                    <DialogDescription className="font-medium text-sm pt-4 leading-relaxed">
                        {staffName === "ALL PERSONNEL (GLOBAL)" ? (
                            "Initiating universal silent entry protocol. This grant will authorize all identified terminal sessions instantly."
                        ) : (
                            <>Granting high-priority silent access for <span className="font-black text-slate-900 dark:text-white underline decoration-primary/30">{staffName}</span>.</>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-8 py-6">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Protocol Duration</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Button 
                                variant={selectedDuration === 'single' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('single')}
                                className="h-24 flex flex-col gap-2 rounded-3xl border-primary/5 font-black uppercase tracking-widest shadow-sm transition-all"
                            >
                                <span className="text-[10px]">Single</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === '10' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('10')}
                                className="h-24 flex flex-col gap-2 rounded-3xl border-primary/5 font-black uppercase tracking-widest shadow-sm transition-all"
                            >
                                <Clock className={cn("h-6 w-6 mb-1", selectedDuration === '10' ? "text-white" : "text-primary/40")} />
                                <span className="text-[10px]">10 Min</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === '30' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('30')}
                                className="h-24 flex flex-col gap-2 rounded-3xl border-primary/5 font-black uppercase tracking-widest shadow-sm transition-all"
                            >
                                <Clock className={cn("h-6 w-6 mb-1", selectedDuration === '30' ? "text-white" : "text-primary/40")} />
                                <span className="text-[10px]">30 Min</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === 'custom' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('custom')}
                                className="h-24 flex flex-col gap-2 rounded-3xl border-primary/5 font-black uppercase tracking-widest shadow-sm transition-all"
                            >
                                <Plus className={cn("h-6 w-6 mb-1", selectedDuration === 'custom' ? "text-white" : "text-primary/40")} />
                                <span className="text-[10px]">Custom</span>
                            </Button>
                        </div>
                        {selectedDuration === 'custom' && (
                            <div className="pt-4 animate-in slide-in-from-top-4 duration-500">
                                <Label htmlFor="custom-mins" className="text-[10px] uppercase font-black text-primary tracking-widest ml-1">Minutes Threshold</Label>
                                <Input 
                                    id="custom-mins" 
                                    type="number" 
                                    value={customMins} 
                                    onChange={(e) => setCustomMins(e.target.value)}
                                    className="mt-2 h-14 text-2xl font-black border-primary/20 rounded-2xl bg-primary/5 text-center tracking-widest"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Button variant="ghost" className="font-black uppercase tracking-widest text-[10px] h-14 order-2 sm:order-1 px-8" onClick={() => onOpenChange(false)}>Cancel Action</Button>
                    <Button onClick={handleGrant} className="h-14 px-10 font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/30 order-1 sm:order-2 bg-primary hover:bg-primary/90 text-white">
                        Initialize Grant
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6"> 
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-[2.5rem]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-[450px] w-full rounded-[3rem]" />
          <Skeleton className="h-[450px] w-full rounded-[3rem]" />
      </div>
    </div>
  );
}

import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const { isCacheReady, isSyncing, inventoryItems, products } = useDataCache();
  const [mountedDate, setMountedDate] = useState<string>('');
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setMountedDate(format(new Date(), 'PP').toUpperCase());
    setIsMounted(true);
  }, []);

  const metrics = useMemo<DashboardMetrics>(() => {
    if (!isMounted) {
        return {
            totalProducts: 0, totalStockQuantity: 0, itemsExpiringSoon: 0, damagedItemsCount: 0,
            totalSuppliers: 0, totalStockValue: 0, stockBySupplier: [], netItemsAddedToday: 0,
            dailyStockChangeDirection: 'none', stockTrend: []
        };
    }

    const today = startOfDay(new Date());
    const prodsMap = new Map<string, Product>(products.map(p => [p.barcode, p]));
    let totalValue = 0;
    let itemsAddedToday = 0;
    let expiringSoon = 0;
    const supplierStock: Record<string, number> = {};

    inventoryItems.forEach(item => {
        if (item.quantity <= 0) return;
        const product = prodsMap.get(item.barcode);
        if (product?.costPrice) totalValue += (item.quantity * product.costPrice);
        const sName = item.supplierName || 'Unknown';
        supplierStock[sName] = (supplierStock[sName] || 0) + item.quantity;
        if (item.timestamp && isSameDay(startOfDay(parseISO(item.timestamp)), today)) itemsAddedToday += item.quantity;
        if (item.itemType === 'Expiry' && item.expiryDate) {
            try {
                const expDate = startOfDay(parseISO(item.expiryDate));
                if (!isBefore(expDate, today) && isBefore(expDate, addDays(today, 7))) expiringSoon++;
            } catch {}
        }
    });

    const stockTrend: StockTrendData[] = [];
    for (let i = 14; i >= 0; i--) {
        const day = subDays(today, i);
        const totalAtEndDay = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
        const addedAfterDay = inventoryItems
            .filter(item => item.timestamp && isAfter(parseISO(item.timestamp), endOfDay(day)))
            .reduce((sum, item) => sum + item.quantity, 0);
        stockTrend.push({ date: format(day, 'MMM dd'), totalStock: Math.max(0, totalAtEndDay - addedAfterDay) });
    }

    return {
        totalProducts: products.length,
        totalStockQuantity: inventoryItems.reduce((s, x) => s + x.quantity, 0),
        itemsExpiringSoon: expiringSoon,
        damagedItemsCount: inventoryItems.filter(x => x.itemType === 'Damage').length,
        totalSuppliers: new Set(products.map(x => x.supplierName)).size,
        totalStockValue: totalValue,
        stockBySupplier: Object.entries(supplierStock)
            .map(([name, totalStock]) => ({ name, totalStock }))
            .sort((a, b) => b.totalStock - a.totalStock),
        netItemsAddedToday: itemsAddedToday,
        dailyStockChangeDirection: itemsAddedToday > 0 ? 'increase' : 'none',
        stockTrend
    };
  }, [inventoryItems, products, isMounted]);

  if (!isCacheReady || !isMounted) {
    return (
      <div className="space-y-8 pt-4">
         <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none px-2">
          MISSION CONTROL
        </h1>
        <DashboardSkeleton />
      </div>
    );
  }

  let totalStockDescription: React.ReactNode = "TOTAL ACTIVE UNITS";
  if (metrics.dailyStockChangeDirection !== 'none') {
    totalStockDescription = (
        <Badge variant="outline" className={cn("font-black text-[9px] uppercase tracking-widest px-2 py-0.5 border-none bg-primary/10 text-primary")}>
            <ArrowUp className="h-2.5 w-2.5 mr-1" strokeWidth={4} />
            {metrics.netItemsAddedToday} RECENT LOGS
        </Badge>
    );
  }

  return (
    <div className="space-y-12 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex flex-col gap-3 px-2">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
                    MISSION CONTROL
                </h1>
                <div className="flex flex-col items-end gap-1">
                    {/* Desktop Date Display */}
                    <span className="hidden md:inline text-[10px] font-black text-primary uppercase tracking-[0.4em]">{mountedDate}</span>
                    
                    {/* Mobile Sync Status Display */}
                    <div className="md:hidden flex flex-col items-end">
                        {isSyncing ? (
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] animate-pulse">Syncing...</span>
                        ) : (
                            <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.4em]">Synced</span>
                        )}
                    </div>

                    {isSyncing && (
                        <Badge variant="outline" className="hidden md:flex border-none bg-primary/5 text-primary text-[8px] font-black uppercase tracking-widest px-2 animate-pulse">
                            SYNCING SYSTEM CORE
                        </Badge>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-6 border-t border-white/10 pt-4 opacity-40">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.5em]">{metrics.totalSuppliers} VENDORS LINKED</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.5em]">{metrics.totalProducts} MASTER SKUS</p>
            </div>
        </div>

        {/* HIGH-DENSITY METRIC GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          {/* SPECIALIZED GAUGE CARD */}
          <VolumeGaugeCard 
            title="Registry Volume" 
            value={metrics.totalStockQuantity} 
            description={totalStockDescription}
            href="/inventory"
            onIconClick={() => setIsStockTrendDialogOpen(true)}
          />
          
          <MetricCard 
            title="Total Valuation" 
            value={`QAR ${Math.round(metrics.totalStockValue).toLocaleString()}`}
            iconNode={<Wallet />}
            description="ACTIVE ASSET VALUE"
          />
          
          <MetricCard 
              title="Priority Alerts" 
              value={metrics.itemsExpiringSoon} 
              iconNode={<CalendarClock />}
              description="7-DAY PROTOCOL"
              href="/inventory?filterType=expiringSoon"
              className={cn(metrics.itemsExpiringSoon > 0 && "bg-yellow-500/5 dark:bg-yellow-500/[0.02] border-yellow-500/10")}
          />
          
          <MetricCard 
              title="Damage Reports" 
              value={metrics.damagedItemsCount} 
              iconNode={<AlertTriangle />}
              description="AUDIT REQUIRED"
              href="/inventory?filterType=damaged"
              className={cn(metrics.damagedItemsCount > 0 ? "bg-destructive/5 dark:bg-destructive/[0.02] border-destructive/10" : "")} 
          />

          <div className="col-span-2 lg:col-span-1">
            <QuickAuthorizeCard />
          </div>
        </div>

        <PendingApprovalsSummary />
        <ActiveAuthorizations />

        {/* ANALYTICS PANEL */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 pt-8">
            <Card className="shadow-none rounded-[3rem] border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl overflow-hidden group">
                <CardHeader className="p-8 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl group-hover:scale-110 transition-all duration-500">
                            <TrendingUp className="h-6 w-6 text-primary" strokeWidth={3} />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black uppercase tracking-tighter">Vendor Analytics</CardTitle>
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mt-1">Live Supplier Distribution</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    <div className="h-[400px] w-full">
                        <StockBySupplierChart data={metrics.stockBySupplier} />
                    </div>
                </CardContent>
            </Card>
        </div>

        {metrics.stockTrend && (
            <StockTrendDetailedDialog 
              isOpen={isStockTrendDialogOpen} 
              onOpenChange={setIsStockTrendDialogOpen} 
              initialData={metrics.stockTrend} 
            />
        )}

        <div className="pt-24 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.8em] text-muted-foreground/10 flex items-center justify-center gap-8">
                <span className="w-12 h-px bg-current opacity-20" />
                SHEETSYNC INDUSTRIAL CORE
                <span className="w-12 h-px bg-current opacity-20" />
            </p>
        </div>
    </div>
  );
}
