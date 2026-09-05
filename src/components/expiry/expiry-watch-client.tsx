'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
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
    FilterX
} from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddReminderDialog } from './add-reminder-dialog';

export function ExpiryWatchClient() {
    const { expiryReminders, resolveExpiryReminder, refreshData } = useDataCache();
    const { user } = useAuth();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isResolving, setIsResolving] = useState<string | null>(null);

    const filteredReminders = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        return expiryReminders.filter(r => 
            r.productName.toLowerCase().includes(lower) || 
            r.barcode.toLowerCase().includes(lower) ||
            r.staffName.toLowerCase().includes(lower)
        ).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    }, [expiryReminders, searchTerm]);

    const handleResolve = async (id: string, name: string) => {
        setIsResolving(id);
        toast({ title: "Resolving Log", description: `Updating status for ${name} to 'resolved' in the registry...` });

        try {
            await resolveExpiryReminder(id);
            toast({ title: "Status Updated", description: "Product identity verified and registry status set to resolved." });
            await refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Sync Failure", description: "Registry core connection interrupted. Status update failed." });
        } finally {
            setIsResolving(null);
        }
    };

    const stats = useMemo(() => {
        const now = new Date();
        const nextMonth = addMonths(now, 1);
        return {
            total: expiryReminders.length,
            critical: expiryReminders.filter(r => isBefore(parseISO(r.expiryDate), nextMonth)).length,
            personnel: new Set(expiryReminders.map(r => r.staffName)).size
        };
    }, [expiryReminders]);

    return (
        <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* INDUSTRIAL STATS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/10 shadow-none rounded-[1.5rem]">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-xl"><History className="h-5 w-5 text-primary" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Active Watch</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-1">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn("border-none shadow-none rounded-[1.5rem]", stats.critical > 0 ? "bg-orange-500/10" : "bg-muted/30")}>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", stats.critical > 0 ? "bg-orange-500/20 text-orange-600" : "bg-muted text-muted-foreground")}>
                            <Bell className={cn("h-5 w-5", stats.critical > 0 && "animate-pulse")} />
                        </div>
                        <div>
                            <p className={cn("text-[10px] font-black uppercase tracking-widest", stats.critical > 0 ? "text-orange-600/60" : "text-muted-foreground/60")}>1-Month Alerts</p>
                            <p className={cn("text-3xl font-black leading-none mt-1", stats.critical > 0 ? "text-orange-600" : "text-muted-foreground/40")}>{stats.critical}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/30 border-none shadow-none rounded-[1.5rem]">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="bg-background/50 p-3 rounded-xl"><User className="h-5 w-5 text-muted-foreground" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Operators</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-1">{stats.personnel}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COMMAND BAR */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-grow group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="IDENTIFY WATCH SKU OR NAME..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-14 pl-11 rounded-2xl bg-muted/20 border-white/5 font-black uppercase tracking-tight text-base shadow-inner"
                    />
                </div>
                <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="h-14 px-8 rounded-2xl w-full sm:w-auto font-black uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-primary text-white border-none"
                >
                    <Plus className="mr-2 h-5 w-5" /> Initialize Watch Log
                </Button>
            </div>

            {/* WATCH FEED */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Watch Registry Feed (Pending)</h3>
                    {searchTerm && (
                        <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="h-6 text-[8px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5">
                            <FilterX className="mr-1 h-3 w-3" /> Clear Filter
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredReminders.length > 0 ? filteredReminders.map(reminder => {
                        const daysLeft = differenceInDays(parseISO(reminder.expiryDate), new Date());
                        const isCritical = daysLeft <= 30;
                        
                        return (
                            <Card key={reminder.id} className={cn(
                                "group border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden transition-all duration-500",
                                isCritical ? "border-orange-500/20" : "hover:border-primary/20"
                            )}>
                                <CardContent className="p-0">
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center p-6 gap-6">
                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                            <div className={cn(
                                                "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border transition-transform duration-700 group-hover:rotate-[5deg]",
                                                isCritical ? "bg-orange-500/10 border-orange-500/20 text-orange-600" : "bg-primary/5 border-primary/10 text-primary"
                                            )}>
                                                {isCritical ? <ShieldAlert className="h-7 w-7" /> : <Box className="h-7 w-7" />}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">{reminder.productName}</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-mono font-black text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded tracking-tighter uppercase">{reminder.barcode}</span>
                                                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground/30">
                                                        <User className="h-3 w-3" /> {reminder.staffName}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-8 shrink-0">
                                            <div className="flex flex-col items-end">
                                                <p className="text-[9px] font-black uppercase text-muted-foreground/30 tracking-widest mb-1.5">Expiry Date</p>
                                                <div className={cn(
                                                    "flex items-center gap-2 font-black text-lg tabular-nums leading-none tracking-tighter",
                                                    isCritical ? "text-orange-600" : "text-slate-900 dark:text-white"
                                                )}>
                                                    <Calendar className="h-4 w-4 opacity-30" />
                                                    {format(parseISO(reminder.expiryDate), 'dd MMM yyyy')}
                                                </div>
                                                <p className={cn("text-[9px] font-black uppercase tracking-widest mt-1.5", isCritical ? "text-orange-500 animate-pulse" : "text-primary/60")}>
                                                    {daysLeft > 0 ? `${daysLeft} Days to Threshold` : "Registry Overdue"}
                                                </p>
                                            </div>

                                            <Button 
                                                onClick={() => handleResolve(reminder.id, reminder.productName)}
                                                disabled={isResolving === reminder.id}
                                                className={cn(
                                                    "h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                                                    isCritical 
                                                        ? "bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-500/20" 
                                                        : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                                                )}
                                            >
                                                {isResolving === reminder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                Mark as Resolved
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }) : (
                        <div className="py-32 flex flex-col items-center justify-center text-center opacity-20 grayscale animate-in zoom-in-95 duration-700">
                            <div className="p-8 bg-muted/20 rounded-[3rem] mb-6 border-4 border-dashed border-white/5">
                                <History className="h-16 w-16" strokeWidth={1} />
                            </div>
                            <h4 className="text-2xl font-black uppercase tracking-tighter">Watch Registry Clear</h4>
                            <p className="text-xs font-medium mt-2 max-w-[280px] leading-relaxed uppercase tracking-widest">No long-term products are currently under observation. Registry state is nominal.</p>
                        </div>
                    )}
                </div>
            </div>

            <AddReminderDialog 
                isOpen={isAddDialogOpen} 
                onOpenChange={setIsAddDialogOpen} 
            />
            
            <div className="pt-20 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.8em] text-muted-foreground/10 flex items-center justify-center gap-8">
                    <span className="w-12 h-px bg-current opacity-20" />
                    SHEETSYNC EXPIRY WATCH CORE
                    <span className="w-12 h-px bg-current opacity-20" />
                </p>
            </div>
        </div>
    );
}
