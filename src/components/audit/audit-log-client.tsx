'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuditLogEntry } from '@/lib/types';
import { Search, FilterX, CalendarIcon, User, Tag, Crosshair, Info, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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

const formatActionString = (action: string) => {
  if (!action) return '';
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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

  // Reset pagination on filter change
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
      const toDate = startOfDay(selectedDateRange.to);
      logs = logs.filter(log => {
        try {
          const logDate = startOfDay(parseISO(log.timestamp));
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
          <div className="flex items-center justify-center gap-2 py-4">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                  <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1 mx-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Page</span>
                  <span className="text-sm font-black text-primary">{currentPage}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">of {totalPages}</span>
              </div>

              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                  <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                  <ChevronsRight className="h-4 w-4" />
              </Button>
          </div>
      );
  };
  
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <CardContent className="p-0 flex flex-col gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search logs (Barcode, Product, or User)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-40 flex-1">
                <div className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by user" /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_USERS_VALUE}>All Users</SelectItem>
                {uniqueUsers.map(user => <SelectItem key={user} value={user}>{user}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-40 flex-1">
                <div className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by action" /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACTIONS_VALUE}>All Actions</SelectItem>
                {uniqueActions.map(action => <SelectItem key={action} value={action}>{formatActionString(action)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal sm:min-w-48 flex-1", !selectedDateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDateRange?.from ? (selectedDateRange.to ? <>{format(selectedDateRange.from, "LLL dd, y")} - {format(selectedDateRange.to, "LLL dd, y")}</> : format(selectedDateRange.from, "LLL dd, y")) : <span>Filter by date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={selectedDateRange?.from} selected={selectedDateRange} onSelect={setSelectedDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>

            {(searchTerm || selectedUser !== ALL_USERS_VALUE || selectedAction !== ALL_ACTIONS_VALUE || selectedDateRange) && (
              <Button variant="ghost" onClick={clearFilters}><FilterX className="mr-2 h-4 w-4" /> Clear Filters</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-1">
          <Badge variant="outline" className="font-black uppercase tracking-tighter text-[9px] bg-muted/20 border-white/5 py-1">
              Found {filteredLogs.length} Security Records
          </Badge>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 italic">RETENTION: 365 DAYS</span>
      </div>

      <Card className="shadow-md">
        {isMobile ? (
           <div className="space-y-4 p-4">
            {paginatedLogs.length > 0 ? (
              paginatedLogs.map(log => (
                <Card key={log.id} className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        <Badge variant="secondary">{formatActionString(log.action)}</Badge>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">{format(parseISO(log.timestamp), 'PPp')}</span>
                  </CardHeader>
                  <CardContent className="text-sm">
                      <div className="space-y-2">
                          <div className="flex items-start gap-2">
                              <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div>
                                  <p className="font-medium">User</p>
                                  <p className="text-muted-foreground break-all">{log.user}</p>
                              </div>
                          </div>
                          <div className="mt-2 text-xs line-clamp-2 text-muted-foreground">
                              {log.details}
                          </div>
                          <div className="mt-4 pt-4 border-t">
                            <Button variant="secondary" className="w-full" onClick={() => handleOpenDetails(log)}>
                                <Info className="mr-2 h-4 w-4" /> View Full Details
                            </Button>
                          </div>
                      </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="h-24 text-center flex flex-col justify-center items-center">
                <p>No audit logs match your filters.</p>
              </div>
            )}
           </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Timestamp</TableHead>
                <TableHead className="w-[220px]">User</TableHead>
                <TableHead className="w-[200px]">Action</TableHead>
                <TableHead>Quick Details</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(parseISO(log.timestamp), 'PPpp')}</TableCell>
                    <TableCell className="font-medium break-all">{log.user}</TableCell>
                    <TableCell><Badge variant="secondary">{formatActionString(log.action)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{log.details}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(log)}>
                            <Info className="mr-2 h-4 w-4" /> Details
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">No audit logs match your filters.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <PaginationControls />
      </Card>
      
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Audit Log Details
                </DialogTitle>
                <DialogDescription>
                    Full details for the selected log entry.
                </DialogDescription>
            </DialogHeader>
            {selectedLog && (
                <div className="space-y-3 py-4 text-sm">
                    <div className="flex items-center">
                        <CalendarIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Timestamp:</span>
                        <span className="ml-2 text-muted-foreground">{format(parseISO(selectedLog.timestamp), 'PPp')}</span>
                    </div>
                     <Separator />
                    <div className="flex items-center">
                        <Tag className="mr-3 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Action:</span>
                        <span className="ml-2"><Badge variant="secondary">{formatActionString(selectedLog.action)}</Badge></span>
                    </div>
                     <div className="flex items-center">
                        <User className="mr-3 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">User:</span>
                        <span className="ml-2 text-muted-foreground break-all">{selectedLog.user}</span>
                    </div>
                     <div className="flex items-center">
                        <Crosshair className="mr-3 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Target ID:</span>
                        <span className="ml-2 text-muted-foreground font-mono text-xs break-all">{selectedLog.target}</span>
                    </div>
                     <Separator />
                     <div>
                        <h4 className="font-medium mb-2 flex items-center gap-3"><Info className="h-4 w-4 text-muted-foreground" />Details:</h4>
                        <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md font-sans border border-primary/10">
                            {selectedLog.details}
                        </pre>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
