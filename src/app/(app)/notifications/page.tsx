
'use client';

import { useState, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BellDot, ScanSearch, CheckCircle, Package, Barcode, Hash, MapPin, CalendarOff, User, Building } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { startOfDay, parseISO, isBefore, isValid, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

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
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-primary flex items-center tracking-tight">
            <BellDot className="mr-3 h-8 w-8" />
            Expired Item Notifications
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
            Click the button to scan all current inventory and identify items that have passed their expiration date. Results will be grouped by the staff member who logged them.
        </p>
      </div>

       <Button onClick={handleScanForExpiredItems} disabled={!isCacheReady} size="lg">
            <ScanSearch className="mr-2 h-4 w-4" />
            Scan for Expired Items
        </Button>

        <div className="mt-8">
        {!hasScanned && (
            <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/50">
            <ScanSearch className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Awaiting Scan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                Click the button to find expired items in your inventory.
            </p>
        </div>
        )}
        {hasScanned && staffWithExpiredItems.length > 0 && (
            <Accordion type="multiple" className="w-full space-y-4">
            {staffWithExpiredItems.map(([staffName, items]) => (
                <AccordionItem key={staffName} value={staffName} className="border-b-0">
                  <Card className="shadow-md">
                    <CardHeader className="p-0">
                      <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-primary"/>
                            <span className="font-semibold text-lg">{staffName}</span>
                            <Badge variant="destructive">{items.length} Expired</Badge>
                        </div>
                      </AccordionTrigger>
                    </CardHeader>
                    <AccordionContent className="p-4 bg-muted/40">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map(item => (
                             <Card key={item.id} className="bg-background/80 flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base">{item.productName}</CardTitle>
                                            <CardDescription className="text-xs flex items-center gap-1"><Barcode className="h-3 w-3" />{item.barcode}</CardDescription>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="text-xs text-destructive font-semibold">Expired On</p>
                                            <p className="font-bold text-destructive">{item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm flex-grow">
                                    <div className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4 text-primary/70"/>Qty: <span className="font-medium text-foreground">{item.quantity}</span></div>
                                    <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-primary/70"/>Location: <span className="font-medium text-foreground">{item.location}</span></div>
                                    <div className="flex items-center gap-2 col-span-2 text-muted-foreground"><Building className="h-4 w-4 text-primary/70"/>Supplier: <span className="font-medium text-foreground">{item.supplierName || 'N/A'}</span></div>
                                </CardContent>
                            </Card>
                        ))}
                        </div>
                    </AccordionContent>
                  </Card>
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
    </div>
  );
}
