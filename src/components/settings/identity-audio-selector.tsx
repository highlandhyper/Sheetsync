
'use client';

import { useAccessControl } from '@/context/access-control-context';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Play, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

export function IdentityAudioSelector() {
  const { permissions, setIdentityAudioType } = useAccessControl();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audio1Ref = useRef<HTMLAudioElement | null>(null);

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
      
      <RadioGroup 
        value={permissions.identityAudioType || 'whoareyou'} 
        onValueChange={(v: any) => setIdentityAudioType(v)}
        className="grid grid-cols-1 gap-3"
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
  );
}
