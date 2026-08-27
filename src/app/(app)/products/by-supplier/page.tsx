'use client';
import { ReturnableInventoryBySupplierClient } from '@/components/inventory/returnable-inventory-by-supplier-client';
import { Suspense, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { ScanBarcode, Sparkles, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VoucherReturnTerminal } from '@/components/inventory/voucher-return-terminal';

function ReturnableInventorySkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Skeleton className="h-10 w-full md:w-[320px]" />
            <div className="flex gap-2 w-full md:w-auto">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
      </Card>
      <Card className="shadow-md overflow-hidden">
        <div className="divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex p-4 gap-4 items-center">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
                <Skeleton className="h-5 w-20 ml-auto" />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}


export default function ReturnInventoryBySupplierPage() {
  const { isCacheReady } = useDataCache();
  const { role } = useAuth();
  const [isVoucherTerminalOpen, setIsVoucherTerminalOpen] = useState(false);

  return (
    <div className="w-full max-w-[1700px] mx-auto py-2 printable-area">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-primary noprint">Return Inventory by Supplier</h1>
          
          {role === 'admin' && (
              <Button 
                onClick={() => setIsVoucherTerminalOpen(true)}
                className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5"
              >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Voucher Import
              </Button>
          )}
      </div>

      <Suspense fallback={<ReturnableInventorySkeleton />}>
        {!isCacheReady ? (
          <ReturnableInventorySkeleton />
        ) : (
          <ReturnableInventoryBySupplierClient />
        )}
      </Suspense>

      <Dialog open={isVoucherTerminalOpen} onOpenChange={setIsVoucherTerminalOpen}>
          <DialogContent className="sm:max-w-5xl p-0 overflow-hidden rounded-[3rem] border-none shadow-3xl bg-background h-[90vh] flex flex-col">
              <DialogHeader className="p-8 pb-4 bg-muted/20 border-b border-white/5 shrink-0">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-2xl">
                              <Sparkles className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">AI Bulk Return Processing</DialogTitle>
                              <DialogDescription className="font-bold text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">Voucher Recognition Terminal</DialogDescription>
                          </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setIsVoucherTerminalOpen(false)} className="rounded-full">
                          <X className="h-5 w-5" />
                      </Button>
                  </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-8 pt-4">
                  <VoucherReturnTerminal />
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
