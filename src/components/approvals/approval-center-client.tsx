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
    ArrowLeftRight, AlertCircle
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

export function ApprovalCenterClient() {
    const { pendingRequests, processedRequests, approveRequest, rejectRequest } = useSpecialEntry();
    const { updateInventoryItem, refreshData } = useDataCache();
    const { user: authUser } = useAuth();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<SpecialEntryRequest | null>(null);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [duration, setDuration] = useState<string>("single");
    const [isProcessing, setIsProcessing] = useState(false);

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

    const handleRejectRequest = async (id: string) => {
        try {
            await rejectRequest(id);
            toast({ title: 'Request Rejected', description: 'The submission has been declined.' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to reject request.', variant: 'destructive' });
        }
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

    const ComparisonRow = ({ label, original, updated, icon: Icon }: { label: string, original: any, updated: any, icon: any }) => {
        const isChanged = String(original) !== String(updated);
        return (
            <div className={cn("grid grid-cols-3 gap-2 items-center p-3 rounded-lg border border-transparent transition-all", isChanged ? "bg-primary/[0.03] border-primary/10 shadow-sm" : "bg-muted/30 opacity-60")}>
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md", isChanged ? "bg-primary/10" : "bg-muted")}>
                        <Icon className={cn("h-3.5 w-3.5", isChanged ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">{label}</span>
                </div>
                
                <div className="relative group/orig">
                    <span className="absolute -top-4 left-0 text-[8px] font-black text-destructive uppercase opacity-0 group-hover/orig:opacity-100 transition-opacity">Current</span>
                    <div className={cn("text-xs font-medium text-muted-foreground line-through decoration-destructive/40", !isChanged && "no-underline")}>
                        {original || 'N/A'}
                    </div>
                </div>

                <div className="relative group/new">
                    <span className="absolute -top-4 left-0 text-[8px] font-black text-primary uppercase opacity-0 group-hover/new:opacity-100 transition-opacity">Proposed</span>
                    <div className={cn("text-sm font-black flex items-center gap-2", isChanged ? "text-primary" : "text-foreground")}>
                        <ArrowRight className={cn("h-3 w-3 shrink-0", isChanged ? "opacity-100 animate-pulse" : "opacity-0")} />
                        <span className="truncate">{updated || 'N/A'}</span>
                    </div>
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
                    <TabsTrigger value="pending" className="font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:text-primary">
                        Active Requests ({pendingRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-background">
                        Decision History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="pt-6 animate-in fade-in duration-500">
                    {filteredPending.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPending.map(req => {
                                const isEdit = req.type === 'inventory_edit';
                                const isProduct = req.type === 'product_add';
                                return (
                                    <Card key={req.id} className="group relative border-2 border-transparent hover:border-primary/20 transition-all shadow-lg overflow-hidden flex flex-col">
                                        <CardHeader className={cn("pb-4 shrink-0", isEdit ? "bg-accent/5" : isProduct ? "bg-orange-500/5" : "bg-primary/5")}>
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
                                                    {isEdit ? 'Data Edit' : isProduct ? 'New SKU' : 'Silent Entry'}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4 flex-grow">
                                            {isEdit && req.editDetails ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
                                                        <Edit className="h-4 w-4 text-accent-foreground" />
                                                        <span className="text-xs font-bold truncate">{req.editDetails.productName}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground font-medium italic line-clamp-2">"Authorizing modification of quantity, location or properties."</p>
                                                </div>
                                            ) : isProduct ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                                                        <PackagePlus className="h-5 w-5 text-orange-600" />
                                                        <span className="text-sm font-black font-mono tracking-tight">{req.reason}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center mt-2">Unregistered Barcode Found</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                                        <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                        <span className="text-xs font-medium italic leading-relaxed">"{req.reason || 'No reason specified'}"</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase pt-2 border-t mt-auto">
                                                <Clock className="h-3 w-3" />
                                                <span>Requested {format(parseISO(req.requestedAt), 'PPp')}</span>
                                            </div>

                                            <div className="pt-4 flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="flex-1 text-destructive hover:bg-destructive/5 font-black uppercase tracking-tighter h-10"
                                                    onClick={() => handleRejectRequest(req.id)}
                                                >
                                                    <X className="mr-1.5 h-4 w-4" /> Decline
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    className="flex-1 font-black uppercase tracking-tighter shadow-lg shadow-primary/20 h-10"
                                                    onClick={() => handleActionClick(req)}
                                                >
                                                    <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Review
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

            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-6 pb-2 shrink-0">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                                Request Verification
                            </DialogTitle>
                            <DialogDescription>
                                Secure review of submission from <span className="font-bold text-foreground">{selectedRequest?.userEmail}</span>.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-grow overflow-y-auto px-6 py-4 space-y-6">
                        {selectedRequest && (
                            <>
                                {selectedRequest.type === 'inventory_edit' && selectedRequest.editDetails && selectedRequest.originalDetails ? (
                                    <div className="space-y-6">
                                        <div className="p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between shadow-inner">
                                            <div>
                                                <Label className="text-[10px] uppercase font-black text-primary tracking-widest bg-primary/10 px-2 py-0.5 rounded-full mb-1 inline-block">Target Asset</Label>
                                                <h4 className="text-xl font-black leading-tight">{selectedRequest.editDetails.productName}</h4>
                                                <p className="text-[10px] text-muted-foreground font-mono mt-1">ID: {selectedRequest.editDetails.itemId}</p>
                                            </div>
                                            <Edit className="h-10 w-10 text-primary/20" />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-3 gap-2 px-3 mb-2">
                                                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Property</span>
                                                <span className="text-[9px] font-black uppercase text-destructive tracking-widest">Current (OLD)</span>
                                                <span className="text-[9px] font-black uppercase text-primary tracking-widest">Requested (NEW)</span>
                                            </div>
                                            <Separator className="mb-4" />
                                            <div className="space-y-3">
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
                                    </div>
                                ) : selectedRequest.type === 'product_add' ? (
                                    <div className="space-y-4">
                                        <Alert className="bg-orange-500/10 border-orange-500/20 py-6">
                                            <PackagePlus className="h-6 w-6 text-orange-600" />
                                            <AlertTitle className="font-black uppercase tracking-tighter text-lg ml-2">Barcode Not Registered</AlertTitle>
                                            <AlertDescription className="text-sm mt-2 ml-2">
                                                The user attempted to log a product with barcode <span className="font-mono font-bold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded">{selectedRequest.reason}</span> which does not exist in your cloud registry.
                                            </AlertDescription>
                                        </Alert>
                                        <div className="p-6 rounded-2xl bg-muted/20 border-2 border-dashed space-y-3">
                                            <p className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                                                <Info className="h-3.5 w-3.5" /> Administrator Recommendation
                                            </p>
                                            <ol className="text-sm space-y-2 font-medium">
                                                <li className="flex items-start gap-2">
                                                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-black shrink-0">1</span>
                                                    <span>Approve this request to clear it from the queue.</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-black shrink-0">2</span>
                                                    <span>Navigate to <strong>Manage Products</strong> to register this barcode permanently.</span>
                                                </li>
                                            </ol>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-8 rounded-3xl bg-primary/5 border-2 border-primary/10 space-y-6 shadow-sm">
                                            <div className="flex items-center gap-5">
                                                <div className="bg-primary/10 p-4 rounded-2xl">
                                                    <Key className="h-8 w-8 text-primary" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-xl uppercase tracking-tighter">Silent Entry Access</h4>
                                                    <p className="text-sm text-muted-foreground font-medium">{selectedRequest.staffName} needs authorization to bypass log alerts.</p>
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                                    <MessageSquare className="h-3.5 w-3.5" /> Justification Provided
                                                </Label>
                                                <div className="text-sm italic font-medium p-4 bg-background rounded-2xl border-2 border-muted shadow-inner leading-relaxed">
                                                    "{selectedRequest.reason || 'No specific reason given by the user.'}"
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t bg-background shrink-0 gap-3">
                        <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className="font-bold">Close Review</Button>
                        <Button onClick={handleConfirmApproval} className="font-black shadow-lg shadow-primary/30 px-8 bg-primary hover:bg-primary/90">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Authorize Submission
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
