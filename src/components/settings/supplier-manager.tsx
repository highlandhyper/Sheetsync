
'use client';

import { useState, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Building,
  Mail,
  Smartphone,
  Hash,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Supplier } from '@/lib/types';
import { saveSupplierContactsAction } from '@/app/actions';
import { EditSupplierDialog } from '@/components/suppliers/edit-supplier-dialog';

export function SupplierManager() {
  const { toast } = useToast();
  const { supplierContacts, updateSupplier, isSyncing, refreshData } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const filteredSuppliers = useMemo(() => {
    return supplierContacts
      .filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [supplierContacts, searchTerm]);

  const handleOpenEdit = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setIsEditDialogOpen(true);
  };

  const handleSuccess = () => {
    setIsEditDialogOpen(false);
    setSupplierToEdit(null);
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Overview */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Building className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Supplier directory
            </h3>

            <Badge
              variant="secondary"
              className="rounded-lg border-0 bg-muted px-2.5 py-0.5 text-[8px] font-semibold"
            >
              {supplierContacts.length} vendors
            </Badge>
          </div>

          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
            Maintain vendor contact terminals and unique identification codes for automated reporting.
          </p>
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex min-w-0 flex-col gap-3 border-b border-border/50 bg-muted/[0.18] px-3.5 py-3 sm:flex-row sm:items-center sm:px-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search registry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-xl border-border/60 bg-background pl-9 text-xs shadow-none"
            />
          </div>
          
          <Button 
            onClick={() => refreshData()} 
            variant="outline" 
            size="sm" 
            disabled={isSyncing}
            className="h-9 rounded-xl border-border/60 bg-background text-[10px] font-semibold shadow-none"
          >
            {isSyncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            Sync Registry
          </Button>
        </div>

        <ScrollArea className="h-[420px]">
          {filteredSuppliers.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="group min-w-0 px-3.5 py-4 transition-colors hover:bg-muted/25 sm:px-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-[11px] font-bold text-muted-foreground">
                        {supplier.name.slice(0, 1)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
                                {supplier.name}
                            </p>
                            {supplier.supplierCode && (
                                <Badge variant="outline" className="font-mono text-[8px] border-border/60 bg-background px-1.5">
                                    {supplier.supplierCode}
                                </Badge>
                            )}
                        </div>

                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          {supplier.phone && (
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              <span className="truncate font-mono text-[9px] text-muted-foreground">
                                {supplier.phone}
                              </span>
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Mail className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              <span className="truncate text-[9px] text-muted-foreground">
                                {supplier.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => handleOpenEdit(supplier)}
                      aria-label={`Edit ${supplier.name}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Building className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">No vendors identified</p>
              <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-muted-foreground">
                Register suppliers from the product catalog or log them here.
              </p>
            </div>
          )}
        </ScrollArea>
      </section>

      {isEditDialogOpen && supplierToEdit && (
        <EditSupplierDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          supplier={supplierToEdit}
        />
      )}
    </div>
  );
}
