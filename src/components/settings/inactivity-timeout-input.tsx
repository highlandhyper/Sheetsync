'use client';

import { useGeneralSettings } from '@/context/general-settings-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function InactivityTimeoutInput() {
  const { settings, setSetting, isInitialized } = useGeneralSettings();

  if (!isInitialized) return null;

  return (
    <div className="flex items-center space-x-2">
      <Input
        id="inactivity-timeout"
        type="number"
        min="1"
        value={settings.inactivityTimeout}
        onChange={(e) => {
          const value = parseInt(e.target.value, 10);
          if (value >= 1) { // Basic validation: ensure it's at least 1 minute
            setSetting('inactivityTimeout', value)
          } else if (e.target.value === '') {
            setSetting('inactivityTimeout', 1); // Or handle empty string case as you see fit
          }
        }}
        className="w-24"
      />
      <Label htmlFor="inactivity-timeout" className="cursor-pointer">minutes</Label>
    </div>
  );
}
