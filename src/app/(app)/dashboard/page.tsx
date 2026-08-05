'use client'; 

import { type DashboardMetrics, type StockBySupplier, type StockTrendData, type InventoryItem, type Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown, ShieldCheck, Check, Clock, Plus, UserPlus, ShieldQuestion, Timer, Calendar as CalendarIcon, BellOff, User, Ban, Key, ArrowRight, ChevronsUpDown, RefreshCw, Layers } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, AreaChart, Area, ResponsiveContainer } from 'recharts';
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

function MetricCard({ title, value, iconNode, description, isLoading, href, className, children, onIconClick }: { title: string; value: string | number; iconNode: React.ReactNode; description?: React.ReactNode, isLoading?: boolean, href?: string, className?: string, children?: React.ReactNode, onIconClick?: (e: React.MouseEvent) => void }) {
  const cardInnerContent = (
    <>
      <div className="absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none">
        {children}
      </div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-20">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">{title}</CardTitle>
        <div 
            className={cn(
                "p-2 bg-primary/10 rounded-xl text-primary transition-all duration-300", 
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
            {iconNode}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-full relative z-20">
        {isLoading ? (
            <Skeleton className="h-10 w-1/2" />
        ) : (
            <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">{value}</div>
        )}
        {description && !isLoading && <div className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/60 pt-2 flex items-center">{description}</div>}
        {isLoading && <Skeleton className="h-4 w-3/4 mt-2" />}
      </CardContent>
    </>
  );

  const cardContainerClassName = cn(
    "group transition-all duration-500 rounded-3xl border-white/5",
    href ? "hover:border-primary/30 hover:scale-[1.02] cursor-pointer" : "",
    className
  );
  
  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[2rem] block h-full">
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

const MAX_SUPPLIERS_IN_CHART = 10;

function StockBySupplierChart({ data }: { data: StockBySupplier[] }) {
  const router = useRouter();

  const chartConfig = {
    totalStock: {
      label: "Total Stock",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No supplier stock data available.</p>;
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
    <ChartContainer config={chartConfig} className="h-full w-full max-h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
            accessibilityLayer
            data={chartDisplayData}
            margin={{ top: 40, right: 10, left: 10, bottom: 10 }}
        >
            <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" opacity={0.1} />
            <XAxis 
            dataKey="name" 
            hide 
            />
            <YAxis 
            type="number" 
            tickLine={false} 
            axisLine={false} 
            tickMargin={8} 
            className="text-[10px] font-black opacity-40"
            />
            <ChartTooltip
                cursor={{ fill: 'hsl(var(--primary))', opacity: 0.05 }}
                content={<ChartTooltipContent className="bg-background/80 backdrop-blur-xl shadow-2xl rounded-2xl p-4 border-white/10" />}
            />
            <Bar 
            dataKey="totalStock" 
            fill="hsl(var(--primary))" 
            radius={[8, 8, 0, 0]}
            onClick={(payload) => handleBarClick(payload)} 
            onMouseEnter={(props, e: any) => { 
                if (e && e.target) e.target.style.cursor = 'pointer';
            }}
            onMouseLeave={(props, e: any) => {
                if (e && e.target) e.target.style.cursor = 'default';
            }}
            animationDuration={1500}
            >
            <LabelList 
                dataKey="totalStock" 
                position="top" 
                offset={12} 
                className="fill-foreground text-[11px] font-black" 
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
      label: "Stock Level",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none z-0">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorStock" x1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['dataMin - 5', 'auto']} />
          <Area 
            type="monotone" 
            dataKey="totalStock" 
            stroke="hsl(var(--primary))" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorStock)" 
            animationDuration={2000}
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

    // Hydration Safe initialization
    useEffect(() => {
        if (isOpen && !dateRange) {
            setDateRange({
                from: subDays(new Date(), 6),
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
            <DialogContent className="sm:max-w-3xl rounded-[2rem] border-none shadow-2xl">
                <DialogHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter">
                                <TrendingUp className="h-6 w-6 text-primary" />
                                Inventory Volume Analysis
                            </DialogTitle>
                            <DialogDescription>
                                Historical stock trend based on recorded additions and current levels.
                            </DialogDescription>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Analyze Period</Label>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-10 text-xs font-bold px-4 rounded-xl bg-muted/30 border-primary/10">
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "MMM dd, y")} - {format(dateRange.to, "MMM dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "MMM dd, y")
                                            )
                                        ) : (
                                            <span>Select custom period</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
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
                <div className="h-[350px] w-full mt-6">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                            <AreaChart data={trendData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorStockDetailed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickMargin={10} 
                                    className="text-[10px] font-black uppercase text-muted-foreground/40" 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickMargin={10} 
                                    className="text-[10px] font-black text-muted-foreground/40"
                                />
                                <ChartTooltip content={<ChartTooltipContent className="rounded-2xl shadow-2xl" />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="totalStock" 
                                    stroke="hsl(var(--primary))" 
                                    strokeWidth={4}
                                    fillOpacity={1} 
                                    fill="url(#colorStockDetailed)" 
                                    animationDuration={1500}
                                />
                            </AreaChart>
                    </ChartContainer>
                </div>
                <DialogFooter className="sm:justify-start pt-4">
                    <Button variant="secondary" className="rounded-xl font-bold px-8" onClick={() => onOpenChange(false)}>Close Analysis</Button>
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
            description: `Authorization sent to ${selectedStaff}. A dynamic OTP has been generated.`,
        });
        setSelectedStaff("");
        setGrantParams(null);
    };

    return (
        <>
        <Card className="shadow-2xl rounded-[2rem] border-white/5 bg-card/60 backdrop-blur-xl h-full flex flex-col group overflow-hidden">
            <CardHeader className="pb-2 bg-primary/5">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary">Quick Authorize</CardTitle>
                <CardDescription className="text-[10px] font-bold">Proactive silent entry grant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline" 
                            role="combobox" 
                            className="w-full h-12 text-sm justify-between font-black uppercase tracking-tight rounded-2xl border-primary/10 bg-muted/20"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <User className="h-4 w-4 text-primary shrink-0" />
                                {selectedStaff || "Select Staff Member"}
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl" align="start">
                        <Command>
                            <CommandInput placeholder="Search staff..." className="h-11 text-xs" />
                            <CommandList>
                                <CommandEmpty className="text-xs py-4 text-center">No personnel found.</CommandEmpty>
                                <CommandGroup>
                                    {uniqueStaffNames.map(name => (
                                        <CommandItem 
                                            key={name} 
                                            value={name} 
                                            onSelect={() => {
                                                setSelectedStaff(name);
                                                setStaffPopoverOpen(false);
                                            }}
                                            className="text-xs font-bold h-10 px-4"
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", selectedStaff === name ? "opacity-100" : "opacity-0")} />
                                            {name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                
                <Button 
                    className="w-full h-12 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95" 
                    disabled={!selectedStaff}
                    onClick={handleOpenGrant}
                >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Authorize Staff
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
            actionDescription={`Granting special silent mode access to ${selectedStaff}. Requires admin credentials.`}
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
            title: "Authorization Revoked",
            description: `Silent mode access for ${name} has been terminated.`,
        });
    };

    return (
        <div className="space-y-6 pt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                <div className="bg-primary/10 p-2 rounded-xl">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                Live Silent Mode Sessions
                <Badge variant="secondary" className="ml-4 bg-green-500/10 text-green-600 border-green-500/20 font-black uppercase text-[10px] tracking-widest px-3 py-1">
                    {activeSessions.length} Active
                </Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeSessions.map(session => (
                    <Card key={session.id} className="border-green-500/10 bg-green-500/[0.02] shadow-2xl rounded-[2rem] overflow-hidden flex flex-col group">
                        <CardHeader className="pb-3 bg-green-500/[0.03] border-b border-green-500/5">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                                    <User className="h-5 w-5 text-green-600" />
                                    {session.staffName}
                                </CardTitle>
                                <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest bg-background border-green-200">
                                    {session.type === 'timed' ? 'Timed' : 'Single Use'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="text-xs space-y-4 pt-6 flex-grow">
                            <div className="flex justify-between items-center text-muted-foreground">
                                <span className="flex items-center gap-2 font-bold uppercase tracking-widest text-[9px]"><Clock className="h-3.5 w-3.5" /> Authorized:</span>
                                <span className="font-black text-slate-900 dark:text-white text-sm">{session.approvedAt ? format(parseISO(session.approvedAt), 'HH:mm') : 'N/A'}</span>
                            </div>
                            {session.expiresAt && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span className="flex items-center gap-2 font-bold uppercase tracking-widest text-[9px] text-destructive"><Timer className="h-3.5 w-3.5" /> Expiry:</span>
                                    <span className="font-black text-destructive text-sm">
                                        {format(parseISO(session.expiresAt), 'HH:mm')}
                                    </span>
                                </div>
                            )}
                            <div className="py-4 px-5 bg-white dark:bg-black/20 rounded-2xl border-2 border-primary/10 shadow-inner flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2"><Key className="h-3.5 w-3.5" /> Entry Key</span>
                                <span className="font-black text-2xl text-primary tracking-[0.3em] font-mono leading-none">{session.otp || '----'}</span>
                            </div>
                            <div className="pt-2 flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest opacity-60">
                                <BellOff className="h-4 w-4" />
                                <span>Email alerts disabled</span>
                            </div>
                        </CardContent>
                        <div className="p-3 border-t border-green-500/5 bg-muted/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-xl"
                                onClick={() => handleRevokeClick(session.id, session.staffName)}
                            >
                                <Ban className="mr-2 h-4 w-4" />
                                Revoke Session
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function PendingApprovalsSummary() {
    const { pendingRequests } = useSpecialEntry();
    
    if (pendingRequests.length === 0) return null;

    return (
        <Card className="border-primary/20 bg-primary/[0.03] shadow-2xl rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 group">
            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="bg-primary p-6 rounded-[2rem] shadow-2xl shadow-primary/30 group-hover:scale-105 transition-transform duration-500">
                        <ShieldQuestion className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black tracking-tighter uppercase leading-none mb-2">Security Override</h3>
                        <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">You have <span className="text-primary font-black">{pendingRequests.length} incoming requests</span> awaiting administrator clearance.</p>
                    </div>
                </div>
                <Button asChild className="w-full md:w-auto px-10 h-16 text-lg font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                    <Link href="/approvals">
                        Review Center <ArrowRight className="ml-3 h-6 w-6" />
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
            <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                        Authorize Silent Mode
                    </DialogTitle>
                    <DialogDescription className="font-medium text-sm pt-2">
                        Granting proactive silent access for <span className="font-black text-slate-900 dark:text-white">{staffName}</span>. 
                        A unique 4-digit OTP will be generated instantly.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-8 py-6">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Select Duration Strategy</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <Button 
                                variant={selectedDuration === 'single' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('single')}
                                className="h-20 flex flex-col gap-1 rounded-2xl group border-primary/10 font-bold"
                            >
                                <Check className={cn("h-5 w-5 mb-1 group-hover:scale-110 transition-transform", selectedDuration === 'single' ? "opacity-100" : "opacity-30")} />
                                <span className="text-[10px] uppercase tracking-widest">Single Entry</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === '10' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('10')}
                                className="h-20 flex flex-col gap-1 rounded-2xl group border-primary/10 font-bold"
                            >
                                <Clock className={cn("h-5 w-5 mb-1 group-hover:scale-110 transition-transform", selectedDuration === '10' ? "opacity-100" : "opacity-30")} />
                                <span className="text-[10px] uppercase tracking-widest">10 Minutes</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === '30' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('30')}
                                className="h-20 flex flex-col gap-1 rounded-2xl group border-primary/10 font-bold"
                            >
                                <Clock className={cn("h-5 w-5 mb-1 group-hover:scale-110 transition-transform", selectedDuration === '30' ? "opacity-100" : "opacity-30")} />
                                <span className="text-[10px] uppercase tracking-widest">30 Minutes</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === 'custom' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('custom')}
                                className="h-20 flex flex-col gap-1 rounded-2xl group border-primary/10 font-bold"
                            >
                                <Plus className={cn("h-5 w-5 mb-1 group-hover:scale-110 transition-transform", selectedDuration === 'custom' ? "opacity-100" : "opacity-030")} />
                                <span className="text-[10px] uppercase tracking-widest">Custom Time</span>
                            </Button>
                        </div>
                        {selectedDuration === 'custom' && (
                            <div className="pt-4 animate-in slide-in-from-top-2 duration-300">
                                <Label htmlFor="custom-mins" className="text-[10px] uppercase font-black text-primary tracking-widest">Minutes (Active)</Label>
                                <Input 
                                    id="custom-mins" 
                                    type="number" 
                                    value={customMins} 
                                    onChange={(e) => setCustomMins(e.target.value)}
                                    className="mt-2 h-12 text-lg font-black border-primary/20 rounded-xl bg-primary/5"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="gap-3">
                    <Button variant="ghost" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleGrant} className="h-12 px-8 font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20">
                        Next: Verify Admin
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr"> 
        <div className="lg:col-span-2 h-40"><Skeleton className="h-full w-full rounded-[2.5rem]" /></div>
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <Skeleton className="h-40 w-full rounded-[2rem]" />
      </div>
      <div className="space-y-6 pt-10">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-64 w-full rounded-[2rem]" />
              <Skeleton className="h-64 w-full rounded-[2rem]" />
              <Skeleton className="h-64 w-full rounded-[2rem]" />
          </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isCacheReady, isSyncing, inventoryItems, products } = useDataCache();
  const [mountedDate, setMountedDate] = useState<string>('');
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setMountedDate(format(new Date(), 'PP'));
    setIsMounted(true);
  }, []);

  const metrics = useMemo<DashboardMetrics>(() => {
    // HYDRATION SAFETY: Ensure calculations only run fully after component mounts to avoid mismatches
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
            stockTrend: []
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
        if (product?.costPrice) {
            totalValue += (item.quantity * product.costPrice);
        }

        const sName = item.supplierName || 'Unknown Vendor';
        supplierStock[sName] = (supplierStock[sName] || 0) + item.quantity;

        if (item.timestamp && isSameDay(startOfDay(parseISO(item.timestamp)), today)) {
            itemsAddedToday += item.quantity;
        }

        if (item.itemType === 'Expiry' && item.expiryDate) {
            try {
                const expDate = startOfDay(parseISO(item.expiryDate));
                if (!isBefore(expDate, today) && isBefore(expDate, addDays(today, 7))) {
                    expiringSoon++;
                }
            } catch {}
        }
    });

    const stockTrend: StockTrendData[] = [];
    for (let i = 6; i >= 0; i--) {
        const day = subDays(today, i);
        const totalAtEndDay = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
        const addedAfterDay = inventoryItems
            .filter(item => item.timestamp && isAfter(parseISO(item.timestamp), endOfDay(day)))
            .reduce((sum, item) => sum + item.quantity, 0);
        
        stockTrend.push({
            date: format(day, 'MMM dd'),
            totalStock: Math.max(0, totalAtEndDay - addedAfterDay)
        });
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
      <div className="space-y-12">
         <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none">
          <Activity className="mr-4 h-8 w-8 text-primary" strokeWidth={3} />
          Mission Control
        </h1>
        <DashboardSkeleton />
      </div>
    );
  }

  let totalStockDescription: React.ReactNode = "Sum of all active warehouse units";
  if (metrics.dailyStockChangeDirection !== 'none') {
    const isIncrease = metrics.dailyStockChangeDirection === 'increase';
    const colorClass = isIncrease ? 'text-primary' : 'text-green-600';
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;

    totalStockDescription = (
        <div className="flex items-center flex-wrap gap-2">
          <span>Global Levels</span>
          <Badge variant="outline" className={cn("font-black text-[9px] uppercase tracking-widest px-2 py-0 border-none bg-primary/10", colorClass)}>
            <ArrowIcon className="h-3 w-3 mr-1" />
            {metrics.netItemsAddedToday} New Assets Today
          </Badge>
        </div>
    );
  }


  return (
    <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className="flex flex-col">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center tracking-tighter uppercase leading-none mb-2">
                        Mission Control
                    </h1>
                    <div className="flex items-center gap-3">
                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase tracking-[0.2em]">
                            <Activity className="h-3 w-3 animate-pulse" /> Network: Encrypted
                        </div>
                        {isSyncing && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/5 dark:bg-white/5 border border-white/10 text-muted-foreground text-[9px] font-black uppercase tracking-[0.2em]">
                                <RefreshCw className="h-3 w-3 animate-spin" /> Live Synchronizing
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/10 backdrop-blur-md shadow-inner">
                <Layers className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Registered Suppliers</span>
                    <span className="text-sm font-black text-primary leading-none">{metrics.totalSuppliers} Vendors</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
          <MetricCard 
            title="Total Stock Volume" 
            value={metrics.totalStockQuantity} 
            iconNode={<Warehouse className="h-6 w-6" />}
            onIconClick={() => setIsStockTrendDialogOpen(true)}
            description={totalStockDescription}
            href="/inventory"
            className="lg:col-span-2 bg-primary/[0.03] border-primary/10 shadow-primary/5"
          >
              {metrics.stockTrend && <StockTrendSparkline data={metrics.stockTrend} />}
          </MetricCard>
          
          <MetricCard 
            title="Asset Valuation" 
            value={`QAR ${metrics.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            iconNode={<Wallet className="h-6 w-6" />}
            description="Sum total of current assets"
          />
          
          <MetricCard 
              title="Expiring High Priority" 
              value={metrics.itemsExpiringSoon} 
              iconNode={<CalendarClock className="h-6 w-6" />}
              description="Critical 7-day threshold"
              href="/inventory?filterType=expiringSoon"
              className={cn(
                  metrics.itemsExpiringSoon > 0 && "bg-yellow-500/[0.03] border-yellow-500/20 shadow-yellow-500/5 hover:border-yellow-500/50"
              )}
          />
          
          <MetricCard 
              title="Damaged/Loss Review" 
              value={metrics.damagedItemsCount} 
              iconNode={<AlertTriangle className="h-6 w-6" />}
              description="Requires immediate audit"
              href="/inventory?filterType=damaged"
              className={cn(metrics.damagedItemsCount > 0 ? "bg-destructive/[0.03] border-destructive/20 shadow-destructive/5 hover:border-destructive/50" : "")} 
          />

          <QuickAuthorizeCard />
        </div>

        <PendingApprovalsSummary />
        <ActiveAuthorizations />

        <div className="grid grid-cols-1 gap-8">
          <Card className="shadow-2xl rounded-[3rem] border-white/5 bg-card/60 backdrop-blur-xl overflow-hidden hidden sm:block">
            <CardHeader className="border-b border-white/5 bg-primary/[0.02] p-8 pb-6">
              <div className="flex items-center justify-between">
                  <div>
                      <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <TrendingUp className="h-7 w-7 text-primary" />
                        Supplier Stock Metrics
                      </CardTitle>
                      <CardDescription className="font-bold text-[10px] mt-1">Total unit distribution across registered vendors</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest px-3 py-1">Real-time Snapshot</Badge>
                      <span className="text-[10px] text-muted-foreground uppercase font-black opacity-40">{mountedDate || '-- --- --'}</span>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <div className="h-[450px] w-full">
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
    </div>
  );
}
