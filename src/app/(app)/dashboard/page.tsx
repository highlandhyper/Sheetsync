'use client'; 

import { type DashboardMetrics, type StockBySupplier } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown, ShieldCheck, Check, X, Clock, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fetchDashboardMetricsAction } from '@/app/actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';


function MetricCard({ title, value, iconNode, description, isLoading, href, className }: { title: string; value: string | number; iconNode: React.ReactNode; description?: React.ReactNode, isLoading?: boolean, href?: string, className?: string }) {
  const cardInnerContent = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-full text-primary">{iconNode}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <Skeleton className="h-8 w-1/2" />
        ) : (
            <div className="text-2xl font-bold">{value}</div>
        )}
        {description && !isLoading && <div className="text-xs text-muted-foreground pt-1 flex items-center">{description}</div>}
        {isLoading && <Skeleton className="h-4 w-3/4 mt-1" />}
      </CardContent>
    </>
  );

  const cardContainerClassName = cn(
    "shadow-lg transition-all duration-300 rounded-lg hover:shadow-xl h-full",
    "bg-gradient-to-tr from-card to-card/90",
    href ? "hover:bg-card/95 hover:ring-2 hover:ring-primary/50" : "",
    className
  );
  
  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg block h-full">
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

const MAX_SUPPLIERS_IN_CHART = 7;

function StockBySupplierChart({ data }: { data: StockBySupplier[] }) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const chartConfig = {
    totalStock: {
      label: "Total Stock",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No supplier stock data available.</p>;
  }
  
  let chartDisplayData = data;
  let otherSuppliersData: StockBySupplier[] | null = null;

  if (data.length > MAX_SUPPLIERS_IN_CHART) {
    const topSuppliers = data.slice(0, MAX_SUPPLIERS_IN_CHART -1);
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
  
  const yAxisWidth = isMobile ? 120 : 180;
  const charMargin = isMobile ? { top: 20, right: 30, left: 10, bottom: 5 } : { top: 20, right: 30, left: 20, bottom: 5 };


  return (
    <ChartContainer config={chartConfig} className="min-h-[350px] w-full h-full max-h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart
        accessibilityLayer
        data={chartDisplayData}
        margin={charMargin}
        layout="vertical"
      >
        <CartesianGrid horizontal={false} vertical={true} strokeDasharray="3 3" />
        <XAxis type="number" dataKey="totalStock" hide />
        <YAxis 
          dataKey="name" 
          type="category" 
          tickLine={false} 
          axisLine={false} 
          tickMargin={8} 
          width={yAxisWidth} 
          interval={0} 
          className="text-xs"
          tickFormatter={(value) => value.length > (isMobile ? 15 : 20) ? `${value.substring(0, isMobile ? 13 : 18)}...` : value}
        />
        <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel className="bg-background shadow-lg rounded-md p-2" />}
        />
        <Bar 
          dataKey="totalStock" 
          fill="var(--color-totalStock)" 
          radius={4}
          onClick={(payload) => handleBarClick(payload)} 
          onMouseEnter={(props, e: any) => { 
            if (e && e.target) e.target.style.cursor = 'pointer';
          }}
          onMouseLeave={(props, e: any) => {
             if (e && e.target) e.target.style.cursor = 'default';
          }}
        >
           <LabelList dataKey="totalStock" position="right" offset={8} className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function SpecialEntryApprovalPanel() {
    const { pendingRequests, approveRequest, rejectRequest } = useSpecialEntry();
    const { role } = useAuth();

    if (role !== 'admin' || pendingRequests.length === 0) return null;

    return (
        <Card className="mb-8 border-primary/20 bg-primary/5 shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Pending Special Entry Requests
                    </CardTitle>
                    <Badge variant="secondary" className="animate-pulse">{pendingRequests.length} Pending</Badge>
                </div>
                <CardDescription>Authorize staff to log items without email alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {pendingRequests.map((req) => (
                    <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-background border gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">{req.staffName}</p>
                                <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => rejectRequest(req.id)}>
                                <X className="mr-1 h-3 w-3" /> Reject
                            </Button>
                            <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => approveRequest(req.id)}>
                                <Check className="mr-1 h-3 w-3" /> 1 Entry
                            </Button>
                            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => approveRequest(req.id, 5)}>
                                <Clock className="mr-1 h-3 w-3" /> 5 Mins
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
       <Skeleton className="h-10 w-2/3 mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"> 
        <MetricCard title="Total Stock Quantity" value="" iconNode={<Warehouse className="h-5 w-5" />} isLoading={true} description={<Skeleton className="h-4 w-3/4 mt-1" />} />
        <MetricCard title="Total Stock Value" value="" iconNode={<Wallet className="h-5 w-5" />} isLoading={true} description={<Skeleton className="h-4 w-3/4 mt-1" />} />
        <MetricCard title="Total Suppliers" value="" iconNode={<Users className="h-5 w-5" />} isLoading={true} description={<Skeleton className="h-4 w-3/4 mt-1" />} />
        <MetricCard title="Items Expiring Soon" value="" iconNode={<CalendarClock className="h-5 w-5" />} isLoading={true} description={<Skeleton className="h-4 w-3/4 mt-1" />} />
        <MetricCard 
            title="Damaged Items" 
            value="" 
            iconNode={<AlertTriangle className="h-5 w-5" />}
            isLoading={true}
            description={<Skeleton className="h-4 w-3/4 mt-1" />}
        />
      </div>
      <div className="grid grid-cols-1 hidden md:block"> 
        <Card className="col-span-1 shadow-lg rounded-lg">
            <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Stock by Supplier
            </CardTitle>
            <CardDescription>Total stock quantity held per supplier.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pr-2 sm:pr-4 pb-6 h-[400px]">
              <Skeleton className="h-full w-full" />
            </CardContent>
        </Card>
      </div>
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
      <div className="container mx-auto p-4 md:p-6">
         <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 sm:mb-8 text-primary flex items-center tracking-tight">
          <Activity className="mr-3 h-7 w-7 sm:h-8 sm:w-8" />
          Inventory Dashboard
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
          <span>Sum of all items in stock</span>
          <span className={cn("ml-2 font-semibold flex items-center", colorClass)}>
            <ArrowIcon className="h-4 w-4 mr-0.5" />
            {trendText}
          </span>
        </div>
      );
    }
  }


  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 sm:mb-8 text-primary flex items-center tracking-tight">
        <Activity className="mr-3 h-7 w-7 sm:h-8 sm:w-8" />
        Inventory Dashboard
      </h1>

      <SpecialEntryApprovalPanel />

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        <MetricCard 
          title="Total Stock Quantity" 
          value={metrics.totalStockQuantity} 
          iconNode={<Warehouse className="h-5 w-5" />}
          description={totalStockDescription}
          href="/inventory"
          isLoading={isLoading}
        />
        <MetricCard 
          title="Total Stock Value" 
          value={metrics.totalStockValue ? `QAR ${metrics.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'QAR 0.00'}
          iconNode={<Wallet className="h-5 w-5" />}
          description="Total cost of all items in stock"
          isLoading={isLoading}
        />
         <MetricCard 
          title="Total Suppliers" 
          value={metrics.totalSuppliers} 
          iconNode={<Users className="h-5 w-5" />}
          description="Unique suppliers registered"
          isLoading={isLoading}
        />
        <MetricCard 
          title="Items Expiring Soon" 
          value={metrics.itemsExpiringSoon} 
          iconNode={<CalendarClock className="h-5 w-5" />}
          description="Next 7 days"
          href="/inventory?filterType=expiringSoon"
          className={cn(
            !isLoading && metrics.itemsExpiringSoon > 0 && "border-yellow-500/50 dark:border-yellow-400/50 hover:border-yellow-500 dark:hover:border-yellow-400"
          )}
          isLoading={isLoading}
        />
        <MetricCard 
            title="Damaged Items" 
            value={metrics.damagedItemsCount} 
            iconNode={<AlertTriangle className="h-5 w-5" />}
            description="Items marked as damage"
            href="/inventory?filterType=damaged"
            className={!isLoading && metrics.damagedItemsCount > 0 ? "border-destructive/50 hover:border-destructive" : ""} 
            isLoading={isLoading}
        />
      </div>
       <div className="mt-6 md:mt-8 hidden md:block"> 
        <Card className="col-span-1 shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Stock by Supplier
            </CardTitle>
            <CardDescription>Total stock quantity held per supplier. Click a bar to filter inventory.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0 pr-2 sm:pr-4 pb-4 sm:pb-6 h-[400px]">
            {isLoading ? <Skeleton className="h-full w-full" /> : <StockBySupplierChart data={metrics.stockBySupplier} /> }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
