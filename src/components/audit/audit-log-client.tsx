'use client';

import { useMemo, useState } from 'react';
import type { AuditLogEntry } from '@/lib/types';
import { useDataCache } from '@/context/data-cache-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  FilterX,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Activity,
  Clock3,
  FileText,
  Database,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isValid, parseISO, subDays, isAfter } from 'date-fns';

type TimeFilter = 'all' | '24h' | '7d' | '30d';

function getActionTone(action: string) {
  const value = action.toUpperCase();

  if (
    value.includes('DELETE') ||
    value.includes('REMOVE') ||
    value.includes('WIPE') ||
    value.includes('PURGE')
  ) {
    return {
      badge: 'bg-destructive/10 text-destructive border-destructive/15',
      dot: 'bg-destructive',
    };
  }

  if (
    value.includes('CREATE') ||
    value.includes('ADD') ||
    value.includes('REGISTER') ||
    value.includes('LOG')
  ) {
    return {
      badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/15',
      dot: 'bg-emerald-500',
    };
  }

  if (
    value.includes('UPDATE') ||
    value.includes('EDIT') ||
    value.includes('RESOLVE')
  ) {
    return {
      badge: 'bg-amber-500/10 text-amber-600 border-amber-500/15',
      dot: 'bg-amber-500',
    };
  }

  if (value.includes('RETURN')) {
    return {
      badge: 'bg-blue-500/10 text-blue-600 border-blue-500/15',
      dot: 'bg-blue-500',
    };
  }

  return {
    badge: 'bg-muted text-muted-foreground border-border/50',
    dot: 'bg-muted-foreground/50',
  };
}

function formatTimestamp(timestamp: string) {
  const parsed = parseISO(timestamp);

  if (!isValid(parsed)) {
    const fallback = new Date(timestamp);

    if (Number.isNaN(fallback.getTime())) {
      return {
        date: 'Unknown date',
        time: '',
        full: timestamp || 'Unknown',
      };
    }

    return {
      date: format(fallback, 'dd MMM yyyy'),
      time: format(fallback, 'HH:mm'),
      full: format(fallback, 'dd MMM yyyy, HH:mm'),
    };
  }

  return {
    date: format(parsed, 'dd MMM yyyy'),
    time: format(parsed, 'HH:mm'),
    full: format(parsed, 'dd MMM yyyy, HH:mm'),
  };
}

function AuditMobileCard({ log }: { log: AuditLogEntry }) {
  const tone = getActionTone(log.action);
  const timestamp = formatTimestamp(log.timestamp);

  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <CardContent className="min-w-0 p-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Activity className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold tracking-tight text-foreground">
                  {log.user || 'Unknown user'}
                </p>

                <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">
                  {timestamp.date}
                  {timestamp.time ? ` • ${timestamp.time}` : ''}
                </p>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  'max-w-[120px] shrink-0 truncate rounded-lg px-2 py-0.5 text-[8px] font-semibold',
                  tone.badge
                )}
              >
                {log.action || 'Unknown action'}
              </Badge>
            </div>

            <div className="mt-3 grid min-w-0 gap-2">
              <div className="min-w-0 rounded-xl bg-muted/30 px-3 py-2.5">
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Target
                </p>
                <p className="mt-0.5 break-words text-[10px] font-medium leading-4 text-foreground">
                  {log.target || '—'}
                </p>
              </div>

              <div className="min-w-0">
                <p className="line-clamp-3 break-words text-[10px] leading-4 text-muted-foreground">
                  {log.details || 'No additional details.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditLogClient() {
  const { auditLogs, refreshData } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const users = useMemo(
    () =>
      Array.from(
        new Set(
          auditLogs
            .map((log) => log.user?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [auditLogs]
  );

  const actions = useMemo(
    () =>
      Array.from(
        new Set(
          auditLogs
            .map((log) => log.action?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [auditLogs]
  );

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return auditLogs.filter((log) => {
      if (query) {
        const haystack = [
          log.user,
          log.action,
          log.target,
          log.details,
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (userFilter !== 'all' && log.user !== userFilter) {
        return false;
      }

      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      if (timeFilter !== 'all') {
        const parsed = parseISO(log.timestamp);

        if (!isValid(parsed)) {
          return false;
        }

        const days =
          timeFilter === '24h' ? 1 : timeFilter === '7d' ? 7 : 30;

        if (!isAfter(parsed, subDays(new Date(), days))) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, searchTerm, userFilter, actionFilter, timeFilter]);

  const uniqueUsers = useMemo(
    () => new Set(filteredLogs.map((log) => log.user)).size,
    [filteredLogs]
  );

  const uniqueActions = useMemo(
    () => new Set(filteredLogs.map((log) => log.action)).size,
    [filteredLogs]
  );

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    userFilter !== 'all' ||
    actionFilter !== 'all' ||
    timeFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setUserFilter('all');
    setActionFilter('all');
    setTimeFilter('all');
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Summary */}
      <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Visible events
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {filteredLogs.length}
                </p>
              </div>
              <FileText className="h-4 w-4 shrink-0 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Users
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {uniqueUsers}
                </p>
              </div>
              <UserRound className="h-4 w-4 shrink-0 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Actions
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {uniqueActions}
                </p>
              </div>
              <Activity className="h-4 w-4 shrink-0 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Registry
                </p>
                <p className="mt-1 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  Secure
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search / filters */}
      <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="min-w-0 p-3.5 sm:p-4">
          <div className="flex min-w-0 flex-col gap-2.5 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />

              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search user, action, target or details"
                className="h-10 min-w-0 rounded-xl border-border/60 bg-background pl-10 pr-3 text-xs shadow-none"
              />
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto">
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-10 min-w-0 rounded-xl border-border/60 bg-background text-[10px] shadow-none sm:w-[150px]">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-10 min-w-0 rounded-xl border-border/60 bg-background text-[10px] shadow-none sm:w-[170px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={timeFilter}
                onValueChange={(value) => setTimeFilter(value as TimeFilter)}
              >
                <SelectTrigger className="h-10 min-w-0 rounded-xl border-border/60 bg-background text-[10px] shadow-none sm:w-[140px]">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refreshData()}
                  className="h-10 rounded-xl border-border/60 px-3 text-[9px] font-semibold shadow-none"
                >
                  <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="h-10 rounded-xl px-3 text-[9px] font-semibold text-muted-foreground"
                >
                  <FilterX className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
            <p className="text-[9px] text-muted-foreground sm:text-[10px]">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {filteredLogs.length}
              </span>{' '}
              of {auditLogs.length} audit events
            </p>

            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="rounded-lg border-0 px-2 py-0.5 text-[8px] font-semibold"
              >
                Filters active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredLogs.length > 0 ? (
        <>
          {/* Mobile feed */}
          <div className="space-y-2.5 md:hidden">
            {filteredLogs.map((log) => (
              <AuditMobileCard key={log.id} log={log} />
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-muted/25">
                  <TableRow className="h-11 border-border/50 hover:bg-transparent">
                    <TableHead className="w-[150px] pl-4 text-[9px] font-semibold text-muted-foreground">
                      Time
                    </TableHead>
                    <TableHead className="w-[180px] text-[9px] font-semibold text-muted-foreground">
                      User
                    </TableHead>
                    <TableHead className="w-[180px] text-[9px] font-semibold text-muted-foreground">
                      Action
                    </TableHead>
                    <TableHead className="w-[220px] text-[9px] font-semibold text-muted-foreground">
                      Target
                    </TableHead>
                    <TableHead className="pr-4 text-[9px] font-semibold text-muted-foreground">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredLogs.map((log) => {
                    const tone = getActionTone(log.action);
                    const timestamp = formatTimestamp(log.timestamp);

                    return (
                      <TableRow
                        key={log.id}
                        className="group border-border/50 transition-colors hover:bg-muted/20"
                      >
                        <TableCell className="pl-4 align-top">
                          <div className="flex items-start gap-2">
                            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                            <div>
                              <p className="whitespace-nowrap text-[10px] font-medium text-foreground">
                                {timestamp.date}
                              </p>
                              <p className="mt-0.5 text-[9px] text-muted-foreground">
                                {timestamp.time}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="align-top">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[9px] font-bold text-muted-foreground">
                              {(log.user || 'U').slice(0, 1).toUpperCase()}
                            </div>
                            <span className="max-w-[150px] truncate text-[10px] font-medium text-foreground">
                              {log.user || 'Unknown user'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="align-top">
                          <Badge
                            variant="outline"
                            className={cn(
                              'max-w-[160px] truncate rounded-lg px-2 py-0.5 text-[8px] font-semibold',
                              tone.badge
                            )}
                          >
                            <span
                              className={cn(
                                'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
                                tone.dot
                              )}
                            />
                            {log.action || 'Unknown action'}
                          </Badge>
                        </TableCell>

                        <TableCell className="align-top">
                          <p className="max-w-[210px] break-words text-[10px] font-medium leading-4 text-foreground">
                            {log.target || '—'}
                          </p>
                        </TableCell>

                        <TableCell className="pr-4 align-top">
                          <div className="flex min-w-0 items-start gap-2">
                            <p className="line-clamp-2 min-w-0 flex-1 break-words text-[10px] leading-4 text-muted-foreground">
                              {log.details || 'No additional details.'}
                            </p>
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/25 opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Database className="h-5 w-5" />
            </div>

            <h3 className="mt-3 text-sm font-semibold text-foreground">
              No audit events found
            </h3>

            <p className="mt-1 max-w-[280px] text-[10px] leading-4 text-muted-foreground">
              Try clearing or changing the current search and filters.
            </p>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="mt-3 h-9 rounded-xl border-border/60 px-3 text-[9px] font-semibold shadow-none"
              >
                <FilterX className="mr-1.5 h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
