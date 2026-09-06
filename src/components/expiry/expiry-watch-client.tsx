'use client';

import * as React from 'react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
    Search, 
    Plus, 
    Calendar, 
    User, 
    Bell, 
    ShieldAlert, 
    Box, 
    History,
    Check,
    Loader2,
    FilterX,
    Scan,
    X,
    ClipboardPlus
} from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore, addMonths, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';
import Link from 'next/link';

const SCANNER_REGION_ID = "diary-lookup-scanner-region";

const playProfessionalBeep = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {}
};

export function ExpiryWatchClient() {
    const { expiryReminders, resolveExpiryReminder, refreshData } = useDataCache();
    const { user } = useAuth();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isResolving, setIsResolving] = useState<string | null>(null);

    const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
    const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
    const scanProcessedRef = useRef(false);

    const filteredReminders = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        return expiryReminders.filter(r => 
            r.productName.toLowerCase().includes(lower) || 
            r.barcode.toLowerCase().includes(lower) ||
            r.staffName.toLowerCase().includes(lower)
        ).sort((a, b) => {
            const dateA = parseISO(a.expiryDate);
            const dateB = parseISO(b.expiryDate);
            const validA = isValid(dateA);
            const validB = isValid(dateB);
            
            if (!validA && !validB) return 0;
            if (!validA) return 1;
            if (!validB) return -1;
            
            return dateA.getTime() - dateB.getTime();
        });
    }, [expiryReminders, searchTerm]);

    const handleResolve = async (id: string, name: string) => {
        setIsResolving(id);
        toast({ title: "Resolving Entry", description: `Clearing ${name} from Diary Reminders...` });

        try {
            await resolveExpiryReminder(id);
            toast({ title: "Task Completed", description: "Product removed from active observation." });
            await refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Sync Failure", description: "Registry core connection interrupted." });
        } finally {
            setIsResolving(null);
        }
    };

    const stats = useMemo(() => {
        const now = new Date();
        const nextMonth = addMonths(now, 1);
        return {
            total: expiryReminders.length,
            critical: expiryReminders.filter(r => {
                const d = parseISO(r.expiryDate);
                return isValid(d) && isBefore(d, nextMonth);
            }).length,
            personnel: new Set(expiryReminders.map(r => r.staffName)).size
        };
    }, [expiryReminders]);

    const onScanSuccess = useCallback((decodedText: string) => {
      if (scanProcessedRef.current || !decodedText) return;
      scanProcessedRef.current = true;
      playProfessionalBeep();
      setSearchTerm(decodedText);
      setIsScannerDialogOpen(false);
      
      toast({
          title: "SKU Identified",
          description: `Filtering Diary for: ${decodedText}`,
      });

      setTimeout(() => { scanProcessedRef.current = false; }, 1000);
    }, [toast]);

    useEffect(() => {
      if (isScannerDialogOpen) {
        const timer = setTimeout(() => {
          if (html5QrcodeScannerRef.current) return;
          const scanner = new Html5Qrcode(SCANNER_REGION_ID, false);
          scanner.start(
            { facingMode: 'environment' },
            { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            onScanSuccess,
            () => {}
          ).then(() => {
            html5QrcodeScannerRef.current = scanner;
          }).catch(() => {
            setIsScannerDialogOpen(false);
          });
        }, 800);
        return () => {
          clearTimeout(timer);
          if (html5QrcodeScannerRef.current) {
            html5QrcodeScannerRef.current.stop().catch(() => {});
            html5QrcodeScannerRef.current = null;
          }
        };
      }
    }, [isScannerDialogOpen, onScanSuccess]);

    return (
        <div className="space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom))] animate-in fade-in duration-300 sm:space-y-5 sm:pb-8">
            {/* STATS GRID */}
            <div className="hidden grid-cols-3 gap-3 sm:grid">
                <Card className="rounded-2xl border-0 bg-primary/[0.055] shadow-none">
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><History className="h-4 w-4 text-primary" /></div>
                        <div>
                            <p className="text-[10px] font-medium text-primary/70">Active entries</p>
                            <p className="mt-0.5 text-2xl font-bold leading-none text-foreground">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn("rounded-2xl border-0 shadow-none", stats.critical > 0 ? "bg-orange-500/10" : "bg-muted/35")}>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stats.critical > 0 ? "bg-orange-500/20 text-orange-600" : "bg-muted text-muted-foreground")}>
                            <Bell className={cn("h-5 w-5", stats.critical > 0 && "animate-pulse")} />
                        </div>
                        <div>
                            <p className={cn("text-[10px] font-medium", stats.critical > 0 ? "text-orange-600/70" : "text-muted-foreground")}>Critical</p>
                            <p className={cn("mt-0.5 text-2xl font-bold leading-none", stats.critical > 0 ? "text-orange-600" : "text-muted-foreground/50")}>{stats.critical}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 bg-muted/35 shadow-none">
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/60"><User className="h-4 w-4 text-muted-foreground" /></div>
                        <div>
                            <p className="text-[10px] font-medium text-muted-foreground">Operators</p>
                            <p className="mt-0.5 text-2xl font-bold leading-none text-foreground">{stats.personnel}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COMMAND BAR */}
            <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-2">
                    <div className="group relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
                        <Input 
                            placeholder="Search reminders..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-11 w-full rounded-xl border-0 bg-muted/40 pl-9 pr-3 text-base font-medium shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                        />
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsScannerDialogOpen(true)} 
                        className="h-11 w-11 shrink-0 rounded-xl bg-muted/40 text-muted-foreground shadow-none hover:bg-primary/10 hover:text-primary"
                    >
                        <Scan className="h-5 w-5" />
                    </Button>
                </div>
                <Button 
                    asChild
                    className="h-11 shrink-0 rounded-xl border-0 bg-primary px-3 text-[10px] font-semibold text-primary-foreground shadow-none sm:px-4 sm:text-xs"
                >
                    <Link href="/expiry-watch/add">
                        <ClipboardPlus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden min-[390px]:inline">Log New Entry</span><span className="min-[390px]:hidden">New</span>
                    </Link>
                </Button>
            </div>

            {/* FEED */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-semibold text-muted-foreground">Active reminders</h3>
                    {searchTerm && (
                        <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="h-7 rounded-lg px-2 text-[10px] font-medium text-destructive hover:bg-destructive/5">
                            <FilterX className="mr-1 h-3 w-3" /> Clear
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                    {filteredReminders.length > 0 ? filteredReminders.map(reminder => {
                        const parsedDate = parseISO(reminder.expiryDate);
                        const isDateValid = isValid(parsedDate);
                        const daysLeft = isDateValid ? differenceInDays(parsedDate, new Date()) : 0;
                        const isCritical = isDateValid && daysLeft <= 30;
                        
                        return (
                            <Card key={reminder.id} className={cn(
                                "group overflow-hidden rounded-2xl border-0 bg-muted/25 shadow-none transition-colors",
                                isCritical ? "bg-orange-500/[0.07]" : "hover:bg-muted/40"
                            )}>
                                <CardContent className="p-0">
                                    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className={cn(
                                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0",
                                                isCritical ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary"
                                            )}>
                                                {isCritical ? <ShieldAlert className="h-4.5 w-4.5" /> : <Box className="h-4.5 w-4.5" />}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">{reminder.productName}</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{reminder.barcode}</span>
                                                    <div className="hidden items-center gap-1.5 text-[9px] font-medium text-muted-foreground/60 sm:flex">
                                                        <User className="h-3 w-3" /> {reminder.staffName || 'Personnel'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-background/45 p-2.5 sm:bg-transparent sm:p-0">
                                            <div className="flex flex-col items-start sm:items-end">
                                                <p className="mb-1 text-[9px] font-medium text-muted-foreground">Expiry date</p>
                                                <div className={cn(
                                                    "flex items-center gap-1.5 text-sm font-semibold tabular-nums leading-none sm:text-base",
                                                    isCritical ? "text-orange-600" : "text-slate-900 dark:text-white"
                                                )}>
                                                    <Calendar className="h-3.5 w-3.5 opacity-40" />
                                                    {isDateValid ? format(parsedDate, 'dd MMM yyyy') : 'Registry Error'}
                                                </div>
                                                <p className={cn("mt-1 text-[9px] font-medium", isCritical ? "text-orange-500" : "text-primary/70")}>
                                                    {!isDateValid ? "Invalid Data" : daysLeft > 0 ? `${daysLeft} Days Left` : "Overdue Threshold"}
                                                </p>
                                            </div>

                                            <Button 
                                                onClick={() => handleResolve(reminder.id, reminder.productName)}
                                                disabled={isResolving === reminder.id}
                                                className={cn(
                                                    "h-9 rounded-lg px-3 text-[10px] font-semibold shadow-none transition-colors sm:h-10 sm:px-4",
                                                    isCritical 
                                                        ? "bg-orange-500 text-white hover:bg-orange-600" 
                                                        : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                                )}
                                            >
                                                {isResolving === reminder.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }) : (
                        <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground/50">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40">
                                <History className="h-5 w-5" strokeWidth={1.5} />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">No active reminders</h4>
                            <p className="mt-1 max-w-[220px] text-xs leading-relaxed">New diary reminders will appear here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* OPTICAL SEARCH TERMINAL */}
            <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
                <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border-0 bg-black p-0 shadow-2xl sm:rounded-3xl">
                    <DialogHeader className="absolute inset-x-0 top-0 z-20 bg-zinc-900/85 p-4 pb-2">
                        <DialogTitle className="text-base font-semibold text-white">Barcode Scanner</DialogTitle>
                        <DialogDescription className="text-[10px] text-zinc-400">Scan a barcode to filter diary reminders</DialogDescription>
                    </DialogHeader>
                    <div className="relative scanner-container h-[58dvh] min-h-[300px] max-h-[420px] w-full">
                        <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                        <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
                    </div>
                    <div className="relative z-20 flex justify-center bg-zinc-900/85 p-1.5">
                        <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10">
                            Close Scanner
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            
            <div className="hidden pt-8 text-center sm:block">
                <p className="text-[10px] text-muted-foreground/40">
                    SheetSync Diary
                </p>
            </div>
        </div>
    );
}
