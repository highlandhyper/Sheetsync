
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
    <div className="space-y-4">
      <audio ref={audioRef} src="/whoareyou.mp3" preload="auto" />
      <audio ref={audio1Ref} src="/whoareyou1.mp3" preload="auto" />
      
      {/* GRANULAR TOGGLE - Compact Version */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", isEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
            {isEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </div>
          <Label htmlFor="identity-audio-toggle" className="font-black uppercase text-[10px] tracking-widest cursor-pointer">
            Enable Voice Prompt
          </Label>
        </div>
        <Switch 
            id="identity-audio-toggle" 
            checked={isEnabled} 
            onCheckedChange={setIdentityAudioEnabled} 
            className="scale-90"
        />
      </div>

      <div className={cn("space-y-3 transition-all duration-300", !isEnabled && "opacity-40 pointer-events-none grayscale")}>
          <RadioGroup 
            value={permissions.identityAudioType || 'whoareyou'} 
            onValueChange={(v: any) => setIdentityAudioType(v)}
            className="grid grid-cols-1 gap-2"
          >
            <div className="flex items-center justify-between p-2.5 rounded-xl border bg-background hover:bg-muted/5 transition-colors">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="whoareyou" id="audio-v1" className="h-3.5 w-3.5" />
                <Label htmlFor="audio-v1" className="font-bold text-xs cursor-pointer">
                  Standard (V1)
                </Label>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0 text-primary hover:bg-primary/10" 
                onClick={(e) => { e.preventDefault(); playPreview('whoareyou'); }}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </Button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl border bg-background hover:bg-muted/5 transition-colors">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="whoareyou1" id="audio-v2" className="h-3.5 w-3.5" />
                <Label htmlFor="audio-v2" className="font-bold text-xs cursor-pointer">
                  Alternate (V2)
                </Label>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0 text-primary hover:bg-primary/10" 
                onClick={(e) => { e.preventDefault(); playPreview('whoareyou1'); }}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </Button>
            </div>
          </RadioGroup>
      </div>
    </div>
  );
}
