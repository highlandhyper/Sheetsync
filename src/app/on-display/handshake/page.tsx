'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyOnDisplayTokenAction } from '@/app/actions';
import { 
    LockKeyhole, 
    ChevronRight, 
    Loader2, 
    ShieldAlert, 
    ShieldCheck, 
    KeyRound, 
    SmartphoneNfc,
    ArrowLeft
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

    const [sessionId, setSessionId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleVerify = async () => {
        if (!sessionId.trim() || pin.length < 4) return;

        setError('');
        startTransition(async () => {
            try {
                const res = await verifyOnDisplayTokenAction(sessionId.trim(), pin);
                if (res.success) {
                    toast({
                        title: "Handshake Successful",
                        description: "Identity verified. Opening terminal...",
                    });
                    // Redirect to the dynamic route with the pin in query to auto-unlock
                    router.push(`/on-display/${sessionId.trim()}?pin=${pin}`);
                } else {
                    setError(res.message || "Invalid Session ID or PIN.");
                }
            } catch (e) {
                setError("Registry connection failure. Try again.");
            }
        });
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
                        Manual <span className="text-primary">Handshake</span>
                    </h1>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">
                        Cross-Device Access Terminal
                    </p>
                </div>

                <Card className="rounded-[2.5rem] border-border/60 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-3xl">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="session-id" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                Session ID (From SMS)
                            </Label>
                            <div className="relative group">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    id="session-id"
                                    placeholder="ENTER TOKEN..."
                                    value={sessionId}
                                    onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                                    className="h-14 rounded-2xl bg-muted/20 border-none pl-11 font-mono text-sm font-bold tracking-widest placeholder:text-muted-foreground/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="handshake-pin" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                                Security PIN
                            </Label>
                            <div className="relative group">
                                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                <Input 
                                    id="handshake-pin"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    className="h-14 rounded-2xl bg-muted/20 border-none pl-11 text-2xl font-black tracking-[0.5em] text-center placeholder:tracking-normal placeholder:text-muted-foreground/20"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 animate-in shake-in duration-300">
                                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold leading-relaxed">{error}</p>
                            </div>
                        )}

                        <Button 
                            onClick={handleVerify}
                            disabled={!sessionId || pin.length < 4 || isVerifying}
                            className="w-full h-16 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            {isVerifying ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span>Initiate Handshake</span>
                                    <ChevronRight className="h-5 w-5" />
                                </div>
                            )}
                        </Button>
                    </div>
                </Card>

                <div className="pt-4 flex flex-col items-center gap-6">
                    <Button variant="ghost" asChild className="h-10 rounded-xl px-4 text-muted-foreground/60 hover:text-foreground">
                        <Link href="/login">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Login
                        </Link>
                    </Button>
                    
                    <div className="flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.4em] text-muted-foreground/20">
                        <ShieldCheck className="h-3 w-3" />
                        Registry Protocol Secure
                    </div>
                </div>
            </div>
        </div>
    );
}
