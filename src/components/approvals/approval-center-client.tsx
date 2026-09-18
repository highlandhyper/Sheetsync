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
    ArrowLeftRight, AlertCircle, PlusCircle, ExternalLink, Eye,
    Trash2,
    ShieldAlert
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
import { updateInventoryItemAction, approveRequestAction } from '@/app/actions';
import type { SpecialEntryRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { CreateProductFromInventoryDialog } from '@/components/products/create-product-from-inventory-dialog';

export function ApprovalCenterClient() {
    const { pendingRequests, processedRequests, approveRequest, completeProductAddRequest, rejectRequest } = useSpecialEntry();
    const { updateInventoryItem, refreshData, suppliers, addProduct } = useDataCache();
    const { user: authUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<SpecialEntryRequest | null>(null);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
    const [productBarcodeForDialog, setProductBarcodeForDialog] = useState('');

    const filteredPending = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        return pendingRequests.filter(r => {
            const matchesStaff = (r.staffName || "").toLowerCase().includes(lower);
            const matchesEmail = (r.userEmail || "").toLowerCase().includes(lower);
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

    const handleAuthorizationSuccess = async () => {
        if (!selectedRequest || !authUser?.email) return;
        setIsAuthDialogOpen(false);
        setIsProcessing(true);

        try {
            if (selectedRequest.type === 'on_display_request') {
                const res = await approveRequestAction(selectedRequest.id, authUser.email);
                if (res.success) {
                    toast({ title: 'Approved', description: 'On-Display change applied successfully.' });
                    refreshData();
                } else {
                    toast({ variant: "destructive", title: "Approval Error", description: res.message });
                }
            } else if (selectedRequest.type === 'inventory_edit' && selectedRequest.editDetails) {
                const details = selectedRequest.editDetails;
                const formData = new FormData();
                formData.append('itemId', details.itemId);
                formData.append('location', details.location);
                formData.append('itemType', details.itemType);
                formData.append('userEmail', authUser.email);
                formData.append('quantity', String(details.quantity));
                if (details.expiryDate) formData.append('expiryDate', details.expiryDate);

                const result = await updateInventoryItemAction(undefined, formData);
                if (result.success && result.data) {
                    updateInventoryItem(result.data);
                    await approveRequest(selectedRequest.id);
                    toast({ title: 'Edit Applied', description: `Approved changes for ${details.productName}.` });
                }
            } else if (selectedRequest.type === 'product_add') {
                await completeProductAddRequest(selectedRequest.id);
                toast({ title: 'Processed', description: 'Catalog request completed.' });
            } else {
                await approveRequest(selectedRequest.id);
                toast({ title: 'Authorized', description: `Request for ${selectedRequest.staffName} approved.` });
            }
        } catch (error) {
            toast({ title: 'Sync Error', description: 'Action failed.', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
            setSelectedRequest(null);
        }
    };

    const requestTypeMeta = (req: SpecialEntryRequest) => {
        if (req.type === "on_display_request") return { label: "On-Display", icon: ShieldAlert, badge: "border-red-500/15 bg-red-500/10 text-red-600", iconClass: "bg-red-500/10 text-red-600" };
        if (req.type === "inventory_edit") return { label: "Inventory Edit", icon: Edit, badge: "border-primary/15 bg-primary/10 text-primary", iconClass: "bg-primary/10 text-primary" };
        if (req.type === "product_add") return { label: "New Product", icon: PackagePlus, badge: "border-orange-500/15 bg-orange-500/10 text-orange-600", iconClass: "bg-orange-500/10 text-orange-600" };
        return { label: "Special Entry", icon: Key, badge: "border-emerald-500/15 bg-emerald-500/10 text-emerald-600", iconClass: "bg-emerald-500/10 text-emerald-600" };
    };

    return (
        <div className="min-w-0 space-y-4">
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
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="pending" className="w-full min-w-0">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1">
                    <TabsTrigger value="pending" className="rounded-lg px-2 text-[10px] font-semibold">Active Requests</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg px-2 text-[10px] font-semibold">History</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-3 outline-none animate-in fade-in duration-200">
                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {filteredPending.map((req) => {
                            const meta = requestTypeMeta(req);
                            const Icon = meta.icon;
                            return (
                                <Card key={req.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                                    <CardHeader className="min-w-0 border-b border-border/50 bg-muted/[0.16] p-4 pb-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.iconClass)}><Icon className="h-4 w-4" /></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <CardTitle className="truncate text-[13px] font-bold">{req.staffName}</CardTitle>
                                                        <CardDescription className="mt-0.5 truncate text-[9px] font-medium">{req.userEmail}</CardDescription>
                                                    </div>
                                                    <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[7px] font-bold", meta.badge)}>{meta.label}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col p-4">
                                        <div className="rounded-xl bg-muted/30 px-3 py-2.5 flex-1">
                                            <p className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">Requested Change</p>
                                            <p className="mt-1 text-xs font-bold leading-tight text-foreground">
                                                {req.type === 'on_display_request' && req.editDetails 
                                                  ? `${req.editDetails.requestType === 'delete' ? 'REMOVE' : 'ADJUST'} ${req.editDetails.productName}`
                                                  : (req.editDetails?.productName || req.suggestedProductName || req.reason || "Registry Access")
                                                }
                                            </p>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                                            <Button variant="outline" size="sm" className="h-9 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => handleRejectRequest(req.id)}>Decline</Button>
                                            <Button size="sm" className="h-9 rounded-xl" onClick={() => handleActionClick(req)}><Eye className="mr-1.5 h-3.5 w-3.5" />Review</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>
                <TabsContent value="history" className="mt-3 outline-none animate-in fade-in duration-200">
                     <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                        {processedRequests.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                {processedRequests.map((req) => (
                                    <div key={req.id} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-muted/20">
                                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", req.status === 'approved' ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                                            {req.status === 'approved' ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold">{req.staffName}</p>
                                            <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{req.userEmail}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <Badge variant="outline" className={cn("text-[7px] font-bold uppercase", req.status === 'approved' ? "border-emerald-500/20 text-emerald-600" : "border-destructive/20 text-destructive")}>{req.status}</Badge>
                                            <p className="mt-1 text-[7px] font-mono text-muted-foreground">{format(parseISO(req.approvedAt || req.requestedAt), "dd MMM yy")}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                     </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-muted/20 border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-primary/10 flex items-center justify-center rounded-2xl text-primary"><ShieldCheck className="h-6 w-6" /></div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight">Review On-Display Request</DialogTitle>
                                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Personnel: {selectedRequest?.staffName}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {selectedRequest?.type === 'on_display_request' && selectedRequest.editDetails && selectedRequest.originalDetails && (
                            <div className="space-y-4">
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Protocol: {selectedRequest.editDetails.requestType === 'delete' ? 'Registry Deletion' : 'Inventory Correction'}</p>
                                    <h4 className="text-lg font-bold leading-tight">{selectedRequest.editDetails.productName}</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-muted/20 rounded-2xl border border-white/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Quantity</span>
                                            <Badge className="bg-background text-primary border-primary/10">{selectedRequest.originalDetails.quantity} → {selectedRequest.editDetails.quantity}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Location</span>
                                            <Badge className="bg-background text-primary border-primary/10">{selectedRequest.originalDetails.location} → {selectedRequest.editDetails.location}</Badge>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-muted/20 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Expiry Window</span>
                                        </div>
                                        <p className="text-xs font-bold">{selectedRequest.originalDetails.expiryDate || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 bg-muted/10 border-t border-white/5 gap-2">
                        <Button variant="ghost" onClick={() => setIsDetailDialogOpen(false)} className="font-bold h-11 px-6 rounded-xl">Close</Button>
                        <Button onClick={handleConfirmApproval} className="h-11 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Authorize Change</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AuthorizeActionDialog
                isOpen={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
                onAuthorizationSuccess={handleAuthorizationSuccess}
                actionDescription="Administrative identity verification required to apply registry modifications."
            />
        </div>
    );
}
