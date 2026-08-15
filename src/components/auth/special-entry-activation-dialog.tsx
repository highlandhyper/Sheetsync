'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, KeyRound, BellOff, Zap } from 'lucide-react';
import type { SpecialEntryRequest } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

interface SpecialEntryActivationDialogProps {
  session: SpecialEntryRequest;
  onActivate: (otp: string) => boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpecialEntryActivationDialog({ session, onActivate, isOpen, onOpenChange }: SpecialEntryActivationDialogProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isError, setIsError] = useState(false);

  // Clear OTP whenever the dialog opens to prevent browser autofill issues
  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setIsError(false);
    }
  }, [isOpen]);

  const handleActivate = () => {
    const success = onActivate(otp);
    if (success) {
      toast({
        title: "Silent Mode Activated",
        description: `Authorization confirmed for ${session.staffName}.`,
      });
      onOpenChange(false);
    } else {
      setIsError(true);
      setOtp("");
      toast({
        variant: "destructive",
        title: "Activation Failed",
        description: "The One-Time Password (OTP) is incorrect.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/20 shadow-2xl p-0 overflow-hidden rounded-3xl">
        <div className="bg-primary p-6 text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Security Handshake</DialogTitle>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">Personnel Authorization Required</p>
                </div>
            </div>
            <Zap className="h-5 w-5 opacity-40 animate-pulse" />
        </div>

        <div className="p-6 space-y-6">
            <div className="space-y-4">
                {/* PROMINENT KEY DISPLAY */}
                {session.otp && (
                    <div className="bg-primary/5 border-2 border-primary/10 rounded-2xl p-4 flex flex-col items-center text-center space-y-2 animate-in zoom-in-95 duration-500">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Authorization Key Found</span>
                        <div className="flex items-center gap-4">
                            <KeyRound className="h-5 w-5 text-primary opacity-40" />
                            <span className="text-4xl font-mono font-black text-primary tracking-[0.4em] leading-none ml-2">
                                {session.otp}
                            </span>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight pt-1">
                            Grant Type: <span className="text-foreground">{session.type === 'single' ? 'Single Entry' : 'Timed Session'}</span>
                        </p>
                    </div>
                )}

                <div className="text-center px-2">
                    <DialogDescription className="text-xs font-medium leading-relaxed">
                        Administrator access has been granted for <span className="font-bold text-foreground">{session.staffName === "ALL PERSONNEL (GLOBAL)" ? "ALL PERSONNEL" : session.staffName}</span>.
                        <br />Input the system key shown above to initialize silent logging.
                    </DialogDescription>
                </div>
            </div>
            
            <Separator className="bg-primary/5" />

            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block text-center">Verify Identity Key</Label>
                <div className="relative max-w-[220px] mx-auto">
                    <Input 
                        type="text" 
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4} 
                        value={otp}
                        onChange={(e) => {
                            setIsError(false);
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setOtp(val);
                        }}
                        className={isError ? "border-destructive text-center text-3xl font-mono font-black tracking-[0.5em] h-14 rounded-2xl shadow-inner bg-muted/30" : "text-center text-3xl font-mono font-black tracking-[0.5em] h-14 rounded-2xl shadow-inner bg-muted/30 border-primary/20 focus:border-primary transition-all"}
                        placeholder="----"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                    />
                </div>
            </div>
        </div>

        <div className="p-6 pt-0">
          <Button onClick={handleActivate} className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={otp.length < 4}>
            <Zap className="mr-2 h-5 w-5 fill-primary-foreground" />
            Initialize Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
