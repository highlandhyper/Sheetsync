
'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Search, PackageSearch } from 'lucide-react';
import type { ReturnedItem } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDataCache } from '@/context/data-cache-context';

export function ReturnLogListClient() {
  const { returnedItems: allReturnedItems } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) return allReturnedItems;

    return allReturnedItems.filter(item =>
      item.productName.toLowerCase().includes(lowerSearchTerm) ||
      item.barcode.toLowerCase().includes(lowerSearchTerm) ||
      (item.supplierName && item.supplierName.toLowerCase().includes(lowerSearchTerm)) ||
      item.staffName.toLowerCase().includes(lowerSearchTerm) ||
      item.location.toLowerCase().includes(lowerSearchTerm)
    );
  }, [allReturnedItems, searchTerm]);

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow">
        <CardContent className="p-0">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search return log (product, barcode, supplier, staff...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {filteredItems.length > 0 ? (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Returned Qty</TableHead>
                <TableHead>Return Date</TableHead>
                <TableHead>Original Location</TableHead>
                <TableHead>Processed By</TableHead>
                <TableHead>Item Type</TableHead>
                <TableHead>Expiry Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const isExpired = item.expiryDate && item.returnTimestamp && new Date(item.expiryDate) < new Date(item.returnTimestamp);
                const formattedReturnTimestamp = item.returnTimestamp && isValid(parseISO(item.returnTimestamp)) 
                  ? format(parseISO(item.returnTimestamp), 'PPp') 
                  : 'N/A';

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.barcode}</TableCell>
                    <TableCell className="text-muted-foreground">{item.supplierName}</TableCell>
                    <TableCell className="text-right font-semibold">{item.returnedQuantity}</TableCell>
                    <TableCell className="text-muted-foreground">{formattedReturnTimestamp}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell className="text-muted-foreground">{item.staffName}</TableCell>
                    <TableCell className={cn(item.itemType === 'Damage' ? "text-orange-500" : "text-muted-foreground")}>
                      {item.itemType}
                    </TableCell>
                    <TableCell className={cn(isExpired && item.itemType === 'Expiry' ? "text-destructive" : "text-muted-foreground")}>
                      {item.expiryDate && isValid(parseISO(item.expiryDate)) ? format(parseISO(item.expiryDate), 'PP') : 'N/A'}
                      {isExpired && item.itemType === 'Expiry' && " (Expired)"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-12">
          <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">No matching items in Return Log</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search terms or check if any items have been returned.
          </p>
        </div>
      )}
    </div>
  );
}
