'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import { Separator } from '../ui/separator';

export function AccessControlManager() {
  const { permissions, setPermission } = useAccessControl();

  // We can group them for display purposes
  const mainNavItems = allNavItems.filter(item => item.href !== '/settings');
  const managementItems = accountNavItems.filter(item => item.href !== '/settings');


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
        checked={permissions.viewer.includes(item.href)}
        onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
        className="flex-shrink-0"
        />
    </div>
  );

  return (
    <div className="space-y-6">
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
