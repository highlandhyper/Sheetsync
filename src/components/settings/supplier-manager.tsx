'use client';

import { useState, useMemo } from 'react';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building,
  Search,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Database,
  Smartphone,
  Mail,
  PlusCircle,
  Edit,
  Barcode,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { Supplier, Product } from '@/lib/types';
import { EditSupplierDialog } from '@/components/suppliers/edit-supplier-dialog';
import { AddSupplierDialog } from '@/components/suppliers/add-supplier-dialog';

export function SupplierManager() {
  const { toast } = useToast();
  const { supplierContacts, products, isSyncing, refreshData } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // GLOBAL PING LOGIC: Search across contacts and product catalog
  const searchResults = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];

    const resultsMap = new Map<string, { type: 'contact' | 'db_only', supplier: Supplier }>();

    // 1. Check existing contact registry (exact or fuzzy)
    supplierContacts.forEach(contact => {
        const matchesName = contact.name.toLowerCase().includes(term);
        const matchesCode = contact.supplierCode?.toLowerCase() === term;
        if (matchesName || matchesCode) {
            resultsMap.set(contact.name.toLowerCase(), { type: 'contact', supplier: contact });
        }
    });

    // 2. "Ping" product DB for names not in registry
    products.forEach(product => {
        if (!product.supplierName) return;
        const name = product.supplierName;
        if (name.toLowerCase().includes(term) && !resultsMap.has(name.toLowerCase())) {
            resultsMap.set(name.toLowerCase(), { 
                type: 'db_only', 
                supplier: { id: `tmp_${name}`, name, lastReportValue: 0 } 
            });
        }
    });

    return Array.from(resultsMap.values());
  }, [supplierContacts, products, searchTerm]);

  const handleOpenEdit = (supplier: Supplier, isNew: boolean) => {
    if (isNew) {
        // If it's a "db_only" result, we can't edit it directly via ID, 
        // we'd normally open a register dialog. For now, let's allow editing as if new.
        setSupplierToEdit({ ...supplier, id: '' });
    } else {
        setSupplierToEdit(supplier);
    }
    setIsEditDialogOpen(true);
  };

  return (
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      {/* Overview Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20 shadow-sm">
            <Building className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold tracking-tight text-foreground leading-none mb-1">
              Supplier Maintenance
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider opacity-60">
              Registry Lookup & Protocol Management
            </p>
          </div>
        </div>
        
        <Button 
            onClick={() => refreshData()} 
            variant="outline" 
            size="sm" 
            disabled={isSyncing}
            className="h-9 rounded-xl border-border/60 bg-background text-[10px] font-black uppercase tracking-widest shadow-none"
          >
            {isSyncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />}
            Sync DB
        </Button>
      </div>

      {/* SEARCH TERMINAL */}
      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" strokeWidth={2.5} />
          <Input
            placeholder="IDENTIFY SUPPLIER BY NAME OR CODE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-16 pl-12 rounded-[1.25rem] bg-muted/20 border-white/5 font-bold text-lg uppercase tracking-tight shadow-inner focus-visible:ring-primary/20 placeholder:text-muted-foreground/20 placeholder:font-black placeholder:uppercase placeholder:text-xs placeholder:tracking-[0.3em]"
          />
        </div>

        {/* RESULTS INTERFACE */}
        <div className="space-y-2.5">
          {searchResults.length > 0 ? (
            searchResults.map(({ type, supplier }) => (
                <div 
                    key={supplier.name}
                    className="group relative flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/20 hover:bg-primary/[0.02]"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-black text-lg",
                            type === 'contact' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/40"
                        )}>
                            {supplier.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-base font-black text-foreground uppercase tracking-tight truncate">{supplier.name}</h4>
                                {type === 'contact' ? (
                                    <Badge variant="outline" className="text-[8px] font-black border-emerald-500/20 bg-emerald-500/5 text-emerald-600 uppercase tracking-widest px-1.5">REGISTRY_OK</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[8px] font-black border-amber-500/20 bg-amber-500/5 text-amber-600 uppercase tracking-widest px-1.5">DB_PING_ONLY</Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                {supplier.supplierCode && <span className="flex items-center gap-1"><Barcode className="h-3 w-3" /> {supplier.supplierCode}</span>}
                                {type === 'contact' && (
                                    <>
                                        {supplier.phone && <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {supplier.phone}</span>}
                                        {supplier.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {supplier.email}</span>}
                                    </>
                                )}
                                {type === 'db_only' && <span className="text-amber-600/70">Found in product catalog. Awaiting registration.</span>}
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={() => handleOpenEdit(supplier, type === 'db_only')}
                        className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/10"
                    >
                        {type === 'contact' ? <Edit className="mr-2 h-3.5 w-3.5" /> : <PlusCircle className="mr-2 h-3.5 w-3.5" />}
                        {type === 'contact' ? 'Maintain Node' : 'Register Vendor'}
                    </Button>
                </div>
            ))
          ) : searchTerm ? (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-muted/20 p-6 rounded-[2rem] mb-4">
                    <Database className="h-10 w-10 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest">Zero Matches Found</h4>
                <p className="text-[10px] font-medium text-muted-foreground max-w-[240px] mx-auto mt-1">
                    The registry pinged all nodes and catalog products but found no match for your query.
                </p>
            </div>
          ) : (
            <div className="py-24 border-2 border-dashed border-muted rounded-[2rem] flex flex-col items-center justify-center text-center opacity-40">
                <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <h4 className="text-sm font-black uppercase tracking-tight leading-none">Ready for Identification</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Enter code or name to update vendor nodes</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-8 flex justify-center">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground/20">SheetSync Industrial Protocol • v6.2 Secure Registry</p>
      </div>

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
