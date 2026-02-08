
'use client';

import { useState, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BellDot, ScanSearch, CheckCircle, Package, Barcode, Hash, MapPin, Building, User } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { startOfDay, parseISO, isBefore, isValid, format } from 'date-fns';

type ExpiredItemsByStaff = {
  [staffName: string]: InventoryItem[];
};

export default function NotificationsPage() {
  const { inventoryItems, isCacheReady } = useDataCache();
  const [expiredItemsByStaff, setExpiredItemsByStaff] = useState<ExpiredItemsByStaff | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);

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

  const openStaffDialog = (staffName: string) => {
    setSelectedStaffName(staffName);
  };

  const onDialogClose = () => {
    setSelectedStaffName(null);
  };

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {staffWithExpiredItems.map(([staffName, items]) => (
              <Card 
                key={staffName} 
                className="cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-primary/50 transition-all" 
                onClick={() => openStaffDialog(staffName)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <User className="h-6 w-6 text-primary" />
                    {staffName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-destructive">{items.length}</p>
                  <p className="text-sm text-muted-foreground">Expired Item(s)</p>
                </CardContent>
              </Card>
            ))}
          </div>
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

      <Dialog open={!!selectedStaffName} onOpenChange={(isOpen) => !isOpen && onDialogClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5" />Expired Items for {selectedStaffName}</DialogTitle>
            <DialogDescription>
              The following items logged by {selectedStaffName} have passed their expiration date.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1">
            <div className="space-y-3 py-4">
              {selectedStaffName && expiredItemsByStaff?.[selectedStaffName]?.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-4">
                        <Package className="h-6 w-6 text-primary flex-shrink-0" />
                        <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                            {item.barcode} &bull; Qty: <span className="font-medium text-foreground">{item.quantity}</span> &bull; Loc: <span className="font-medium text-foreground">{item.location}</span>
                        </p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-bold text-destructive">
                        {item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">Expired</p>
                    </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
