'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { submitSupplierDisputeAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useDataCache } from '@/context/data-cache-context';
import {
    Package,
    Layers,
    ShieldCheck,
    Loader2,
    Building,
    Barcode,
    MapPin,
    AlertTriangle,
    Wallet,
    Info,
    Search,
    RefreshCw,
    CalendarDays,
    Clock3,
    Boxes,
    ArrowLeft,
    ChevronRight,
    X,
    Sun,
    Moon,
    MessageSquareWarning,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function safeDate(value: string | undefined, pattern: string) {
    if (!value) return '—';
    const parsed = parseISO(value);
    return isValid(parsed) ? format(parsed, pattern) : '—';
}

export default function SupplierPortalPage() {
    const params = useParams();
    const code = params?.code as string;
    const { inventoryItems = [], supplierContacts = [], isCacheReady, refreshData } = useDataCache();
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const { toast } = useToast();
    const [submittingDispute, setSubmittingDispute] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedTheme = window.localStorage.getItem('supplier-portal-theme');
            const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
            setTheme(initialTheme);
            document.documentElement.classList.toggle('dark', initialTheme === 'dark');
        } catch {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(current => {
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', next === 'dark');
            try {
                window.localStorage.setItem('supplier-portal-theme', next);
            } catch {
                // Theme still works for the current page if storage is unavailable.
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (isCacheReady) {
            setIsLoading(false);
            void refreshData();
            setLastUpdated(new Date());
        }
    }, [isCacheReady, refreshData]);

    const supplier = useMemo(
        () => (supplierContacts || []).find(s => s.supplierCode?.toUpperCase() === code?.toUpperCase()),
        [supplierContacts, code]
    );

    const supplierStock = useMemo(() => {
        if (!supplier) return [];
        return (inventoryItems || [])
            .filter(i => i.supplierName?.toLowerCase() === supplier.name.toLowerCase() && i.quantity > 0)
            .sort((a, b) => {
                const da = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
                const db = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
                return db - da;
            });
    }, [inventoryItems, supplier]);

    // One summary row per barcode; individual expiry/location logs stay available in the full list.
    const groupedStock = useMemo(() => {
        const groups = new Map<string, { key: string; productName: string; barcode: string; quantity: number; batches: typeof supplierStock }>();
        supplierStock.forEach(item => {
            const key = item.barcode?.trim() ? item.barcode.trim() : `no-barcode-${item.id}`;
            const existing = groups.get(key);
            if (existing) {
                existing.quantity += Number(item.quantity) || 0;
                existing.batches.push(item);
            } else {
                groups.set(key, {
                    key,
                    productName: item.productName || 'Unnamed product',
                    barcode: item.barcode || '',
                    quantity: Number(item.quantity) || 0,
                    batches: [item],
                });
            }
        });
        return Array.from(groups.values()).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [supplierStock]);


    const reportProductDispute = useCallback(async (product: (typeof groupedStock)[number]) => {
        if (!supplier?.supplierCode || submittingDispute) return;
        setSubmittingDispute(product.key);
        try {
            const result = await submitSupplierDisputeAction({ supplierCode: supplier.supplierCode, productName: product.productName, barcode: product.barcode, quantity: product.quantity });
            if (!result.success) { toast({ title: 'Dispute not submitted', description: result.message || 'Please try again.', variant: 'destructive' }); return; }
            toast({ title: 'Dispute submitted', description: 'Your dispute is now waiting for Highland Hypermarket approval.' });
        } catch { toast({ title: 'Submission failed', description: 'Could not send the dispute. Please try again.', variant: 'destructive' }); }
        finally { setSubmittingDispute(null); }
    }, [supplier, submittingDispute, toast]);

    const filteredStock = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return groupedStock;
        return groupedStock.filter(product =>
            [product.productName, product.barcode, ...product.batches.flatMap(item => [item.location, item.expiryDate])]
                .some(value => String(value ?? '').toLowerCase().includes(term))
        );
    }, [groupedStock, search]);

    const stats = useMemo(() => ({
        totalUnits: supplierStock.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        totalValue: supplier?.lastReportValue || 0,
        activeBatches: groupedStock.length,
    }), [supplierStock, supplier, groupedStock]);

    const openProductDetails = useCallback((product: (typeof groupedStock)[number]) => {
        window.history.pushState({ ...window.history.state, supplierStockDetail: true }, '');
        setSelectedProduct(product);
    }, [groupedStock]);

    const closeProductDetails = useCallback(() => {
        if (window.history.state?.supplierStockDetail) {
            window.history.back();
        } else {
            setSelectedProduct(null);
        }
    }, []);

    useEffect(() => {
        const handlePopState = () => setSelectedProduct(null);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await refreshData();
            setLastUpdated(new Date());
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-5 text-center">
                <img
                    src="/logo-pwa.jpg"
                    alt="SheetSync app logo"
                    className="h-20 w-20 rounded-2xl object-contain"
                    width={80}
                    height={80}
                />
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">Highland Hypermarket</h1>
                    <p className="text-sm text-muted-foreground">Supplier Stock Portal</p>
                </div>
                <Loader2 className="mt-1 h-5 w-5 animate-spin text-primary" aria-label="Loading" />
                <p className="text-sm text-muted-foreground">Loading your stock…</p>
            </main>
        );
    }

    if (!supplier) {
        return (
            <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 rounded-2xl bg-destructive/10 p-4">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="text-xl font-bold">Supplier link unavailable</h1>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    This supplier link does not match an active supplier record. Please contact Highland Hypermarket for a new link.
                </p>
            </main>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-muted/20 pb-8">
            <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6 sm:py-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
                            <Building className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-bold leading-tight sm:text-xl">{supplier.name}</h1>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">ID: {supplier.supplierCode}</Badge>
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
                                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                    Supplier portal
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
                        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </Button>
                    <Badge variant="outline" className="hidden shrink-0 items-center gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-[10px] text-emerald-700 sm:inline-flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> LIVE
                    </Badge>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-7">
                <section aria-label="Stock summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    <Card className="col-span-2 overflow-hidden rounded-2xl border-0 bg-primary text-primary-foreground shadow-sm sm:col-span-1">
                        <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
                            <div className="rounded-xl bg-white/15 p-2.5"><Layers className="h-5 w-5 sm:h-6 sm:w-6" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Active stock units</p>
                                <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums sm:text-4xl">{stats.totalUnits.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="flex h-full items-center gap-3 p-4 sm:gap-4 sm:p-5">
                            <div className="hidden rounded-xl bg-muted p-2.5 text-primary sm:block"><Wallet className="h-5 w-5" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase leading-snug text-muted-foreground">Previous report value</p>
                                <p className="mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl"><span className="mr-1 text-[10px] font-semibold text-primary">QAR</span>{stats.totalValue.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="flex h-full items-center gap-3 p-4 sm:gap-4 sm:p-5">
                            <div className="hidden rounded-xl bg-muted p-2.5 text-primary sm:block"><Package className="h-5 w-5" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase leading-snug text-muted-foreground">Active products</p>
                                <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{stats.activeBatches.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">items</span></p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="space-y-3 border-b bg-muted/20 p-4 sm:flex sm:items-center sm:justify-between sm:space-y-0 sm:p-5">
                        <div>
                            <h2 className="text-base font-bold sm:text-lg">Active stock</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Products currently recorded under your supplier account.</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Info className="h-3.5 w-3.5" />
                                {lastUpdated ? `Updated ${format(lastUpdated, 'HH:mm')}` : 'Live stock'}
                            </span>
                            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 px-3" onClick={handleRefresh} disabled={isRefreshing}>
                                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
                            </Button>
                        </div>
                    </div>

                    <div className="border-b p-3 sm:p-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search product, barcode or location"
                                aria-label="Search supplier stock"
                                className="h-11 rounded-xl pl-9 text-base sm:text-sm"
                            />
                            {search && (
                                <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 h-9 -translate-y-1/2 px-3" onClick={() => setSearch('')}>
                                    Clear
                                </Button>
                            )}
                        </div>
                        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                            Showing {filteredStock.length} of {groupedStock.length} products
                        </p>
                    </div>

                    {filteredStock.length > 0 ? (
                        <>
                            {/* Mobile product summaries: one row per barcode */}
                            <div className="divide-y divide-border/50 md:hidden">
                                {filteredStock.map(product => (
                                    <article key={product.key} className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
                                                <Package className="h-5 w-5" strokeWidth={1.7} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="break-words text-sm font-semibold leading-snug">{product.productName}</h3>
                                                <p className="mt-1 flex items-center gap-1.5 break-all font-mono text-[11px] text-muted-foreground">
                                                    <Barcode className="h-3 w-3 shrink-0" /> {product.barcode || 'No barcode'}
                                                </p>
                                                <p className="mt-1 text-[11px] text-muted-foreground">{product.batches.length} stock log{product.batches.length === 1 ? '' : 's'} · expiry and location details</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-lg font-semibold tabular-nums">{product.quantity.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">total units</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <Button type="button" variant="ghost" className="h-10 min-w-0 flex-1 justify-between rounded-xl px-3 text-primary hover:bg-primary/5" onClick={() => openProductDetails(product)}>
                                                <span className="truncate text-sm font-medium">View full list <span className="font-normal text-muted-foreground">({product.batches.length})</span></span>
                                                <ChevronRight className="h-4 w-4 shrink-0" />
                                            </Button>
                                            <Button type="button" variant="outline" className="h-10 shrink-0 gap-1.5 rounded-xl px-3 text-xs" onClick={() => void reportProductDispute(product)} disabled={!!submittingDispute}>
                                                <MessageSquareWarning className="h-3.5 w-3.5" /> Dispute
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            {/* Desktop table uses the same grouped product summaries */}
                            <div className="hidden overflow-x-auto md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/20">
                                            <TableHead className="pl-6 text-xs">Product / barcode</TableHead>
                                            <TableHead className="text-right text-xs">Total quantity</TableHead>
                                            <TableHead className="text-center text-xs">Stock logs</TableHead>
                                            <TableHead className="text-right text-xs">Details</TableHead>\n                                            <TableHead className="pr-6 text-right text-xs">Dispute</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStock.map(product => (
                                            <TableRow key={product.key}>
                                                <TableCell className="max-w-[360px] pl-6">
                                                    <p className="truncate font-semibold">{product.productName}</p>
                                                    <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><Barcode className="h-3 w-3" />{product.barcode || 'No barcode'}</p>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold tabular-nums">{product.quantity.toLocaleString()}</TableCell>
                                                <TableCell className="text-center text-sm text-muted-foreground">{product.batches.length}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button type="button" variant="ghost" size="sm" className="gap-1 rounded-lg" onClick={() => openProductDetails(product)}>View full list <ChevronRight className="h-4 w-4" /></Button>
                                                </TableCell>
                                                <TableCell className="pr-6 text-right">
                                                    <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => void reportProductDispute(product)} disabled={!!submittingDispute}>
                                                        <MessageSquareWarning className="h-3.5 w-3.5" /> Dispute
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center px-5 py-12 text-center sm:py-16">
                            <div className="rounded-2xl bg-muted p-4"><Boxes className="h-8 w-8 text-muted-foreground" /></div>
                            <h3 className="mt-4 text-sm font-semibold">{search ? 'No matching products' : 'No active stock'}</h3>
                            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                                {search ? 'Try another product name, barcode or location.' : 'There are currently no active stock entries recorded for this supplier.'}
                            </p>
                            {search && <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch('')}>Clear search</Button>}
                        </div>
                    )}
                </section>

                <footer className="pb-2 pt-2 text-center">
                    <p className="text-[10px] text-muted-foreground">SheetSync · Highland Hypermarket supplier portal</p>
                </footer>
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-background" role="dialog" aria-modal="true" aria-label={`${selectedProduct.productName} stock details`}>
                    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur">
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Back to products" onClick={closeProductDetails}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-base font-semibold">{selectedProduct.productName}</h2>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">{selectedProduct.barcode || 'No barcode'}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Close details" onClick={closeProductDetails}>
                            <X className="h-4 w-4" />
                        </Button>
                    </header>
                    <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
                            <div className="mb-5 flex items-end justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Combined active quantity</p>
                                    <p className="mt-1 text-3xl font-semibold tabular-nums">{selectedProduct.quantity.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">units</span></p>
                                </div>
                                <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">{selectedProduct.batches.length} log{selectedProduct.batches.length === 1 ? '' : 's'}</span>
                            </div>
                            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry and stock log list</p>
                            <div className="divide-y divide-border/50">
                                {selectedProduct.batches.map((item: (typeof supplierStock)[number], index: number) => (
                                    <article key={item.id ?? `${item.barcode}-${index}`} className="py-4 first:pt-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold">{item.quantity.toLocaleString()} units</p>
                                                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" />Expires {safeDate(item.expiryDate, 'dd MMM yyyy')}</p>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-muted/70 px-2.5 py-1 text-[10px] text-muted-foreground">Log {index + 1}</span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <div className="flex items-start gap-2 text-xs">
                                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span><span className="text-muted-foreground">Location </span>{item.location || 'Not specified'}</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-xs">
                                                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span><span className="text-muted-foreground">Logged </span>{safeDate(item.timestamp, 'dd MMM yyyy, HH:mm')}</span>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </main>
        </div>
    );
}
