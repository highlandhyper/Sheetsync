
'use client'; 

import { type DashboardMetrics, type StockBySupplier, type StockTrendData, type SpecialEntryRequest } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown, ShieldCheck, Check, X, Clock, MessageSquare, Plus, KeyRound, UserPlus, ShieldQuestion, UserCheck, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fetchDashboardMetricsAction } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, AreaChart, Area } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRouter } from 'next/navigation';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { useDataCache } from '@/context/data-cache-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';

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
    "bg-gradient-to-br from-card to-card/95 border-border/50",
    href ? "hover:bg-card/95 hover:ring-2 hover:ring-primary/30" : "",
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
    <ChartContainer config={chartConfig} className="min-h-[350px] w-full h-full max-h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
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
    <ChartContainer config={chartConfig} className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
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
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function StockTrendDetailedDialog({ isOpen, onOpenChange, data }: { isOpen: boolean; onOpenChange: (open: boolean) => void; data: StockTrendData[] }) {
    const chartConfig = {
        totalStock: {
            label: "Total Units",
            color: "hsl(var(--primary))",
        },
    } satisfies ChartConfig;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        7-Day Stock Trend
                    </DialogTitle>
                    <DialogDescription>
                        Historical overview of total inventory volume across all storage zones.
                    </DialogDescription>
                </DialogHeader>
                <div className="h-[350px] w-full mt-4">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
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
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
                <DialogFooter className="sm:justify-start">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Close Overview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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

function QuickAuthorizeCard() {
    const { uniqueStaffNames } = useDataCache();
    const { grantProactiveEntry } = useSpecialEntry();
    const { toast } = useToast();
    const [selectedStaff, setSelectedStaff] = useState<string>("");
    const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [grantParams, setGrantParams] = useState<{ duration?: number } | null>(null);

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
        <Card className="shadow-lg rounded-xl bg-gradient-to-br from-card to-card/95 border-border/50 h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Authorize</CardTitle>
                <CardDescription className="text-[10px]">Proactive silent entry grant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Staff Member" />
                    </SelectTrigger>
                    <SelectContent>
                        {uniqueStaffNames.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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

function PendingSpecialEntryRequests() {
    const { pendingRequests, approveRequest, rejectRequest } = useSpecialEntry();
    const [selectedRequest, setSelectedRequest] = useState<SpecialEntryRequest | null>(null);
    const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [duration, setDuration] = useState<string>("single");

    if (pendingRequests.length === 0) {
        return null;
    }

    const handleApproveClick = (req: SpecialEntryRequest) => {
        setSelectedRequest(req);
        setIsApproveDialogOpen(true);
    };

    const handleApproveSubmit = () => {
        setIsApproveDialogOpen(false);
        setIsAuthDialogOpen(true);
    };

    const handleAuthorizationSuccess = () => {
        if (!selectedRequest) return;
        setIsAuthDialogOpen(false);
        approveRequest(selectedRequest.id, duration === 'single' ? undefined : parseInt(duration));
        setSelectedRequest(null);
    };

    return (
        <div className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-primary flex items-center gap-2">
                    <ShieldQuestion className="h-6 w-6" />
                    Pending Authorizations
                    <Badge className="ml-2 bg-destructive animate-pulse">{pendingRequests.length}</Badge>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingRequests.map(req => (
                    <Card key={req.id} className="border-primary/20 shadow-lg overflow-hidden flex flex-col">
                        <CardHeader className="bg-primary/5 pb-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg">{req.staffName}</CardTitle>
                                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Request: {req.type === 'timed' ? 'Timed Access' : 'Single Entry'}
                                    </CardDescription>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border">
                                    {format(parseISO(req.requestedAt), 'HH:mm')}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 flex-grow">
                            <p className="text-sm text-muted-foreground italic mb-4">
                                {req.reason || '"No reason provided"'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                <Users className="h-3 w-3" />
                                <span>Via: {req.userEmail}</span>
                            </div>
                        </CardContent>
                        <div className="p-3 bg-muted/20 border-t flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => rejectRequest(req.id)}>
                                <X className="mr-1 h-3 w-3" /> Reject
                            </Button>
                            <Button size="sm" className="flex-1 h-8 text-xs font-bold" onClick={() => handleApproveClick(req)}>
                                <Check className="mr-1 h-3 w-3" /> Authorize
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Authorize Silent Entry</DialogTitle>
                        <DialogDescription>
                            Granting silent mode for <span className="font-bold text-foreground">{selectedRequest?.staffName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Access Duration</Label>
                            <Select value={duration} onValueChange={setDuration}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Single Log Only</SelectItem>
                                    <SelectItem value="10">10 Minutes Window</SelectItem>
                                    <SelectItem value="30">30 Minutes Window</SelectItem>
                                    <SelectItem value="60">1 Hour Window</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleApproveSubmit}>
                            Next: Admin Credentials
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AuthorizeActionDialog 
                isOpen={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
                onAuthorizationSuccess={handleAuthorizationSuccess}
                actionDescription={`Approving silent mode request for ${selectedRequest?.staffName}. Credentials required.`}
            />
        </div>
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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);

  useEffect(() => {
    async function getMetrics() {
      setIsLoading(true);
      const response = await fetchDashboardMetricsAction();
      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        console.error("Failed to fetch dashboard metrics:", response.message);
      }
      setIsLoading(false);
    }
    getMetrics();
  }, []);

  if (isLoading || !metrics) {
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
  if (metrics.dailyStockChangeDirection && metrics.dailyStockChangeDirection !== 'none') {
    const isIncrease = metrics.dailyStockChangeDirection === 'increase';
    const colorClass = isIncrease ? 'text-destructive' : 'text-green-600';
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;

    let trendText: string;
    if (metrics.dailyStockChangePercent !== undefined && metrics.dailyStockChangePercent !== null) {
      trendText = `${isIncrease ? '+' : ''}${metrics.dailyStockChangePercent.toFixed(1)}%`;
    } else if (isIncrease && metrics.netItemsAddedToday && metrics.netItemsAddedToday > 0) {
        trendText = `+${metrics.netItemsAddedToday} (New)`;
    } else {
        trendText = ''; 
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
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-10">
      <h1 className="text-xl font-bold mb-4 text-primary flex items-center tracking-tight">
        <Activity className="mr-3 h-6 w-6" />
        Command Center
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
        <MetricCard 
          title="Total Stock Quantity" 
          value={metrics.totalStockQuantity} 
          iconNode={<Warehouse className="h-5 w-5" />}
          onIconClick={() => setIsStockTrendDialogOpen(true)}
          description={totalStockDescription}
          href="/inventory"
          isLoading={isLoading}
          className="lg:col-span-2"
        >
            {metrics.stockTrend && <StockTrendSparkline data={metrics.stockTrend} />}
        </MetricCard>
        <MetricCard 
          title="Total Stock Value" 
          value={metrics.totalStockValue ? `QAR ${metrics.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'QAR 0.00'}
          iconNode={<Wallet className="h-5 w-5" />}
          description="Valuation of current assets"
          isLoading={isLoading}
        />
         <MetricCard 
          title="Total Suppliers" 
          value={metrics.totalSuppliers} 
          iconNode={<Users className="h-5 w-5" />}
          description="Active vendor relationships"
          isLoading={isLoading}
        />
        
        <MetricCard 
            title="Items Expiring Soon" 
            value={metrics.itemsExpiringSoon} 
            iconNode={<CalendarClock className="h-5 w-5" />}
            description="High priority (7 days)"
            href="/inventory?filterType=expiringSoon"
            className={cn(
                !isLoading && metrics.itemsExpiringSoon > 0 && "border-yellow-500/50 bg-yellow-500/5 dark:border-yellow-400/50 hover:border-yellow-500"
            )}
            isLoading={isLoading}
        />
        
        <MetricCard 
            title="Damaged Items" 
            value={metrics.damagedItemsCount} 
            iconNode={<AlertTriangle className="h-5 w-5" />}
            description="Loss prevention review"
            href="/inventory?filterType=damaged"
            className={cn(!isLoading && metrics.damagedItemsCount > 0 ? "border-destructive/50 bg-destructive/5 hover:border-destructive" : "")} 
            isLoading={isLoading}
        />

        <QuickAuthorizeCard />
      </div>

      <PendingSpecialEntryRequests />

      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <Card className="shadow-xl rounded-xl border-border/50 bg-card/50 lg:col-span-3 overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-bold flex items-center tracking-tight">
                    <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                    Stock Volume by Supplier
                    </CardTitle>
                    <CardDescription className="font-medium">Total unit distribution across registered vendors</CardDescription>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <Badge variant="outline" className="bg-background">Live Data</Badge>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="h-[400px] w-full mt-4">
                {isLoading ? <Skeleton className="h-full w-full rounded-xl" /> : <StockBySupplierChart data={metrics.stockBySupplier} /> }
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.stockTrend && (
          <StockTrendDetailedDialog 
            isOpen={isStockTrendDialogOpen} 
            onOpenChange={setIsStockTrendDialogOpen} 
            data={metrics.stockTrend} 
          />
      )}
    </div>
  );
}
