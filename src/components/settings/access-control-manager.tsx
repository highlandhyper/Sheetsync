'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import { Separator } from '../ui/separator';
import { Layout } from 'lucide-react';

export function AccessControlManager() {
  const { permissions, setPermission, setViewerDefaultPath } = useAccessControl();

  const mainNavItems = allNavItems.filter(item => item.href !== '/settings');
  const managementItems = accountNavItems.filter(item => item.href !== '/settings');

  const enabledViewerPaths = permissions.viewer || [];
  const availableLandingPages = [...allNavItems, ...accountNavItems].filter(item => 
    enabledViewerPaths.includes(item.href)
  );

  const handlePermissionChange = (path: string, isEnabled: boolean) => {
    setPermission('viewer', path, isEnabled);
  };

  const renderToggle = (item: typeof allNavItems[0]) => (
    <div key={item.href} className="flex items-center justify-between rounded-lg border bg-card p-3">
        <div className="flex items-center gap-3">
             <item.icon className="h-5 w-5 text-muted-foreground" />
            <Label htmlFor={`perm-${item.href}`} className="cursor-pointer font-medium pr-2">
                {item.label}
            </Label>
        </div>
        <Switch
        id={`perm-${item.href}`}
        checked={enabledViewerPaths.includes(item.href)}
        onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
        className="flex-shrink-0"
        />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-primary/5 p-4 space-y-3">
        <h4 className="font-bold text-primary flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Viewer Default Landing Page
        </h4>
        <p className="text-sm text-muted-foreground">
            Select the page Viewers are redirected to immediately after logging in.
        </p>
        <Select 
            value={permissions.viewerDefaultPath} 
            onValueChange={setViewerDefaultPath}
            disabled={availableLandingPages.length === 0}
        >
            <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder={availableLandingPages.length === 0 ? "Enable pages below first" : "Select landing page"} />
            </SelectTrigger>
            <SelectContent>
                {availableLandingPages.map(item => (
                    <SelectItem key={item.href} value={item.href}>
                        <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold text-lg mb-3">Main Navigation Pages</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mainNavItems.map(renderToggle)}
        </div>
      </div>
      
      <Separator />
      
       <div>
        <h4 className="font-semibold text-lg mb-3">Management Pages</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {managementItems.map(renderToggle)}
        </div>
      </div>
    </div>
  );
}
