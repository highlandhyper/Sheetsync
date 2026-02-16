'use client';

import { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import type { InventoryItem } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Package, User, CalendarDays, MapPin, AlertTriangle, Tag, Barcode as BarcodeIcon, Building, Pencil, History } from 'lucide-react';
import { ItemAuditLogDialog } from '@/components/audit/item-audit-log-dialog';

interface InventoryItemDetailsDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStartEdit?: (item: InventoryItem) => void; // Make optional
  displayContext?: 'returnByStaff' | 'default' | 'returnBySupplier';
}

export function InventoryItemDetailsDialog({
  item,
  isOpen,
  onOpenChange,
  onStartEdit, // Will be undefined if not passed (e.g., for 'viewer' role)
  displayContext = 'default'
}: InventoryItemDetailsDialogProps) {
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  
  if (!item) return null;

  const isItemExpired = item.expiryDate ? isValid(parseISO(item.expiryDate)) && parseISO(item.expiryDate) < new Date() : false;

  let formattedTimestamp = "Not available";
  if (item.timestamp) {
    const parsedTs = parseISO(item.timestamp);
    if (isValid(parsedTs)) {
      formattedTimestamp = format(parsedTs, 'PPp');
    } else {
      formattedTimestamp = "Invalid timestamp";
    }
  }

  let formattedExpiryDate = "N/A";
  if (item.expiryDate) { // Show expiry if it exists, regardless of type
    const parsedExpDate = parseISO(item.expiryDate);
    if (isValid(parsedExpDate)) {
      formattedExpiryDate = format(parsedExpDate, 'PP');
      if (isItemExpired) {
        formattedExpiryDate += " (Expired)";
      }
    } else {
      formattedExpiryDate = "Invalid date";
    }
  }


  const handleEditClick = () => {
    if (onStartEdit && item) {
      onOpenChange(false); // Close details dialog
      onStartEdit(item);   // Open edit dialog
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) setIsAuditLogOpen(false); // Reset on close
        onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center text-xl">
            <Package className="mr-2 h-5 w-5 text-primary" />
            Item Details: {item.productName}
          </DialogTitle>
          <DialogDescription>
            Detailed information for the selected inventory item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center">
            <BarcodeIcon className="mr-3 h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Barcode:</span>
            <span className="ml-2 text-muted-foreground">{item.barcode}</span>
          </div>

          <Separator />

          {displayContext === 'returnByStaff' ? (
            <div className="flex items-center">
              <Building className="mr-3 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Supplier:</span>
              <span className="ml-2 text-muted-foreground">{item.supplierName || 'N/A'}</span>
            </div>
          ) : ( 
            <div className="flex items-center">
              <User className="mr-3 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Logged by:</span>
              <span className="ml-2 text-muted-foreground">{item.staffName}</span>
            </div>
          )}

          <div className="flex items-center">
            <CalendarDays className="mr-3 h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Logged on:</span>
            <span className="ml-2 text-muted-foreground">
              {formattedTimestamp}
            </span>
          </div>

          <Separator />

          <div className="flex items-center">
            <MapPin className="mr-3 h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Location:</span>
            <span className="ml-2 text-muted-foreground">{item.location}</span>
          </div>

          
          <div className="flex items-center">
            <CalendarDays className="mr-3 h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Expiry Date:</span>
            <span className={`ml-2 ${isItemExpired && item.itemType === 'Expiry' ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
              {formattedExpiryDate}
            </span>
          </div>
          

          <div className="flex items-center">
            {item.itemType === 'Damage' ?
              <AlertTriangle className="mr-3 h-4 w-4 text-orange-500" /> :
              <Tag className="mr-3 h-4 w-4 text-muted-foreground" />
            }
            <span className="font-medium">Item Type:</span>
            <span className={`ml-2 ${item.itemType === 'Damage' ? 'text-orange-500' : 'text-muted-foreground'}`}>
              {item.itemType}
            </span>
          </div>

        </div>

        <DialogFooter className="mt-6 flex justify-between items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsAuditLogOpen(true)}>
                <History className="mr-2 h-4 w-4" /> View History
            </Button>
            <div className="flex items-center gap-2">
              {onStartEdit && ( // Only render Edit button if onStartEdit is provided
                <Button type="button" variant="outline" onClick={handleEditClick}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {item && (
      <ItemAuditLogDialog
        isOpen={isAuditLogOpen}
        onOpenChange={setIsAuditLogOpen}
        targetId={item.id}
        productName={item.productName}
      />
    )}
  </>
  );
}
