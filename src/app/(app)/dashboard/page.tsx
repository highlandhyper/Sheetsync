'use client'; 

import { type DashboardMetrics, type StockBySupplier, type StockTrendData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown, ShieldCheck, Check, X, Clock, MessageSquare, Plus, AreaChart as AreaChartIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fetchDashboardMetricsAction } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, AreaChart, Area } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';

function MetricCard({ title, value, iconNode, description, isLoading, href, className, children }: { title: string; value: string | number; iconNode: React.ReactNode; description?: React.ReactNode, isLoading?: boolean, href?: string, className?: string, children?: React.ReactNode }) {
  const cardInnerContent = (
    <>
      {children}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-full text-primary">{iconNode}</div>
      </CardHeader>
      <CardContent className="flex flex-col h-full relative z-10">
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

function SpecialEntryApprovalPanel() {
    const { pendingRequests, approveRequest, rejectRequest } = useSpecialEntry();
    const { role } = useAuth();
    const [customMins, setCustomMins] = useState<string>("15");
    
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [stagedApproval, setStagedApproval] = useState<{id: string, mins?: number} | null>(null);

    if (role !== 'admin' || pendingRequests.length === 0) return null;

    const handleInitiateApproval = (id: string, mins?: number) => {
        setStagedApproval({ id, mins });
        setIsAuthDialogOpen(true);
    };

    const handleAuthSuccess = () => {
        if (stagedApproval) {
            approveRequest(stagedApproval.id, stagedApproval.mins);
            setStagedApproval(null);
        }
        setIsAuthDialogOpen(false);
    };

    return (
        <>
        <Card className="mb-8 border-primary/20 bg-primary/5 shadow-md rounded-xl">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Pending Special Entry Requests
                    </CardTitle>
                    <Badge variant="secondary" className="animate-pulse">{pendingRequests.length} Pending</Badge>
                </div>
                <CardDescription>Authorize staff to log items without email alerts. Local password required.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {pendingRequests.map((req) => (
                    <div key={req.id} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-3 rounded-lg bg-background border gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">{req.staffName}</p>
                                <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                            <Button size="sm" variant="outline" className="flex-1 lg:flex-none order-last lg:order-none" onClick={() => rejectRequest(req.id)}>
                                <X className="mr-1 h-3 w-3" /> Reject
                            </Button>
                            
                            <div className="h-8 w-px bg-border hidden lg:block mx-1" />

                            <Button size="sm" variant="secondary" className="flex-1 lg:flex-none" onClick={() => handleInitiateApproval(req.id)}>
                                <Check className="mr-1 h-3 w-3" /> 1 Entry
                            </Button>
                            
                            <Button size="sm" className="flex-1 lg:flex-none" onClick={() => handleInitiateApproval(req.id, 10)}>
                                <Clock className="mr-1 h-3 w-3" /> 10 Mins
                            </Button>

                            <Button size="sm" className="flex-1 lg:flex-none" onClick={() => handleInitiateApproval(req.id, 30)}>
                                <Clock className="mr-1 h-3 w-3" /> 30 Mins
                            </Button>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button size="sm" variant="ghost" className="flex-1 lg:flex-none border-dashed border-2">
                                        <Plus className="mr-1 h-3 w-3" /> Custom
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-40 p-3" align="end">
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Mins</p>
                                            <Input 
                                                type="number" 
                                                value={customMins} 
                                                onChange={(e) => setCustomMins(e.target.value)} 
                                                className="h-8"
                                            />
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="w-full text-xs h-8" 
                                            disabled={!customMins || parseInt(customMins) < 1}
                                            onClick={() => handleInitiateApproval(req.id, parseInt(customMins))}
                                        >
                                            Set Time
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
        <AuthorizeActionDialog
            isOpen={isAuthDialogOpen}
            onOpenChange={setIsAuthDialogOpen}
            onAuthorizationSuccess={handleAuthSuccess}
            actionDescription="You are authorizing a Special Entry (Silent Mode) session. Please verify your local admin credentials."
        />
        </>
    );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"> 
        <div className="lg:col-span-2 h-32"><Skeleton className="h-full w-full rounded-xl" /></div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <Skeleton className="h-[450px] w-full rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
         <h1 className="text-3xl sm:text-4xl font-black mb-8 text-primary flex items-center tracking-tight uppercase">
          <Activity className="mr-3 h-8 w-8 sm:h-10 sm:w-10" />
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
      <h1 className="text-3xl sm:text-4xl font-black mb-4 text-primary flex items-center tracking-tighter uppercase">
        <Activity className="mr-3 h-8 w-8 sm:h-10 sm:w-10" />
        Command Center
      </h1>

      <SpecialEntryApprovalPanel />

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard 
          title="Total Stock Quantity" 
          value={metrics.totalStockQuantity} 
          iconNode={<Warehouse className="h-5 w-5" />}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
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
    </div>
  );
}