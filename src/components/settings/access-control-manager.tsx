'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import {
  Layout,
  ShieldCheck,
  FileText,
  Printer,
  Undo2,
  Edit,
  Trash2,
  Globe,
  ChevronRight,
  CheckCircle2,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import type { ViewerFeature } from '@/lib/types';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function AccessControlManager() {
  const {
    permissions,
    setPermission,
    setFeaturePermission,
    setViewerDefaultPath,
  } = useAccessControl();

  const mainNavItems = allNavItems.filter((item) => item.href !== '/settings');
  const managementItems = accountNavItems.filter(
    (item) => item.href !== '/settings'
  );

  const enabledViewerPaths = permissions.viewer || [];
  const enabledViewerFeatures = permissions.viewerFeatures || [];

  const availableLandingPages = [...allNavItems, ...accountNavItems].filter(
    (item) => enabledViewerPaths.includes(item.href)
  );

  const viewerFeaturesList: {
    id: ViewerFeature;
    label: string;
    icon: any;
    description: string;
  }[] = [
    {
      id: 'EXPORT_PDF',
      label: 'Export PDF Reports',
      icon: FileText,
      description: 'Allow viewers to generate and download inventory PDF reports.',
    },
    {
      id: 'PRINT_RECORDS',
      label: 'Print Records',
      icon: Printer,
      description: 'Allow viewers to print inventory lists and records.',
    },
    {
      id: 'PROCESS_RETURN',
      label: 'Process Returns',
      icon: Undo2,
      description: 'Allow viewers to process stock returns.',
    },
    {
      id: 'EDIT_INVENTORY',
      label: 'Edit Logs',
      icon: Edit,
      description: 'Allow viewers to modify existing inventory log entries.',
    },
    {
      id: 'DELETE_INVENTORY',
      label: 'Delete Records',
      icon: Trash2,
      description: 'Allow viewers to permanently remove inventory records.',
    },
  ];

  const handlePermissionChange = (path: string, isEnabled: boolean) => {
    setPermission('viewer', path, isEnabled);
  };

  const handleFeatureToggle = (
    feature: ViewerFeature,
    isEnabled: boolean
  ) => {
    setFeaturePermission(feature, isEnabled);
  };

  const renderPagePermission = (item: typeof allNavItems[0]) => {
    const isEnabled = enabledViewerPaths.includes(item.href);

    return (
      <div
        key={item.href}
        className={cn(
          'group flex min-w-0 items-center gap-3 px-3 py-3 transition-colors sm:px-4',
          isEnabled ? 'bg-primary/[0.025]' : 'hover:bg-muted/30'
        )}
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
            isEnabled
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <item.icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <Label
            htmlFor={`perm-${item.href}`}
            className="block cursor-pointer truncate text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]"
          >
            {item.label}
          </Label>
          <p className="mt-0.5 truncate font-mono text-[8px] text-muted-foreground/70 sm:text-[9px]">
            {item.href}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'hidden text-[8px] font-semibold uppercase tracking-[0.08em] sm:inline',
              isEnabled ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {isEnabled ? 'Visible' : 'Hidden'}
          </span>
          <Switch
            id={`perm-${item.href}`}
            checked={isEnabled}
            onCheckedChange={(checked) =>
              handlePermissionChange(item.href, checked)
            }
            className="shrink-0"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Overview */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Viewer access
              </h3>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                Control which pages and actions are available to viewer accounts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Badge
            variant="secondary"
            className="rounded-lg border-0 bg-muted px-2.5 py-1 text-[8px] font-semibold"
          >
            {enabledViewerPaths.length} pages
          </Badge>
          <Badge
            variant="secondary"
            className="rounded-lg border-0 bg-muted px-2.5 py-1 text-[8px] font-semibold"
          >
            {enabledViewerFeatures.length} actions
          </Badge>
        </div>
      </div>

      {/* Default landing page */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex min-w-0 items-start gap-3 px-3.5 py-3.5 sm:px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="truncate text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
                Default landing page
              </h4>
              {permissions.viewerDefaultPath && (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              )}
            </div>
            <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground sm:text-[10px]">
              Choose the first page viewers see after signing in.
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 bg-muted/[0.18] px-3.5 py-3 sm:px-4">
          <Select
            value={permissions.viewerDefaultPath}
            onValueChange={setViewerDefaultPath}
            disabled={availableLandingPages.length === 0}
          >
            <SelectTrigger className="h-10 w-full min-w-0 rounded-xl border-border/60 bg-background px-3 text-left text-[11px] font-medium shadow-none">
              <SelectValue
                placeholder={
                  availableLandingPages.length === 0
                    ? 'Enable at least one page first'
                    : 'Select landing page'
                }
              />
            </SelectTrigger>

            <SelectContent className="max-w-[calc(100vw-1.5rem)] rounded-xl">
              {availableLandingPages.map((item) => (
                <SelectItem key={item.href} value={item.href}>
                  <div className="flex min-w-0 items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="pages" className="w-full min-w-0">
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1">
          <TabsTrigger
            value="pages"
            className="min-w-0 rounded-lg px-2 text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-[10px]"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Pages
          </TabsTrigger>

          <TabsTrigger
            value="features"
            className="min-w-0 rounded-lg px-2 text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-[10px]"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="pages"
          className="mt-3 min-w-0 outline-none animate-in fade-in duration-200"
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-2.5 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-foreground">
                  Page visibility
                </p>
                <p className="mt-0.5 text-[8px] text-muted-foreground sm:text-[9px]">
                  Pages enabled here appear in the viewer navigation.
                </p>
              </div>
              <Layout className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </div>

            <div className="divide-y divide-border/50">
              {mainNavItems.map(renderPagePermission)}
              {managementItems.map(renderPagePermission)}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="features"
          className="mt-3 min-w-0 outline-none animate-in fade-in duration-200"
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-2.5 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-foreground">
                  Allowed actions
                </p>
                <p className="mt-0.5 text-[8px] text-muted-foreground sm:text-[9px]">
                  Grant only the actions a viewer needs.
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </div>

            <div className="divide-y divide-border/50">
              {viewerFeaturesList.map((feature) => {
                const isEnabled = enabledViewerFeatures.includes(feature.id);
                const isDestructive = feature.id === 'DELETE_INVENTORY';

                return (
                  <div
                    key={feature.id}
                    className={cn(
                      'flex min-w-0 items-center gap-3 px-3.5 py-3.5 transition-colors sm:px-4',
                      isEnabled && !isDestructive && 'bg-primary/[0.025]',
                      isEnabled && isDestructive && 'bg-destructive/[0.025]',
                      !isEnabled && 'hover:bg-muted/30'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        isDestructive
                          ? 'bg-destructive/10 text-destructive'
                          : isEnabled
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <feature.icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor={`feature-${feature.id}`}
                        className="block cursor-pointer text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]"
                      >
                        {feature.label}
                      </Label>
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-muted-foreground sm:text-[10px]">
                        {feature.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/30 sm:block" />
                      <Switch
                        id={`feature-${feature.id}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          handleFeatureToggle(feature.id, checked)
                        }
                        className="shrink-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
