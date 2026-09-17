'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { verifyOnDisplayTokenAction, submitOnDisplayRequestAction } from '@/app/actions';
import type { InventoryItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  ShieldAlert, 
  Package, 
  CheckCircle2, 
  Trash2, 
  Save, 
  MapPin, 
  Hash, 
  KeyRound, 
  ArrowRight, 
  LockKeyhole,
  Clock,
  ShieldCheck,
  AlertTriangle,
  SendHorizontal,
  Barcode
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function OnDisplayStaffPage() {
  const { token } = useParams() as { token: string };
  const { toast } = useToast();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [qty, setQty] = useState<number>(0);
  const [loc, setLoc] = useState<string>('');
  const [requestType, setRequestType] = useState<'edit' | 'delete'>('edit');

  const handleVerify = async () => {
    if (!accessKey || accessKey.length < 4) return;
    setIsVerifying(true);
    setErrorMessage('');
    
    try {
        const res = await verifyOnDisplayTokenAction(token, accessKey);
        if (res.success && res.data) {
            setItem(res.data);
            setQty(res.data.quantity);
            setLoc(res.data.location);
            setIsVerified(true);
            toast({ title: "Identity Confirmed", description: "Terminal session authorized." });
        } else {
            setErrorMessage(res.message || "Invalid Access Key.");
        }
    } catch (e) {
        setErrorMessage("Handshake timeout. Check connection.");
    } finally {
        setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!item) return;
    startTransition(async () => {
      const res = await submitOnDisplayRequestAction(token, accessKey, {
        editDetails: {
          itemId: item.id,
          productName: item.productName,
          quantity: qty,
          location: loc,
          itemType: item.itemType,
          expiryDate: item.expiryDate,
          requestType
        }
      });
      if (res.success) {
        setSuccess(true);
        toast({ title: "Request Synchronized", description: "Admin approval pending." });
      } else {
        toast({ variant: "destructive", title: "Sync Blocked", description: res.message });
      }
    });
  };

  if (success) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-tech-grid opacity-[0.4]" />
        <div className="relative z-10 animate-in zoom-in-95 duration-500">
            <div className="mb-8 mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Transmission<br/>Complete</h1>
            <p className="mt-4 text-sm font-medium text-slate-500 max-w-[240px] mx-auto">Your registry update request has been successfully dispatched to Highland Hypermarket Admin.</p>
            <p className="mt-8 text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-50">One-Time Token Purged</p>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-slate-100 p-4 sm:p-6 overflow-hidden">
        {/* TECHNICAL VISUAL LAYER */}
        <div className="absolute inset-0 bg-tech-grid opacity-[0.7]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(241,245,249,0.9)_80%)]" />
        
        <Card className="relative z-10 w-full max-w-sm rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
            <CardHeader className="bg-primary/5 text-center border-b border-primary/10 py-10">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg text-primary animate-in zoom-in-90 duration-700">
                    <LockKeyhole className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">Security<br/>Handshake</CardTitle>
                <div className="mt-4 flex items-center justify-center gap-2">
                    <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/5 text-[8px] font-black uppercase tracking-widest text-primary">Verification Required</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-8 pt-10 space-y-8">
                <div className="space-y-3">
                    <Label htmlFor="pin" className="text-[10px] font-black uppercase tracking-[0.3em] ml-1 text-slate-400">Registry Access Key</Label>
                    <div className="relative group">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input 
                            id="pin"
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="••••"
                            value={accessKey}
                            onChange={(e) => {
                                setAccessKey(e.target.value.replace(/\D/g, ''));
                                setErrorMessage('');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                            className="h-16 pl-12 text-center text-3xl font-black tracking-[0.6em] bg-slate-50 border-slate-100 rounded-[1.25rem] focus-visible:bg-white focus-visible:ring-primary/10 transition-all placeholder:text-slate-200"
                        />
                    </div>
                    {errorMessage ? (
                      <div className="flex items-center justify-center gap-2 text-destructive animate-in slide-in-from-top-1">
                        <AlertTriangle className="h-3 w-3" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">{errorMessage}</p>
                      </div>
                    ) : (
                      <p className="text-[9px] text-center text-slate-400 font-medium leading-relaxed px-4">
                        Enter the 4-digit code provided in your SMS to reveal product data.
                      </p>
                    )}
                </div>
                
                <Button 
                    onClick={handleVerify} 
                    disabled={accessKey.length < 4 || isVerifying}
                    className="w-full h-16 rounded-[1.25rem] font-black uppercase tracking-[0.25em] shadow-xl shadow-primary/20 text-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {isVerifying ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Authorize <ArrowRight className="ml-2 h-5 w-5" /></>}
                </Button>
            </CardContent>
            <CardFooter className="pb-8 justify-center">
              <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-300">SheetSync Secure Node</p>
            </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-24 sm:p-8 overflow-hidden relative">
      <div className="absolute inset-0 bg-tech-grid opacity-[0.3]" />
      
      <div className="relative z-10 mx-auto max-w-lg space-y-6">
        <header className="flex flex-col items-center text-center space-y-2 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-primary/5 text-primary">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">Highland<br/>Hypermarket</h1>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10">On-Display Expiry Protocol</p>
        </header>

        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-black/[0.03]">
          <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-md border border-primary/5">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-xl font-bold truncate leading-tight text-slate-900">{item!.productName}</CardTitle>
                <div className="flex items-center gap-2">
                   <Badge variant="outline" className="font-mono text-[10px] bg-white border-slate-200 text-slate-500 px-2 py-0">
                      <Barcode className="h-2.5 w-2.5 mr-1 text-slate-300" />
                      {item!.barcode}
                   </Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* STATS TILES */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100 shadow-inner group transition-colors hover:bg-white hover:border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                   <Hash className="h-3 w-3 text-slate-300" />
                   <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">In Registry</p>
                </div>
                <p className="text-3xl font-black text-slate-900">{item!.quantity} <span className="text-xs font-bold text-slate-400 uppercase">Units</span></p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100 shadow-inner group transition-colors hover:bg-white hover:border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                   <Clock className="h-3 w-3 text-slate-300" />
                   <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Expiry Window</p>
                </div>
                <p className="text-sm font-black text-slate-900 uppercase">
                  {item!.expiryDate ? format(parseISO(item!.expiryDate), 'dd MMM yyyy') : 'NO DATA'}
                </p>
              </div>
            </div>

            <Separator className="opacity-40" />

            {/* ACTION CENTER */}
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] ml-1 text-slate-400">Request Protocol</Label>
                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem] shadow-inner">
                  <Button 
                    variant={requestType === 'edit' ? 'default' : 'ghost'} 
                    className={cn(
                      "flex-1 rounded-2xl text-[10px] font-black uppercase tracking-widest h-12 transition-all", 
                      requestType === 'edit' ? "shadow-lg" : "text-slate-500"
                    )}
                    onClick={() => setRequestType('edit')}
                  >
                    <Save className="h-3.5 w-3.5 mr-2" /> Adjust
                  </Button>
                  <Button 
                    variant={requestType === 'delete' ? 'destructive' : 'ghost'} 
                    className={cn(
                      "flex-1 rounded-2xl text-[10px] font-black uppercase tracking-widest h-12 transition-all", 
                      requestType === 'delete' ? "shadow-lg bg-red-600" : "text-slate-500"
                    )}
                    onClick={() => setRequestType('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Purge
                  </Button>
                </div>
              </div>

              {requestType === 'edit' ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-400">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Physical Count Observed</Label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="number" 
                        value={qty} 
                        onChange={(e) => setQty(parseFloat(e.target.value))}
                        className="h-14 pl-12 text-lg font-black bg-slate-50 border-slate-100 rounded-2xl focus-visible:bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500">Destination Zone</Label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                      <Input 
                        value={loc} 
                        onChange={(e) => setLoc(e.target.value)}
                        className="h-14 pl-12 text-sm font-bold bg-slate-50 border-slate-100 rounded-2xl focus-visible:bg-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-400 flex items-start gap-4">
                  <div className="p-3 bg-white rounded-2xl text-red-600 shadow-sm border border-red-100">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-red-900">Confirm Deletion</h4>
                    <p className="text-[11px] font-medium text-red-700/70 mt-1 leading-relaxed">This request will alert management to remove this product log from the On-Display registry permanently.</p>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting} 
                className="w-full h-18 rounded-[1.5rem] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 text-[11px] mt-4 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <div className="flex items-center gap-3">
                    <SendHorizontal className="h-5 w-5" />
                    Dispatch Update
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
          
          <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 flex justify-center">
             <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="h-3 w-3" />
                <span className="text-[8px] font-black uppercase tracking-[0.4em]">Audit Trace Logged</span>
             </div>
          </CardFooter>
        </Card>
      </div>

      {/* MOBILE SAFE AREA PADDING */}
      <div className="h-8" />
    </div>
  );
}
