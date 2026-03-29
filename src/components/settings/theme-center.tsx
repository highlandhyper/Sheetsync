'use client';

import { useGeneralSettings } from '@/context/general-settings-context';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { ThemePreset } from '@/lib/types';

const themes: { id: ThemePreset; name: string; color: string }[] = [
  { id: 'standard', name: 'Standard Blue', color: 'bg-sky-500' },
  { id: 'minimal', name: 'Minimal Mono', color: 'bg-zinc-800' },
  { id: 'emerald', name: 'Emerald Green', color: 'bg-emerald-600' },
  { id: 'midnight', name: 'Midnight Navy', color: 'bg-indigo-700' },
];

export function ThemeCenter() {
  const { settings, setSetting } = useGeneralSettings();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setSetting('themePreset', theme.id)}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all hover:bg-muted/50",
              settings.themePreset === theme.id 
                ? "border-primary bg-primary/5" 
                : "border-transparent bg-muted/20"
            )}
          >
            <div className={cn("h-10 w-10 rounded-full shadow-inner", theme.color)} />
            <span className="text-[10px] font-black uppercase tracking-widest">{theme.name}</span>
            {settings.themePreset === theme.id && (
              <div className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                <Check className="h-3 w-3" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
