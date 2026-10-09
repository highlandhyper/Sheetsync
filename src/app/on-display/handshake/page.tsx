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

export function ManualHandshakePage() {
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
        <div className="min-h-[100dvh] bg-black relative overflow-hidden flex flex-col items-center justify-start pt-8 pb-12 animate-in fade-in duration-700">
            {/* ATMOSPHERIC LAYER */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 w-full max-w-[360px] px-6 flex flex-col h-full">
                {!identifiedStaff ? (
                    <div className="flex-1 flex flex-col">
                        {/* TOP NAVIGATION */}
                        <div className="flex items-center justify-between mb-12">
                            <Link 
                                href="/login" 
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white transition-all active:scale-90"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            
                            <Button variant="ghost" size="sm" className="h-8 rounded-full bg-zinc-900/80 text-[11px] text-zinc-400 px-3 hover:text-white border-none shadow-none">
                                Help?
                            </Button>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="space-y-3 mb-8 text-left">
                            <h1 className="text-3xl font-bold text-white tracking-tight">
                                Confirmation
                            </h1>
                            <p className="text-[14px] font-medium text-zinc-500">
                                Enter a 4-digit code sent to you by SMS.
                            </p>
                        </div>

                        {/* PIN SLOTS */}
                        <div className="relative flex items-center justify-start gap-3 mb-16">
                            {[0, 1, 2, 3].map((index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-all duration-300",
                                        "bg-zinc-900/30 text-white",
                                        pin.length === index && !error ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-800",
                                        error ? "border-destructive/40 bg-destructive/5" : ""
                                    )}
                                >
                                    {pin[index] ? (
                                        <span className="text-white animate-in zoom-in-75 duration-200">{pin[index]}</span>
                                    ) : (
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full bg-zinc-700 transition-all",
                                            pin.length === index && "animate-pulse bg-emerald-500"
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
                                maxLength={4}
                                value={pin}
                                onChange={handleInputChange}
                                className="absolute inset-0 h-full w-full opacity-0 cursor-default"
                                autoFocus
                            />
                        </div>

                        {/* STATUS / INFO AREA */}
                        <div className="flex flex-col items-center justify-center space-y-24">
                            <p className="text-[11px] font-medium text-zinc-600 text-center">
                                You can request a new code
                            </p>

                            <div className="flex flex-col items-center space-y-6">
                                <Link 
                                    href="/login"
                                    className="flex items-center gap-2 text-[15px] font-medium text-zinc-600 hover:text-white transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Return to Portal
                                </Link>

                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Industrial Protocol
                                </div>
                            </div>
                        </div>

                        {isVerifying && (
                            <div className="mt-8 flex items-center justify-center gap-2 text-emerald-500 animate-pulse">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Verifying Identity...</span>
                            </div>
                        )}
                        
                        {error && (
                            <div className="mt-8 flex items-center justify-center gap-2 text-destructive animate-in shake-in duration-300">
                                <ShieldAlert className="h-4 w-4 shrink-0" />
                                <p className="text-[10px] font-black leading-relaxed uppercase tracking-widest">{error}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-inner">
                            <UserCheck className="h-10 w-10" strokeWidth={2.5} />
                        </div>
                        
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500">Identity Confirmed</p>
                            <h2 className="text-5xl font-black tracking-tight text-white uppercase">{identifiedStaff.name}</h2>
                        </div>

                        <div className="p-6 bg-zinc-900/40 rounded-[2rem] border border-white/5 flex items-start gap-4 text-left">
                            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed uppercase tracking-tighter">
                                Authorized session identified. Proceed to terminal to load batch nodes.
                            </p>
                        </div>

                        <Button 
                            onClick={handleProceed}
                            className="w-full h-16 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-2xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/10 transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4" strokeWidth={4} />
                                <span>Open Terminal</span>
                            </div>
                        </Button>

                        <button 
                            onClick={() => { setIdentifiedStaff(null); setPin(''); setTimeout(() => inputRef.current?.focus(), 100); }}
                            className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 hover:text-white transition-colors"
                        >
                            Reset Protocol
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ManualHandshakePage;
