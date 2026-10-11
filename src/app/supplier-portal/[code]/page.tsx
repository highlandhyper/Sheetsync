'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
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
    Info
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';

export default function SupplierPortalPage() {
    const params = useParams();
    const code = params?.code as string;
    const { inventoryItems = [], supplierContacts = [], isCacheReady, refreshData } = useDataCache();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isCacheReady) {
            setIsLoading(false);
            // Auto-refresh on mount for live view
            refreshData();
        }
    }, [isCacheReady, refreshData]);

    const supplier = useMemo(() => 
        (supplierContacts || []).find(s => s.supplierCode?.toUpperCase() === code?.toUpperCase())
    , [supplierContacts, code]);

    const supplierStock = useMemo(() => {
        if (!supplier) return [];
        return (inventoryItems || []).filter(i => 
            i.supplierName?.toLowerCase() === supplier.name.toLowerCase() && i.quantity > 0
        ).sort((a, b) => {
            const da = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
            const db = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
            return db - da;
        });
    }, [inventoryItems, supplier]);

    const stats = useMemo(() => {
        return {
            totalUnits: supplierStock.reduce((s, i) => s + i.quantity, 0),
            totalValue: supplier?.lastReportValue || 0,
            activeBatches: supplierStock.length
        };
    }, [supplierStock, supplier]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <div className="p-5 bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-100 dark:border-white/5 mb-8 animate-pulse">
                    <ShieldCheck className="h-10 w-10 text-neutral-400 dark:text-neutral-500" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-300 dark:text-neutral-700" strokeWidth={2.5} />
                    <p className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500">Establishing registry link...</p>
                </div>
            </div>
        );
    }

    if (!supplier) {
        return (
            <div className="flex flex-col items-center justify-center h-screen px-6 text-center">
                <div className="bg-destructive/10 p-4 rounded-2xl mb-4">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Identity Denied</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
                    The provided vendor code "{code}" does not match an active registry node.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/5 pb-20">
            {/* PORTAL HEADER */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10 px-6 py-5">
                <div className="mx-auto max-w-6xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-11 w-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shadow-sm">
                            <Building className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight leading-none mb-1">{supplier.name}</h1>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/10">ID: {supplier.supplierCode}</Badge>
                                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                    <ShieldCheck className="h-3 w-3 text-emerald-500" /> Authorized Stock Portal
                                </span>
                            </div>
                        </div>
                    </div>
                    <Badge variant="outline" className="h-8 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Registry Link
                    </Badge>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
                {/* SUMMARY GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border-none shadow-xl bg-black text-white">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="bg-white/10 p-3 rounded-2xl"><Layers className="h-7 w-7 text-white" /></div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider opacity-60">Total Active Stock</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-4xl font-bold tracking-tight">{stats.totalUnits}</span>
                                    <span className="text-[11px] font-medium uppercase">Units</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-none shadow-xl bg-card">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="bg-primary/5 p-3 rounded-2xl"><Wallet className="h-7 w-7 text-primary" /></div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Previous Report Value</p>
                                <p className="text-2xl font-bold text-foreground">
                                    <span className="text-[11px] mr-1 font-medium text-primary">QAR</span>
                                    {stats.totalValue.toLocaleString()}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-none shadow-xl bg-card">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="bg-muted p-3 rounded-2xl"><Package className="h-7 w-7 text-muted-foreground" /></div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active Identifiers</p>
                                <p className="text-2xl font-bold text-foreground">{stats.activeBatches} SKUs</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* STOCK TABLE */}
                <Card className="rounded-2xl border-none shadow-2xl overflow-hidden bg-card">
                    <CardHeader className="p-8 pb-4 border-b border-white/5 bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold tracking-tight">Active Stock Registry</CardTitle>
                                <CardDescription className="text-xs font-medium mt-1">Current units identifying you as the master supplier.</CardDescription>
                            </div>
                            <div className="bg-background/80 p-2 rounded-xl flex items-center gap-2 text-[11px] font-bold px-4 border border-white/5">
                                <Info className="h-3.5 w-3.5 text-primary" />
                                Updated {format(new Date(), "HH:mm:ss")}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {supplierStock.length > 0 ? (
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow className="h-12 hover:bg-transparent">
                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-8">Identification</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Units</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Zone</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Threshold Date</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider pr-8">Registry Timestamp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {supplierStock.map((item) => (
                                        <TableRow key={item.id} className="h-16 group hover:bg-primary/[0.02] border-white/5">
                                            <TableCell className="pl-8">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-foreground truncate max-w-[250px]">{item.productName}</span>
                                                    <span className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1.5 mt-0.5">
                                                        <Barcode className="h-2.5 w-2.5" /> {item.barcode}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-base font-bold text-primary tabular-nums">{item.quantity}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[9px] font-bold px-2 py-0 bg-muted/50 border-none uppercase">
                                                    <MapPin className="mr-1 h-2.5 w-2.5 text-primary/40" /> {item.location}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                                {item.expiryDate ? format(parseISO(item.expiryDate), "dd MMM yy") : "---"}
                                            </TableCell>
                                            <TableCell className="pr-8 text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                                                {item.timestamp ? format(parseISO(item.timestamp), "dd/MM/yy HH:mm") : "N/A"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-24 text-center space-y-3 opacity-20">
                                <Package className="h-16 w-16 mx-auto" strokeWidth={1} />
                                <p className="text-[11px] font-bold uppercase tracking-widest">Zero Active Registry Links</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <footer className="pt-8 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/30">SheetSync Industrial Protocol • Secure Portal v5.0</p>
                </footer>
            </main>
        </div>
    );
}
