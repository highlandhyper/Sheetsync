'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import type { InventoryItem } from '@/lib/types';
import { 
    Search, 
    PackageOpen, 
    FilterX, 
    Eye, 
    Undo2, 
    Tag, 
    Printer, 
    CalendarIcon, 
    Trash2, 
    Building, 
    Wallet, 
    FileText, 
    ChevronDown, 
    Barcode, 
    ChevronsUpDown, 
    Check, 
    MapPin,
    Scan,
    X,
    AlertTriangle
} from 'lucide-react';
import { addDays, parseISO, isValid, isBefore, format, isAfter, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { ReturnQuantityDialog } from '@/components/inventory/return-quantity-dialog';
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog';
import { DeleteConfirmationDialog } from '@/components/inventory/delete-inventory-item-dialog';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { BulkReturnDialog } from './bulk-return-dialog';
import { BulkDeleteDialog } from './bulk-delete-dialog';
import { useMultiSelect } from '@/context/multi-select-context';
import { CreateProductFromInventoryDialog } from '../products/create-product-from-inventory-dialog';
import { useDataCache } from '@/context/data-cache-context';
import { InventoryItemCardMobile } from './inventory-item-card-mobile';
import { InventoryItemGroupDetailsDialog, type GroupedInventoryItem } from './inventory-item-group-details-dialog';
import { InventoryItemDetailsDialog } from './inventory-item-details-dialog';
import { generateInventoryPDF, type PDFOrientation } from '@/lib/pdf-reports';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import Fuse from 'fuse.js';

const ALL_SUPPLIERS_VALUE = "___ALL_SUPPLIERS___";
const ALL_LOCATIONS_VALUE = "___ALL_LOCATIONS___";
const SCANNER_REGION_ID = "inventory-list-filter-scanner";

const playProfessionalBeep = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.warn("Audio feedback failed:", e);
  }
};

type DashboardFilterType = {
  type: 'damaged' | 'expiringSoon' | 'otherSuppliers' | 'customExpiry' | 'specificSupplier';
  suppliers?: string[];
  customExpiryFrom?: string;
  customExpiryTo?: string;
} | null;

export function InventoryListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { role } = useAuth();
  const { isMultiSelectEnabled } = useMultiSelect();
  const isMobile = useIsMobile();
  const { 
      inventoryItems: cachedItems,
      products: cachedProducts,
      suppliers,
      uniqueLocations,
      addProduct: addProductToCache, 
      refreshData: onDataNeeded,
  } = useDataCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  
  const [activeDashboardFilter, setActiveDashboardFilter] = useState<DashboardFilterType>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentItemToEdit, setCurrentItemToEdit] = useState<InventoryItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItemForDeletion, setSelectedItemForDeletion] = useState<InventoryItem | null>(null);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedInventoryItem | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);
  const [shouldAutoFetchImage, setShouldAutoFetchImage] = useState(false);

  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  const [isBulkReturnOpen, setIsBulkReturnOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [barcodeToCreate, setBarcodeToCreate] = useState<string | null>(null);

  const [isScannerDialogOpen, setIsScannerDialogOpen] = useState(false);
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const scanProcessedRef = useRef(false);

  const productsByBarcode = useMemo(() => {
    return new Map(cachedProducts.map(p => [p.barcode, p]));
  }, [cachedProducts]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // PARSE DASHBOARD REDIRECTS
  useEffect(() => {
    const filterType = searchParams.get('filterType');
    if (!filterType) {
      setActiveDashboardFilter(null);
      return;
    }

    if (filterType === 'damaged') {
      setActiveDashboardFilter({ type: 'damaged' });
    } else if (filterType === 'expiringSoon') {
      setActiveDashboardFilter({ type: 'expiringSoon' });
    } else if (filterType === 'specificSupplier') {
        const suppliersStr = searchParams.get('suppliers');
        if (suppliersStr) {
            setSelectedSupplier(decodeURIComponent(suppliersStr));
            setActiveDashboardFilter(null);
        }
    } else if (filterType === 'otherSuppliers') {
        const suppliersStr = searchParams.get('suppliers');
        if (suppliersStr) {
            setActiveDashboardFilter({ 
              type: 'otherSuppliers', 
              suppliers: decodeURIComponent(suppliersStr).split(',') 
            });
        }
    }
  }, [searchParams]);

  // FUZZY SEARCH ENGINE
  const fuse = useMemo(() => new Fuse(cachedItems, {
    keys: ['productName'],
    threshold: 0.4,
    distance: 100,
    minMatchCharLength: 2,
    useExtendedSearch: true
  }), [cachedItems]);

  const filteredItemsBySearchAndSupplierAndDate = useMemo(() => {
    let items = cachedItems;

    if (debouncedSearch) {
        const term = debouncedSearch.trim();
        const normalizedTerm = term.replace(/^0+/, '');
        
        const exactBarcodeItems = items.filter(item => {
            const itemBc = item.barcode.trim();
            return itemBc === term || itemBc.replace(/^0+/, '') === normalizedTerm;
        });
        
        if (exactBarcodeItems.length > 0) {
            items = exactBarcodeItems;
        } else {
            items = fuse.search(term).map(r => r.item);
        }
    }

    if (activeDashboardFilter) {
       switch(activeDashboardFilter.type) {
        case 'damaged': items = items.filter(item => item.itemType === 'Damage'); break;
        case 'expiringSoon': {
            const today = startOfDay(new Date());
            const threshold = startOfDay(addDays(today, 7));
            items = items.filter(item => {
                if (item.itemType === 'Expiry' && item.expiryDate) {
                    try {
                        const expiry = startOfDay(parseISO(item.expiryDate));
                        return isValid(expiry) && !isBefore(expiry, today) && isBefore(expiry, threshold);
                    } catch { return false; }
                }
                return false;
            });
            break;
        }
        case 'otherSuppliers': case 'specificSupplier': {
            if (activeDashboardFilter.suppliers) {
                const lowerCaseSuppliers = activeDashboardFilter.suppliers.map(s => s.toLowerCase());
                items = items.filter(item => item.supplierName && lowerCaseSuppliers.includes(item.supplierName.toLowerCase()));
            }
            break;
        }
        case 'customExpiry': {
            if (activeDashboardFilter.customExpiryFrom && activeDashboardFilter.customExpiryTo) {
                try {
                    const from = startOfDay(parseISO(activeDashboardFilter.customExpiryFrom));
                    const to = startOfDay(parseISO(activeDashboardFilter.customExpiryTo));
                    if (isValid(from) && isValid(to)) {
                        items = items.filter(item => {
                            if (item.itemType === 'Expiry' && item.expiryDate) {
                                try {
                                    const expiry = startOfDay(parseISO(item.expiryDate));
                                    return isValid(expiry) && !isBefore(expiry, from) && !isAfter(expiry, to);
                                } catch { return false; }
                            }
                            return false;
                        });
                    }
                } catch { }
            }
            break;
        }
       }
    }

    if (selectedSupplier) {
        items = items.filter(item => item.supplierName === selectedSupplier);
    }

    if (selectedLocation) {
        items = items.filter(item => item.location === selectedLocation);
    }

    if (selectedDateRange?.from && selectedDateRange.to) {
        const fromDate = startOfDay(selectedDateRange.from);
        const toDate = endOfDay(selectedDateRange.to);
        items = items.filter(item => {
            if (item.itemType === 'Expiry' && item.expiryDate) {
                try {
                    const expiry = startOfDay(parseISO(item.expiryDate));
                    return isValid(expiry) && !isBefore(expiry, fromDate) && !isAfter(expiry, toDate);
                } catch { return false; }
            }
            return false;
        });
    }

    if (typeFilter !== 'all') {
      const today = startOfDay(new Date());
      items = items.filter(item => {
        if (typeFilter === 'damage') return item.itemType === 'Damage';
        if (typeFilter === 'expiry') return item.itemType === 'Expiry';
        if (typeFilter === 'expired') {
          if (item.itemType !== 'Expiry' || !item.expiryDate) return false;
          try {
            const expiry = startOfDay(parseISO(item.expiryDate));
            return isValid(expiry) && (isBefore(expiry, today) || isSameDay(expiry, today));
          } catch { return false; }
        }
        return true;
      });
    }

    return items;
  }, [cachedItems, activeDashboardFilter, debouncedSearch, selectedSupplier, selectedLocation, selectedDateRange, typeFilter, fuse]);
  
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { individualItems: InventoryItem[]; totalQuantity: number }>();

    for (const item of filteredItemsBySearchAndSupplierAndDate) {
        if (item.quantity <= 0) continue; 
        if (!groups.has(item.barcode)) {
            groups.set(item.barcode, { individualItems: [], totalQuantity: 0 });
        }
        const group = groups.get(item.barcode)!;
        group.individualItems.push(item);
        group.totalQuantity += item.quantity;
    }

    const result: GroupedInventoryItem[] = [];
    for (const [barcode, groupData] of groups.entries()) {
        groupData.individualItems.sort((a, b) => {
            const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : 0;
            const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : 0;
            return dateB - dateA;
        });
        result.push({ mainItem: groupData.individualItems[0], individualItems: groupData.individualItems, totalQuantity: groupData.totalQuantity });
    }

    const sortOrder = searchParams.get('sort') || 'newest';

    result.sort((a, b) => {
        if (sortOrder === 'newest') {
            const dateA = a.mainItem.timestamp ? parseISO(a.mainItem.timestamp).getTime() : 0;
            const dateB = b.mainItem.timestamp ? parseISO(b.mainItem.timestamp).getTime() : 0;
            return dateB - dateA;
        } else if (sortOrder === 'name') {
            return a.mainItem.productName.localeCompare(b.mainItem.productName);
        } else if (sortOrder === 'qty') {
            return b.totalQuantity - a.totalQuantity;
        }
        return 0;
    });

    return result;
  }, [filteredItemsBySearchAndSupplierAndDate, searchParams]);

  useEffect(() => {
    if (isGroupDetailsOpen && selectedGroup) {
        const matchingGroup = groupedItems.find(g => g.mainItem.barcode === selectedGroup.mainItem.barcode);
        if (matchingGroup) setSelectedGroup(matchingGroup);
        else { setIsGroupDetailsOpen(false); setSelectedGroup(null); }
    }
  }, [groupedItems, isGroupDetailsOpen, selectedGroup]);

  const totalValueOfSelectedItems = useMemo(() => {
    if (selectedBarcodes.size === 0) return 0;
    let totalValue = 0;
    groupedItems.forEach(group => {
      if (selectedBarcodes.has(group.mainItem.barcode)) {
        totalValue += (productsByBarcode.get(group.mainItem.barcode)?.costPrice ?? 0) * group.totalQuantity;
      }
    });
    return totalValue;
  }, [selectedBarcodes, groupedItems, productsByBarcode]);
  
  const getItemsForBulkAction = (): string[] => {
    if (selectedBarcodes.size === 0) return [];
    const itemIds: string[] = [];
    groupedItems.forEach(group => {
        if(selectedBarcodes.has(group.mainItem.barcode)) group.individualItems.forEach(item => itemIds.push(item.id));
    });
    return itemIds;
  };

  const clearFilters = () => {
    setSearchTerm(''); setSelectedSupplier(''); setSelectedLocation(''); setSelectedDateRange(undefined); setIsDatePopoverOpen(false); setTypeFilter('all');
    if (activeDashboardFilter || searchParams.get('filterType')) {
       setActiveDashboardFilter(null); 
       router.replace('/inventory'); 
    }
  }

  const handleSupplierChange = (value: string) => {
    setSelectedSupplier(value === ALL_SUPPLIERS_VALUE ? '' : value);
    if (activeDashboardFilter || searchParams.get('filterType')) { 
      setActiveDashboardFilter(null); 
      router.replace('/inventory'); 
    }
  };

  const handleLocationChange = (value: string) => {
    setSelectedLocation(value === ALL_LOCATIONS_VALUE ? '' : value);
    if (activeDashboardFilter || searchParams.get('filterType')) { 
      setActiveDashboardFilter(null); 
      router.replace('/inventory'); 
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if(activeDashboardFilter || searchParams.get('filterType')) { 
      setActiveDashboardFilter(null); 
      router.replace('/inventory'); 
    }
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setSelectedDateRange(range);
    if (range?.from && range?.to) setIsDatePopoverOpen(false);
    if (activeDashboardFilter || searchParams.get('filterType')) { 
      setActiveDashboardFilter(null); 
      router.replace('/inventory'); 
    }
  }

  const handleOpenGroupDetails = (group: GroupedInventoryItem) => { setSelectedGroup(group); setIsGroupDetailsOpen(true); };
  const handleOpenDetailsDialog = (item: InventoryItem, autoFetch = false) => { 
    setSelectedItemForDetails(item); 
    setShouldAutoFetchImage(autoFetch);
    setIsDetailsDialogOpen(true); 
  };
  const handleOpenReturnDialog = (item: InventoryItem) => { if (role === 'viewer') return; setSelectedItemForReturn(item); setIsReturnDialogOpen(true); };
  const handleOpenEditDialog = (item: InventoryItem) => { if (role === 'viewer') return; setCurrentItemToEdit(item); setIsEditDialogOpen(true); };
  const handleOpenDeleteDialog = (item: InventoryItem) => { if (role !== 'admin') return; setSelectedItemForDeletion(item); setIsDeleteDialogOpen(true); };

  const handleActionSuccess = useCallback(() => {
    setIsReturnDialogOpen(false); 
    setIsEditDialogOpen(false); 
    setIsDeleteDialogOpen(false);
    setSelectedBarcodes(new Set());
  }, []);

  const handleExportPDF = (orientation: PDFOrientation) => {
    const cols = ['No.', 'Product Name', 'Barcode', 'Supplier', 'Qty', 'Unit Cost', 'Total Value', 'Expiry', 'Location'];
    const dataMapper = (group: GroupedInventoryItem, idx: number) => {
        const product = productsByBarcode.get(group.mainItem.barcode);
        const cost = product?.costPrice ?? 0;
        const hasMultipleLocs = new Set(group.individualItems.map(i => i.location)).size > 1;
        return [
            (idx + 1).toString(), group.mainItem.productName, group.mainItem.barcode,
            group.mainItem.supplierName || 'N/A', group.totalQuantity.toString(),
            `QAR ${cost.toFixed(2)}`, `QAR ${(cost * group.totalQuantity).toFixed(2)}`,
            group.mainItem.expiryDate || 'N/A', hasMultipleLocs ? "Multiple" : group.mainItem.location
        ];
    };
    let totalVal = 0; groupedItems.forEach(g => totalVal += (productsByBarcode.get(g.mainItem.barcode)?.costPrice ?? 0) * g.totalQuantity);
    generateInventoryPDF('Current Inventory Summary', groupedItems, cols, (g) => dataMapper(g, groupedItems.indexOf(g)), totalVal, orientation);
  };

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scanProcessedRef.current || !decodedText) return;
    scanProcessedRef.current = true;
    playProfessionalBeep();
    setSearchTerm(decodedText);
    setIsScannerDialogOpen(false);
    toast({ title: "Barcode Identified", description: `Filtering records for: ${decodedText}` });
    setTimeout(() => { scanProcessedRef.current = false; }, 1000);
  }, [toast]);

  useEffect(() => {
    if (isScannerDialogOpen) {
      const timer = setTimeout(() => {
        if (html5QrcodeScannerRef.current) return;
        const scanner = new Html5Qrcode(SCANNER_REGION_ID, false);
        scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onScanSuccess,
          () => {}
        ).then(() => {
          html5QrcodeScannerRef.current = scanner;
        }).catch(() => {
          toast({ variant: 'destructive', title: 'Hardware Error', description: 'Optical system failed.' });
          setIsScannerDialogOpen(false);
        });
      }, 800);
      return () => {
        clearTimeout(timer);
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.stop().catch(console.error);
          html5QrcodeScannerRef.current = null;
        }
      };
    }
  }, [isScannerDialogOpen, onScanSuccess, toast]);

  const inventorySummary = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;

    groupedItems.forEach((group) => {
      totalUnits += group.totalQuantity;
      const cost = productsByBarcode.get(group.mainItem.barcode)?.costPrice ?? 0;
      totalValue += cost * group.totalQuantity;
    });

    return {
      products: groupedItems.length,
      totalUnits,
      totalValue,
    };
  }, [groupedItems, productsByBarcode]);

  const hasActiveFilters = Boolean(
    searchTerm ||
    selectedSupplier ||
    selectedLocation ||
    activeDashboardFilter ||
    selectedDateRange ||
    typeFilter !== 'all'
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-4 overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
      {/* OVERVIEW */}
      <section className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
        <Card className="min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="min-w-0 p-3 sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Products
                </p>
                <p className="mt-1 truncate text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                  {inventorySummary.products}
                </p>
              </div>
              <Barcode className="h-4 w-4 shrink-0 text-primary sm:h-[18px] sm:w-[18px]" />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="min-w-0 p-3 sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Units
                </p>
                <p className="mt-1 truncate text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                  {inventorySummary.totalUnits.toLocaleString()}
                </p>
              </div>
              <PackageOpen className="h-4 w-4 shrink-0 text-primary sm:h-[18px] sm:w-[18px]" />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="min-w-0 p-3 sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                  Value
                </p>
                <p className="mt-1 truncate text-[13px] font-bold tracking-tight text-foreground sm:text-xl">
                  QAR {inventorySummary.totalValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <Wallet className="h-4 w-4 shrink-0 text-primary sm:h-[18px] sm:w-[18px]" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SEARCH + FILTER WORKSPACE */}
      <Card className="filters-card-noprint min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="min-w-0 p-3 sm:p-4">
          {selectedBarcodes.size > 0 && role === 'admin' && isMultiSelectEnabled ? (
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Check className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                      {selectedBarcodes.size} products selected
                    </p>
                    <p className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                      Selected value: QAR{' '}
                      {totalValueOfSelectedItems.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:flex">
                <Button
                  variant="outline"
                  onClick={() => setIsBulkReturnOpen(true)}
                  className="h-10 rounded-xl border-border/60 px-3 text-[10px] font-semibold shadow-none"
                >
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  Return selected
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="h-10 rounded-xl px-3 text-[10px] font-semibold shadow-none"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete selected
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 space-y-3">
              {/* Primary search */}
              <div className="flex min-w-0 gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="search"
                    placeholder="Search product name, barcode or personnel"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="h-11 min-w-0 rounded-xl border-border/60 bg-background pl-10 pr-3 text-xs shadow-none sm:text-sm"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsScannerDialogOpen(true)}
                  className="h-11 w-11 shrink-0 rounded-xl border-border/60 bg-background text-primary shadow-none"
                  aria-label="Scan barcode"
                >
                  <Scan className="h-[18px] w-[18px]" />
                </Button>
              </div>

              {/* Filters */}
              <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-[minmax(180px,1.2fr)_minmax(160px,1fr)_minmax(130px,.7fr)_minmax(160px,.9fr)_auto]">
                <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierComboboxOpen}
                      className="h-10 min-w-0 justify-between rounded-xl border-border/60 bg-background px-3 text-left text-[10px] font-medium shadow-none"
                    >
                      <div className="flex min-w-0 items-center">
                        <Building className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {selectedSupplier || 'All suppliers'}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search supplier..." />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value={ALL_SUPPLIERS_VALUE}
                            onSelect={() => {
                              handleSupplierChange(ALL_SUPPLIERS_VALUE);
                              setSupplierComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                !selectedSupplier ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            All Suppliers
                          </CommandItem>

                          {suppliers.map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={supplier.name}
                              onSelect={() => {
                                handleSupplierChange(supplier.name);
                                setSupplierComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedSupplier === supplier.name
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {supplier.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={locationComboboxOpen}
                      className="h-10 min-w-0 justify-between rounded-xl border-border/60 bg-background px-3 text-left text-[10px] font-medium shadow-none"
                    >
                      <div className="flex min-w-0 items-center">
                        <MapPin className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {selectedLocation || 'All locations'}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search location..." />
                      <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value={ALL_LOCATIONS_VALUE}
                            onSelect={() => {
                              handleLocationChange(ALL_LOCATIONS_VALUE);
                              setLocationComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                !selectedLocation ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            All Locations
                          </CommandItem>

                          {uniqueLocations.map((location) => (
                            <CommandItem
                              key={location}
                              value={location}
                              onSelect={() => {
                                handleLocationChange(location);
                                setLocationComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedLocation === location
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {location}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-10 min-w-0 rounded-xl border-border/60 bg-background px-3 text-[10px] shadow-none">
                    <div className="flex min-w-0 items-center">
                      <Tag className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <SelectValue placeholder="Type" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="expiry">Expiry</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>

                <Popover
                  open={isDatePopoverOpen}
                  onOpenChange={setIsDatePopoverOpen}
                  modal={true}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'col-span-2 h-10 min-w-0 justify-start rounded-xl border-border/60 bg-background px-3 text-left text-[10px] font-medium shadow-none lg:col-span-1',
                        !selectedDateRange && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {selectedDateRange?.from ? (
                          selectedDateRange.to ? (
                            <>
                              {format(selectedDateRange.from, 'LLL dd')} –{' '}
                              {format(selectedDateRange.to, 'LLL dd')}
                            </>
                          ) : (
                            format(selectedDateRange.from, 'LLL dd')
                          )
                        ) : (
                          'Expiry range'
                        )}
                      </span>
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={selectedDateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>

                <div className="col-span-2 grid grid-cols-3 gap-2 lg:col-span-1 lg:flex">
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      onClick={clearFilters}
                      className="h-10 rounded-xl px-2 text-[9px] font-semibold text-muted-foreground lg:w-10"
                      aria-label="Clear filters"
                    >
                      <FilterX className="h-3.5 w-3.5 lg:mr-0" />
                      <span className="ml-1 lg:hidden">Clear</span>
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'h-10 rounded-xl border-border/60 px-2 text-[9px] font-semibold shadow-none',
                          !hasActiveFilters && 'col-span-2 lg:col-span-1'
                        )}
                        disabled={groupedItems.length === 0}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Export
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportPDF('portrait')}>
                        Portrait
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportPDF('landscape')}>
                        Landscape
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    onClick={() => window.print()}
                    variant="outline"
                    className="h-10 rounded-xl border-border/60 px-2 text-[9px] font-semibold shadow-none"
                    disabled={groupedItems.length === 0}
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Print
                  </Button>
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/50 pt-3">
                <p className="truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {groupedItems.length}
                  </span>{' '}
                  active product groups
                </p>

                {hasActiveFilters && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 rounded-lg border-0 px-2 py-0.5 text-[8px] font-semibold"
                  >
                    Filtered
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* INVENTORY RESULTS */}
      {groupedItems.length > 0 ? (
        <>
          {/* Desktop */}
          <Card className="hidden min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader className="bg-muted/25">
                  <TableRow className="h-11 border-border/50 hover:bg-transparent">
                    {role === 'admin' && isMultiSelectEnabled && (
                      <TableHead className="w-11 pl-3 text-center noprint">
                        <Checkbox
                          checked={
                            selectedBarcodes.size > 0 &&
                            selectedBarcodes.size === groupedItems.length
                          }
                          onCheckedChange={(checked) =>
                            checked
                              ? setSelectedBarcodes(
                                  new Set(
                                    groupedItems.map(
                                      (group) => group.mainItem.barcode
                                    )
                                  )
                                )
                              : setSelectedBarcodes(new Set())
                          }
                        />
                      </TableHead>
                    )}

                    <TableHead className="min-w-[240px] text-[9px] font-semibold text-muted-foreground">
                      Product
                    </TableHead>
                    <TableHead className="w-[145px] text-[9px] font-semibold text-muted-foreground">
                      Barcode
                    </TableHead>
                    <TableHead className="w-[85px] text-right text-[9px] font-semibold text-muted-foreground">
                      Stock
                    </TableHead>
                    <TableHead className="w-[100px] text-right text-[9px] font-semibold text-muted-foreground">
                      Unit cost
                    </TableHead>
                    <TableHead className="w-[115px] text-right text-[9px] font-semibold text-muted-foreground">
                      Value
                    </TableHead>
                    <TableHead className="w-[125px] text-[9px] font-semibold text-muted-foreground">
                      Location
                    </TableHead>
                    <TableHead className="w-[135px] text-[9px] font-semibold text-muted-foreground">
                      Expiry
                    </TableHead>
                    <TableHead className="w-[90px] text-[9px] font-semibold text-muted-foreground">
                      Type
                    </TableHead>
                    <TableHead className="w-[132px] pr-3 text-right text-[9px] font-semibold text-muted-foreground noprint">
                      Activity
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {groupedItems.map((group) => {
                    const { mainItem, totalQuantity, individualItems } = group;
                    const product = productsByBarcode.get(mainItem.barcode);
                    const cost = product?.costPrice;
                    const hasMultipleExpiry =
                      new Set(individualItems.map((item) => item.expiryDate)).size > 1;
                    const hasMultipleLocs =
                      new Set(individualItems.map((item) => item.location)).size > 1;
                    const hasMultipleTypes =
                      new Set(individualItems.map((item) => item.itemType)).size > 1;

                    const isExpired =
                      !hasMultipleExpiry &&
                      mainItem.expiryDate &&
                      (() => {
                        try {
                          const expiry = startOfDay(parseISO(mainItem.expiryDate));
                          const today = startOfDay(new Date());
                          return (
                            isValid(expiry) &&
                            (isBefore(expiry, today) || isSameDay(expiry, today))
                          );
                        } catch {
                          return false;
                        }
                      })();

                    return (
                      <TableRow
                        key={`row-${mainItem.barcode}`}
                        data-state={
                          selectedBarcodes.has(mainItem.barcode)
                            ? 'selected'
                            : undefined
                        }
                        className="group h-[58px] border-border/50 transition-colors hover:bg-muted/20"
                      >
                        {role === 'admin' && isMultiSelectEnabled && (
                          <TableCell className="w-11 pl-3 text-center noprint">
                            <Checkbox
                              checked={selectedBarcodes.has(mainItem.barcode)}
                              onCheckedChange={() =>
                                setSelectedBarcodes((previous) => {
                                  const next = new Set(previous);
                                  if (next.has(mainItem.barcode)) {
                                    next.delete(mainItem.barcode);
                                  } else {
                                    next.add(mainItem.barcode);
                                  }
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                        )}

                        <TableCell className="min-w-0 py-2.5">
                          <div className="min-w-0">
                            <p className="max-w-[360px] truncate text-[11px] font-semibold tracking-tight text-foreground">
                              {mainItem.productName}
                            </p>
                            <p className="mt-0.5 max-w-[320px] truncate text-[9px] font-medium text-muted-foreground">
                              {mainItem.supplierName || 'No registered supplier'}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-[9px] text-muted-foreground">
                          {mainItem.barcode}
                        </TableCell>

                        <TableCell className="text-right text-[11px] font-bold tabular-nums text-primary">
                          {totalQuantity}
                        </TableCell>

                        <TableCell className="text-right text-[10px] tabular-nums text-muted-foreground">
                          {cost !== undefined ? `QAR ${cost.toFixed(2)}` : 'N/A'}
                        </TableCell>

                        <TableCell className="text-right text-[10px] font-semibold tabular-nums text-foreground">
                          {cost !== undefined
                            ? `QAR ${(cost * totalQuantity).toFixed(2)}`
                            : 'N/A'}
                        </TableCell>

                        <TableCell className="text-[10px] text-muted-foreground">
                          <span className="line-clamp-2">
                            {hasMultipleLocs ? 'Multiple' : mainItem.location || 'N/A'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex max-w-[126px] truncate rounded-lg px-2 py-1 text-[9px] font-medium',
                              isExpired
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted/50 text-muted-foreground'
                            )}
                          >
                            {hasMultipleExpiry
                              ? 'Multiple'
                              : mainItem.expiryDate
                                ? format(parseISO(mainItem.expiryDate), 'dd MMM yyyy')
                                : 'N/A'}
                          </span>
                        </TableCell>

                        <TableCell>
                          {hasMultipleTypes ? (
                            <Badge
                              variant="outline"
                              className="rounded-lg border-border/60 bg-muted/30 px-2 py-0.5 text-[8px] font-semibold text-muted-foreground"
                            >
                              Multiple
                            </Badge>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex rounded-lg px-2 py-1 text-[9px] font-medium',
                                mainItem.itemType === 'Damage'
                                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                  : 'bg-primary/10 text-primary'
                              )}
                            >
                              {mainItem.itemType}
                            </span>
                          )}
                        </TableCell>

                        {/* Fixed-width activity/action area prevents row content from shifting on hover */}
                        <TableCell className="relative w-[132px] min-w-[132px] max-w-[132px] pr-3 text-right noprint">
                          <div className="relative h-9 w-full">
                            <span className="absolute inset-0 flex items-center justify-end whitespace-nowrap text-[9px] tabular-nums text-muted-foreground transition-opacity duration-150 group-hover:opacity-0">
                              {mainItem.timestamp
                                ? format(parseISO(mainItem.timestamp), 'dd/MM/yy HH:mm')
                                : 'N/A'}
                            </span>

                            <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                              {individualItems.length === 1 ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenDetailsDialog(mainItem)}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                    aria-label="View details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>

                                  {role !== 'viewer' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenReturnDialog(mainItem)}
                                      disabled={mainItem.quantity <= 0}
                                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                      aria-label="Return item"
                                    >
                                      <Undo2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}

                                  {role === 'admin' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenDeleteDialog(mainItem)}
                                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                      aria-label="Delete item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenGroupDetails(group)}
                                  className="h-8 rounded-lg border-primary/20 bg-primary/5 px-2 text-[9px] font-semibold text-primary shadow-none hover:bg-primary/10"
                                >
                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                  {individualItems.length} Logs
                                </Button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile */}
          <div className="grid min-w-0 grid-cols-1 gap-3 md:hidden">
            {groupedItems.map((group) => (
              <InventoryItemCardMobile
                key={`card-${group.mainItem.barcode}`}
                item={group.mainItem}
                product={productsByBarcode.get(group.mainItem.barcode)}
                totalQuantity={group.totalQuantity}
                individualItemCount={group.individualItems.length}
                onDetails={
                  group.individualItems.length === 1
                    ? () => handleOpenDetailsDialog(group.mainItem)
                    : () => handleOpenGroupDetails(group)
                }
                onViewImage={() => handleOpenDetailsDialog(group.mainItem, true)}
                onReturn={
                  role !== 'viewer'
                    ? () => handleOpenReturnDialog(group.mainItem)
                    : undefined
                }
                onDelete={
                  role === 'admin'
                    ? () => handleOpenDeleteDialog(group.mainItem)
                    : undefined
                }
                isSelected={
                  isMultiSelectEnabled &&
                  selectedBarcodes.has(group.mainItem.barcode)
                }
                onSelect={
                  isMultiSelectEnabled && role === 'admin'
                    ? () => {
                        const next = new Set(selectedBarcodes);
                        if (next.has(group.mainItem.barcode)) {
                          next.delete(group.mainItem.barcode);
                        } else {
                          next.add(group.mainItem.barcode);
                        }
                        setSelectedBarcodes(next);
                      }
                    : undefined
                }
                context="inventory"
              />
            ))}
          </div>
        </>
      ) : (
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center px-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PackageOpen className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No inventory items found
            </h3>

            <p className="mt-1 max-w-xs text-[10px] leading-4 text-muted-foreground">
              {hasActiveFilters
                ? 'No active inventory records match the current filters.'
                : 'Log new inventory items to see them here.'}
            </p>

            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="mt-3 h-9 rounded-xl border-border/60 px-3 text-[9px] font-semibold shadow-none"
              >
                <FilterX className="mr-1.5 h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <InventoryItemGroupDetailsDialog
        key={
          selectedGroup
            ? `group-${selectedGroup.mainItem.barcode}`
            : 'group-none'
        }
        group={selectedGroup}
        isOpen={isGroupDetailsOpen}
        onOpenChange={setIsGroupDetailsOpen}
        onActionSuccess={handleActionSuccess}
        onOpenReturnDialog={handleOpenReturnDialog}
        onOpenEditDialog={handleOpenEditDialog}
        onOpenDeleteDialog={handleOpenDeleteDialog}
      />

      <InventoryItemDetailsDialog
        key={
          selectedItemForDetails
            ? `details-${selectedItemForDetails.id}`
            : 'details-none'
        }
        item={selectedItemForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        autoFetchImage={shouldAutoFetchImage}
        onStartEdit={role === 'admin' ? handleOpenEditDialog : undefined}
      />

      <ReturnQuantityDialog
        key={
          selectedItemForReturn
            ? `return-${selectedItemForReturn.id}`
            : 'return-none'
        }
        item={selectedItemForReturn}
        isOpen={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        onReturnSuccess={handleActionSuccess}
      />

      <EditInventoryItemDialog
        key={
          currentItemToEdit
            ? `edit-${currentItemToEdit.id}`
            : 'edit-none'
        }
        item={currentItemToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleActionSuccess}
        uniqueLocationsFromDb={uniqueLocations}
      />

      <DeleteConfirmationDialog
        key={
          selectedItemForDeletion
            ? `delete-${selectedItemForDeletion.id}`
            : 'delete-none'
        }
        item={selectedItemForDeletion}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleActionSuccess}
      />

      {barcodeToCreate && (
        <CreateProductFromInventoryDialog
          barcode={barcodeToCreate}
          allSuppliers={suppliers}
          isOpen={isCreateProductDialogOpen}
          onSuccess={(product) => {
            addProductToCache(product);
            onDataNeeded();
          }}
          onOpenChange={setIsCreateProductDialogOpen}
        />
      )}

      <BulkReturnDialog
        isOpen={isBulkReturnOpen}
        onOpenChange={setIsBulkReturnOpen}
        itemIds={getItemsForBulkAction()}
        onSuccess={handleActionSuccess}
        itemCount={getItemsForBulkAction().length}
      />

      <BulkDeleteDialog
        isOpen={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        itemIds={getItemsForBulkAction()}
        onSuccess={handleActionSuccess}
        itemCount={getItemsForBulkAction().length}
      />

      <Dialog open={isScannerDialogOpen} onOpenChange={setIsScannerDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-muted/20 p-4 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Scan className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-semibold tracking-tight">
                  Scan barcode
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                  Position the barcode inside the camera frame.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="relative h-[58dvh] min-h-[300px] max-h-[440px] w-full bg-black">
            <div
              id={SCANNER_REGION_ID}
              className="relative h-full w-full bg-black [&>span]:hidden"
            />
            <div className="scanner-overlay">
              <div className="scanner-focus">
                <div className="scanner-laser" />
                <div className="scanner-corner scanner-corner-tl" />
                <div className="scanner-corner scanner-corner-tr" />
                <div className="scanner-corner scanner-corner-bl" />
                <div className="scanner-corner scanner-corner-br" />
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 p-3">
            <Button
              variant="ghost"
              onClick={() => setIsScannerDialogOpen(false)}
              className="h-10 w-full rounded-xl text-[10px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="mr-1.5 h-4 w-4" />
              Close scanner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
