
'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { allNavItems, accountNavItems } from '@/lib/nav-config';
import { Separator } from '../ui/separator';

export function AccessControlManager() {
  const { permissions, setPermission } = useAccessControl();

  const viewerNavItems = allNavItems.filter(item => item.roles.includes('admin'));
  const viewerAccountItems = accountNavItems.filter(item => item.href !== '/settings' && item.roles.includes('admin'));

  const handlePermissionChange = (path: string, isEnabled: boolean) => {
    setPermission('viewer', path, isEnabled);
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-lg mb-3">Main Navigation Pages</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {viewerNavItems.map(item => (
            <div key={item.href} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <Label htmlFor={`perm-${item.href}`} className="cursor-pointer pr-2">
                  <span className="font-medium block">{item.label}</span>
                  <span className="text-xs text-muted-foreground block break-all">{item.href}</span>
              </Label>
              <Switch
                id={`perm-${item.href}`}
                checked={permissions.viewer.includes(item.href)}
                onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
                className="flex-shrink-0"
              />
            </div>
          ))}
        </div>
      </div>
      <Separator />
       <div>
        <h4 className="font-semibold text-lg mb-3">Account & Management Pages</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {viewerAccountItems.map(item => (
            <div key={item.href} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <Label htmlFor={`perm-${item.href}`} className="cursor-pointer pr-2">
                  <span className="font-medium block">{item.label}</span>
                  <span className="text-xs text-muted-foreground block break-all">{item.href}</span>
              </Label>
              <Switch
                id={`perm-${item.href}`}
                checked={permissions.viewer.includes(item.href)}
                onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
                className="flex-shrink-0"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
