
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
        <div className="space-y-4">
          {viewerNavItems.map(item => (
            <div key={item.href} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/50">
              <Label htmlFor={`perm-${item.href}`} className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.href}</span>
              </Label>
              <Switch
                id={`perm-${item.href}`}
                checked={permissions.viewer.includes(item.href)}
                onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
                className="self-end sm:self-center"
              />
            </div>
          ))}
        </div>
      </div>
      <Separator />
       <div>
        <h4 className="font-semibold text-lg mb-3">Account & Management Pages</h4>
        <div className="space-y-4">
          {viewerAccountItems.map(item => (
            <div key={item.href} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/50">
              <Label htmlFor={`perm-${item.href}`} className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.href}</span>
              </Label>
              <Switch
                id={`perm-${item.href}`}
                checked={permissions.viewer.includes(item.href)}
                onCheckedChange={(checked) => handlePermissionChange(item.href, checked)}
                className="self-end sm:self-center"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
