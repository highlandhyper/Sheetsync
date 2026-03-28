'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Search, History, FilterX, Barcode } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';

interface ParsedReturnLog {
  id: string;
  timestamp: string;
  productName: string;
  barcode: string;
  quantity: string;
  staff: string;
  user: string;
}

export function ReturnLogListClient() {
  const { auditLogs } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');

  const returnLogs = useMemo(() => {
    return auditLogs
      .filter(log => log.action === 'RETURN_INVENTORY')
      .map(log => {
        const details = log.details;
        
        // Parsing pattern: [RETURN] Product: {name} | Barcode: {barcode} | Qty: {qty} | Staff: {staff}
        const nameMatch = details.match(/Product: (.*?) \|/);
        const barcodeMatch = details.match(/Barcode: (.*?) \|/);
        const qtyMatch = details.match(/Qty: (.*?) \|/);
        const staffMatch = details.match(/Staff: (.*?) \|/);

        return {
          id: log.id,
          timestamp: log.timestamp,
          productName: nameMatch ? nameMatch[1] : 'N/A',
          barcode: barcodeMatch ? barcodeMatch[1] : 'N/A',
          quantity: qtyMatch ? qtyMatch[1] : 'N/A',
          staff: staffMatch ? staffMatch[1] : 'N/A',
          user: log.user
        } as ParsedReturnLog;
      });
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    if (!lower) return returnLogs;

    return returnLogs.filter(log => 
      log.productName.toLowerCase().includes(lower) ||
      log.barcode.toLowerCase().includes(lower) ||
      log.staff.toLowerCase().includes(lower) ||
      log.user.toLowerCase().includes(lower)
    );
  }, [returnLogs, searchTerm]);

  return (
    <div className="space-y-6">
      <Card className="p-4 shadow-md">
        <CardContent className="p-0 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by product, barcode, or staff member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          {searchTerm && (
            <Button variant="ghost" onClick={() => setSearchTerm('')}>
              <FilterX className="mr-2 h-4 w-4" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {filteredLogs.length > 0 ? (
        <Card className="shadow-md overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead className="text-right">Returned Qty</TableHead>
                <TableHead>Processed By (Staff)</TableHead>
                <TableHead>Admin User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-medium">
                    {format(parseISO(log.timestamp), 'PPp')}
                  </TableCell>
                  <TableCell className="font-bold text-primary">{log.productName}</TableCell>
                  <TableCell className="font-mono text-xs">{log.barcode}</TableCell>
                  <TableCell className="text-right font-black text-destructive">{log.quantity}</TableCell>
                  <TableCell>{log.staff}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{log.user}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-xl">
          <History className="mx-auto h-16 w-16 text-muted-foreground opacity-20" />
          <h3 className="mt-4 text-xl font-bold text-muted-foreground">No return history found</h3>
          <p className="text-sm text-muted-foreground">Processed returns will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}
