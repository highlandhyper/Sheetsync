
'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchOnDisplayAlertsAction } from '@/app/actions';
import type { OnDisplayAlert } from '@/lib/types';
import { 
    Smartphone, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    History, 
    Loader2, 
    Barcode, 
    User, 
    Calendar,
    KeyRound,
    Search,
    FilterX,
    BadgeAlert,
    ChevronRight,
    ExternalLink
} from 'lucide-react';
import { format, parseISO, isAfter, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export function OnDisplayAlertsTerminal() {
    const [alerts, setAlerts] = useState<OnDisplayAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAlerts = async () => {
        setIsLoading(true);
        const res = await fetchOnDisplayAlertsAction();
        if (res.success && res.data) {
            setAlerts(res.data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const filteredAlerts = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        if (!lower) return alerts;
        return alerts.filter(a => 
            a.productName.toLowerCase().includes(lower) || 
            a.barcode.toLowerCase().includes(lower) || 
            a.staffName.toLowerCase().includes(lower)
        );
    }, [alerts, searchTerm]);

    const getStatus = (alert: OnDisplayAlert) => {
        const isUsed = alert.used?.toLowerCase() === 'yes';
        const expiresAt = parseISO(alert.expiresAt);
        const isExpired = isValid(expiresAt) && isAfter(new Date(), expiresAt);

        if (isUsed) return { label: 'USED', icon: CheckCircle2, class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
        if (isExpired) return { label: 'EXPIRED', icon: XCircle, class: 'bg-muted text-muted-foreground border-border/50' };
        return { label: 'ACTIVE', icon: Clock, class: 'bg-primary/10 text-primary border-primary/20' };
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                    <Input 
                        placeholder="Filter by product or personnel..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 pl-9 rounded-xl border-border/60 bg-muted/20 text-xs font-medium placeholder:text-muted-foreground/30"
                    />
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={fetchAlerts} 
                    disabled={isLoading}
                    className="h-9 rounded-lg font-black uppercase tracking-widest text-[9px] opacity-40 hover:opacity-100"
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <History className="h-3 w-3 mr-2" />}
                    Refresh History
                </Button>
            </div>

            <ScrollArea className="h-[480px] pr-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                        <Loader2 className="h-8 w-8 animate-spin mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Establishing Link...</p>
                    </div>
                ) : filteredAlerts.length > 0 ? (
                    <div className="space-y-2.5">
                        {filteredAlerts.map((alert) => {
                            const status = getStatus(alert);
                            const StatusIcon = status.icon;
                            
                            return (
                                <Card key={alert.id} className="border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden rounded-2xl group transition-all hover:bg-muted/10">
                                    <div className="p-4 flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 min-w-0">
                                            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Smartphone className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h5 className="text-[13px] font-black uppercase tracking-tight text-foreground truncate">{alert.productName}</h5>
                                                    <Badge variant="outline" className={cn("h-4 px-1.5 text-[7px] font-black", status.class)}>
                                                        <StatusIcon className="mr-1 h-2 w-2" /> {status.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    <span className="flex items-center gap-1"><Barcode className="h-3 w-3" /> {alert.barcode}</span>
                                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {alert.staffName}</span>
                                                </div>
                                                <p className="mt-2 text-[9px] font-medium text-muted-foreground/60 flex items-center gap-1.5">
                                                    <Calendar className="h-2.5 w-2.5" /> Dispatched {format(parseISO(alert.sentAt), "dd MMM yy 'at' HH:mm")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex flex-col items-end gap-2">
                                            <div className="rounded-xl border border-dashed border-primary/20 bg-background/50 px-2.5 py-1.5 text-center min-w-[80px]">
                                                <p className="text-[7px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">Access Key</p>
                                                <p className="font-mono text-xs font-black tracking-[0.2em] text-primary">{alert.pin}</p>
                                            </div>
                                            {status.label === 'ACTIVE' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                    <a href={`/on-display/${alert.token}`} target="_blank" rel="noreferrer">
                                                        <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center opacity-30">
                        <BadgeAlert className="h-12 w-12 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Zero Alerts Found</p>
                    </div>
                )}
            </ScrollArea>
            
            <div className="pt-2 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.5em] text-muted-foreground/20">SheetSync Registry Protocol • v6.0 Transmission Log</p>
            </div>
        </div>
    );
}
