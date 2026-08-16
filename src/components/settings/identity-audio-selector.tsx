
'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Play, Music, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

export function IdentityAudioSelector() {
  const { permissions, setIdentityAudioType, setIdentityAudioEnabled } = useAccessControl();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audio1Ref = useRef<HTMLAudioElement | null>(null);

  const isEnabled = permissions.isIdentityAudioEnabled !== false;

  const playPreview = (type: 'whoareyou' | 'whoareyou1') => {
    const audio = type === 'whoareyou1' ? audio1Ref.current : audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      <audio ref={audioRef} src="/whoareyou.mp3" preload="auto" />
      <audio ref={audio1Ref} src="/whoareyou1.mp3" preload="auto" />
      
      {/* GRANULAR TOGGLE */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", isEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
            {isEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </div>
          <div className="space-y-0.5">
            <Label htmlFor="identity-audio-toggle" className="font-black uppercase text-xs tracking-widest cursor-pointer">
              Enable Prompt
            </Label>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Activate "Who are you?" sound.</p>
          </div>
        </div>
        <Switch 
            id="identity-audio-toggle" 
            checked={isEnabled} 
            onCheckedChange={setIdentityAudioEnabled} 
        />
      </div>

      <Separator className="opacity-50" />

      <div className={cn("space-y-4 transition-all duration-300", !isEnabled && "opacity-40 pointer-events-none grayscale")}>
          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Voice Selection</Label>
          <RadioGroup 
            value={permissions.identityAudioType || 'whoareyou'} 
            onValueChange={(v: any) => setIdentityAudioType(v)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div className="flex items-center justify-between p-4 rounded-2xl border bg-background hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="whoareyou" id="audio-v1" />
                <Label htmlFor="audio-v1" className="font-bold cursor-pointer">
                  Standard Voice (V1)
                </Label>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-primary" 
                onClick={(e) => { e.preventDefault(); playPreview('whoareyou'); }}
              >
                <Play className="h-4 w-4 fill-current" />
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border bg-background hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="whoareyou1" id="audio-v2" />
                <Label htmlFor="audio-v2" className="font-bold cursor-pointer">
                  Alternate Voice (V2)
                </Label>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-primary" 
                onClick={(e) => { e.preventDefault(); playPreview('whoareyou1'); }}
              >
                <Play className="h-4 w-4 fill-current" />
              </Button>
            </div>
          </RadioGroup>
      </div>
    </div>
  );
}
