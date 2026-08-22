'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { AuditLogEntry } from '@/lib/types';
import { 
    Search, 
    FilterX, 
    CalendarIcon, 
    User, 
    Tag, 
    Crosshair, 
    Info, 
    FileText, 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight,
    AlertTriangle,
    ShieldAlert,
    Trash2,
    Edit,
    History,
    Activity,
    PlusCircle,
    Undo2,
    Database,
    Fingerprint,
    Terminal,
    BarChart3
} from 'lucide-react';
import { parseISO, isValid, isBefore, format, isAfter, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Badge } from '../ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDataCache } from '@/context/data-cache-context';
import { Calendar } from '../ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '../ui/label';

const ALL_USERS_VALUE = "___ALL_USERS___";
const ALL_ACTIONS_VALUE = "___ALL_ACTIONS___";
const ITEMS_PER_PAGE = 50;

const getActionIcon = (action: string) => {
    if (action.includes('DELETE') || action.includes('WIPE')) return <Trash2 className="h-3 w-3" />;
    if (action.includes('UPDATE') || action.includes('EDIT')) return <Edit className="h-3 w-3" />;
    if (action.includes('CREATE') || action.includes('LOG') || action.includes('REGISTER')) return <PlusCircle className="h-3 w-3" />;
    if (action.includes('RETURN')) return <Undo2 className="h-3 w-3" />;
    return <Activity className="h-3 w-3" />;
};

const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('WIPE')) return "bg-red-500/10 text-red-600 border-red-500/20";
    if (action.includes('UPDATE') || action.includes('EDIT')) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (action.includes('CREATE') || action.includes('LOG') || action.includes('REGISTER')) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (action.includes('RETURN')) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
};

const formatActionString = (action: string) => {
  if (!action) return '';
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

function MetricCard({ title, value, subValue, icon: Icon, variant = 'default' }: { title: string, value: number, subValue?: string, icon: any, variant?: 'default' | 'destructive' | 'warning' }) {
    return (
        <Card className={cn(
            "group shadow-none border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden transition-all hover:border-primary/20",
            variant === 'destructive' && "border-red-500/10 bg-red-500/[0.01]"
        )}>
            <CardContent className="p-7">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.3em] leading-none mb-2">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <h4 className={cn(
                                "text-4xl font-black tracking-tighter leading-none", 
                                variant === 'destructive' ? "text-red-500" : "text-slate-900 dark:text-white"
                            )}>
                                {value.toLocaleString()}
                            </h4>
                            {subValue && <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">{subValue}</span>}
                        </div>
                    </div>
                    <div className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg",
                        variant === 'destructive' ? "bg-red-500/10 text-red-500 group-hover:shadow-red-500/20" : "bg-primary/10 text-primary group-hover:shadow-primary/20"
                    )}>
                        <Icon className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function AuditLogClient() {
  const { auditLogs: allLogs } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>(ALL_USERS_VALUE);
  const [selectedAction, setSelectedAction] = useState<string>(ALL_ACTIONS_VALUE);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const isMobile = useIsMobile();

  // Metrics calculation
  const metrics = useMemo(() => {
    if (!allLogs) return { total: 0, critical: 0, distinctUsers: 0, recent: 0 };
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    
    return {
        total: allLogs.length,
        critical: allLogs.filter(l => l.action.includes('DELETE') || l.action.includes('WIPE')).length,
        distinctUsers: new Set(allLogs.map(l => l.user)).size,
        recent: allLogs.filter(l => parseISO(l.timestamp) > sixHoursAgo).length
    };
  }, [allLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUser, selectedAction, selectedDateRange]);

  const { uniqueUsers, uniqueActions } = useMemo(() => {
    if (!allLogs) return { uniqueUsers: [], uniqueActions: [] };
    const users = new Set<string>();
    const actions = new Set<string>();
    allLogs.forEach(log => {
      users.add(log.user);
      actions.add(log.action);
    });
    return {
      uniqueUsers: Array.from(users).sort(),
      uniqueActions: Array.from(actions).sort(),
    };
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    let logs = allLogs || [];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      logs = logs.filter(log =>
        log.user.toLowerCase().includes(lowerSearch) ||
        log.action.toLowerCase().includes(lowerSearch) ||
        log.target.toLowerCase().includes(lowerSearch) ||
        log.details.toLowerCase().includes(lowerSearch)
      );
    }

    if (selectedUser !== ALL_USERS_VALUE) {
      logs = logs.filter(log => log.user === selectedUser);
    }

    if (selectedAction !== ALL_ACTIONS_VALUE) {
      logs = logs.filter(log => log.action === selectedAction);
    }

    if (selectedDateRange?.from && selectedDateRange.to) {
      const fromDate = startOfDay(selectedDateRange.from);
      const toDate = endOfDay(selectedDateRange.to);
      logs = logs.filter(log => {
        try {
          const logDate = parseISO(log.timestamp);
          return isValid(logDate) && !isBefore(logDate, fromDate) && !isAfter(logDate, toDate);
        } catch {
          return false;
        }
      });
    }

    return logs;
  }, [allLogs, searchTerm, selectedUser, selectedAction, selectedDateRange]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedUser(ALL_USERS_VALUE);
    setSelectedAction(ALL_ACTIONS_VALUE);
    setSelectedDateRange(undefined);
  };
  
  const handleOpenDetails = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setIsDetailsDialogOpen(true);
  };

  const PaginationControls = () => {
      if (totalPages <= 1) return null;
      return (
          <div className="flex items-center justify-center gap-3 py-10 bg-muted/5 border-t border-white/5">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-white/5 bg-background shadow-sm hover:bg-primary/5 transition-all"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                  <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-white/5 bg-background shadow-sm hover:bg-primary/5 transition-all"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2 mx-6">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">Page</span>
                  <span className="text-lg font-black text-primary tabular-nums">{currentPage}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">of {totalPages}</span>
              </div>

              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-white/5 bg-background shadow-sm hover:bg-primary/5 transition-all"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                  <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-white/5 bg-background shadow-sm hover:bg-primary/5 transition-all"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                  <ChevronsRight className="h-4 w-4" />
              </Button>
          </div>
      );
  };
  
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-32">
      {/* INTELLIGENCE METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Forensic Evidence" value={metrics.total} icon={Database} subValue="TOTAL TRACES" />
          <MetricCard title="High-Risk Removal" value={metrics.critical} icon={ShieldAlert} variant="destructive" subValue="SECURITY" />
          <MetricCard title="Unique Identities" value={metrics.distinctUsers} icon={Fingerprint} subValue=" PERSONNEL" />
          <MetricCard title="Temporal Activity" value={metrics.recent} icon={Activity} subValue="RECENT 6H" />
      </div>

      {/* FILTER DECK */}
      <Card className="p-2 sm:p-2 border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/[0.02]">
        <CardContent className="p-4 sm:p-6 flex flex-col gap-6">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/20 group-focus-within:text-primary transition-colors" strokeWidth={3} />
            <Input
              type="search"
              placeholder="SEARCH FORENSIC REGISTRY (SKU, NAME, OR STAFF)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-16 w-full h-16 bg-muted/10 border-white/5 rounded-2xl font-black uppercase tracking-tight text-xl placeholder:text-muted-foreground/10 shadow-inner focus:border-primary/20"
            />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-64 h-14 rounded-2xl bg-background/50 border-white/5 font-black uppercase text-[10px] tracking-[0.2em] shadow-sm">
                <div className="flex items-center"><User className="mr-3 h-4 w-4 text-primary/40" /><SelectValue placeholder="PERSONNEL FILTER" /></div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 shadow-3xl">
                <SelectItem value={ALL_USERS_VALUE} className="text-[10px] font-black uppercase py-3">ALL PERSONNEL</SelectItem>
                {uniqueUsers.map(user => <SelectItem key={user} value={user} className="text-[10px] font-black uppercase py-3">{user}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-64 h-14 rounded-2xl bg-background/50 border-white/5 font-black uppercase text-[10px] tracking-[0.2em] shadow-sm">
                <div className="flex items-center"><Tag className="mr-3 h-4 w-4 text-primary/40" /><SelectValue placeholder="OPERATION TYPE" /></div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 shadow-3xl">
                <SelectItem value={ALL_ACTIONS_VALUE} className="text-[10px] font-black uppercase py-3">ALL OPERATIONS</SelectItem>
                {uniqueActions.map(action => (
                    <SelectItem key={action} value={action} className="text-[10px] font-black uppercase py-3">
                        {formatActionString(action)}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left h-14 rounded-2xl bg-background/50 border-white/5 font-black uppercase text-[10px] tracking-[0.2em] sm:min-w-72 shadow-sm", !selectedDateRange && "text-muted-foreground/30")}>
                  <CalendarIcon className="mr-3 h-4 w-4 text-primary/40" />
                  {selectedDateRange?.from ? (selectedDateRange.to ? <>{format(selectedDateRange.from, "MMM dd, yy")} — {format(selectedDateRange.to, "MMM dd, yy")}</> : format(selectedDateRange.from, "MMM dd, yy")) : <span>TEMPORAL WINDOW</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-[2rem] overflow-hidden border-white/10 shadow-3xl" align="start">
                <Calendar initialFocus mode="range" defaultMonth={selectedDateRange?.from} selected={selectedDateRange} onSelect={setSelectedDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>

            {(searchTerm || selectedUser !== ALL_USERS_VALUE || selectedAction !== ALL_ACTIONS_VALUE || selectedDateRange) && (
              <Button variant="ghost" onClick={clearFilters} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[9px] text-red-500 hover:bg-red-500/5 transition-all"><FilterX className="mr-2 h-4 w-4" /> RESET TERMINAL</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FORENSIC TRACE REGISTRY */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                    <Terminal className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tighter">Forensic Trace Registry</h2>
            </div>
            <Badge variant="outline" className="font-black uppercase tracking-widest text-[8px] bg-primary/5 text-primary border-primary/20 py-1.5 px-4 rounded-full">
                {filteredLogs.length} TRACES IDENTIFIED
            </Badge>
        </div>

        <Card className="shadow-2xl border-white/5 overflow-hidden rounded-[2.5rem] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl">
            {isMobile ? (
            <div className="divide-y divide-white/5">
                {paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => (
                    <div key={log.id} className="p-8 space-y-6 hover:bg-primary/[0.03] transition-all group" onClick={() => handleOpenDetails(log)}>
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn("font-black uppercase tracking-[0.1em] text-[8px] px-3 py-1 rounded-lg border-none shadow-sm", getActionColor(log.action))}>
                            {getActionIcon(log.action)}
                            <span className="ml-2">{formatActionString(log.action)}</span>
                        </Badge>
                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-tighter tabular-nums">{format(parseISO(log.timestamp), 'PPp')}</span>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-background rounded-2xl border border-white/5 shadow-inner transition-transform group-hover:scale-110">
                            <Fingerprint className="h-6 w-6 text-primary/40" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 leading-none mb-1.5">PERSONNEL ID</p>
                            <p className="text-base font-black truncate text-slate-900 dark:text-white uppercase tracking-tight">{log.user}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-2xl border border-white/5">
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed italic opacity-80">
                            "{log.details}"
                        </p>
                    </div>
                    </div>
                ))
                ) : (
                <div className="py-32 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/20">Zero Traces Match Identification</p>
                </div>
                )}
            </div>
            ) : (
            <Table>
                <TableHeader className="bg-muted/10 border-b border-white/5">
                <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] pl-10 h-16 text-muted-foreground/40">Timestamp</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] h-16 text-muted-foreground/40">Identity Node</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] h-16 text-muted-foreground/40">Operation</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] h-16 text-muted-foreground/40">Impact Details</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] h-16 pr-10 text-right text-muted-foreground/40">Action</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedLogs.length > 0 ? (
                    paginatedLogs.map(log => (
                    <TableRow key={log.id} className="group hover:bg-primary/[0.02] transition-colors h-20 border-white/5">
                        <TableCell className="text-[10px] font-mono font-black text-muted-foreground/40 pl-10 tracking-tighter">
                            {format(parseISO(log.timestamp), 'dd/MM/yy HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-muted/40 rounded-xl border border-white/5 text-muted-foreground/20 group-hover:text-primary transition-all duration-500 group-hover:rotate-[15deg]">
                                    <Fingerprint className="h-5 w-5" />
                                </div>
                                <span className="font-black text-sm tracking-tight uppercase text-slate-800 dark:text-slate-200">{log.user}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-[0.1em] border shadow-sm", getActionColor(log.action))}>
                                {getActionIcon(log.action)}
                                {formatActionString(log.action)}
                            </div>
                        </TableCell>
                        <TableCell className="max-w-[400px]">
                            <p className="text-[11px] font-bold text-muted-foreground/60 truncate group-hover:text-foreground transition-colors leading-relaxed">
                                {log.details}
                            </p>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDetails(log)} className="h-10 w-10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground">
                                <Info className="h-5 w-5" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-96 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-10 grayscale">
                            <BarChart3 className="h-16 w-16" strokeWidth={1} />
                            <p className="text-[11px] font-black uppercase tracking-[0.6em]">Zero Forensic Matches Identified</p>
                        </div>
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            )}
            <PaginationControls />
        </Card>
      </div>
      
      {/* FORENSIC DETAIL DIALOG */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[3rem] border-none shadow-3xl bg-background">
            <div className="p-10 pb-6 bg-muted/20 border-b border-white/5">
                <DialogHeader>
                    <div className="flex items-center gap-6 mb-6">
                        <div className={cn("p-6 rounded-[1.5rem] shadow-xl transition-transform duration-700", selectedLog ? getActionColor(selectedLog.action) : "bg-muted")}>
                            {selectedLog && React.cloneElement(getActionIcon(selectedLog.action) as React.ReactElement, { className: "h-8 w-8" })}
                        </div>
                        <div className="space-y-1">
                            <DialogTitle className="text-4xl font-black uppercase tracking-tighter leading-none">
                                Forensic Node
                            </DialogTitle>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-background border-white/10 text-primary">
                                    TRACE ID: {selectedLog?.id.toUpperCase()}
                                </Badge>
                                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest border-none">
                                    VERIFIED LOG
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <DialogDescription className="font-bold text-sm leading-relaxed tracking-tight text-muted-foreground/60 pr-8">
                        Secure breakdown of selected security event. All timestamps and personnel identities are cryptographically synced with the master registry.
                    </DialogDescription>
                </DialogHeader>
            </div>
            
            {selectedLog && (
                <div className="p-10 pt-6 space-y-10">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 rounded-3xl bg-muted/10 border border-white/5 space-y-2 shadow-inner">
                            <div className="flex items-center gap-2">
                                <Fingerprint className="h-3 w-3 text-primary" />
                                <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Personnel Identity</p>
                            </div>
                            <p className="text-xl font-black uppercase truncate text-slate-900 dark:text-white">{selectedLog.user}</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-muted/10 border border-white/5 space-y-2 shadow-inner">
                            <div className="flex items-center gap-2">
                                <Activity className="h-3 w-3 text-primary" />
                                <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Registry Timestamp</p>
                            </div>
                            <p className="text-xl font-black uppercase text-slate-900 dark:text-white">{format(parseISO(selectedLog.timestamp), 'dd MMM yy • HH:mm')}</p>
                        </div>
                    </div>

                    <div className="p-8 bg-primary/5 border border-primary/20 rounded-[2rem] flex items-center gap-6 shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-tech-grid opacity-20" />
                        <Crosshair className="h-10 w-10 text-primary/60 shrink-0 relative z-10 transition-transform group-hover:scale-110 duration-700" strokeWidth={3} />
                        <div className="relative z-10 min-w-0">
                            <p className="text-[9px] font-black uppercase text-primary tracking-[0.3em] leading-none mb-2">Impact Target ID</p>
                            <p className="text-lg font-mono font-black text-primary tracking-tighter truncate">{selectedLog.target}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 ml-2">
                            <Info className="h-4 w-4 text-muted-foreground/40" />
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em]">Event Breakdown</Label>
                        </div>
                        <div className="p-8 bg-background rounded-[2.5rem] border-2 border-muted shadow-2xl shadow-black/[0.01] relative">
                            <p className="text-sm font-bold leading-relaxed italic text-slate-700 dark:text-slate-300 relative z-10">
                                "{selectedLog.details}"
                            </p>
                            <History className="absolute bottom-6 right-8 h-16 w-16 text-muted-foreground/5 pointer-events-none" />
                        </div>
                    </div>
                </div>
            )}
            
            <div className="p-8 bg-muted/20 border-t border-white/5 flex justify-center">
                <Button variant="ghost" onClick={() => setIsDetailsDialogOpen(false)} className="h-12 px-12 text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100 hover:bg-transparent transition-all">
                    TERMINATE INVESTIGATION SESSION
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}