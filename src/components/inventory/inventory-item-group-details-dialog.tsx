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
import { Edit, Undo2, Trash2, MapPin, CalendarDays, User as UserIcon, Tag, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '../ui/separator';

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
  const isMobile = useIsMobile();

  if (!group) return null;

  const renderItemDetails = (item: InventoryItem) => {
    const isExpired = item.expiryDate && isValid(parseISO(item.expiryDate)) ? isBefore(startOfDay(parseISO(item.expiryDate)), startOfDay(new Date())) : false;
    
    if (isMobile) {
      return (
        <div key={item.id} className="rounded-lg border bg-card/50 p-3 text-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-base">{item.quantity} <span className="text-sm font-normal text-muted-foreground">in stock</span></p>
              <p className="text-xs text-muted-foreground">{item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}</p>
            </div>
             {role === 'admin' && (
                <div className="flex flex-shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onOpenEditDialog(item)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenReturnDialog(item)} disabled={item.quantity <= 0} className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenDeleteDialog(item)} className="h-8 w-8 text-destructive/70 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3">
             <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
              <div><span className="font-medium">Location</span><p className="text-muted-foreground">{item.location}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <UserIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
              <div><span className="font-medium">Logged By</span><p className="text-muted-foreground">{item.staffName}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Expiry</span>
                <p className={cn(isExpired ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                  {item.expiryDate ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}
                </p>
              </div>
            </div>
             <div className="flex items-start gap-2">
              {item.itemType === 'Damage' ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-orange-500" /> : <Tag className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />}
              <div>
                <span className="font-medium">Type</span>
                <p className={cn(item.itemType === 'Damage' ? 'text-orange-500' : 'text-muted-foreground')}>{item.itemType}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <TableRow key={item.id}>
        <TableCell className="text-xs">{item.timestamp ? format(parseISO(item.timestamp), 'PPp') : 'N/A'}</TableCell>
        <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
        <TableCell>{item.location}</TableCell>
        <TableCell className={cn(isExpired ? 'text-destructive font-semibold' : '')}>
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Individual Logs for: {group.mainItem.productName}</DialogTitle>
          <DialogDescription>
            Barcode: {group.mainItem.barcode}. Total Quantity: {group.totalQuantity}. Showing {group.individualItems.length} log(s).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-1">
           {isMobile ? (
              <div className="space-y-3 py-2">
                  {group.individualItems.map(renderItemDetails)}
              </div>
            ) : (
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
                  {group.individualItems.map(renderItemDetails)}
                </TableBody>
              </Table>
            )}
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
