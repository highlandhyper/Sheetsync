'use client';

import { useDataCache } from '@/context/data-cache-context';
import { RefreshCw, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export function SyncStatusIndicator() {
  const { isSyncing, isOnline, pendingActions } = useDataCache();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<'syncing' | 'complete' | 'offline'>('syncing');

  useEffect(() => {
    if (isSyncing) {
      setShow(true);
      setStatus('syncing');
    } else if (show && status === 'syncing') {
      setStatus('complete');
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
    
    if (!isOnline) {
      setShow(true);
      setStatus('offline');
    } else if (status === 'offline' && isOnline) {
       setStatus('complete');
       setTimeout(() => setShow(false), 3000);
    }
  }, [isSyncing, isOnline, show, status]);

  if (!show) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none px-4 w-full max-w-sm">
        <div className={cn(
            "flex items-center justify-between gap-4 px-6 py-4 rounded-[2rem] border shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] backdrop-blur-3xl transition-all duration-700 animate-in fade-in slide-in-from-top-8 zoom-in-95",
            status === 'syncing' && "bg-white/80 dark:bg-zinc-900/80 border-primary/20 text-primary",
            status === 'complete' && "bg-white/80 dark:bg-zinc-900/80 border-green-500/20 text-green-600",
            status === 'offline' && "bg-destructive/10 border-destructive/20 text-destructive"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "p-2 rounded-xl transition-all duration-500",
                    status === 'syncing' && "bg-primary/10 animate-pulse",
                    status === 'complete' && "bg-green-500/10",
                    status === 'offline' && "bg-destructive/20"
                )}>
                    {status === 'syncing' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={3} />
                    ) : status === 'complete' ? (
                        <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
                    ) : (
                        <WifiOff className="h-4 w-4" strokeWidth={3} />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">
                        {status === 'syncing' ? "Syncing Registry" : status === 'complete' ? "Sync Complete" : "Registry Link Lost"}
                    </span>
                    <span className="text-[8px] font-bold uppercase opacity-40 mt-1 tracking-widest">
                        {status === 'syncing' ? "Handshaking with Cloud Core" : status === 'complete' ? "Data Verified & Cached" : "Offline Mode Active"}
                    </span>
                </div>
            </div>

            {pendingActions.length > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-destructive/5 rounded-lg border border-destructive/10">
                    <span className="text-[9px] font-black tabular-nums">{pendingActions.length}</span>
                    <span className="text-[7px] font-black uppercase tracking-tighter">Queue</span>
                </div>
            )}
        </div>
    </div>
  );
}
