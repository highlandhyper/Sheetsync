
'use client'; 

import { fetchDashboardMetricsAction, type ActionResponse } from '@/app/actions';
import type { DashboardMetrics, StockBySupplier } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';


function MetricCard({ title, value, iconNode, description, isLoading, href, className }: { title: string; value: string | number; iconNode: React.ReactNode; description?: React.ReactNode, isLoading?: boolean, href?: string, className?: string }) {
  const cardInnerContent = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {iconNode}
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <Skeleton className="h-8 w-1/2" />
        ) : (
            <div className="text-2xl font-bold">{value}</div>
        )}
        {description && !isLoading && <div className="text-xs text-muted-foreground pt-1 flex items-center">{description}</div>}
        {description && isLoading && <Skeleton className="h-6 w-3/4 mt-1" />} 
      </CardContent>
    </>
  );

  const cardContainerClassName = cn(
    "shadow-lg transition-all duration-300 rounded-lg hover:shadow-xl h-full", 
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
  if (data.length > MAX_SUPPLIERS_IN_CHART) {
    const topSuppliers = data.slice(0, MAX_SUPPLIERS_IN_CHART -1);
    const otherStock = data.slice(MAX_SUPPLIERS_IN_CHART - 1).reduce((sum, s) => sum + s.totalStock, 0);
    if (otherStock > 0) {
        chartDisplayData = [...topSuppliers, { name: "Other Suppliers", totalStock: otherStock }];
    } else {
        chartDisplayData = topSuppliers;
    }
  }

  const handleBarClick = (barPayload: any) => {
    if (barPayload && barPayload.name === "Other Suppliers") {
      // The "Other Suppliers" bar is formed if data.length > MAX_SUPPLIERS_IN_CHART - 1 and otherStock > 0.
      // So, we can directly proceed to find the names.
      const otherActualSupplierNames = data.slice(MAX_SUPPLIERS_IN_CHART - 1).map(s => s.name);
      if (otherActualSupplierNames.length > 0) {
        const suppliersQueryParam = encodeURIComponent(otherActualSupplierNames.join(','));
        router.push(`/inventory?filterType=otherSuppliers&suppliers=${suppliersQueryParam}`);
      } else {
        // Fallback if for some reason otherActualSupplierNames is empty, though unlikely
        // if "Other Suppliers" bar was rendered due to otherStock > 0.
        router.push('/inventory');
      }
    } else if (barPayload && barPayload.name) {
      // Navigate to inventory page filtered by this specific supplier
      router.push(`/inventory?filterType=specificSupplier&suppliers=${encodeURIComponent(barPayload.name)}`);
    }
  };

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-[350px]">
      <BarChart
        accessibilityLayer
        data={chartDisplayData}
        margin={{
          top: 20,
          right: 30, 
          left: 20,  
          bottom: 5,
        }}
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
          width={180} 
          interval={0} 
          className="text-xs"
        />
        <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel className="bg-background shadow-lg rounded-md p-2" />}
        />
        <Bar 
          dataKey="totalStock" 
          fill="var(--color-totalStock)" 
          radius={4}
          onClick={(payload) => handleBarClick(payload.payload)} 
          onMouseEnter={(props, e: any) => { 
            if (props.name) { 
              if (e && e.target) e.target.style.cursor = 'pointer';
            }
          }}
          onMouseLeave={(props, e: any) => {
             if (e && e.target) e.target.style.cursor = 'default';
          }}
        >
           <LabelList dataKey="totalStock" position="right" offset={8} className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-8">
       <Skeleton className="h-10 w-1/3 mb-6" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"> 
        <MetricCard title="Total Stock Quantity" value="" iconNode={<Warehouse className="h-5 w-5 text-muted-foreground" />} isLoading={true} description={<Skeleton className="h-4 w-3/4 mt-1" />} />
        <MetricCard title="Total Suppliers" value="" iconNode={<Users className="h-5 w-5 text-muted-foreground" />} isLoading={true} description="Unique suppliers registered" />
        <MetricCard title="Items Expiring Soon" value="" iconNode={<CalendarClock className="h-5 w-5 text-muted-foreground" />} isLoading={true} description="Next 7 days" />
        <MetricCard 
            title="Damaged Items" 
            value="" 
            iconNode={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
            isLoading={true}
            description="Items marked as damage"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1"> 
        <Card className="col-span-1 shadow-lg rounded-lg">
            <CardHeader>
            <CardTitle className="text-xl flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Stock by Supplier
            </CardTitle>
            <CardDescription>Total stock quantity held per supplier.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pr-4 pb-6">
            <Skeleton className="h-[350px] w-full" />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter(); 

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const response: ActionResponse<DashboardMetrics> = await fetchDashboardMetricsAction();
      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        console.error("Failed to fetch dashboard metrics:", response.message);
        toast({
            title: "Error Fetching Dashboard Data",
            description: response.message || "Could not load dashboard metrics. Please try again later.",
            variant: "destructive",
        });
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);


  if (isLoading || !metrics) {
    return (
      <div className="container mx-auto py-2">
         <h1 className="text-3xl font-bold mb-8 text-primary flex items-center">
          <Activity className="mr-3 h-8 w-8" />
          Inventory Dashboard
        </h1>
        <DashboardSkeleton />
      </div>
    );
  }

  let totalStockDescription: React.ReactNode = "Sum of all items in stock";
  if (metrics.dailyStockChangeDirection && metrics.dailyStockChangeDirection !== 'none') {
    const isIncrease = metrics.dailyStockChangeDirection === 'increase';
    // User requested increase=red, decrease=green
    const colorClass = isIncrease ? 'text-destructive' : 'text-green-600';
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;

    let trendText: string;
    if (metrics.dailyStockChangePercent !== undefined && metrics.dailyStockChangePercent !== null) {
      trendText = `${metrics.dailyStockChangePercent > 0 ? '+' : ''}${metrics.dailyStockChangePercent.toFixed(1)}%`;
    } else if (isIncrease && metrics.netItemsAddedToday && metrics.netItemsAddedToday > 0) {
        trendText = `+${metrics.netItemsAddedToday} (New)`;
    } else {
        trendText = ''; 
    }

    if (trendText) {
      totalStockDescription = (
        <>
          Sum of all items in stock
          <span className={cn("ml-2 font-semibold flex items-center", colorClass)}>
            <ArrowIcon className="h-4 w-4 mr-0.5" />
            {trendText}
          </span>
        </>
      );
    }
  }


  return (
    <div className="container mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8 text-primary flex items-center">
        <Activity className="mr-3 h-8 w-8" />
        Inventory Dashboard
      </h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Stock Quantity" 
          value={metrics.totalStockQuantity} 
          iconNode={<Warehouse className="h-5 w-5 text-muted-foreground" />}
          description={totalStockDescription}
          href="/inventory"
        />
         <MetricCard 
          title="Total Suppliers" 
          value={metrics.totalSuppliers} 
          iconNode={<Users className="h-5 w-5 text-muted-foreground" />}
          description="Unique suppliers registered"
        />
        <MetricCard 
          title="Items Expiring Soon" 
          value={metrics.itemsExpiringSoon} 
          iconNode={<CalendarClock className="h-5 w-5 text-muted-foreground" />}
          description="Next 7 days"
          href="/inventory?filterType=expiringSoon"
          className={cn(
            metrics.itemsExpiringSoon > 0 && "border-yellow-500/50 dark:border-yellow-400/50 hover:border-yellow-500 dark:hover:border-yellow-400 animate-pulse"
          )}
        />
        <MetricCard 
            title="Damaged Items" 
            value={metrics.damagedItemsCount} 
            iconNode={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
            description="Items marked as damage"
            href="/inventory?filterType=damaged"
            className={metrics.damagedItemsCount > 0 ? "border-destructive/50 hover:border-destructive" : ""} 
        />
      </div>
       <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1 mt-8"> 
        <Card className="col-span-1 shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Stock by Supplier
            </CardTitle>
            <CardDescription>Total stock quantity held per supplier.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0 pr-4 pb-6">
            <StockBySupplierChart data={metrics.stockBySupplier} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
