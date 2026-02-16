'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { AuditLogEntry } from '@/lib/types';
import { useDataCache } from '@/context/data-cache-context';
import { format, parseISO } from 'date-fns';
import { FileText, History, Info, Package, Tag, User } from 'lucide-react';

interface ItemAuditLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  productName?: string;
}

const formatActionString = (action: string) => {
  if (!action) return '';
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function ItemAuditLogDialog({ isOpen, onOpenChange, targetId, productName }: ItemAuditLogDialogProps) {
  const { auditLogs } = useDataCache();

  const filteredLogs = useMemo(() => {
    if (!targetId) return [];
    return auditLogs
      .filter(log => log.target === targetId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, targetId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Audit History
          </DialogTitle>
          <DialogDescription>
            Showing history for: <span className="font-semibold">{productName || targetId}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-1">
            {filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <div key={log.id} className="text-sm p-3 border rounded-lg bg-muted/50">
                  <div className="flex justify-between items-center mb-2">
                     <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary">{formatActionString(log.action)}</Badge>
                     </div>
                     <span className="text-xs text-muted-foreground">
                        {format(parseISO(log.timestamp), 'PPp')}
                     </span>
                  </div>
                  <Separator />
                  <div className="mt-2 space-y-2">
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                           <p className="font-medium">User</p>
                           <p className="text-muted-foreground break-all">{log.user}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                         <div>
                           <p className="font-medium">Details</p>
                           <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">{log.details}</pre>
                        </div>
                      </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-8 w-8 mb-2" />
                <p>No audit history found for this item.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
