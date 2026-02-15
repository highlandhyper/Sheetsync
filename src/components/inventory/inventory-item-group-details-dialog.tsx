
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryItem } from '@/lib/types';
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
import { Edit, Undo2, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

export interface GroupedInventoryItem {
  mainItem: InventoryItem;
  individualItems: InventoryItem[];
  totalQuantity: number;
}

interface InventoryItemGroupDetailsDialogProps {
  group: GroupedInventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReturnDialog: (item: InventoryItem) => void;
  onOpenEditDialog: (item: InventoryItem) => void;
  onOpenDeleteDialog: (item: InventoryItem) => void;
  onActionSuccess: () => void;
}

export function InventoryItemGroupDetailsDialog({
  group,
  isOpen,
  onOpenChange,
  onOpenReturnDialog,
  onOpenEditDialog,
  onOpenDeleteDialog,
}: InventoryItemGroupDetailsDialogProps) {
  const { role } = useAuth();

  if (!group) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>Individual Logs for: {group.mainItem.productName}</DialogTitle>
          <DialogDescription>
            Barcode: {group.mainItem.barcode}. Total Quantity: {group.totalQuantity}. Showing {group.individualItems.length} log(s).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logged At</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Logged By</TableHead>
                {role === 'admin' && <TableHead className="text-center">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.individualItems.map((item) => {
                const isExpired = item.expiryDate && isValid(parseISO(item.expiryDate)) ? isBefore(startOfDay(parseISO(item.expiryDate)), startOfDay(new Date())) : false;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell>{item.location}</TableCell>
                    <TableCell className={cn(isExpired ? 'text-destructive' : '')}>
                      {item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}
                    </TableCell>
                    <TableCell className={cn(item.itemType === 'Damage' ? 'text-orange-500' : '')}>{item.itemType}</TableCell>
                    <TableCell>{item.staffName}</TableCell>
                    {role === 'admin' && (
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onOpenEditDialog(item)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => onOpenReturnDialog(item)} disabled={item.quantity <= 0} className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => onOpenDeleteDialog(item)} className="h-8 w-8 text-destructive/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
