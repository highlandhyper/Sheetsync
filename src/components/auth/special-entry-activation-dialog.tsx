
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import type { SpecialEntryRequest } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

interface SpecialEntryActivationDialogProps {
  session: SpecialEntryRequest;
  onActivate: (otp: string) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpecialEntryActivationDialog({ session, onActivate, isOpen, onOpenChange }: SpecialEntryActivationDialogProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isError, setIsError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setIsError(false);
    }
  }, [isOpen]);

  const handleActivate = async () => {
    setIsVerifying(true);
    const success = await onActivate(otp);
    setIsVerifying(false);
    
    if (success) {
      toast({
        title: "Silent Mode Activated",
        description: `Authorization confirmed for ${session.staffName}.`,
      });
      onOpenChange(false);
    } else {
      setIsError(true);
      setOtp("");
      // Logic handled in verifyOtpAction for blocking/expiry
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md border-primary/20 shadow-2xl p-0 overflow-hidden rounded-3xl"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="bg-primary p-6 text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Security Handshake</DialogTitle>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">Identity Verification Protocol</p>
                </div>
            </div>
        </div>

        <div className="p-6 space-y-6">
            <div className="space-y-4">
                <div className="text-center px-2">
                    <DialogDescription className="text-xs font-medium leading-relaxed">
                        Access granted for <span className="font-bold text-foreground">{session.staffName === "ALL PERSONNEL (GLOBAL)" ? "ALL PERSONNEL" : session.staffName}</span>.
                        <br /><br />
                        Identify your personnel session by entering the 4-digit key dispatched via the SMS Gateway.
                    </DialogDescription>
                </div>
            </div>
            
            <Separator className="bg-primary/5" />

            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block text-center">Verify Hashed Identity Key</Label>
                <div className="relative max-w-[220px] mx-auto">
                    <Input 
                        type="text" 
                        inputMode="numeric" 
                        autoComplete="off"
                        maxLength={4} 
                        value={otp}
                        disabled={isVerifying}
                        onChange={(e) => {
                            setIsError(false);
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setOtp(val);
                        }}
                        className={isError ? "border-destructive text-center text-3xl font-mono font-black tracking-[0.5em] h-14 rounded-2xl shadow-inner bg-muted/30" : "text-center text-3xl font-mono font-black tracking-[0.5em] h-14 rounded-2xl shadow-inner bg-muted/30 border-primary/20 focus:border-primary transition-all"}
                        placeholder="----"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && otp.length === 4 && handleActivate()}
                    />
                </div>
            </div>

            {session.verificationAttempts && session.verificationAttempts > 0 && (
                <p className="text-center text-[10px] font-black uppercase text-destructive animate-pulse tracking-widest">
                    Attempt {session.verificationAttempts}/3
                </p>
            )}
        </div>

        <div className="p-6 pt-0">
          <Button onClick={handleActivate} className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={otp.length < 4 || isVerifying}>
            {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Initialize"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
