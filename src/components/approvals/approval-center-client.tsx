'use client';

import { useState, useMemo } from 'react';
import { useSpecialEntry } from '@/context/special-entry-context';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { 
    Check, X, Clock, User, ShieldCheck, History, 
    AlertTriangle, Edit, PackagePlus, MessageSquare, 
    ArrowRight, Info, Key, CheckCircle2, Ban,
    Search, FilterX, Hash, MapPin, Tag, Calendar as CalendarIcon
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { AuthorizeActionDialog } from '@/components/inventory/authorize-action-dialog';
import { updateInventoryItemAction } from '@/app/actions';
import type { SpecialEntryRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export function ApprovalCenterClient() {
    const { pendingRequests, processedRequests, approveRequest, rejectRequest } = useSpecialEntry();
    const { updateInventoryItem, refreshData, suppliers, addProduct } = useDataCache();
    const { user: authUser } = useAuth();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<SpecialEntryRequest | null>(null);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [duration, setDuration] = useState<string>("single");

    const filteredPending = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return pendingRequests.filter(r => 
            r.staffName.toLowerCase().includes(lower) || 
            r.userEmail.toLowerCase().includes(lower) ||
            (r.editDetails?.productName.toLowerCase().includes(lower))
        );
    }, [pendingRequests, searchTerm]);

    const handleActionClick = (req: SpecialEntryRequest) => {
        setSelectedRequest(req);
        setIsDetailDialogOpen(true);
    };

    const handleConfirmApproval = () => {
        setIsDetailDialogOpen(false);
        setIsAuthDialogOpen(true);
    };

    const handleAuthorizationSuccess = async () => {
        if (!selectedRequest) return;
        setIsAuthDialogOpen(false);

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
                toast({ title: 'Edit Applied', description: `Approved changes for ${details.productName}.` });
                updateInventoryItem(result.data);
                approveRequest(selectedRequest.id);
                refreshData();
            } else {
                toast({ title: 'Error', description: result.message || 'Failed to apply requested edit.', variant: 'destructive' });
            }
        } else {
            approveRequest(selectedRequest.id, duration === 'single' ? undefined : parseInt(duration));
            toast({ title: 'Authorized', description: `Request for ${selectedRequest.staffName} approved.` });
        }
        
        setSelectedRequest(null);
    };

    const ComparisonRow = ({ label, original, updated, icon: Icon }: { label: string, original: any, updated: any, icon: any }) => {
        const isChanged = original !== updated;
        return (
            <div className={cn("grid grid-cols-3 gap-4 items-center p-3 rounded-lg transition-colors", isChanged ? "bg-primary/5" : "bg-muted/30")}>
                <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground">{label}</span>
                </div>
                <div className="text-sm font-medium text-muted-foreground line-through decoration-destructive/30">{original || 'N/A'}</div>
                <div className={cn("text-sm font-bold flex items-center gap-2", isChanged ? "text-primary" : "text-foreground")}>
                    <ArrowRight className={cn("h-3 w-3", isChanged ? "opacity-100" : "opacity-0")} />
                    {updated || 'N/A'}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <Card className="p-4 shadow-sm border-primary/10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by personnel, email or product name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 bg-muted/20"
                    />
                </div>
            </Card>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] h-12 bg-muted/50 p-1">
                    <TabsTrigger value="pending" className="font-bold uppercase tracking-widest text-[10px]">
                        Active Requests ({pendingRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="font-bold uppercase tracking-widest text-[10px]">
                        Recent Decisions
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="pt-6 animate-in fade-in duration-500">
                    {filteredPending.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPending.map(req => {
                                const isEdit = req.type === 'inventory_edit';
                                const isProduct = req.type === 'product_add';
                                return (
                                    <Card key={req.id} className="group relative border-2 border-transparent hover:border-primary/20 transition-all shadow-lg overflow-hidden">
                                        <CardHeader className={cn("pb-4", isEdit ? "bg-accent/5" : isProduct ? "bg-orange-500/5" : "bg-primary/5")}>
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-xl font-black tracking-tight">{req.staffName}</CardTitle>
                                                    <Badge variant="secondary" className="text-[9px] uppercase font-black tracking-tighter">
                                                        {req.userEmail}
                                                    </Badge>
                                                </div>
                                                <Badge className={cn("font-black uppercase tracking-widest text-[10px] py-1", 
                                                    isEdit ? "bg-accent text-accent-foreground" : 
                                                    isProduct ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground")}>
                                                    {isEdit ? 'Inventory Edit' : isProduct ? 'New Product' : 'Silent Entry'}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
                                            {isEdit && req.editDetails ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                                                        <Edit className="h-4 w-4 text-accent-foreground" />
                                                        <span className="text-xs font-bold truncate">{req.editDetails.productName}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground italic line-clamp-2">"Authorizing modification of quantity, location or properties."</p>
                                                </div>
                                            ) : isProduct ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 p-2 bg-orange-500/5 border border-orange-500/20 rounded">
                                                        <PackagePlus className="h-4 w-4 text-orange-600" />
                                                        <span className="text-xs font-black font-mono">{req.reason}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Unregistered Barcode Found</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded">
                                                        <MessageSquare className="h-4 w-4 text-primary" />
                                                        <span className="text-xs font-medium italic">"{req.reason || 'No reason specified'}"</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase pt-2">
                                                <Clock className="h-3 w-3" />
                                                <span>Requested {format(parseISO(req.requestedAt), 'PPp')}</span>
                                            </div>

                                            <div className="pt-4 flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="flex-1 text-destructive hover:bg-destructive/5 font-bold"
                                                    onClick={() => rejectRequest(req.id)}
                                                >
                                                    <X className="mr-1 h-3.5 w-3.5" /> Reject
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    className="flex-1 font-bold shadow-lg shadow-primary/20"
                                                    onClick={() => handleActionClick(req)}
                                                >
                                                    <Info className="mr-1 h-3.5 w-3.5" /> Review
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="bg-muted p-6 rounded-full mb-4">
                                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-xl font-black text-muted-foreground uppercase tracking-widest">Inbox Zero</h3>
                            <p className="text-sm text-muted-foreground mt-2">All personnel requests have been processed.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="pt-6">
                    <Card className="shadow-lg overflow-hidden border-primary/10">
                        <div className="divide-y">
                            {processedRequests.map(req => (
                                <div key={req.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-2 rounded-full", req.status === 'approved' ? "bg-green-500/10" : "bg-destructive/10")}>
                                            {req.status === 'approved' ? <Check className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-destructive" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{req.staffName}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black">{req.type.replace('_', ' ')} • {req.status}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-medium text-muted-foreground">{format(parseISO(req.approvedAt || req.requestedAt), 'PPp')}</p>
                                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{req.userEmail}</p>
                                    </div>
                                </div>
                            ))}
                            {processedRequests.length === 0 && (
                                <div className="p-12 text-center text-muted-foreground">No recent decisions found.</div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ADVANCED REVIEW DIALOG */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            Request Verification
                        </DialogTitle>
                        <DialogDescription>
                            Reviewing submission from <span className="font-bold text-foreground">{selectedRequest?.userEmail}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="py-6 space-y-6">
                            {selectedRequest.type === 'inventory_edit' && selectedRequest.editDetails && selectedRequest.originalDetails ? (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between">
                                        <div>
                                            <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Target Product</Label>
                                            <h4 className="text-lg font-black">{selectedRequest.editDetails.productName}</h4>
                                        </div>
                                        <Edit className="h-8 w-8 text-primary/20" />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-3 gap-4 px-3 mb-1">
                                            <span className="text-[9px] font-black uppercase text-muted-foreground">Property</span>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground">Current (Sheet)</span>
                                            <span className="text-[9px] font-black uppercase text-primary">Proposed Change</span>
                                        </div>
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
                                            original={selectedRequest.originalDetails.expiryDate || 'None'} 
                                            updated={selectedRequest.editDetails.expiryDate || 'None'} 
                                            icon={CalendarIcon}
                                        />
                                    </div>
                                </div>
                            ) : selectedRequest.type === 'product_add' ? (
                                <div className="space-y-4">
                                    <Alert className="bg-orange-500/10 border-orange-500/20">
                                        <PackagePlus className="h-4 w-4 text-orange-600" />
                                        <AlertTitle className="font-black uppercase tracking-tighter">Barcode Not Found</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            The staff member attempted to log a product with barcode <span className="font-mono font-bold text-orange-600">{selectedRequest.reason}</span> which does not exist in your catalog.
                                        </AlertDescription>
                                    </Alert>
                                    <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">Recommendation:</p>
                                        <p className="text-sm font-bold">1. Approve this request to clear it. <br /> 2. Go to 'Manage Products' to register this barcode.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-6 rounded-2xl bg-primary/5 border-2 border-primary/10 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/10 p-3 rounded-xl">
                                                <Key className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg">Silent Entry Request</h4>
                                                <p className="text-sm text-muted-foreground">{selectedRequest.staffName} needs to bypass notifications.</p>
                                            </div>
                                        </div>
                                        <Separator />
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Reason Provided</Label>
                                            <p className="text-sm italic font-medium p-3 bg-background rounded-lg border">
                                                "{selectedRequest.reason || 'No specific reason given.'}"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close Review</Button>
                        <Button onClick={handleConfirmApproval} className="font-black shadow-lg shadow-primary/30">
                            Authorize Submission
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AuthorizeActionDialog 
                isOpen={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
                onAuthorizationSuccess={handleAuthorizationSuccess}
                actionDescription={selectedRequest?.type === 'inventory_edit' ? `Finalizing data override for ${selectedRequest?.editDetails?.productName}. Credentials required.` : `Approving authorization request. This will generate a 4-digit OTP.`}
            />
        </div>
    );
}
