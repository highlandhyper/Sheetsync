'use client'; 

import { type DashboardMetrics, type StockBySupplier, type StockTrendData, type InventoryItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown, ShieldCheck, Check, Clock, Plus, UserPlus, ShieldQuestion, Timer, Calendar as CalendarIcon, BellOff, User, Ban, Key, ArrowRight, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fetchDashboardMetricsAction } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, AreaChart, Area } from 'recharts';
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
import { format, parseISO, subDays, eachDayOfInterval, isAfter, endOfDay } from 'date-fns';
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
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div 
            className={cn(
                "p-2 bg-primary/10 rounded-full text-primary transition-all duration-200", 
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
            <Skeleton className="h-8 w-1/2" />
        ) : (
            <div className="text-3xl font-bold tracking-tight">{value}</div>
        )}
        {description && !isLoading && <div className="text-xs text-muted-foreground pt-1 flex items-center font-medium">{description}</div>}
        {isLoading && <Skeleton className="h-4 w-3/4 mt-1" />}
      </CardContent>
    </>
  );

  const cardContainerClassName = cn(
    "shadow-lg transition-all duration-300 rounded-xl hover:shadow-xl h-full flex flex-col relative overflow-hidden",
    "bg-card/40 backdrop-blur-md border border-white/10",
    href ? "hover:bg-card/60 hover:ring-2 hover:ring-primary/30" : "",
    className
  );
  
  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl block h-full">
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
      <BarChart
        accessibilityLayer
        data={chartDisplayData}
        margin={{ top: 40, right: 10, left: 10, bottom: 10 }}
      >
        <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" opacity={0.3} />
        <XAxis 
          dataKey="name" 
          hide 
        />
        <YAxis 
          type="number" 
          tickLine={false} 
          axisLine={false} 
          tickMargin={8} 
          className="text-[10px] font-medium"
        />
        <ChartTooltip
            cursor={{ fill: 'hsl(var(--primary))', opacity: 0.05 }}
            content={<ChartTooltipContent className="bg-background shadow-xl rounded-lg p-3 border-border/50" />}
        />
        <Bar 
          dataKey="totalStock" 
          fill="hsl(var(--primary))" 
          radius={[6, 6, 0, 0]}
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
    <ChartContainer config={chartConfig} className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0">
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
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 6),
        to: new Date(),
    });

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
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Inventory Volume Analysis
                            </DialogTitle>
                            <DialogDescription>
                                Historical stock trend based on recorded additions and current levels.
                            </DialogDescription>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Analyze Period</Label>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 bg-muted/30">
                                        <CalendarIcon className="mr-2 h-3 w-3" />
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
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickMargin={10} 
                                    className="text-[10px] font-bold uppercase text-muted-foreground" 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickMargin={10} 
                                    className="text-[10px] font-bold text-muted-foreground"
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="totalStock" 
                                    stroke="hsl(var(--primary))" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorStockDetailed)" 
                                    animationDuration={1500}
                                />
                            </AreaChart>
                    </ChartContainer>
                </div>
                <DialogFooter className="sm:justify-start pt-4">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Close Analysis</Button>
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
        <Card className="shadow-lg rounded-xl bg-card/40 backdrop-blur-md border border-white/10 h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Authorize</CardTitle>
                <CardDescription className="text-[10px]">Proactive silent entry grant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline" 
                            role="combobox" 
                            className="w-full h-9 text-xs justify-between font-bold"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <User className="h-3.5 w-3.5 text-primary shrink-0" />
                                {selectedStaff || "Select Staff Member"}
                            </div>
                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search staff..." className="h-8 text-xs" />
                            <CommandList>
                                <CommandEmpty className="text-xs py-2 text-center">No personnel found.</CommandEmpty>
                                <CommandGroup>
                                    {uniqueStaffNames.map(name => (
                                        <CommandItem 
                                            key={name} 
                                            value={name} 
                                            onSelect={() => {
                                                setSelectedStaff(name);
                                                setStaffPopoverOpen(false);
                                            }}
                                            className="text-xs font-bold"
                                        >
                                            <Check className={cn("mr-2 h-3 w-3", selectedStaff === name ? "opacity-100" : "opacity-0")} />
                                            {name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                
                <Button 
                    className="w-full h-9 text-xs font-bold" 
                    disabled={!selectedStaff}
                    onClick={handleOpenGrant}
                >
                    <UserPlus className="mr-2 h-3.5 w-3.5" />
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
        <div className="space-y-4 pt-6">
            <h2 className="text-xl font-black text-primary flex items-center gap-2">
                <ShieldCheck className="h-6 w-6" />
                Live Silent Mode Sessions
                <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600 border-green-500/20">
                    {activeSessions.length} Active
                </Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map(session => (
                    <Card key={session.id} className="border-green-500/20 bg-green-500/[0.02] shadow-sm overflow-hidden flex flex-col group">
                        <CardHeader className="pb-2 bg-green-500/[0.03]">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <User className="h-4 w-4 text-green-600" />
                                    {session.staffName}
                                </CardTitle>
                                <Badge variant="outline" className="text-[9px] uppercase font-black bg-background border-green-200">
                                    {session.type === 'timed' ? 'Timed' : 'Single Use'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="text-xs space-y-2 pt-3 flex-grow">
                            <div className="flex justify-between text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Authorized:</span>
                                <span className="font-medium text-foreground">{session.approvedAt ? format(parseISO(session.approvedAt), 'HH:mm') : 'N/A'}</span>
                            </div>
                            {session.expiresAt && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span className="flex items-center gap-1 text-destructive"><Timer className="h-3 w-3" /> Expiry:</span>
                                    <span className="font-bold text-destructive">
                                        {format(parseISO(session.expiresAt), 'HH:mm')}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                                <span className="flex items-center gap-1 text-primary"><Key className="h-3 w-3" /> Active OTP:</span>
                                <span className="font-black text-primary tracking-widest">{session.otp || '----'}</span>
                            </div>
                            <div className="pt-2 flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase tracking-tight">
                                <BellOff className="h-3 w-3" />
                                <span>No Email Alerts active</span>
                            </div>
                        </CardContent>
                        <div className="p-2 border-t bg-muted/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full h-7 text-[10px] font-black uppercase text-destructive hover:bg-destructive/5"
                                onClick={() => handleRevokeClick(session.id, session.staffName)}
                            >
                                <Ban className="mr-1 h-3 w-3" />
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
        <Card className="border-primary/20 bg-primary/5 shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-4 rounded-2xl shadow-lg shadow-primary/20">
                        <ShieldQuestion className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight">Action Required</h3>
                        <p className="text-muted-foreground font-medium">You have <span className="text-primary font-bold">{pendingRequests.length} pending requests</span> awaiting your review in the Approval Center.</p>
                    </div>
                </div>
                <Button asChild className="w-full md:w-auto px-8 py-6 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                    <Link href="/approvals">
                        Review Requests <ArrowRight className="ml-2 h-5 w-5" />
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Authorize Silent Mode
                    </DialogTitle>
                    <DialogDescription>
                        Granting proactive silent access for <span className="font-bold text-foreground">{staffName}</span>. 
                        A unique 4-digit OTP will be sent to their notifications.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Access Type</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant={selectedDuration === 'single' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('single')}
                                className="h-14 flex flex-col gap-1"
                            >
                                <Check className="h-4 w-4" />
                                <span className="text-xs">Single Entry</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === '10' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('10')}
                                className="h-14 flex flex-col gap-1"
                            >
                                <Clock className="h-4 w-4" />
                                <span className="text-xs">10 Minutes</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === '30' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('30')}
                                className="h-14 flex flex-col gap-1"
                            >
                                <Clock className="h-4 w-4" />
                                <span className="text-xs">30 Minutes</span>
                            </Button>
                            <Button 
                                variant={selectedDuration === 'custom' ? 'default' : 'outline'} 
                                onClick={() => setSelectedDuration('custom')}
                                className="h-14 flex flex-col gap-1"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-xs">Custom Time</span>
                            </Button>
                        </div>
                        {selectedDuration === 'custom' && (
                            <div className="pt-2">
                                <Label htmlFor="custom-mins" className="text-[10px] uppercase font-bold text-muted-foreground">Minutes</Label>
                                <Input 
                                    id="custom-mins" 
                                    type="number" 
                                    value={customMins} 
                                    onChange={(e) => setCustomMins(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleGrant}>
                        Next: Verify Admin
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr"> 
        <div className="lg:col-span-2 h-32"><Skeleton className="h-full w-full rounded-xl" /></div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <div className="space-y-4 pt-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
          </div>
      </div>
      <Skeleton className="h-[450px] w-full rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { isCacheReady, isSyncing } = useDataCache();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);
  const [mountedDate, setMountedDate] = useState<string>('');

  useEffect(() => {
    setMountedDate(format(new Date(), 'PP'));
    async function getData() {
      const metricsRes = await fetchDashboardMetricsAction();
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      setIsLoading(false);
    }
    getData();
  }, []);

  if (!isCacheReady && isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
         <h1 className="text-xl font-bold mb-8 text-primary flex items-center tracking-tight">
          <Activity className="mr-3 h-6 w-6" />
          Command Center
        </h1>
        <DashboardSkeleton />
      </div>
    );
  }

  let totalStockDescription: React.ReactNode = "Sum of all items in stock";
  if (metrics?.dailyStockChangeDirection && metrics.dailyStockChangeDirection !== 'none') {
    const isIncrease = metrics.dailyStockChangeDirection === 'increase';
    const colorClass = isIncrease ? 'text-destructive' : 'text-green-600';
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;

    let trendText: string = '';
    if (metrics.dailyStockChangePercent !== undefined && metrics.dailyStockChangePercent !== null) {
      trendText = `${isIncrease ? '+' : ''}${metrics.dailyStockChangePercent.toFixed(1)}%`;
    } else if (isIncrease && metrics.netItemsAddedToday && metrics.netItemsAddedToday > 0) {
        trendText = `+${metrics.netItemsAddedToday} (New)`;
    }

    if (trendText) {
      totalStockDescription = (
        <div className="flex items-center flex-wrap">
          <span>Total stock levels</span>
          <span className={cn("ml-2 font-bold flex items-center", colorClass)}>
            <ArrowIcon className="h-4 w-4 mr-0.5" />
            {trendText}
          </span>
        </div>
      );
    }
  }


  return (
    <div className="relative min-h-screen">
      {/* ATMOSPHERIC BACKGROUND LAYER */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="container relative z-10 mx-auto p-4 md:p-6 lg:p-8 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary flex items-center tracking-tight">
                <Activity className="mr-3 h-6 w-6" />
                Command Center
            </h1>
            {isSyncing && (
                <Badge variant="outline" className="animate-pulse bg-primary/10 border-primary/20 text-primary text-[10px] h-6">
                    <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> Live Syncing
                </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
          <MetricCard 
            title="Total Stock Quantity" 
            value={metrics?.totalStockQuantity || 0} 
            iconNode={<Warehouse className="h-5 w-5" />}
            onIconClick={() => setIsStockTrendDialogOpen(true)}
            description={totalStockDescription}
            href="/inventory"
            isLoading={isLoading && !metrics}
            className="lg:col-span-2"
          >
              {metrics?.stockTrend && <StockTrendSparkline data={metrics.stockTrend} />}
          </MetricCard>
          <MetricCard 
            title="Total Stock Value" 
            value={metrics?.totalStockValue ? `QAR ${metrics.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'QAR 0.00'}
            iconNode={<Wallet className="h-5 w-5" />}
            description="Valuation of current assets"
            isLoading={isLoading && !metrics}
          />
           <MetricCard 
            title="Total Suppliers" 
            value={metrics?.totalSuppliers || 0} 
            iconNode={<Users className="h-5 w-5" />}
            description="Active vendor relationships"
            isLoading={isLoading && !metrics}
          />
          
          <MetricCard 
              title="Items Expiring Soon" 
              value={metrics?.itemsExpiringSoon || 0} 
              iconNode={<CalendarClock className="h-5 w-5" />}
              description="High priority (7 days)"
              href="/inventory?filterType=expiringSoon"
              className={cn(
                  metrics && metrics.itemsExpiringSoon > 0 && "border-yellow-500/50 bg-yellow-500/5 dark:border-yellow-400/50 hover:border-yellow-500"
              )}
              isLoading={isLoading && !metrics}
          />
          
          <MetricCard 
              title="Damaged Items" 
              value={metrics?.damagedItemsCount || 0} 
              iconNode={<AlertTriangle className="h-5 w-5" />}
              description="Loss prevention review"
              href="/inventory?filterType=damaged"
              className={cn(metrics && metrics.damagedItemsCount > 0 ? "border-destructive/50 bg-destructive/5 hover:border-destructive" : "")} 
              isLoading={isLoading && !metrics}
          />

          <QuickAuthorizeCard />
        </div>

        <PendingApprovalsSummary />
        <ActiveAuthorizations />

        <div className="grid grid-cols-1 gap-6 pt-4">
          <Card className="shadow-xl rounded-xl border-white/10 bg-card/40 backdrop-blur-md overflow-hidden hidden sm:block">
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <div className="flex items-center justify-between">
                  <div>
                      <CardTitle className="text-lg font-bold flex items-center tracking-tight">
                      <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                      Stock Volume by Supplier
                      </CardTitle>
                      <CardDescription className="font-medium">Total unit distribution across registered vendors</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-background/50 backdrop-blur-sm text-[10px] h-6 border-white/10">Snapshot</Badge>
                      <span className="text-[10px] text-muted-foreground uppercase font-black">{mountedDate}</span>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="h-[400px] w-full mt-4">
                  {!metrics ? <Skeleton className="h-full w-full rounded-xl" /> : <StockBySupplierChart data={metrics.stockBySupplier} /> }
              </div>
            </CardContent>
          </Card>
        </div>

        {metrics?.stockTrend && (
            <StockTrendDetailedDialog 
              isOpen={isStockTrendDialogOpen} 
              onOpenChange={setIsStockTrendDialogOpen} 
              initialData={metrics.stockTrend} 
            />
        )}
      </div>
    </div>
  );
}
