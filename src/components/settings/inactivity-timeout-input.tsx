
'use client';

import { useGeneralSettings } from '@/context/general-settings-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function InactivityTimeoutInput() {
  const { settings, setSetting, isInitialized } = useGeneralSettings();

  if (!isInitialized) return null;

  const handleEnabledChange = (enabled: boolean) => {
    setSetting('isLockOnInactivityEnabled', enabled);
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 1) {
      setSetting('inactivityTimeout', value);
    } else if (e.target.value === '') {
      setSetting('inactivityTimeout', 1);
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Label htmlFor="inactivity-lock-enabled" className="cursor-pointer font-medium">
                Enable Automatic Session Lock
            </Label>
            <Switch
                id="inactivity-lock-enabled"
                checked={settings.isLockOnInactivityEnabled}
                onCheckedChange={handleEnabledChange}
            />
        </div>
        <div className={cn("space-y-2", !settings.isLockOnInactivityEnabled && "opacity-50 pointer-events-none")}>
            <Label htmlFor="inactivity-timeout" className={cn(!settings.isLockOnInactivityEnabled && "cursor-not-allowed")}>Timeout duration</Label>
            <div className="flex items-center space-x-2">
                <Input
                    id="inactivity-timeout"
                    type="number"
                    min="1"
                    value={settings.inactivityTimeout}
                    onChange={handleTimeoutChange}
                    className="w-24"
                    disabled={!settings.isLockOnInactivityEnabled}
                />
                <span className="text-sm text-muted-foreground">minutes</span>
            </div>
             <p className="text-xs text-muted-foreground">
                Set the automatic lock time due to inactivity (min. 1).
            </p>
        </div>
    </div>
  );
}
