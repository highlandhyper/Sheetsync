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
    ShieldAlert,
    Database,
    Layers
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
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
            const res = await approveRequestAction(selectedRequest.id, authUser.email);
            if (res.success) {
                toast({ title: 'Sync Confirmed', description: 'Registry modification successfully applied.' });
                refreshData();
            } else {
                toast({ variant: "destructive", title: "Sync Error", description: res.message || "The registry core rejected the update." });
            }
        } catch (error) {
            toast({ title: 'Connection Error', description: 'Registry handshake timed out.', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
            setSelectedRequest(null);
        }
    };

    const requestTypeMeta = (req: SpecialEntryRequest) => {
        if (req.type === "on_display_request") return { label: "On-Display", icon: ShieldAlert, badge: "border-red-500/15 bg-red-500/10 text-red-600", iconClass: "bg-red-500/10 text-red-600" };
        if (req.type === "inventory_edit") return { label: "Registry Edit", icon: Edit, badge: "border-primary/15 bg-primary/10 text-primary", iconClass: "bg-primary/10 text-primary" };
        if (req.type === "product_add") return { label: "New Product", icon: PackagePlus, badge: "border-orange-500/15 bg-orange-500/10 text-orange-600", iconClass: "bg-orange-500/10 text-orange-600" };
        return { label: "Special Entry", icon: Key, badge: "border-emerald-500/15 bg-emerald-500/10 text-emerald-600", iconClass: "bg-emerald-500/10 text-emerald-600" };
    };

    const DetailNode = ({ icon: Icon, label, original, edited }: { icon: any, label: string, original?: string | number, edited?: string | number }) => (
        <div className="p-4 bg-muted/20 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-black uppercase text-muted-foreground/40 mb-1">ORIGINAL</p>
                    <p className="text-sm font-bold truncate opacity-50">{original || '---'}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-black uppercase text-primary/40 mb-1">CORRECTED</p>
                    <p className="text-sm font-black truncate text-primary">{edited || '---'}</p>
                </div>
            </div>
        </div>
    );

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
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border-0 bg-muted/30 p-1">
                    <TabsTrigger value="pending" className="rounded-lg px-2 text-[10px] font-black uppercase tracking-widest">Active Requests</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg px-2 text-[10px] font-black uppercase tracking-widest">Protocol History</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4 outline-none animate-in fade-in duration-300">
                    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {filteredPending.map((req) => {
                            const meta = requestTypeMeta(req);
                            const Icon = meta.icon;
                            return (
                                <Card key={req.id} className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm hover:shadow-md transition-all">
                                    <CardHeader className="min-w-0 border-b border-border/50 bg-muted/[0.16] p-5 pb-4">
                                        <div className="flex min-w-0 items-start gap-4">
                                            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm", meta.iconClass)}><Icon className="h-5 w-5" /></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <CardTitle className="truncate text-base font-black uppercase tracking-tight">{req.staffName}</CardTitle>
                                                        <CardDescription className="mt-1 truncate text-[10px] font-bold uppercase text-muted-foreground/60">{req.userEmail}</CardDescription>
                                                    </div>
                                                    <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-widest", meta.badge)}>{meta.label}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col p-5">
                                        <div className="rounded-2xl bg-muted/30 p-4 flex-1 border border-white/5 shadow-inner">
                                            <p className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-[0.2em] mb-2">Registry Proposal</p>
                                            <p className="text-sm font-bold leading-tight text-foreground line-clamp-2 uppercase">
                                                {req.type === 'on_display_request' || req.type === 'inventory_edit'
                                                  ? `${req.editDetails?.requestType === 'delete' ? 'PURGE' : 'ADJUST'} ${req.editDetails?.productName || 'NODE'}`
                                                  : (req.suggestedProductName || req.reason || "SILENT ENTRY HANDSHAKE")
                                                }
                                            </p>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 pt-1">
                                            <Button variant="ghost" size="sm" className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest text-destructive hover:bg-destructive/5" onClick={() => handleRejectRequest(req.id)}>Reject</Button>
                                            <Button size="sm" className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/10" onClick={() => handleActionClick(req)}><Eye className="mr-2 h-4 w-4" /> Review</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {filteredPending.length === 0 && (
                            <div className="col-span-full py-24 text-center opacity-30">
                                <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Zero Active Protocols</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="history" className="mt-4 outline-none animate-in fade-in duration-300">
                     <Card className="min-w-0 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
                        {processedRequests.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                {processedRequests.map((req) => (
                                    <div key={req.id} className="flex min-w-0 items-center gap-4 px-6 py-4 hover:bg-muted/10 transition-colors">
                                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", req.status === 'approved' ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                                            {req.status === 'approved' ? <Check className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-black uppercase tracking-tight">{req.staffName}</p>
                                            <p className="mt-0.5 truncate text-[10px] font-bold text-muted-foreground/50">{req.userEmail}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-widest", req.status === 'approved' ? "border-emerald-500/20 text-emerald-600" : "border-destructive/20 text-destructive")}>{req.status}</Badge>
                                            <p className="mt-1.5 text-[10px] font-mono font-bold text-muted-foreground/30">{format(parseISO(req.approvedAt || req.requestedAt), "dd MMM yy")}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center opacity-20">
                                <History className="mx-auto h-12 w-12 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Zero Historical Traces</p>
                            </div>
                        )}
                     </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-background">
                    <DialogHeader className="p-8 pb-4 bg-muted/30 border-b border-white/5">
                        <div className="flex items-center gap-5">
                            <div className="h-14 w-14 bg-primary/10 flex items-center justify-center rounded-2xl text-primary shadow-sm"><ShieldCheck className="h-8 w-8" /></div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Review Security Request</DialogTitle>
                                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1.5">Personnel terminal: {selectedRequest?.staffName}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-8 space-y-6">
                        {(selectedRequest?.type === 'on_display_request' || selectedRequest?.type === 'inventory_edit') && selectedRequest.editDetails && selectedRequest.originalDetails ? (
                            <div className="space-y-6">
                                <div className="p-5 bg-primary/5 rounded-[1.5rem] border border-primary/10 flex items-start gap-4">
                                    <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center border border-primary/10 shadow-sm"><Database className="h-5 w-5 text-primary" /></div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60 mb-1">Identification Node</p>
                                        <h4 className="text-lg font-black uppercase truncate leading-tight">{selectedRequest.editDetails.productName}</h4>
                                    </div>
                                    <Badge className={cn("mt-1 uppercase font-black text-[9px] tracking-widest", selectedRequest.editDetails.requestType === 'delete' ? "bg-destructive text-white" : "bg-primary text-white")}>
                                        {selectedRequest.editDetails.requestType === 'delete' ? 'PURGE' : 'ADJUST'}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailNode icon={Layers} label="Volume Change" original={selectedRequest.originalDetails.quantity} edited={selectedRequest.editDetails.quantity} />
                                    <DetailNode icon={MapPin} label="Zone Mapping" original={selectedRequest.originalDetails.location} edited={selectedRequest.editDetails.location} />
                                    <DetailNode icon={Tag} label="Classification" original={selectedRequest.originalDetails.itemType} edited={selectedRequest.editDetails.itemType} />
                                    <DetailNode icon={CalendarIcon} label="Lifecycle Threshold" original={selectedRequest.originalDetails.expiryDate || 'N/A'} edited={selectedRequest.editDetails.expiryDate || 'N/A'} />
                                </div>
                            </div>
                        ) : selectedRequest?.type === 'product_add' ? (
                            <div className="p-6 bg-orange-500/5 rounded-3xl border border-orange-500/10 space-y-4">
                                <div className="flex items-center gap-3">
                                    <PackagePlus className="h-6 w-6 text-orange-600" />
                                    <h4 className="text-lg font-black uppercase text-orange-900 tracking-tight">New SKU Identification</h4>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-orange-900/40 tracking-widest">Asset Barcode</p>
                                        <p className="font-mono text-xl font-black text-orange-900">{selectedRequest.reason}</p>
                                    </div>
                                    {selectedRequest.suggestedProductName && (
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-orange-900/40 tracking-widest">Optical Name Suggestion</p>
                                            <p className="text-base font-bold text-orange-800">{selectedRequest.suggestedProductName}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center space-y-4">
                                <div className="mx-auto h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center"><Key className="h-8 w-8 text-muted-foreground/40" /></div>
                                <div className="space-y-1">
                                    <p className="text-base font-bold uppercase">Manual Silent Entry</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">Personnel requires temporary registry access. Authorizing will dispatch a one-time identification key.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-8 pt-2 bg-muted/10 border-t border-white/5 flex flex-row items-center gap-3">
                        <DialogClose asChild>
                            <Button variant="ghost" className="font-black uppercase tracking-widest text-[10px] h-12 flex-1">Abort</Button>
                        </DialogClose>
                        <Button onClick={handleConfirmApproval} className="h-12 px-10 flex-[2] font-black uppercase tracking-[0.1em] text-[10px] rounded-2xl shadow-xl shadow-primary/20 bg-primary text-white hover:bg-primary/90">
                            Authorize Protocol
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AuthorizeActionDialog
                isOpen={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
                onAuthorizationSuccess={handleAuthorizationSuccess}
                actionDescription="Administrative identity verification required to synchronize registry modifications."
            />
        </div>
    );
}
