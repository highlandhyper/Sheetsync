
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import type { AuditLogEntry } from '@/lib/types';
import { Search, FilterX, CalendarIcon, User, Tag } from 'lucide-react';
import { addDays, parseISO, isValid, isBefore, format, isAfter, startOfDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { fetchAuditLogsAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';

const ALL_USERS_VALUE = "___ALL_USERS___";
const ALL_ACTIONS_VALUE = "___ALL_ACTIONS___";

export function AuditLogClient() {
  const { toast } = useToast();
  const [allLogs, setAllLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>(ALL_USERS_VALUE);
  const [selectedAction, setSelectedAction] = useState<string>(ALL_ACTIONS_VALUE);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      const response = await fetchAuditLogsAction();
      if (response.success && response.data) {
        setAllLogs(response.data);
      } else {
        toast({ title: 'Error', description: 'Could not fetch audit logs.', variant: 'destructive' });
      }
      setIsLoading(false);
    }
    loadLogs();
  }, [toast]);

  const { uniqueUsers, uniqueActions } = useMemo(() => {
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
    let logs = allLogs;

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

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedUser(ALL_USERS_VALUE);
    setSelectedAction(ALL_ACTIONS_VALUE);
    setSelectedDateRange(undefined);
  };
  
  if (isLoading) {
    return (
        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border rounded-lg shadow bg-card">
            <Skeleton className="h-10 w-full sm:max-w-xs" />
            <Skeleton className="h-10 w-full sm:max-w-[200px]" />
            <Skeleton className="h-10 w-full sm:max-w-[200px]" />
            <Skeleton className="h-10 w-full sm:max-w-[200px]" />
        </div>
        <Card className="shadow-md">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <CardContent className="p-0 flex flex-col gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search logs..."
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
                {uniqueActions.map(action => <SelectItem key={action} value={action}>{action}</SelectItem>)}
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

      <Card className="shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(parseISO(log.timestamp), 'PPpp')}</TableCell>
                  <TableCell className="font-medium">{log.user}</TableCell>
                  <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{log.target}</TableCell>
                  <TableCell>{log.details}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">No audit logs match your filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
