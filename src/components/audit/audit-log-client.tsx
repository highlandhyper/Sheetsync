'use client';

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
    Fingerprint
} from 'lucide-react';
import { parseISO, isValid, isBefore, format, isAfter, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Badge } from '../ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDataCache } from '@/context/data-cache-context';
import { Calendar } from '../ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '../ui/separator';

const ALL_USERS_VALUE = "___ALL_USERS___";
const ALL_ACTIONS_VALUE = "___ALL_ACTIONS___";
const ITEMS_PER_PAGE = 50;

const getActionIcon = (action: string) => {
    if (action.includes('DELETE') || action.includes('WIPE')) return <Trash2 className="h-4 w-4" />;
    if (action.includes('UPDATE') || action.includes('EDIT')) return <Edit className="h-4 w-4" />;
    if (action.includes('CREATE') || action.includes('LOG') || action.includes('REGISTER')) return <PlusCircle className="h-4 w-4" />;
    if (action.includes('RETURN')) return <Undo2 className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
};

const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('WIPE')) return "bg-destructive/10 text-destructive border-destructive/20";
    if (action.includes('UPDATE') || action.includes('EDIT')) return "bg-primary/10 text-primary border-primary/20";
    if (action.includes('CREATE') || action.includes('LOG') || action.includes('REGISTER')) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (action.includes('RETURN')) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    return "bg-muted text-muted-foreground border-transparent";
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
            "shadow-none border-white/5 bg-card/40 backdrop-blur-3xl rounded-2xl overflow-hidden",
            variant === 'destructive' && "border-destructive/10 bg-destructive/[0.02]"
        )}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <h4 className={cn("text-3xl font-black tracking-tighter leading-none", variant === 'destructive' ? "text-destructive" : "text-slate-900 dark:text-white")}>
                                {value}
                            </h4>
                            {subValue && <span className="text-[10px] font-bold text-muted-foreground/40">{subValue}</span>}
                        </div>
                    </div>
                    <div className={cn(
                        "p-3 rounded-xl",
                        variant === 'destructive' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
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
    if (!allLogs) return { total: 0, critical: 0, distinctUsers: 0, recentHours: 0 };
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
          <div className="flex items-center justify-center gap-2 py-8 bg-muted/5 border-t">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-xl border-white/5 bg-background shadow-sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                  <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-xl border-white/5 bg-background shadow-sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1.5 mx-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Terminal Page</span>
                  <span className="text-sm font-black text-primary">{currentPage}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">of {totalPages}</span>
              </div>

              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-xl border-white/5 bg-background shadow-sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                  <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-xl border-white/5 bg-background shadow-sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                  <ChevronsRight className="h-4 w-4" />
              </Button>
          </div>
      );
  };
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Global Event volume" value={metrics.total} icon={Database} subValue="TOTAL" />
          <MetricCard title="High-Risk Deletions" value={metrics.critical} icon={ShieldAlert} variant="destructive" subValue="FORENSIC" />
          <MetricCard title="Distinct Personnel" value={metrics.distinctUsers} icon={Fingerprint} subValue="ROLES" />
          <MetricCard title="Activity Pulse" value={metrics.recent} icon={Activity} subValue="6H RADIUS" />
      </div>

      <Card className="p-4 sm:p-6 shadow-2xl border-white/10 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <History className="h-32 w-32" />
        </div>
        <CardContent className="p-0 flex flex-col gap-6 relative z-10">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
            <Input
              type="search"
              placeholder="SEARCH AUDIT FORENSICS (SKU, NAME, OR STAFF)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 w-full h-14 bg-muted/10 border-white/5 rounded-2xl font-black uppercase tracking-tight text-lg placeholder:text-muted-foreground/20 placeholder:tracking-[0.1em]"
            />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-56 h-12 rounded-xl bg-background/50 border-white/5 font-bold uppercase text-[10px] tracking-widest">
                <div className="flex items-center"><User className="mr-2 h-4 w-4 text-primary/60" /><SelectValue placeholder="FILTER BY USER" /></div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-white/10 shadow-2xl">
                <SelectItem value={ALL_USERS_VALUE} className="text-[10px] font-black uppercase">ALL PERSONNEL</SelectItem>
                {uniqueUsers.map(user => <SelectItem key={user} value={user} className="text-[10px] font-black uppercase">{user}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-56 h-12 rounded-xl bg-background/50 border-white/5 font-bold uppercase text-[10px] tracking-widest">
                <div className="flex items-center"><Tag className="mr-2 h-4 w-4 text-primary/60" /><SelectValue placeholder="FILTER BY ACTION" /></div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-white/10 shadow-2xl">
                <SelectItem value={ALL_ACTIONS_VALUE} className="text-[10px] font-black uppercase">ALL OPERATIONS</SelectItem>
                {uniqueActions.map(action => (
                    <SelectItem key={action} value={action} className="text-[10px] font-black uppercase">
                        {formatActionString(action)}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left h-12 rounded-xl bg-background/50 border-white/5 font-bold uppercase text-[10px] tracking-widest sm:min-w-64", !selectedDateRange && "text-muted-foreground/40")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary/60" />
                  {selectedDateRange?.from ? (selectedDateRange.to ? <>{format(selectedDateRange.from, "LLL dd")} - {format(selectedDateRange.to, "LLL dd")}</> : format(selectedDateRange.from, "LLL dd")) : <span>IDENTIFICATION RANGE</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden border-white/10 shadow-2xl" align="start">
                <Calendar initialFocus mode="range" defaultMonth={selectedDateRange?.from} selected={selectedDateRange} onSelect={setSelectedDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>

            {(searchTerm || selectedUser !== ALL_USERS_VALUE || selectedAction !== ALL_ACTIONS_VALUE || selectedDateRange) && (
              <Button variant="ghost" onClick={clearFilters} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] text-destructive hover:bg-destructive/10"><FilterX className="mr-2 h-4 w-4" /> Reset Filters</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-1">
          <Badge variant="outline" className="font-black uppercase tracking-widest text-[9px] bg-primary/5 text-primary border-primary/20 py-1.5 px-4 rounded-full">
              IDENTIFIED {filteredLogs.length} SECURITY TRACES
          </Badge>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/20 italic">RETENTION: 365 DAYS FORENSIC STORAGE</span>
      </div>

      <Card className="shadow-2xl border-white/10 overflow-hidden rounded-[2.5rem] bg-card/30 backdrop-blur-xl">
        {isMobile ? (
           <div className="divide-y divide-white/5">
            {paginatedLogs.length > 0 ? (
              paginatedLogs.map(log => (
                <div key={log.id} className="p-6 space-y-4 hover:bg-primary/[0.02] transition-colors" onClick={() => handleOpenDetails(log)}>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("font-black uppercase tracking-widest text-[8px] px-2 py-0.5", getActionColor(log.action))}>
                        {getActionIcon(log.action)}
                        <span className="ml-1.5">{formatActionString(log.action)}</span>
                    </Badge>
                    <span className="text-[9px] font-mono font-bold text-muted-foreground/40">{format(parseISO(log.timestamp), 'PPp')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded-lg border border-white/5">
                          <User className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                      <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none mb-1">Personnel</p>
                          <p className="text-sm font-bold truncate text-slate-900 dark:text-white uppercase">{log.user}</p>
                      </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground line-clamp-2 italic leading-relaxed">
                      "{log.details}"
                  </p>
                </div>
              ))
            ) : (
              <div className="py-24 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Zero Registry Matches</p>
              </div>
            )}
           </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 h-12">Timestamp</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Personnel ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Operation</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Target Terminal</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 pr-8 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => (
                  <TableRow key={log.id} className="group hover:bg-primary/[0.02] transition-colors h-16">
                    <TableCell className="text-[10px] font-mono font-bold text-muted-foreground/60 pl-8">
                        {format(parseISO(log.timestamp), 'dd/MM/yy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-muted/50 rounded-lg border border-white/5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                                <Fingerprint className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-sm tracking-tight uppercase">{log.user}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn("font-black uppercase tracking-widest text-[8px] py-1 px-3", getActionColor(log.action))}>
                            {getActionIcon(log.action)}
                            <span className="ml-2">{formatActionString(log.action)}</span>
                        </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground/60 max-w-[350px] truncate group-hover:text-foreground transition-colors">
                        {log.details}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(log)} className="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 text-primary">
                            <Info className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                          <Search className="h-10 w-10" />
                          <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Forensic Evidence Matches Filters</p>
                      </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <PaginationControls />
      </Card>
      
      <Dialog open={isDetailsDialogOpen} onOpenChange={isDetailsDialogOpen ? setIsDetailsDialogOpen : undefined}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-[2rem] border-none shadow-3xl bg-background">
            <div className="p-8 pb-4 bg-muted/30">
                <DialogHeader>
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn("p-4 rounded-2xl shadow-lg", selectedLog ? getActionColor(selectedLog.action) : "bg-muted")}>
                            {selectedLog && getActionIcon(selectedLog.action)}
                        </div>
                        <div>
                            <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">
                                Forensic Detail
                            </DialogTitle>
                            <Badge variant="outline" className="mt-2 text-[9px] font-black uppercase tracking-widest bg-background border-white/5 text-muted-foreground/60">
                                Trace ID: {selectedLog?.id}
                            </Badge>
                        </div>
                    </div>
                    <DialogDescription className="font-bold text-sm leading-relaxed tracking-tight text-muted-foreground">
                        Complete identity and operation breakdown for the selected terminal event.
                    </DialogDescription>
                </DialogHeader>
            </div>
            
            {selectedLog && (
                <div className="p-8 pt-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-muted/10 border border-white/5 space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Personnel Identity</p>
                            <p className="text-base font-black uppercase truncate">{selectedLog.user}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/10 border border-white/5 space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Operation Timestamp</p>
                            <p className="text-base font-black uppercase">{format(parseISO(selectedLog.timestamp), 'dd/MM/yy HH:mm')}</p>
                        </div>
                    </div>

                    <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl flex items-center gap-5">
                        <Crosshair className="h-8 w-8 text-primary/60 shrink-0" />
                        <div>
                            <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Impact Target</p>
                            <p className="text-sm font-mono font-black text-primary tracking-tighter truncate max-w-[380px]">{selectedLog.target}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-1 ml-1">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Complete Event Breakdown</Label>
                        </div>
                        <div className="p-6 bg-background rounded-2xl border-2 border-muted shadow-inner">
                            <p className="text-sm font-medium leading-relaxed italic text-slate-700 dark:text-slate-300">
                                "{selectedLog.details}"
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="p-6 bg-muted/30 border-t flex justify-center">
                <Button variant="ghost" onClick={() => setIsDetailsDialogOpen(false)} className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100">
                    Close Analysis Terminal
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
