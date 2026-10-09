'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyOnDisplayPinOnlyAction } from '@/app/actions';
import { 
    Loader2, 
    ShieldAlert, 
    ShieldCheck, 
    ArrowLeft,
    UserCheck,
    Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    
    const inputRef = useRef<HTMLInputElement>(null);

    const handleVerify = async (val?: string) => {
        const pinToVerify = val || pin;
        if (pinToVerify.length < 4) return;

        setError('');
        startTransition(async () => {
            try {
                const res = await verifyOnDisplayPinOnlyAction(pinToVerify);
                if (res.success && res.data) {
                    setIdentifiedStaff({
                        name: res.data.staffName,
                        token: res.data.token
                    });
                } else {
                    setError(res.message || "Access key rejection.");
                    setPin('');
                    inputRef.current?.focus();
                }
            } catch (e) {
                setError("Registry handshake failure.");
            }
        });
    };

    const handleProceed = () => {
        if (!identifiedStaff) return;
        router.push(`/on-display/${identifiedStaff.token}?pin=${pin}`);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setPin(val);
        setError('');
        if (val.length === 4) {
            handleVerify(val);
        }
    };

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div className="min-h-[100dvh] bg-[#09090b] relative overflow-hidden flex flex-col items-center justify-center p-8">
            {/* ATMOSPHERIC LAYER */}
            <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(41,171,226,0.05)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 w-full max-w-sm space-y-16 animate-in fade-in zoom-in-95 duration-700">
                {!identifiedStaff ? (
                    <div className="space-y-12">
                        {/* HEADER */}
                        <div className="space-y-4 text-center">
                            <h1 className="text-4xl font-bold tracking-tight text-white uppercase">
                                Confirmation
                            </h1>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest leading-relaxed opacity-60">
                                Enter the 4-digit industrial access key dispatched via SMS.
                            </p>
                        </div>

                        {/* PIN INPUT GROUP */}
                        <div className="space-y-10">
                            <div className="relative flex justify-between gap-4">
                                {[0, 1, 2, 3].map((index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "flex-1 h-20 sm:h-24 rounded-3xl flex items-center justify-center text-4xl font-black transition-all duration-300",
                                            "bg-zinc-900/30 border border-white/[0.03]",
                                            pin.length === index && !error ? "bg-primary/5 border-primary/30 shadow-[0_0_25px_rgba(41,171,226,0.15)]" : "",
                                            error ? "border-destructive/40 bg-destructive/5" : ""
                                        )}
                                    >
                                        {pin[index] ? (
                                            <span className="text-white animate-in zoom-in-75 duration-200">{pin[index]}</span>
                                        ) : (
                                            <div className={cn(
                                                "h-1.5 w-1.5 rounded-full bg-zinc-800 transition-all",
                                                pin.length === index && "animate-pulse bg-primary"
                                            )} />
                                        )}
                                    </div>
                                ))}
                                
                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={pin}
                                    onChange={handleInputChange}
                                    className="absolute inset-0 opacity-0 cursor-default"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="flex items-center justify-center gap-3 text-destructive animate-in shake-in duration-300">
                                    <ShieldAlert className="h-4 w-4 shrink-0" />
                                    <p className="text-[10px] font-black leading-relaxed uppercase tracking-[0.2em]">{error}</p>
                                </div>
                            )}

                            {isVerifying && (
                                <div className="flex items-center justify-center gap-3 text-primary animate-pulse">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verifying Identity...</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10 text-center animate-in zoom-in-95 duration-500">
                        <div className="mx-auto w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-inner">
                            <UserCheck className="h-10 w-10" strokeWidth={2.5} />
                        </div>
                        
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Identity Confirmed</p>
                            <h2 className="text-4xl font-bold tracking-tight text-white uppercase">{identifiedStaff.name}</h2>
                        </div>

                        <div className="p-6 bg-zinc-900/20 rounded-[2rem] border border-white/[0.03] flex items-start gap-4 text-left">
                            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-medium text-zinc-500 leading-relaxed uppercase tracking-tighter">
                                Authorized session identified. Proceed to terminal to load batch nodes.
                            </p>
                        </div>

                        <Button 
                            onClick={handleProceed}
                            className="w-full h-16 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl bg-primary text-white hover:bg-primary/90 shadow-primary/10 transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4" strokeWidth={4} />
                                <span>Open Terminal</span>
                            </div>
                        </Button>

                        <button 
                            onClick={() => { setIdentifiedStaff(null); setPin(''); setTimeout(() => inputRef.current?.focus(), 100); }}
                            className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700 hover:text-white transition-colors"
                        >
                            Reset Protocol
                        </button>
                    </div>
                )}

                {/* FOOTER */}
                <div className="pt-12 flex flex-col items-center gap-8">
                    {!identifiedStaff && (
                        <Button variant="ghost" asChild className="h-10 rounded-xl px-4 text-zinc-600 hover:text-white hover:bg-white/[0.03] transition-colors">
                            <Link href="/login">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Return to Portal
                            </Link>
                        </Button>
                    )}
                    
                    <div className="flex items-center justify-center gap-3 text-[8px] font-black uppercase tracking-[0.6em] text-zinc-800">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Industrial Protocol
                    </div>
                </div>
            </div>
        </div>
    );
}
