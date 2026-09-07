'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { 
    Check, X, Clock, User, ShieldCheck, History, 
    AlertTriangle, Edit, PackagePlus, MessageSquare, 
    ArrowRight, Info, Key, CheckCircle2, Ban,
    Search, FilterX, Hash, MapPin, Tag, Calendar as CalendarIcon,
    ArrowLeftRight, AlertCircle, PlusCircle, ExternalLink
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { updateInventoryItemAction } from '@/app/actions';
import type { SpecialEntryRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { CreateProductFromInventoryDialog } from '@/components/products/create-product-from-inventory-dialog';

export function ApprovalCenterClient() {
    const { pendingRequests, processedRequests, approveRequest, rejectRequest } = useSpecialEntry();
    const { updateInventoryItem, refreshData, suppliers, addProduct } = useDataCache();
    const { user: authUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<SpecialEntryRequest | null>(null);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [duration, setDuration] = useState<string>("single");
    const [isProcessing, setIsProcessing] = useState(false);

    const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
    const [productBarcodeForDialog, setProductBarcodeForDialog] = useState('');

    const filteredPending = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        return pendingRequests.filter(r => {
            const matchesStaff = (r.staffName || "").toLowerCase().includes(lower);
            const matchesEmail = (r.userEmail || "").toLowerCase().includes(lower);
            
            // CRITICAL FIX: Safe access to product properties across different request types
            const prodName = r.editDetails?.productName || r.suggestedProductName || "";
            const matchesProduct = prodName.toLowerCase().includes(lower);
            
            const matchesReason = (r.reason || "").toLowerCase().includes(lower);

            return matchesStaff || matchesEmail || matchesProduct || matchesReason;
        });
    }, [pendingRequests, searchTerm]);

    const handleActionClick = (req: SpecialEntryRequest) => {
        setSelectedRequest(req);
        setIsDetailDialogOpen(true);
    };

    const handleConfirmApproval = () => {
        setIsDetailDialogOpen(false);
        setIsAuthDialogOpen(true);
    };

    const handleRejectRequest = async (id: string) => {
        try {
            await rejectRequest(id);
            toast({ title: 'Request Rejected', description: 'The submission has been declined.' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to reject request.', variant: 'destructive' });
        }
    };

    const handleQuickRegister = (barcode: string) => {
        setProductBarcodeForDialog(barcode);
        setIsCreateProductDialogOpen(true);
    };

    const handleProductCreateSuccess = async (p: any) => {
        addProduct(p);
        
        if (selectedRequest) {
            await approveRequest(selectedRequest.id);
            toast({ title: 'Product Registered', description: `Request for barcode ${p.barcode} has been processed.` });
            setIsDetailDialogOpen(false);
            setSelectedRequest(null);
        }
        
        refreshData();
    };

    const handleAuthorizationSuccess = async () => {
        if (!selectedRequest) return;
        setIsAuthDialogOpen(false);
        setIsProcessing(true);

        try {
            if (selectedRequest.type === 'inventory_edit' && selectedRequest.editDetails) {
                const details = selectedRequest.editDetails;
                const formData = new FormData();
                formData.append('itemId', details.itemId);
                formData.append('location', details.location);
                formData.append('itemType', details.itemType);
                formData.append('userEmail', authUser?.email || 'Admin');
                formData.append('quantity', String(details.quantity));
                if (details.expiryDate) formData.append('expiryDate', details.expiryDate);

                const result = await updateInventoryItemAction(undefined, formData);
                if (result.success && result.data) {
                    updateInventoryItem(result.data);
                    await approveRequest(selectedRequest.id);
                    toast({ title: 'Edit Applied', description: `Approved changes for ${details.productName}.` });
                } else {
                    toast({ title: 'Error', description: result.message || 'Failed to apply requested edit.', variant: 'destructive' });
                }
            } else {
                await approveRequest(selectedRequest.id, duration === 'single' ? undefined : parseInt(duration));
                toast({ title: 'Authorized', description: `Request for ${selectedRequest.staffName} approved.` });
            }
        } catch (error) {
            console.error("Approval error:", error);
            toast({ title: 'Sync Error', description: 'Could not complete approval. Please try again.', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
            setSelectedRequest(null);
        }
    };

    const ComparisonRow = ({
        label,
        original,
        updated,
        icon: Icon,
    }: {
        label: string;
        original: any;
        updated: any;
        icon: any;
    }) => {
        const isChanged = String(original) !== String(updated);

        return (
            <div
                className={cn(
                    "min-w-0 rounded-xl border px-3 py-3 sm:px-4",
                    isChanged
                        ? "border-primary/15 bg-primary/[0.025]"
                        : "border-border/50 bg-muted/20"
                )}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <div
                        className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            isChanged
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {label}
                            </span>

                            {isChanged && (
                                <Badge
                                    variant="outline"
                                    className="shrink-0 rounded-md border-primary/15 bg-primary/5 px-1.5 py-0 text-[7px] font-semibold text-primary"
                                >
                                    Changed
                                </Badge>
                            )}
                        </div>

                        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
                            <div className="min-w-0 rounded-lg bg-background px-2.5 py-2">
                                <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    Current
                                </p>
                                <p
                                    className={cn(
                                        "mt-0.5 truncate text-[9px] font-medium",
                                        isChanged
                                            ? "text-muted-foreground line-through decoration-destructive/40"
                                            : "text-foreground"
                                    )}
                                >
                                    {original || "N/A"}
                                </p>
                            </div>

                            <div className="min-w-0 rounded-lg bg-background px-2.5 py-2">
                                <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    Requested
                                </p>
                                <p
                                    className={cn(
                                        "mt-0.5 truncate text-[9px] font-semibold",
                                        isChanged ? "text-primary" : "text-foreground"
                                    )}
                                >
                                    {updated || "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const requestTypeMeta = (req: SpecialEntryRequest) => {
        if (req.type === "inventory_edit") {
            return {
                label: "Inventory Edit",
                icon: Edit,
                badge: "border-primary/15 bg-primary/10 text-primary",
                iconClass: "bg-primary/10 text-primary",
            };
        }

        if (req.type === "product_add") {
            return {
                label: "New Product",
                icon: PackagePlus,
                badge: "border-orange-500/15 bg-orange-500/10 text-orange-600 dark:text-orange-400",
                iconClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
            };
        }

        return {
            label: "Special Entry",
            icon: Key,
            badge: "border-emerald-500/15 bg-emerald-500/10 text-emerald-600",
            iconClass: "bg-emerald-500/10 text-emerald-600",
        };
    };

    const requestSummary = (req: SpecialEntryRequest) => {
        if (req.type === "inventory_edit" && req.editDetails) {
            return req.editDetails.productName;
        }

        if (req.type === "product_add") {
            return req.suggestedProductName || req.reason || "Unregistered barcode";
        }

        return req.reason || "No reason provided";
    };

    return (
        <div className="min-w-0 space-y-4">
            {/* Summary */}
            <section className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
                <Card className="min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                                    Pending
                                </p>
                                <p className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                                    {pendingRequests.length}
                                </p>
                            </div>
                            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                                    Processed
                                </p>
                                <p className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                                    {processedRequests.length}
                                </p>
                            </div>
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="min-w-0 rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                                    Visible
                                </p>
                                <p className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                                    {filteredPending.length}
                                </p>
                            </div>
                            <Search className="h-4 w-4 shrink-0 text-primary" />
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Search */}
            <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <CardContent className="p-3 sm:p-4">
                    <div className="relative min-w-0">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                            placeholder="Search personnel, email, product or barcode"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-11 min-w-0 rounded-xl border-border/60 bg-background pl-10 pr-10 text-xs shadow-none sm:text-sm"
                        />

                        {searchTerm && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg text-muted-foreground"
                                aria-label="Clear search"
                            >
                                <FilterX className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="pending" className="w-full min-w-0">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1">
                    <TabsTrigger
                        value="pending"
                        className="min-w-0 rounded-lg px-2 text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-[10px]"
                    >
                        Active Requests
                        <Badge
                            variant="secondary"
                            className="ml-1.5 rounded-md border-0 px-1.5 py-0 text-[7px]"
                        >
                            {pendingRequests.length}
                        </Badge>
                    </TabsTrigger>

                    <TabsTrigger
                        value="history"
                        className="min-w-0 rounded-lg px-2 text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-[10px]"
                    >
                        History
                    </TabsTrigger>
                </TabsList>

                {/* Pending */}
                <TabsContent
                    value="pending"
                    className="mt-3 min-w-0 outline-none animate-in fade-in duration-200"
                >
                    {filteredPending.length > 0 ? (
                        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {filteredPending.map((req) => {
                                const meta = requestTypeMeta(req);
                                const Icon = meta.icon;

                                return (
                                    <Card
                                        key={req.id}
                                        className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
                                    >
                                        <CardHeader className="min-w-0 border-b border-border/50 bg-muted/[0.16] p-3.5 pb-3 sm:p-4 sm:pb-3">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div
                                                    className={cn(
                                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                                        meta.iconClass
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <CardTitle className="truncate text-[13px] font-semibold tracking-tight text-foreground sm:text-sm">
                                                                {req.staffName}
                                                            </CardTitle>
                                                            <CardDescription className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground">
                                                                {req.userEmail}
                                                            </CardDescription>
                                                        </div>

                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "max-w-[108px] shrink-0 truncate rounded-lg px-2 py-0.5 text-[7px] font-semibold",
                                                                meta.badge
                                                            )}
                                                        >
                                                            {meta.label}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4">
                                            <div className="min-w-0 flex-1 space-y-3">
                                                <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                                                    <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                        Request
                                                    </p>
                                                    <p className="mt-1 line-clamp-2 break-words text-[10px] font-medium leading-4 text-foreground">
                                                        {requestSummary(req)}
                                                    </p>
                                                </div>

                                                {req.type === "product_add" && req.reason && (
                                                    <div className="flex min-w-0 items-center gap-2 text-[9px] text-muted-foreground">
                                                        <Hash className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate font-mono">
                                                            {req.reason}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex min-w-0 items-center gap-1.5 text-[8px] font-medium text-muted-foreground">
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">
                                                        {format(parseISO(req.requestedAt), "PPp")}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 rounded-xl border-destructive/20 px-2 text-[9px] font-semibold text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => handleRejectRequest(req.id)}
                                                >
                                                    <X className="mr-1.5 h-3.5 w-3.5" />
                                                    Decline
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    className="h-9 rounded-xl px-2 text-[9px] font-semibold shadow-none"
                                                    onClick={() => handleActionClick(req)}
                                                >
                                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                    Review
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
                            <CardContent className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>

                                <h3 className="mt-3 text-sm font-semibold text-foreground">
                                    No pending requests
                                </h3>

                                <p className="mt-1 max-w-xs text-[10px] leading-4 text-muted-foreground">
                                    {searchTerm
                                        ? "No active approval request matches this search."
                                        : "All current approval requests have been processed."}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* History */}
                <TabsContent
                    value="history"
                    className="mt-3 min-w-0 outline-none animate-in fade-in duration-200"
                >
                    <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                        {processedRequests.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                {processedRequests.map((req) => {
                                    const isApproved = req.status === "approved";
                                    const meta = requestTypeMeta(req);

                                    return (
                                        <div
                                            key={req.id}
                                            className="flex min-w-0 items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/20 sm:px-4"
                                        >
                                            <div
                                                className={cn(
                                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                                    isApproved
                                                        ? "bg-emerald-500/10 text-emerald-600"
                                                        : "bg-destructive/10 text-destructive"
                                                )}
                                            >
                                                {isApproved ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <Ban className="h-4 w-4" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <p className="truncate text-[11px] font-semibold text-foreground sm:text-[12px]">
                                                        {req.staffName}
                                                    </p>
                                                    <Badge
                                                        variant="outline"
                                                        className="hidden shrink-0 rounded-md border-border/60 px-1.5 py-0 text-[7px] font-medium text-muted-foreground sm:inline-flex"
                                                    >
                                                        {meta.label}
                                                    </Badge>
                                                </div>

                                                <p className="mt-0.5 truncate text-[8px] text-muted-foreground sm:text-[9px]">
                                                    {req.userEmail}
                                                </p>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "rounded-lg px-2 py-0.5 text-[7px] font-semibold capitalize",
                                                        isApproved
                                                            ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-600"
                                                            : "border-destructive/15 bg-destructive/10 text-destructive"
                                                    )}
                                                >
                                                    {req.status}
                                                </Badge>

                                                <p className="mt-1 whitespace-nowrap text-[7px] tabular-nums text-muted-foreground">
                                                    {format(
                                                        parseISO(req.approvedAt || req.requestedAt),
                                                        "dd MMM yy • HH:mm"
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
                                <History className="h-6 w-6 text-muted-foreground/40" />
                                <p className="mt-3 text-sm font-semibold text-foreground">
                                    No recent decisions
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                    Processed requests will appear here.
                                </p>
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Review dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent
                    className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl"
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                >
                    <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/20 p-4 pb-3 sm:p-5 sm:pb-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <ShieldCheck className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <DialogTitle className="truncate text-base font-semibold tracking-tight sm:text-lg">
                                    Review request
                                </DialogTitle>
                                <DialogDescription className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                                    Secure review of submission from{" "}
                                    <span className="font-medium text-foreground">
                                        {selectedRequest?.userEmail}
                                    </span>
                                    .
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
                        {selectedRequest && (
                            <>
                                {selectedRequest.type === "inventory_edit" &&
                                selectedRequest.editDetails &&
                                selectedRequest.originalDetails ? (
                                    <div className="space-y-4">
                                        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-3.5">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <Edit className="h-4 w-4" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-primary">
                                                    Inventory item
                                                </p>
                                                <h4 className="mt-0.5 truncate text-[12px] font-semibold text-foreground sm:text-[13px]">
                                                    {selectedRequest.editDetails.productName}
                                                </h4>
                                                <p className="mt-0.5 truncate font-mono text-[8px] text-muted-foreground">
                                                    {selectedRequest.editDetails.itemId}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <ComparisonRow
                                                label="Quantity"
                                                original={`${selectedRequest.originalDetails.quantity} Units`}
                                                updated={`${selectedRequest.editDetails.quantity} Units`}
                                                icon={Hash}
                                            />
                                            <ComparisonRow
                                                label="Location"
                                                original={selectedRequest.originalDetails.location}
                                                updated={selectedRequest.editDetails.location}
                                                icon={MapPin}
                                            />
                                            <ComparisonRow
                                                label="Classification"
                                                original={selectedRequest.originalDetails.itemType}
                                                updated={selectedRequest.editDetails.itemType}
                                                icon={Tag}
                                            />
                                            <ComparisonRow
                                                label="Expiry Date"
                                                original={
                                                    selectedRequest.originalDetails.expiryDate ||
                                                    "None"
                                                }
                                                updated={
                                                    selectedRequest.editDetails.expiryDate || "None"
                                                }
                                                icon={CalendarIcon}
                                            />
                                        </div>
                                    </div>
                                ) : selectedRequest.type === "product_add" ? (
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.045] p-4">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                                                    <PackagePlus className="h-4 w-4" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-orange-600">
                                                        Unregistered product
                                                    </p>

                                                    <p className="mt-1 break-all font-mono text-[12px] font-semibold text-foreground">
                                                        {selectedRequest.reason}
                                                    </p>

                                                    {selectedRequest.suggestedProductName && (
                                                        <div className="mt-3 rounded-xl bg-background px-3 py-2.5">
                                                            <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                                Suggested name
                                                            </p>
                                                            <p className="mt-0.5 text-[10px] font-semibold text-foreground">
                                                                {selectedRequest.suggestedProductName}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="h-11 w-full rounded-xl bg-orange-500 text-[10px] font-semibold text-white shadow-none hover:bg-orange-600"
                                            onClick={() =>
                                                handleQuickRegister(selectedRequest.reason!)
                                            }
                                        >
                                            <PlusCircle className="mr-1.5 h-4 w-4" />
                                            Register product
                                        </Button>

                                        <div className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
                                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <p className="text-[9px] leading-4 text-muted-foreground">
                                                Registering this barcode allows future inventory logs
                                                to identify the product automatically.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <Key className="h-4 w-4" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-primary">
                                                        Special entry
                                                    </p>
                                                    <h4 className="mt-0.5 text-[12px] font-semibold text-foreground sm:text-[13px]">
                                                        {selectedRequest.staffName}
                                                    </h4>
                                                    <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">
                                                        Requests authorization to bypass standard log
                                                        alerts.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                                            <div className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                <MessageSquare className="h-3 w-3" />
                                                Reason
                                            </div>
                                            <p className="mt-2 break-words text-[10px] leading-4 text-foreground">
                                                {selectedRequest.reason ||
                                                    "No specific reason given by the user."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="shrink-0 border-t border-border/50 bg-background p-3 sm:p-4">
                        <div className="grid w-full grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsDetailDialogOpen(false)}
                                className="h-10 rounded-xl border-border/60 text-[9px] font-semibold shadow-none"
                            >
                                Close
                            </Button>

                            <Button
                                onClick={handleConfirmApproval}
                                disabled={isProcessing}
                                className="h-10 rounded-xl text-[9px] font-semibold shadow-none"
                            >
                                {isProcessing ? (
                                    <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                                ) : (
                                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {selectedRequest?.type === "product_add"
                                    ? "Mark processed"
                                    : "Authorize"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AuthorizeActionDialog
                isOpen={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
                onAuthorizationSuccess={handleAuthorizationSuccess}
                actionDescription={
                    selectedRequest?.type === "inventory_edit"
                        ? `Finalizing data override for ${selectedRequest?.editDetails?.productName}. Credentials required.`
                        : selectedRequest?.type === "product_add"
                          ? "Confirming barcode registration request is handled. Administrator credentials required."
                          : "Approving authorization request. This will generate a 4-digit OTP."
                }
            />

            {productBarcodeForDialog && (
                <CreateProductFromInventoryDialog
                    isOpen={isCreateProductDialogOpen}
                    onOpenChange={setIsCreateProductDialogOpen}
                    barcode={productBarcodeForDialog}
                    allSuppliers={suppliers}
                    onSuccess={handleProductCreateSuccess}
                />
            )}
        </div>
    );
}
