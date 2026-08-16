
'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function AudioFeedbackToggle() {
  const { permissions, setAudioPermission } = useAccessControl();

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="audio-feedback-mode"
        checked={permissions.isAudioEnabled !== false}
        onCheckedChange={setAudioPermission}
      />
      <Label htmlFor="audio-feedback-mode" className="cursor-pointer font-bold">
        {permissions.isAudioEnabled !== false ? "Enabled (Global)" : "Disabled (Global)"}
      </Label>
    </div>
  );
}
