
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOnDisplayItemByTokenAction, submitOnDisplayRequestAction } from '@/app/actions';
import { InventoryItem, SpecialEntryRequest } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldAlert, Package, CheckCircle2, Trash2, Save, MapPin, Hash, Calendar, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function OnDisplayStaffPage() {
  const { token } = useParams() as { token: string };
  const { toast } = useToast();
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  // Form State
  const [qty, setQty] = useState<number>(0);
  const [loc, setLoc] = useState<string>('');
  const [requestType, setRequestType] = useState<'edit' | 'delete'>('edit');

  useEffect(() => {
    async function load() {
      const res = await getOnDisplayItemByTokenAction(token);
      if (res.success && res.data) {
        setItem(res.data);
        setQty(res.data.quantity);
        setLoc(res.data.location);
      }
      setIsLoading(false);
    }
    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!item) return;
    startTransition(async () => {
      const res = await submitOnDisplayRequestAction(token, {
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
        toast({ title: "Request Dispatched", description: "Administrator will review your changes." });
      } else {
        toast({ variant: "destructive", title: "Sync Failed", description: res.message });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <div className="mb-6 rounded-full bg-emerald-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold">Request Submitted</h1>
        <p className="mt-2 text-muted-foreground">The registry update is pending admin approval.</p>
        <p className="mt-1 text-xs text-muted-foreground opacity-60">This session token has been deactivated.</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold">Access Expired</h1>
        <p className="text-muted-foreground">This one-time link is no longer valid or has already been used.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Highland Hypermarket</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">On-Display Expiry Protocol</p>
        </header>

        <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border border-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg font-bold truncate leading-tight">{item.productName}</CardTitle>
                <CardDescription className="font-mono text-xs mt-1">{item.barcode}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Stock</p>
                <p className="text-xl font-black text-slate-900">{item.quantity} Units</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Expiry</p>
                <p className="text-xs font-bold text-slate-900">{item.expiryDate ? format(parseISO(item.expiryDate), 'dd MMM yyyy') : 'N/A'}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <Button 
                  variant={requestType === 'edit' ? 'default' : 'ghost'} 
                  className={cn("flex-1 rounded-lg text-xs font-bold h-10", requestType === 'edit' && "shadow-md")}
                  onClick={() => setRequestType('edit')}
                >
                  <Save className="h-3.5 w-3.5 mr-2" /> Adjust Stock
                </Button>
                <Button 
                  variant={requestType === 'delete' ? 'destructive' : 'ghost'} 
                  className={cn("flex-1 rounded-lg text-xs font-bold h-10", requestType === 'delete' && "shadow-md")}
                  onClick={() => setRequestType('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove Item
                </Button>
              </div>

              {requestType === 'edit' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Physical Count Observed</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                      <Input 
                        type="number" 
                        value={qty} 
                        onChange={(e) => setQty(parseInt(e.target.value))}
                        className="h-12 pl-10 font-bold bg-white border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Moving to Zone</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                      <Input 
                        value={loc} 
                        onChange={(e) => setLoc(e.target.value)}
                        className="h-12 pl-10 font-bold bg-white border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-xs font-bold text-destructive flex items-center gap-2">
                    <Trash2 className="h-4 w-4" /> Request Removal
                  </p>
                  <p className="text-[10px] text-destructive/70 mt-1">This will alert the manager to purge this record from the active display registry.</p>
                </div>
              )}

              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting} 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 text-xs"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Dispatch Request <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
