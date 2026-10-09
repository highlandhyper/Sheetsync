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
    const [resendSeconds, setResendSeconds] = useState(46);
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

    useEffect(() => {
        if (resendSeconds <= 0 || identifiedStaff) return;
        const timer = window.setInterval(() => {
            setResendSeconds((seconds) => Math.max(0, seconds - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [resendSeconds, identifiedStaff]);

    return (
        <div className="min-h-[100dvh] bg-black relative overflow-hidden flex flex-col items-start justify-start px-6 pt-6 pb-8 sm:px-8 sm:pt-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* ATMOSPHERIC LAYER */}
            <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(41,171,226,0.05)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 mx-auto w-full max-w-[320px] space-y-0">
                {!identifiedStaff ? (
                    <div className="space-y-5">
                        {/* HEADER */}
                        <div className="space-y-1.5 text-left">
                            <div className="mb-7 flex items-center justify-between">
                                <Link 
                                    href="/login" 
                                    aria-label="Back to login" 
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all active:scale-90"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                                <span className="rounded-full bg-zinc-900/30 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Security Node</span>
                            </div>
                            <h1 className="text-[20px] font-black tracking-tight text-white uppercase">
                                Confirmation
                            </h1>
                            <p className="max-w-[290px] text-[11px] font-medium leading-relaxed text-zinc-500 uppercase tracking-tight opacity-60">
                                Enter the 4-digit industrial access key dispatched via SMS.
                            </p>
                        </div>

                        {/* PIN INPUT GROUP */}
                        <div className="space-y-6 pt-2">
                            <div
                                className="relative flex w-full items-center justify-between gap-3"
                                onClick={() => inputRef.current?.focus()}
                            >
                                {[0, 1, 2, 3].map((index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "flex h-[72px] flex-1 shrink-0 items-center justify-center rounded-2xl border text-3xl font-black transition-all duration-200",
                                            "border-zinc-800 bg-zinc-900/30 text-white shadow-inner",
                                            pin.length === index && !error ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(41,171,226,0.1)]" : "",
                                            error ? "border-destructive/40 bg-destructive/5" : ""
                                        )}
                                    >
                                        {pin[index] ? (
                                            <span className="text-white animate-in zoom-in-75 duration-200">{pin[index]}</span>
                                        ) : (
                                            <span className={cn(
                                                "h-1.5 w-1.5 rounded-full bg-zinc-700 transition-all duration-300",
                                                pin.length === index && "bg-primary animate-pulse"
                                            )} />
                                        )}
                                    </div>
                                ))}

                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]*"
                                    aria-label="4-digit verification code"
                                    maxLength={4}
                                    value={pin}
                                    onChange={handleInputChange}
                                    className="absolute inset-0 h-full w-full cursor-text opacity-0"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="flex items-center justify-center gap-2 text-destructive animate-in shake-in duration-300">
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    <p className="text-[10px] font-black leading-relaxed uppercase tracking-[0.15em]">{error}</p>
                                </div>
                            )}

                            {!error && !isVerifying && (
                                <p className="pt-20 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-700">
                                    {resendSeconds > 0 ? `Resend key in 00:${String(resendSeconds).padStart(2, '0')}` : 'Key request available'}
                                </p>
                            )}

                            {isVerifying && (
                                <div className="flex items-center justify-center gap-2 text-primary animate-pulse pt-20">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verifying Node...</span>
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
            </div>
        </div>
    );
}
