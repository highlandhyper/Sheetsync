'use client'; 

import { type DashboardMetrics, type StockBySupplier, type StockTrendData, type InventoryItem, type Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Warehouse, CalendarClock, AlertTriangle, Activity, TrendingUp, ArrowUp, ArrowDown, ShieldCheck, Check, Clock, Plus, UserPlus, ShieldQuestion, Timer, Calendar as CalendarIcon, BellOff, User, Ban, Key, ArrowRight, ChevronsUpDown, RefreshCw, Layers, Globe, History, Fingerprint, Edit, Trash2 } from 'lucide-react';
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

function MetricCard({ title, value, iconNode, description, isLoading, href, className, onIconClick }: { title: string; value: string | number; iconNode: React.ReactNode; description?: React.ReactNode, isLoading?: boolean, href?: string, className?: string, onIconClick?: (e: React.MouseEvent) => void }) {
  const cardInnerContent = (
    <div className="relative z-20 flex flex-col h-full p-4 sm:p-5">
        <div className="flex flex-row items-center justify-between w-full mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{title}</span>
            <div 
                className={cn(
                    "w-9 h-9 flex items-center justify-center bg-primary/10 rounded-xl text-primary transition-all duration-500", 
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
                <div className="h-4 w-4">{iconNode}</div>
            </div>
        </div>
        
        <div className="flex-1 flex flex-col justify-center min-h-[80px]">
            {isLoading ? (
                <Skeleton className="h-8 w-3/4" />
            ) : (
                <div className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                    {value}
                </div>
            )}
        </div>

        <div className="mt-1 pt-1 border-t border-white/5 h-8 flex items-center">
            {description && !isLoading && (
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 flex items-center">
                    {description}
                </div>
            )}
            {isLoading && <Skeleton className="h-3 w-1/2" />}
        </div>
    </div>
  );

  const cardContainerClassName = cn(
    "group relative transition-all duration-700 rounded-2xl border border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl h-full shadow-2xl shadow-black/[0.03] overflow-hidden",
    href ? "hover:border-primary/20 hover:shadow-primary/5 cursor-pointer active:scale-[0.98]" : "",
    className
  );
  
  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl block h-full">
        <Card className={cardContainerClassName}>
          {cardInnerContent}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
        </Card>
      </Link>
    );
  }
  return (
    <Card className={cardContainerClassName}>
        {cardInnerContent}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
    </Card>
  );
}

function VolumeGaugeCard({ title, value, description, onIconClick, href }: { title: string, value: number, description: React.ReactNode, onIconClick?: (e: React.MouseEvent) => void, href: string }) {
    const MAX_CAPACITY = 10000; 
    const tier1 = Math.min(value, MAX_CAPACITY);
    const remainder = Math.max(0, MAX_CAPACITY - value);

    const data = [
        { name: 'Active', value: tier1 },
        { name: 'Remainder', value: remainder },
    ];

    return (
        <Link href={href} className="col-span-2 lg:col-span-1 h-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
            <Card className="group relative transition-all duration-700 rounded-2xl border border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl h-full shadow-2xl shadow-black/[0.03] overflow-hidden hover:border-primary/20 hover:shadow-primary/5 cursor-pointer active:scale-[0.98]">
                <div className="relative z-10 p-4 sm:p-5 h-full flex flex-col">
                    <div className="w-full flex justify-between items-start z-20 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{title}</span>
                        <div 
                            className="w-9 h-9 flex items-center justify-center bg-primary/10 rounded-xl text-primary transition-all duration-500 cursor-pointer hover:bg-primary/20 hover:scale-110 active:scale-95"
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
                    
                    <div className="relative flex flex-col items-center justify-center flex-1 min-h-[80px] pt-4">
                        {/* HALF ROUND PROGRESS BAR: ARCHING OVER NUMBERS */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -top-2">
                             <ResponsiveContainer width="100%" height={100}>
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="100%" 
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={32}
                                        outerRadius={48}
                                        paddingAngle={0}
                                        dataKey="value"
                                        stroke="none"
                                        isAnimationActive={true}
                                        animationDuration={2000}
                                    >
                                        <Cell fill="hsl(var(--primary))" />
                                        <Cell fill="hsl(var(--primary) / 0.1)" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="relative z-10 text-center mt-6">
                            <div className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                                {value.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="mt-1 pt-1 border-t border-white/5 h-8 flex items-center justify-center z-20">
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 flex items-center">
                            {description}
                        </div>
                    </div>
                </div>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
            </Card>
        </Link>
    );
}

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

  if (data.length > 10) {
    const topSuppliers = data.slice(0, 9);
    otherSuppliersData = data.slice(9);
    const otherStock = otherSuppliersData.reduce((sum, s) => sum + s.totalStock, 0);
    chartDisplayData = [...topSuppliers, { name: "Other Suppliers", totalStock: otherStock }];
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
        <BarChart accessibilityLayer data={chartDisplayData} margin={{ top: 40, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" opacity={0.05} />
            <XAxis dataKey="name" hide />
            <YAxis type="number" tickLine={false} axisLine={false} tickMargin={8} className="text-[10px] font-black opacity-20" />
            <ChartTooltip cursor={{ fill: 'hsl(var(--primary))', opacity: 0.03 }} content={<ChartTooltipContent className="bg-background/90 backdrop-blur-3xl shadow-3xl rounded-xl p-4 border-white/10" />} />
            <Bar dataKey="totalStock" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} onClick={(payload) => handleBarClick(payload)} className="cursor-pointer" animationDuration={2000}>
                <LabelList dataKey="totalStock" position="top" offset={12} className="fill-foreground text-[10px] font-black" />
            </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function StockTrendDetailedDialog({ isOpen, onOpenChange, initialData }: { isOpen: boolean; onOpenChange: (open: boolean) => void; initialData: StockTrendData[] }) {
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
        const currentTotal = inventoryItems.reduce((s, i) => s + i.quantity, 0);
        days.forEach(day => {
            const addedSince = inventoryItems.filter(i => {
                if (!i.timestamp) return false;
                const logDate = parseISO(i.timestamp);
                return isAfter(logDate, endOfDay(day));
            }).reduce((s, i) => s + i.quantity, 0);
            data.push({ date: format(day, 'MMM dd'), totalStock: Math.max(0, currentTotal - addedSince) });
        });
        return data;
    }, [dateRange, inventoryItems, initialData]);

    const chartConfig = { totalStock: { label: "Total Units", color: "hsl(var(--primary))" } } satisfies ChartConfig;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl rounded-2xl border-none shadow-3xl p-8 overflow-hidden bg-background/95 backdrop-blur-2xl">
                <DialogHeader className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <DialogTitle className="flex items-center gap-3 text-3xl font-black uppercase tracking-tighter">
                                <Activity className="h-8 w-8 text-primary" strokeWidth={3} />
                                Asset <span className="text-primary">Pulse</span>
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Global Registry Volume Analysis</DialogDescription>
                        </div>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-12 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl bg-muted/20 border-primary/10">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "MMM dd")} — {format(dateRange.to, "MMM dd")}</> : format(dateRange.from, "MMM dd")) : <span>Set Period</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-xl" align="end"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent>
                        </Popover>
                    </div>
                </DialogHeader>
                <div className="h-[300px] sm:h-[450px] w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <defs><linearGradient id="colorStockDetailed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.05} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={15} className="text-[10px] font-black uppercase text-muted-foreground/30 tracking-widest" />
                            <YAxis axisLine={false} tickLine={false} tickMargin={15} className="text-[10px] font-black text-muted-foreground/30" />
                            <ChartTooltip content={<ChartTooltipContent className="rounded-xl shadow-3xl" />} />
                            <Area type="monotone" dataKey="totalStock" stroke="hsl(var(--primary))" strokeWidth={5} fillOpacity={1} fill="url(#colorStockDetailed)" animationDuration={2000} />
                        </AreaChart>
                    </ChartContainer>
                </div>
                <DialogFooter className="mt-8"><Button variant="secondary" className="rounded-xl font-black uppercase tracking-widest text-[10px] px-12 h-14 w-full sm:w-auto" onClick={() => onOpenChange(false)}>Close Analysis</Button></DialogFooter>
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

    const handleOpenGrant = () => { if (selectedStaff) setIsGrantDialogOpen(true); };
    const confirmGrant = (duration?: number) => { setGrantParams({ duration }); setIsAuthDialogOpen(true); };
    const handleAuthorizationSuccess = () => {
        setIsAuthDialogOpen(false);
        grantProactiveEntry(selectedStaff, grantParams?.duration);
        toast({ title: "Access Granted", description: `Key sent to ${selectedStaff}.` });
        setSelectedStaff("");
        setGrantParams(null);
    };

    return (
        <>
        <Card className="shadow-none border border-white/5 bg-primary/5 dark:bg-primary/[0.02] h-full flex flex-col group overflow-hidden relative rounded-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-20"><ShieldCheck className="h-8 w-8 text-primary" strokeWidth={1} /></div>
            <CardHeader className="pb-1 px-4 pt-4 sm:px-5 sm:pt-5">
                <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Terminal Access</CardTitle>
                <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Authorization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-1 flex-grow flex flex-col justify-center px-4 pb-4 sm:px-5 sm:pb-5 min-h-[80px]">
                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full h-9 text-[10px] justify-between font-black uppercase tracking-tight rounded-xl border-primary/10 bg-background/50 backdrop-blur-xl">
                            <div className="flex items-center gap-2 truncate">
                                {selectedStaff === "ALL PERSONNEL (GLOBAL)" ? <Globe className="h-3 w-3 text-primary shrink-0" /> : <User className="h-3 w-3 text-primary shrink-0" />}
                                {selectedStaff || "SELECT PERSONNEL"}
                            </div>
                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-30" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden border-white/10" align="start">
                        <Command>
                            <CommandInput placeholder="Search registry..." className="h-11 text-xs font-bold" />
                            <CommandList>
                                <CommandEmpty className="text-[9px] font-black uppercase py-4 text-center opacity-40">Zero Results</CommandEmpty>
                                <CommandGroup heading="Industrial Broadcast">
                                    <CommandItem value="ALL PERSONNEL (GLOBAL)" onSelect={() => { setSelectedStaff("ALL PERSONNEL (GLOBAL)"); setStaffPopoverOpen(false); }} className="text-[10px] font-black text-primary h-10 px-4">
                                        <Globe className="mr-2 h-3 w-3" /> ALL PERSONNEL (GLOBAL)
                                        <Check className={cn("ml-auto h-3 w-3", selectedStaff === "ALL PERSONNEL (GLOBAL)" ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                </CommandGroup>
                                <CommandGroup heading="Individual Registry">
                                    {uniqueStaffNames.map(name => (
                                        <CommandItem key={name} value={name} onSelect={() => { setSelectedStaff(name); setStaffPopoverOpen(false); }} className="text-[10px] font-bold h-10 px-4">
                                            <Check className={cn("mr-2 h-3 w-3", selectedStaff === name ? "opacity-100" : "opacity-0")} /> {name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Button className="w-full h-9 text-[10px] font-black uppercase tracking-[0.1em] rounded-xl shadow-2xl shadow-primary/20 bg-primary text-white" disabled={!selectedStaff} onClick={handleOpenGrant}>AUTHORIZE</Button>
            </CardContent>
            <div className="h-8 flex items-center px-4 sm:px-5 mt-auto mb-1"><div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">PERMISSIONS</div></div>
        </Card>
        <ProactiveGrantDialog isOpen={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen} staffName={selectedStaff} onGrant={confirmGrant} />
        <AuthorizeActionDialog isOpen={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} onAuthorizationSuccess={handleAuthorizationSuccess} actionDescription={`Authorizing access for ${selectedStaff}. Clearance required.`} />
        </>
    );
}

function ActiveAuthorizations() {
    const { activeSessions, revokeRequest } = useSpecialEntry();
    const { toast } = useToast();
    if (activeSessions.length === 0) return null;
    const handleRevoke = (id: string, name: string) => { revokeRequest(id); toast({ title: "Access Revoked", description: `Session for ${name} terminated.` }); };
    return (
        <div className="space-y-6 pt-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-[0.1em]">
                    <ShieldCheck className="h-5 w-5 text-green-500" strokeWidth={3} /> Active Access Grants
                </h2>
                <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/10 font-black uppercase text-[9px] tracking-widest px-3 py-1">{activeSessions.length} Online</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeSessions.map(session => {
                    const isGlobal = session.staffName === "ALL PERSONNEL (GLOBAL)";
                    return (
                        <Card key={session.id} className={cn("border border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl shadow-none rounded-xl overflow-hidden flex flex-col transition-all duration-500", isGlobal && "border-primary/20 bg-primary/[0.01]")}>
                            <CardContent className="p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-xl", isGlobal ? "bg-primary/10 text-primary" : "bg-green-500/10 text-green-600")}>{isGlobal ? <Globe className="h-6 w-6" /> : <User className="h-6 w-6" />}</div>
                                        <div className="flex flex-col"><span className="text-base font-black tracking-tight">{isGlobal ? "Universal Grant" : session.staffName}</span><span className="text-[10px] uppercase font-bold text-muted-foreground/40 tracking-widest">{session.type} Entry Protocol</span></div>
                                    </div>
                                    <div className="py-2 px-4 bg-background dark:bg-black/20 rounded-xl border border-primary/5 shadow-inner flex flex-col items-center"><span className="text-[8px] font-black uppercase text-primary/40 tracking-widest mb-1">Passkey</span><span className="font-mono font-black text-lg text-primary tracking-[0.2em] leading-none">{session.otp || '----'}</span></div>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <Button variant="ghost" size="sm" className="h-10 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-lg px-4" onClick={() => handleRevoke(session.id, session.staffName)}><Ban className="mr-2 h-4 w-4" /> Terminate</Button>
                                    {session.expiresAt && <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 rounded-lg"><Timer className="h-3.5 w-3.5 text-destructive animate-pulse" /><span className="text-[10px] font-black text-destructive tracking-widest">{format(parseISO(session.expiresAt), 'HH:mm')}</span></div>}
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
        <Card className="hidden sm:block border border-primary/10 bg-primary/5 backdrop-blur-3xl shadow-3xl shadow-primary/5 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="bg-primary p-5 rounded-xl shadow-2xl shadow-primary/30 relative"><ShieldQuestion className="h-8 w-8 text-primary-foreground" /><div className="absolute -top-1 -right-1 h-4 w-4 bg-white rounded-full flex items-center justify-center text-[10px] font-black text-primary animate-bounce">!</div></div>
                    <div className="space-y-1"><h3 className="text-2xl font-black tracking-tight uppercase leading-none">Security Pending</h3><p className="text-muted-foreground/60 font-bold uppercase text-[10px] tracking-widest"><span className="text-primary font-black">{pendingRequests.length} High-priority requests</span> awaiting clearance.</p></div>
                </div>
                <Button asChild size="lg" className="h-14 px-10 font-black uppercase tracking-widest text-[11px] rounded-xl shadow-2xl shadow-primary/20 bg-primary"><Link href="/approvals">Review Terminal <ArrowRight className="ml-3 h-5 w-5" /></Link></Button>
            </CardContent>
        </Card>
    );
}

function ProactiveGrantDialog({ isOpen, onOpenChange, staffName, onGrant }: { isOpen: boolean; onOpenChange: (open: boolean) => void; staffName: string; onGrant: (duration?: number) => void; }) {
    const [selectedDuration, setSelectedDuration] = useState<string>("single");
    const [customMins, setCustomMins] = useState("15");
    const handleGrant = () => {
        let d: number | undefined;
        if (selectedDuration === "10") d = 10; else if (selectedDuration === "30") d = 30; else if (selectedDuration === "custom") d = parseInt(customMins);
        onGrant(d); onOpenChange(false);
    };
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95%] rounded-2xl border-none shadow-3xl p-8 bg-background/95 backdrop-blur-2xl">
                <DialogHeader><DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tighter"><ShieldCheck className="h-10 w-10 text-primary" strokeWidth={3} /> Identity Access</DialogTitle><DialogDescription className="font-medium text-sm pt-4 leading-relaxed">Granting silent access for <span className="font-black text-foreground underline decoration-primary/30">{staffName}</span>.</DialogDescription></DialogHeader>
                <div className="space-y-8 py-6"><div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Protocol Duration</Label><div className="grid grid-cols-2 gap-4">
                    {['single', '10', '30', 'custom'].map(t => <Button key={t} variant={selectedDuration === t ? 'default' : 'outline'} onClick={() => setSelectedDuration(t)} className="h-20 flex flex-col gap-1 rounded-2xl border border-primary/5 font-black uppercase tracking-widest text-[10px] transition-all">{(t !== 'single' && t !== 'custom') && <Clock className={cn("h-4 w-4", selectedDuration === t ? "text-white" : "text-primary/40")} />} {t === 'single' ? 'Single' : t === 'custom' ? 'Custom' : `${t} Min`}</Button>)}
                </div>{selectedDuration === 'custom' && <div className="pt-4 animate-in slide-in-from-top-4 duration-500"><Label htmlFor="custom-mins" className="text-[10px] uppercase font-black text-primary tracking-widest ml-1">Minutes Threshold</Label><Input id="custom-mins" type="number" value={customMins} onChange={(e) => setCustomMins(e.target.value)} className="mt-2 h-14 text-2xl font-black border-primary/20 rounded-xl bg-primary/5 text-center" /></div>}</div></div>
                <DialogFooter className="flex flex-col sm:flex-row gap-4 pt-4"><Button variant="ghost" className="font-black uppercase tracking-widest text-[10px] h-14 order-2 sm:order-1 px-8" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleGrant} className="h-14 px-10 font-black uppercase tracking-widest rounded-xl shadow-2xl shadow-primary/30 bg-primary text-white">Initialize Grant</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-32 w-full rounded-2xl" />))}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><Skeleton className="h-[450px] w-full rounded-2xl" /><Skeleton className="h-[450px] w-full rounded-2xl" /></div>
    </div>
  );
}

export default function DashboardPage() {
  const { isCacheReady, isSyncing, inventoryItems, products } = useDataCache();
  const [mountedDate, setMountedDate] = useState<string>('');
  const [isStockTrendDialogOpen, setIsStockTrendDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setMountedDate(format(new Date(), 'PP').toUpperCase()); setIsMounted(true); }, []);

  const metrics = useMemo<DashboardMetrics>(() => {
    if (!isMounted) return { totalProducts: 0, totalStockQuantity: 0, itemsExpiringSoon: 0, damagedItemsCount: 0, totalSuppliers: 0, totalStockValue: 0, stockBySupplier: [], netItemsAddedToday: 0, dailyStockChangeDirection: 'none', stockTrend: [] };
    const today = startOfDay(new Date());
    const prodsMap = new Map<string, Product>(products.map(p => [p.barcode, p]));
    let val = 0, added = 0, soon = 0;
    const supplierStock: Record<string, number> = {};
    inventoryItems.forEach(item => {
        if (item.quantity <= 0) return;
        const p = prodsMap.get(item.barcode);
        if (p?.costPrice) val += (item.quantity * p.costPrice);
        const s = item.supplierName || 'Unknown';
        supplierStock[s] = (supplierStock[s] || 0) + item.quantity;
        if (item.timestamp && isSameDay(startOfDay(parseISO(item.timestamp)), today)) added += item.quantity;
        if (item.itemType === 'Expiry' && item.expiryDate) {
            try { const exp = startOfDay(parseISO(item.expiryDate)); if (!isBefore(exp, today) && isBefore(exp, addDays(today, 7))) soon++; } catch {}
        }
    });
    const trend: StockTrendData[] = [];
    for (let i = 14; i >= 0; i--) {
        const day = subDays(today, i);
        const curr = inventoryItems.reduce((s, x) => s + x.quantity, 0);
        const post = inventoryItems.filter(x => x.timestamp && isAfter(parseISO(x.timestamp), endOfDay(day))).reduce((s, x) => s + x.quantity, 0);
        trend.push({ date: format(day, 'MMM dd'), totalStock: Math.max(0, curr - post) });
    }
    return { totalProducts: products.length, totalStockQuantity: inventoryItems.reduce((s, x) => s + x.quantity, 0), itemsExpiringSoon: soon, damagedItemsCount: inventoryItems.filter(i => i.itemType === 'Damage').reduce((s, i) => s + i.quantity, 0), totalSuppliers: new Set(products.map(x => x.supplierName)).size, totalStockValue: val, stockBySupplier: Object.entries(supplierStock).map(([n, q]) => ({ name: n, totalStock: q })).sort((a, b) => b.totalStock - a.totalStock), netItemsAddedToday: added, dailyStockChangeDirection: added > 0 ? 'increase' : 'none', stockTrend: trend };
  }, [inventoryItems, products, isMounted]);

  if (!isCacheReady || !isMounted) return (<div className="space-y-8 pt-4"><h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none px-2">MISSION CONTROL</h1><DashboardSkeleton /></div>);

  return (
    <div className="space-y-8 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex flex-col gap-3 px-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">MISSION CONTROL</h1>
                <div className="flex flex-col items-start sm:items-end gap-1"><span className="hidden md:inline text-[10px] font-black text-primary uppercase tracking-[0.4em]">{mountedDate}</span><div className="md:hidden flex flex-col items-end">{isSyncing ? (<span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] animate-pulse">Syncing...</span>) : (<span className="text-[10px] font-black text-green-600 uppercase tracking-[0.4em]">Synced</span>)}</div></div>
            </div>
            <div className="flex items-center gap-6 border-t border-white/10 pt-3 opacity-40"><p className="text-[8px] font-black uppercase tracking-[0.5em]">{metrics.totalSuppliers} VENDORS</p><p className="text-[8px] font-black uppercase tracking-[0.5em]">{metrics.totalProducts} SKUS</p></div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <VolumeGaugeCard title="Registry Volume" value={metrics.totalStockQuantity} description={<Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest px-2 py-0.5 border-none bg-primary/10 text-primary"><ArrowUp className="h-2.5 w-2.5 mr-1" strokeWidth={4} /> {metrics.netItemsAddedToday} RECENT</Badge>} href="/inventory" onIconClick={() => setIsStockTrendDialogOpen(true)} />
          <MetricCard title="Total Valuation" value={`QAR ${Math.round(metrics.totalStockValue).toLocaleString()}`} iconNode={<Wallet />} description="ACTIVE ASSET VALUE" />
          <MetricCard title="Priority Alerts" value={metrics.itemsExpiringSoon} iconNode={<CalendarClock />} description="7-DAY PROTOCOL" href="/inventory?filterType=expiringSoon" className={cn("hidden sm:flex", metrics.itemsExpiringSoon > 0 && "bg-yellow-500/5 dark:bg-yellow-500/[0.02] border-yellow-500/10")} />
          <MetricCard title="Damage Reports" value={metrics.damagedItemsCount || 0} iconNode={<AlertTriangle />} description="AUDIT REQUIRED" href="/inventory?filterType=damaged" className={cn("hidden sm:flex", (metrics.damagedItemsCount || 0) > 0 ? "bg-destructive/5 dark:bg-destructive/[0.02] border-destructive/10" : "")} />
          <div className="col-span-2 lg:col-span-1"><QuickAuthorizeCard /></div>
        </div>

        <PendingApprovalsSummary /><ActiveAuthorizations />

        <Card className="shadow-none rounded-2xl border border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl overflow-hidden group">
            <CardHeader className="p-6 pb-2"><div className="flex items-center gap-4"><div className="p-2 bg-primary/10 rounded-xl group-hover:scale-110 transition-all"><TrendingUp className="h-5 w-5 text-primary" strokeWidth={3} /></div><div><CardTitle className="text-lg font-black uppercase tracking-tighter">Vendor Analytics</CardTitle><p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Live Supplier Distribution</p></div></div></CardHeader>
            <CardContent className="p-6 pt-0"><div className="h-[350px] w-full"><StockBySupplierChart data={metrics.stockBySupplier} /></div></CardContent>
        </Card>

        {metrics.stockTrend && (<StockTrendDetailedDialog isOpen={isStockTrendDialogOpen} onOpenChange={setIsStockTrendDialogOpen} initialData={metrics.stockTrend} />)}
        <div className="pt-16 text-center"><p className="text-[9px] font-black uppercase tracking-[0.6em] text-muted-foreground/10 flex items-center justify-center gap-6"><span className="w-8 h-px bg-current opacity-20" /> SHEETSYNC INDUSTRIAL <span className="w-8 h-px bg-current opacity-20" /></p></div>
    </div>
  );
}
