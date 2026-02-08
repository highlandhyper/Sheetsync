
'use client';

import { useState, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BellDot, ScanSearch, CheckCircle, Package, Barcode, Hash, MapPin, CalendarOff, User, Building } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { startOfDay, parseISO, isBefore, isValid, format } from 'date-fns';

type ExpiredItemsByStaff = {
  [staffName: string]: InventoryItem[];
};

export default function NotificationsPage() {
  const { inventoryItems, isCacheReady } = useDataCache();
  const [expiredItemsByStaff, setExpiredItemsByStaff] = useState<ExpiredItemsByStaff | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  const handleScanForExpiredItems = () => {
    const today = startOfDay(new Date());
    const expired = inventoryItems.filter(item => {
      // Only check 'Expiry' items with a positive quantity and a valid date
      if (item.itemType !== 'Expiry' || item.quantity <= 0 || !item.expiryDate) {
        return false;
      }
      try {
        const expiryDate = startOfDay(parseISO(item.expiryDate));
        return isValid(expiryDate) && isBefore(expiryDate, today);
      } catch {
        return false; // In case of invalid date format in sheet
      }
    });

    const groupedByStaff = expired.reduce((acc, item) => {
      const staffName = item.staffName || 'Unknown Staff';
      if (!acc[staffName]) {
        acc[staffName] = [];
      }
      acc[staffName].push(item);
      return acc;
    }, {} as ExpiredItemsByStaff);

    setExpiredItemsByStaff(groupedByStaff);
    setHasScanned(true);
  };

  const staffWithExpiredItems = useMemo(() => {
    if (!expiredItemsByStaff) return [];
    return Object.entries(expiredItemsByStaff).sort((a, b) => a[0].localeCompare(b[0]));
  }, [expiredItemsByStaff]);

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-4xl font-extrabold mb-8 text-primary flex items-center tracking-tight">
        <BellDot className="mr-3 h-8 w-8" />
        Expired Item Notifications
      </h1>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Scan for Expired Inventory</CardTitle>
          <CardDescription>
            Click the button to scan all current inventory and identify items that have passed their expiration date. Results will be grouped by the staff member who logged them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleScanForExpiredItems} disabled={!isCacheReady}>
            <ScanSearch className="mr-2 h-4 w-4" />
            Scan for Expired Items
          </Button>

          <div className="mt-6">
            {!hasScanned && (
               <div className="text-center py-10 border-2 border-dashed rounded-lg bg-card">
                <ScanSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Awaiting Scan</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Click the button to scan for expired items.
                </p>
            </div>
            )}
            {hasScanned && staffWithExpiredItems.length > 0 && (
              <Accordion type="multiple" className="w-full">
                {staffWithExpiredItems.map(([staffName, items]) => (
                  <AccordionItem key={staffName} value={staffName}>
                    <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                      <div className="flex items-center gap-3">
                         <User className="h-5 w-5 text-muted-foreground"/>
                        <span className="font-semibold">{staffName}</span>
                        <span className="bg-destructive text-destructive-foreground rounded-full px-2.5 py-0.5 text-xs font-bold">
                          {items.length} Expired Item(s)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 px-4 bg-muted/30">
                      <div className="space-y-4">
                        {items.map(item => (
                          <div key={item.id} className="p-4 border rounded-lg bg-card shadow-sm">
                            <h4 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary"/>{item.productName}</h4>
                            <p className="text-sm text-muted-foreground flex items-center gap-2"><Barcode className="h-4 w-4"/>{item.barcode}</p>
                            <hr className="my-2" />
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              <p className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground"/>Quantity: <span className="font-medium">{item.quantity}</span></p>
                              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/>Location: <span className="font-medium">{item.location}</span></p>
                              <p className="flex items-center gap-2 col-span-2"><Building className="h-4 w-4 text-muted-foreground"/>Supplier: <span className="font-medium">{item.supplierName || 'N/A'}</span></p>
                              <p className="flex items-center gap-2 col-span-2 text-destructive"><CalendarOff className="h-4 w-4"/>Expired On: <span className="font-semibold">{item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            {hasScanned && staffWithExpiredItems.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed rounded-lg bg-green-500/10 border-green-500/30">
                <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
                <h3 className="mt-4 text-xl font-semibold text-green-700">All Clear!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No expired items were found in the current inventory.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
