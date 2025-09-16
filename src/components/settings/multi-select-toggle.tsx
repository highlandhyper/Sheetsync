
'use client';

import { useMultiSelect } from '@/context/multi-select-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function MultiSelectToggle() {
  const { isMultiSelectEnabled, setIsMultiSelectEnabled } = useMultiSelect();

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="multi-select-mode"
        checked={isMultiSelectEnabled}
        onCheckedChange={setIsMultiSelectEnabled}
      />
      <Label htmlFor="multi-select-mode" className="cursor-pointer">
        {isMultiSelectEnabled ? "Enabled" : "Disabled"}
      </Label>
    </div>
  );
}
