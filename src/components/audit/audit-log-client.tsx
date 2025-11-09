
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Search, FilterX, CalendarIcon, Loader2, PackageSearch } from 'lucide-react';
import { format, parseISO, isValid, startOfDay, isBefore, isAfter } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import type { AuditLogEntry } from '@/lib/types';
import { getAuditLogEntriesAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';

function AuditLogSkeleton() {
  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-10 w-full sm:max-w-xs" /> {/* Search Input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-full sm:w-[180px]" /> {/* Date Range Filter */}
        </div>
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
                <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


export function AuditLogClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<AuditLogEntry[]>([]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const response = await getAuditLogEntriesAction();
        if (response.success && response.data) {
            setLogEntries(response.data);
        } else {
            setError(response.message || "An unknown error occurred while fetching audit logs.");
        }
    } catch (e: any) {
        setError(e.message || "A network error occurred.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    let items = logEntries;

    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        items = items.filter(entry =>
            entry.user.toLowerCase().includes(lowerSearchTerm) ||
            entry.action.toLowerCase().includes(lowerSearchTerm) ||
            entry.target.toLowerCase().includes(lowerSearchTerm) ||
            entry.details.toLowerCase().includes(lowerSearchTerm)
        );
    }
    
    if (selectedDateRange?.from) {
        const fromDate = startOfDay(selectedDateRange.from);
        items = items.filter(entry => {
            const entryDate = parseISO(entry.timestamp);
            return isValid(entryDate) && !isBefore(entryDate, fromDate);
        });
    }

    if (selectedDateRange?.to) {
        const toDate = startOfDay(selectedDateRange.to);
        items = items.filter(entry => {
            const entryDate = parseISO(entry.timestamp);
            return isValid(entryDate) && !isAfter(entryDate, toDate);
        });
    }

    return items;
  }, [logEntries, searchTerm, selectedDateRange]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedDateRange(undefined);
    setIsDatePopoverOpen(false);
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setSelectedDateRange(range);
    if (range?.from && range?.to) {
      setIsDatePopoverOpen(false);
    }
  }

  if (isLoading) {
      return <AuditLogSkeleton />;
  }

  if (error) {
      return (
        <Alert variant="destructive">
            <AlertTitle>Error Loading Audit Log</AlertTitle>
            <AlertDescription>
                {error} <Button variant="link" onClick={loadLogs}>Try again</Button>
            </AlertDescription>
        </Alert>
      )
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search logs (user, action, target...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            
            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full md:w-auto justify-start text-left font-normal md:min-w-48 flex-1",
                      !selectedDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDateRange?.from ? (
                      selectedDateRange.to ? (
                        <>
                          {format(selectedDateRange.from, "LLL dd, y")} - {format(selectedDateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(selectedDateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Filter by date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={selectedDateRange?.from}
                    selected={selectedDateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

            {(searchTerm || selectedDateRange) && (
              <Button variant="ghost" onClick={clearFilters}>
                <FilterX className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredLogs.length > 0 ? (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Timestamp</TableHead>
                <TableHead className="w-48">User</TableHead>
                <TableHead className="w-48">Action</TableHead>
                <TableHead className="w-48">Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((entry) => {
                const parsedTimestamp = parseISO(entry.timestamp);
                const formattedTimestamp = isValid(parsedTimestamp) ? format(parsedTimestamp, 'PPp') : 'Invalid Date';
                
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formattedTimestamp}</TableCell>
                    <TableCell className="font-medium">{entry.user}</TableCell>
                    <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{entry.action}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.target}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.details}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-12">
          <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No Audit Log Entries Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm || selectedDateRange ? "Try adjusting your search or filters." : "No actions have been logged yet."}
          </p>
        </div>
      )}
    </div>
  );
}
