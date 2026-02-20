'use client';

import { useGeneralSettings } from '@/context/general-settings-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function AdminWelcomeToggle() {
  const { settings, setSetting, isInitialized } = useGeneralSettings();

  if (!isInitialized) return null;

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="admin-welcome-mode"
        checked={settings.showAdminWelcome}
        onCheckedChange={(checked) => setSetting('showAdminWelcome', checked)}
      />
      <Label htmlFor="admin-welcome-mode" className="cursor-pointer">
        {settings.showAdminWelcome ? "Enabled" : "Disabled"}
      </Label>
    </div>
  );
}
