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
        <div className="space-y-6 sm:space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* STATS GRID */}
            <div className="hidden sm:grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/10 shadow-none rounded-xl">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-lg"><History className="h-5 w-5 text-primary" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Active Entries</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-1">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn("border-none shadow-none rounded-xl", stats.critical > 0 ? "bg-orange-500/10" : "bg-muted/30")}>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className={cn("p-3 rounded-lg", stats.critical > 0 ? "bg-orange-500/20 text-orange-600" : "bg-muted text-muted-foreground")}>
                            <Bell className={cn("h-5 w-5", stats.critical > 0 && "animate-pulse")} />
                        </div>
                        <div>
                            <p className={cn("text-[10px] font-black uppercase tracking-widest", stats.critical > 0 ? "text-orange-600/60" : "text-muted-foreground/60")}>Critical Threshold</p>
                            <p className={cn("text-3xl font-black leading-none mt-1", stats.critical > 0 ? "text-orange-600" : "text-muted-foreground/40")}>{stats.critical}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/30 border-none shadow-none rounded-xl">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="bg-background/50 p-3 rounded-lg"><User className="h-5 w-5 text-muted-foreground" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Operators</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-1">{stats.personnel}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COMMAND BAR */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                <div className="flex-grow flex gap-2">
                    <div className="relative flex-grow group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="IDENTIFY REMINDER..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-12 sm:h-14 pl-11 rounded-xl bg-muted/10 sm:bg-muted/20 border-white/5 font-black uppercase tracking-tight text-sm sm:text-base shadow-inner"
                        />
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsScannerDialogOpen(true)} 
                        className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 bg-muted/20 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all rounded-xl"
                    >
                        <Scan className="h-6 w-6" />
                    </Button>
                </div>
                <Button 
                    asChild
                    className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-primary text-white border-none"
                >
                    <Link href="/expiry-watch/add">
                        <ClipboardPlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Log New Entry
                    </Link>
                </Button>
            </div>

            {/* FEED */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Active Reminders</h3>
                    {searchTerm && (
                        <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="h-7 text-[8px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5">
                            <FilterX className="mr-1 h-3 w-3" /> Clear
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {filteredReminders.length > 0 ? filteredReminders.map(reminder => {
                        const parsedDate = parseISO(reminder.expiryDate);
                        const isDateValid = isValid(parsedDate);
                        const daysLeft = isDateValid ? differenceInDays(parsedDate, new Date()) : 0;
                        const isCritical = isDateValid && daysLeft <= 30;
                        
                        return (
                            <Card key={reminder.id} className={cn(
                                "group border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl rounded-xl overflow-hidden transition-all duration-500",
                                isCritical ? "border-orange-500/20" : "hover:border-primary/20 shadow-none"
                            )}>
                                <CardContent className="p-0">
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center p-4 sm:p-6 gap-4 sm:gap-6">
                                        <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                                            <div className={cn(
                                                "h-12 w-12 sm:h-14 sm:w-14 rounded-lg flex items-center justify-center shrink-0 shadow-sm border transition-transform duration-700",
                                                isCritical ? "bg-orange-500/10 border-orange-500/20 text-orange-600" : "bg-primary/5 border-primary/10 text-primary"
                                            )}>
                                                {isCritical ? <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7" /> : <Box className="h-6 w-6 sm:h-7 sm:w-7" />}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="text-sm sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">{reminder.productName}</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[8px] sm:text-[10px] font-mono font-black text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded tracking-tighter uppercase">{reminder.barcode}</span>
                                                    <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground/30">
                                                        <User className="h-3 w-3" /> {reminder.staffName || 'Personnel'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 shrink-0 bg-muted/10 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none">
                                            <div className="flex flex-col items-start sm:items-end">
                                                <p className="text-[8px] sm:text-[9px] font-black uppercase text-muted-foreground/30 tracking-widest mb-1">Expiry Date</p>
                                                <div className={cn(
                                                    "flex items-center gap-1.5 sm:gap-2 font-black text-sm sm:text-lg tabular-nums leading-none tracking-tighter",
                                                    isCritical ? "text-orange-600" : "text-slate-900 dark:text-white"
                                                )}>
                                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 opacity-30" />
                                                    {isDateValid ? format(parsedDate, 'dd MMM yyyy') : 'Registry Error'}
                                                </div>
                                                <p className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-widest mt-1", isCritical ? "text-orange-500 animate-pulse" : "text-primary/60")}>
                                                    {!isDateValid ? "Invalid Data" : daysLeft > 0 ? `${daysLeft} Days Left` : "Overdue Threshold"}
                                                </p>
                                            </div>

                                            <Button 
                                                onClick={() => handleResolve(reminder.id, reminder.productName)}
                                                disabled={isResolving === reminder.id}
                                                className={cn(
                                                    "h-10 sm:h-14 px-4 sm:px-8 rounded-lg font-black uppercase tracking-widest text-[8px] sm:text-[10px] transition-all",
                                                    isCritical 
                                                        ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg" 
                                                        : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
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
                        <div className="py-24 flex flex-col items-center justify-center text-center opacity-20 grayscale">
                            <div className="p-6 bg-muted/20 rounded-xl mb-6 border-2 border-dashed border-white/5">
                                <History className="h-12 w-12" strokeWidth={1} />
                            </div>
                            <h4 className="text-xl font-black uppercase tracking-tighter">Diary Nominal</h4>
                            <p className="text-[10px] font-medium mt-2 max-w-[200px] leading-relaxed uppercase tracking-widest">No active reminders found in the registry core.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* OPTICAL SEARCH TERMINAL */}
            <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
                <DialogContent className="max-w-md w-[95%] p-0 overflow-hidden rounded-2xl border-none bg-black">
                    <DialogHeader className="p-6 pb-2 border-b border-white/5 bg-zinc-900/80 absolute top-0 left-0 right-0 z-20">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-white">Visual Identification</DialogTitle>
                        <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-primary">Align SKU for Diary Filter</DialogDescription>
                    </DialogHeader>
                    <div className="relative scanner-container h-[400px] w-full">
                        <div id={SCANNER_REGION_ID} className="h-full w-full bg-black relative [&>span]:hidden" />
                        <div className="scanner-overlay"><div className="scanner-focus"><div className="scanner-laser" /></div></div>
                    </div>
                    <div className="p-2 bg-zinc-900/80 border-t border-white/5 relative z-20 flex justify-center">
                        <Button variant="ghost" onClick={() => setIsScannerDialogOpen(false)} className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10">
                            Abort Protocol
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            
            <div className="pt-20 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.6em] text-muted-foreground/10 flex items-center justify-center gap-6">
                    <span className="w-8 h-px bg-current opacity-20" />
                    SHEETSYNC DIARY REMINDER CORE
                    <span className="w-8 h-px bg-current opacity-20" />
                </p>
            </div>
        </div>
    );
}
