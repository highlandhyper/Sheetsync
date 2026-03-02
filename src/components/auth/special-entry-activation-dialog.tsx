'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocalSettingsAuth } from '@/context/local-settings-auth-context';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, KeyRound, Clock, BellOff } from 'lucide-react';
import type { SpecialEntryRequest } from '@/lib/types';

interface SpecialEntryActivationDialogProps {
  session: SpecialEntryRequest;
  onActivate: () => void;
}

export function SpecialEntryActivationDialog({ session, onActivate }: SpecialEntryActivationDialogProps) {
  const { verifyPin } = useLocalSettingsAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);

  const handleActivate = () => {
    if (verifyPin(pin)) {
      toast({
        title: "Silent Mode Activated",
        description: `Authorization confirmed for ${session.staffName}.`,
      });
      onActivate();
    } else {
      setIsError(true);
      setPin("");
      toast({
        variant: "destructive",
        title: "Activation Failed",
        description: "The 4-digit Admin PIN is incorrect.",
      });
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md border-primary/20 shadow-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center items-center">
          <div className="bg-primary/10 p-4 rounded-full mb-2">
            <BellOff className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">Activate Silent Mode</DialogTitle>
          <DialogDescription className="text-center">
            Access has been granted for <span className="font-bold text-foreground">{session.staffName}</span> ({session.type === 'single' ? 'Single Entry' : `${session.durationMinutes} Minutes`}). 
            <br />Please enter the <span className="font-bold">4-Digit Admin PIN</span> to proceed.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 space-y-4">
          <div className="space-y-2 text-center">
            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Administrator Verification</Label>
            <div className="relative max-w-[200px] mx-auto">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="password" 
                    maxLength={4} 
                    value={pin}
                    onChange={(e) => {
                        setIsError(false);
                        setPin(e.target.value);
                    }}
                    className={isError ? "border-destructive text-center text-2xl tracking-[0.5em] font-mono h-12" : "text-center text-2xl tracking-[0.5em] font-mono h-12"}
                    placeholder="****"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleActivate} className="w-full h-12 text-lg font-bold" disabled={pin.length < 4}>
            <ShieldCheck className="mr-2 h-5 w-5" />
            Activate Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
