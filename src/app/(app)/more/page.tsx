'use client';

import { useAuth } from '@/context/auth-context';
import { useAccessControl } from '@/context/access-control-context';
import { useDataCache } from '@/context/data-cache-context';
import { useSpecialEntry } from '@/context/special-entry-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationCenter } from '@/components/layout/notification-center';
import { CommandPalette } from '@/components/layout/command-palette';
import { 
    ShieldCheck, 
    Undo, 
    UserCheck, 
    ClipboardList, 
    FileText, 
    Settings, 
    Edit3, 
    ChevronRight,
    LayoutDashboard,
    LucideIcon,
    ClipboardPlus,
    SearchCode,
    Terminal,
    Fingerprint,
    Activity,
    Network,
    Cpu,
    LogOut,
    Wifi,
    RefreshCw,
    Command,
    Lock,
    CloudOff,
    Clock,
    BellOff,
    Zap,
    ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { OfflineQueueTerminal } from '@/components/inventory/offline-queue-terminal';

interface HubItem {
    href: string;
    label: string;
    icon: LucideIcon;
    description: string;
    role: 'admin' | 'viewer' | 'both';
    variant?: 'default' | 'primary' | 'security';
}

const HUB_SECTIONS: { title: string; index: string; items: HubItem[] }[] = [
    {
        title: "Operations",
        index: "01",
        items: [
            { href: '/dashboard', label: 'Mission Control', icon: LayoutDashboard, description: 'Live registry metrics & analytics.', role: 'admin', variant: 'primary' },
            { href: '/approvals', label: 'Approval Center', icon: ShieldCheck, description: 'Verify & authorize staff requests.', role: 'admin', variant: 'security' },
            { href: '/inventory', label: 'Global Inventory', icon: ClipboardList, description: 'Master log of all units in stock.', role: 'admin' },
            { href: '/inventory/add', label: 'Log New Item', icon: ClipboardPlus, description: 'Standard industrial SKU logging.', role: 'both', variant: 'primary' },
            { href: '/inventory/lookup', label: 'Barcode Lookup', icon: SearchCode, description: 'Trace specific log & audit history.', role: 'both' },
            { href: '/products', label: 'Return by Staff', icon: UserCheck, description: 'Individual return & audit tracking.', role: 'both' },
            { href: '/products/by-supplier', label: 'Return by Supplier', icon: Undo, description: 'Bulk vendor processing protocol.', role: 'admin' },
        ]
    },
    {
        title: "Management",
        index: "02",
        items: [
            { href: '/products/manage', label: 'Manage Products', icon: Edit3, description: 'Update master registry definitions.', role: 'admin' },
            { href: '/audit-log', label: 'Security Audit', icon: FileText, description: 'Complete terminal action history.', role: 'admin' },
        ]
    },
    {
        title: "System",
        index: "03",
        items: [
            { href: '/settings', label: 'Settings', icon: Settings, description: 'Interface & security configuration.', role: 'both' },
        ]
    }
];

function HubCard({ item }: { item: HubItem }) {
    return (
        <Link href={item.href} className="block group">
            <Card className={cn(
                "relative border-white/5 bg-card/30 backdrop-blur-3xl hover:bg-primary/[0.05] hover:border-primary/20 transition-all duration-300 rounded-[1.5rem] overflow-hidden shadow-none active:scale-[0.97]",
                item.variant === 'security' && "hover:border-destructive/20"
            )}>
                <CardContent className="p-5 flex items-center gap-5">
                    <div className={cn(
                        "p-3 rounded-2xl bg-muted/20 text-muted-foreground transition-all duration-500 group-hover:scale-110",
                        item.variant === 'primary' && "bg-primary/10 text-primary",
                        item.variant === 'security' && "bg-destructive/10 text-destructive",
                        "group-hover:shadow-lg group-hover:shadow-black/5"
                    )}>
                        <item.icon className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none mb-1.5">
                            {item.label}
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60 truncate">
                            {item.description}
                        </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
            </Card>
        </Link>
    );
}

export default function SystemHubPage() {
    const { role, user, logout } = useAuth();
    const { isAllowed } = useAccessControl();
    const { isOnline, isSyncing, lastSync, pendingActions, refreshData } = useDataCache();
    const { activeSessions } = useSpecialEntry();
    
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [_, setForceUpdate] = useState(0);

    // Update time readouts every 30s
    useEffect(() => {
        const timer = setInterval(() => setForceUpdate(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    if (!role || !user) return null;

    const getInitials = (email?: string | null) => {
        if (!email) return 'U';
        const parts = email.split('@')[0].split(/[._-]/);
        if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return email.substring(0, 2).toUpperCase();
    };

    const handleManualLock = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('sheetSync_isLocked', 'true');
            window.location.reload();
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-10 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* SYSTEM STATUS HEADER */}
            <div className="px-1 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
                            System <span className="text-primary">Hub</span>
                        </h1>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-2">
                            Operational Command Terminal
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                         <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[9px] uppercase tracking-widest">v5.0.0</Badge>
                    </div>
                </div>

                {/* MOBILE CONTROL CENTER */}
                <Card className="border-white/5 bg-primary/5 dark:bg-primary/[0.02] rounded-[2rem] overflow-hidden shadow-none">
                    <CardHeader className="pb-2 pt-6 px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Command Terminal</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-tighter">
                                    SYNCED {lastSync ? formatDistanceToNow(new Date(lastSync), { addSuffix: true }) : 'NEVER'}
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* PRIMARY ACTIONS GRID */}
                        <div className="grid grid-cols-4 gap-3">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => isOnline && !isSyncing && refreshData()}
                                            disabled={!isOnline || isSyncing}
                                            className={cn(
                                                "h-14 w-full rounded-2xl border transition-all",
                                                isSyncing 
                                                    ? "bg-amber-500/20 text-amber-600 border-amber-500/30 animate-pulse" 
                                                    : !isOnline 
                                                        ? "bg-destructive/20 text-destructive border-destructive/30" 
                                                        : "bg-green-500/20 text-green-600 border-green-500/30"
                                            )}
                                        >
                                            <RefreshCw className={cn("h-6 w-6", isSyncing && "animate-spin")} strokeWidth={2.5} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="rounded-xl font-bold">
                                        {isSyncing ? "Transmission in progress..." : !isOnline ? "Registry Link Offline" : "Force Master Sync"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsCommandPaletteOpen(true)}
                                className="h-14 w-full text-muted-foreground rounded-2xl border-white/5 bg-white/40 dark:bg-zinc-900/40 hover:bg-primary/5 transition-all"
                            >
                                <Command className="h-6 w-6" strokeWidth={2.5} />
                            </Button>

                            <div className="h-14 w-full flex items-center justify-center bg-white/40 dark:bg-zinc-900/40 rounded-2xl border border-white/5 relative">
                                <NotificationCenter />
                            </div>

                            {role === 'admin' ? (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleManualLock}
                                    className="h-14 w-full text-muted-foreground rounded-2xl border-white/5 bg-white/40 dark:bg-zinc-900/40 hover:text-destructive transition-all"
                                >
                                    <Lock className="h-6 w-6" strokeWidth={2.5} />
                                </Button>
                            ) : (
                                <div className="h-14 w-full flex items-center justify-center bg-white/40 dark:bg-zinc-900/40 rounded-2xl border border-white/5" />
                            )}
                        </div>

                        {/* SECONDARY TELEMETRY */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 p-3 rounded-xl bg-white/40 dark:bg-zinc-900/40 border border-white/5 flex items-center gap-3">
                                <div className={cn(
                                    "h-2 w-2 rounded-full",
                                    isOnline ? "bg-green-500 animate-pulse" : "bg-destructive"
                                )} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                    {isOnline ? "Industrial Link Active" : "Registry Disconnected"}
                                </span>
                            </div>
                            
                            {pendingActions.length > 0 && (
                                <Button 
                                    onClick={() => setIsQueueOpen(true)}
                                    variant="outline"
                                    className="h-11 px-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 animate-pulse hover:bg-destructive/20"
                                >
                                    <CloudOff className="h-3.5 w-3.5 mr-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">{pendingActions.length} CONFLICTS</span>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* OPERATIONAL IDENTITY BLOCK */}
                <div className="p-6 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 dark:from-zinc-900 dark:to-black text-white shadow-2xl shadow-black/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-tech-grid opacity-20" />
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px] group-hover:bg-primary/20 transition-all duration-1000" />
                    
                    <div className="relative z-10 flex items-center gap-5">
                        <Avatar className="h-16 w-16 rounded-2xl border-2 border-white/10 shadow-xl">
                            <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(user.email)}`} alt={user.email || "User"} />
                            <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground font-black text-xl">{getInitials(user.email)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 mb-1">Authenticated Account</p>
                            <h2 className="text-xl font-black tracking-tight truncate leading-none uppercase mb-1">{user.displayName || user.email?.split('@')[0] || "Personnel"}</h2>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-white/10 text-white border-none font-black text-[9px] uppercase tracking-widest px-2">
                                    <Fingerprint className="h-2.5 w-2.5 mr-1" />
                                    {role} Privilege
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NAVIGATION SECTIONS */}
            <div className="space-y-16">
                {HUB_SECTIONS.map((section) => {
                    const visibleItems = section.items.filter(item => {
                        const roleMatch = item.role === 'both' || item.role === role;
                        const accessMatch = isAllowed(role, item.href);
                        return roleMatch && accessMatch;
                    });

                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={section.title} className="space-y-6">
                            <div className="flex items-center gap-4 px-1">
                                <div className="text-2xl font-black text-primary/10 tracking-tighter">{section.index}</div>
                                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-primary">{section.title}</h2>
                                <div className="h-px flex-1 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {visibleItems.map((item) => (
                                    <HubCard key={item.href} item={item} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ACTION FOOTER */}
            <div className="space-y-10 pt-10">
                <div className="px-1 flex flex-col items-center gap-6">
                    <Button 
                        variant="ghost" 
                        onClick={() => logout()}
                        className="w-full h-16 rounded-[1.5rem] border-2 border-destructive/10 text-destructive hover:bg-destructive/5 font-black uppercase tracking-[0.2em] text-xs"
                    >
                        <LogOut className="mr-3 h-5 w-5" />
                        Terminate Registry Session
                    </Button>
                    
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-4">
                            <Cpu className="h-4 w-4 text-muted-foreground/20" />
                            <Activity className="h-4 w-4 text-muted-foreground/20" />
                            <Network className="h-4 w-4 text-muted-foreground/20" />
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-[0.6em] text-muted-foreground/20">
                            SHEETSYNC INDUSTRIAL CORE • SECURE LINK
                        </p>
                    </div>
                </div>
            </div>

            <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

            <Dialog open={isQueueOpen} onOpenChange={setIsQueueOpen}>
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-background">
                    <DialogHeader className="p-8 pb-4 bg-muted/20 border-b border-white/5">
                        <div className="flex items-center gap-4 mb-1">
                            <div className="p-3 bg-destructive/10 rounded-2xl">
                                <ShieldAlert className="h-6 w-6 text-destructive" />
                            </div>
                            <div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-destructive">Conflict Resolution</DialogTitle>
                                <DialogDescription className="font-bold text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">Registry Integrity Protocol</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-8 pt-4">
                        <OfflineQueueTerminal />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
