
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyOnDisplayPinOnlyAction } from '@/app/actions';
import { 
    LockKeyhole, 
    ChevronRight, 
    Loader2, 
    ShieldAlert, 
    ShieldCheck, 
    KeyRound, 
    SmartphoneNfc,
    ArrowLeft,
    UserCheck,
    Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ManualHandshakePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isVerifying, startTransition] = useTransition();

    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [identifiedStaff, setIdentifiedStaff] = useState<{ name: string; token: string } | null>(null);

    const handleVerify = async () => {
        if (pin.length < 4) return;

        setError('');
        startTransition(async () => {
            try {
                const res = await verifyOnDisplayPinOnlyAction(pin);
                if (res.success && res.data) {
                    setIdentifiedStaff({
                        name: res.data.staffName,
                        token: res.data.token
                    });
                    toast({
                        title: "Identification Successful",
                        description: `Personnel recognized: ${res.data.staffName}`,
                    });
                } else {
                    setError(res.message || "Invalid Access Key.");
                }
            } catch (e) {
                setError("Registry connection failure. Try again.");
            }
        });
    };

    const handleProceed = () => {
        if (!identifiedStaff) return;
        router.push(`/on-display/${identifiedStaff.token}?pin=${pin}`);
    };

    return (
        <div className="min-h-[100dvh] bg-background relative overflow-hidden flex flex-col items-center justify-center p-5">
            {/* ATMOSPHERIC LAYER */}
            <div className="absolute inset-0 bg-tech-grid opacity-20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center space-y-3">
                    <div className="mx-auto w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-6 ring-8 ring-primary/5 shadow-2xl shadow-primary/10">
                        <SmartphoneNfc className="h-10 w-10 text-primary" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">
                        Registry <span className="text-primary">Handshake</span>
                    </h1>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">
                        Secure Industrial Identification
                    </p>
                </div>

                {!identifiedStaff ? (
                    <Card className="rounded-[2.5rem] border-border/60 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-3xl animate-in fade-in duration-500">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="handshake-pin" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                    Security PIN (From SMS)
                                </Label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        id="handshake-pin"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="••••"
                                        value={pin}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setPin(val);
                                            setError('');
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                                        className="h-14 rounded-2xl bg-muted/20 border-none pl-11 text-2xl font-black tracking-[0.5em] text-center placeholder:tracking-normal placeholder:text-muted-foreground/20 focus-visible:ring-primary/20 shadow-inner"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter ml-1">
                                    Enter the 4-digit code provided in your SMS alert.
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 animate-in shake-in duration-300">
                                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold leading-relaxed uppercase tracking-tighter">{error}</p>
                                </div>
                            )}

                            <Button 
                                onClick={handleVerify}
                                disabled={pin.length < 4 || isVerifying}
                                className="w-full h-16 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                {isVerifying ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>Verify Identity</span>
                                        <ChevronRight className="h-5 w-5" />
                                    </div>
                                )}
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <Card className="rounded-[2.5rem] border-primary/20 bg-primary/[0.04] backdrop-blur-xl p-6 sm:p-8 shadow-3xl animate-in zoom-in-95 duration-500">
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
                                <UserCheck className="h-8 w-8" strokeWidth={2} />
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Identity Confirmed</p>
                                <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">{identifiedStaff.name}</h2>
                            </div>

                            <div className="p-4 bg-background/60 rounded-2xl border border-primary/10 flex items-start gap-3 text-left">
                                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase tracking-tighter">
                                    Security session identified. Tapping "Open Terminal" will load your specific batch nodes from the registry.
                                </p>
                            </div>

                            <Button 
                                onClick={handleProceed}
                                className="w-full h-16 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl bg-primary text-white hover:bg-primary/90 shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-2">
                                    <Check className="h-5 w-5" strokeWidth={3} />
                                    <span>Open Terminal</span>
                                </div>
                            </Button>

                            <button 
                                onClick={() => { setIdentifiedStaff(null); setPin(''); }}
                                className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-destructive transition-colors"
                            >
                                Not {identifiedStaff.name}? Switch PIN
                            </button>
                        </div>
                    </Card>
                )}

                <div className="pt-4 flex flex-col items-center gap-6">
                    <Button variant="ghost" asChild className="h-10 rounded-xl px-4 text-muted-foreground/60 hover:text-foreground">
                        <Link href="/login">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Login
                        </Link>
                    </Button>
                    
                    <div className="flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.4em] text-muted-foreground/20">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Registry Handshake Protocol v2.0
                    </div>
                </div>
            </div>
        </div>
    );
}
