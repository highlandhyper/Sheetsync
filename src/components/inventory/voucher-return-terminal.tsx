'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Upload, 
    Loader2, 
    CheckCircle2, 
    AlertTriangle, 
    Undo2, 
    Barcode, 
    Hash, 
    Layers,
    X,
    FileType,
    Zap,
    Camera,
    FileType as FileIcon,
    AlertCircle,
    Search
} from 'lucide-react';
import { processVoucher } from '@/ai/flows/process-voucher-flow';
import { useToast } from '@/hooks/use-toast';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';
import { bulkReturnInventoryItemsAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface StagedReturn {
    barcode: string;
    productName: string;
    quantity: number;
    allocation: { itemId: string; qty: number; location: string }[];
    status: 'matched' | 'unmatched' | 'partial';
    totalAvailable: number;
}

/**
 * High-Speed Industrial Image Pre-processor
 */
async function optimizeImageForRegistry(dataUri: string): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX_DIMENSION = 1800; // Increased for Gemini 2.0 precision
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_DIMENSION) {
                    height *= MAX_DIMENSION / width;
                    width = MAX_DIMENSION;
                }
            } else {
                if (height > MAX_DIMENSION) {
                    width *= MAX_DIMENSION / height;
                    height = MAX_DIMENSION;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = dataUri;
    });
}

export function VoucherReturnTerminal() {
    const { toast } = useToast();
    const { user } = useAuth();
    const { inventoryItems, refreshData } = useDataCache();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [stagedItems, setStagedItems] = useState<StagedReturn[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUri = event.target?.result as string;
            setPreviewImage(dataUri);
            const optimizedUri = await optimizeImageForRegistry(dataUri);
            processWithAI(optimizedUri);
        };
        reader.readAsDataURL(file);
    };

    const startCamera = async () => {
        setIsCameraStarting(true);
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (err) {
            toast({ variant: "destructive", title: "Camera Error", description: "Hardware access denied." });
            setIsCameraOpen(false);
        } finally {
            setIsCameraStarting(false);
        }
    };

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    }, []);

    const capturePhoto = async () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUri = canvas.toDataURL('image/jpeg', 0.95);
                setPreviewImage(dataUri);
                setFileName(`capture_${Date.now()}.jpg`);
                stopCamera();
                const optimizedUri = await optimizeImageForRegistry(dataUri);
                processWithAI(optimizedUri);
            }
        }
    };

    /**
     * Intelligent Distributed Allocation Engine
     * Resolves return quantities across multiple logs for the same SKU.
     */
    const allocateQuantityToLogs = (barcode: string, requestedQty: number) => {
        const normalizedTarget = barcode.replace(/^0+/, '').trim().toLowerCase();
        
        const relevantLogs = inventoryItems
            .filter(i => {
                if (i.quantity <= 0) return false;
                const normalizedLogBarcode = i.barcode.replace(/^0+/, '').trim().toLowerCase();
                return i.barcode.trim().toLowerCase() === barcode.trim().toLowerCase() || 
                       normalizedLogBarcode === normalizedTarget;
            })
            .sort((a, b) => (a.quantity - b.quantity)); // Smallest logs first to prune the sheet

        let remaining = requestedQty;
        const allocation: { itemId: string; qty: number; location: string }[] = [];
        const totalAvailable = relevantLogs.reduce((s, l) => s + l.quantity, 0);

        for (const log of relevantLogs) {
            if (remaining <= 0) break;
            const take = Math.min(log.quantity, remaining);
            allocation.push({ itemId: log.id, qty: take, location: log.location });
            remaining -= take;
        }

        return {
            allocation,
            remaining,
            totalAvailable,
            status: (remaining <= 0) ? 'matched' : (totalAvailable > 0 ? 'partial' : 'unmatched')
        };
    };

    const processWithAI = async (dataUri: string) => {
        setIsProcessing(true);
        setStagedItems([]);
        
        try {
            const result = await processVoucher({ photoDataUri: dataUri });
            if (!result.success || !result.items) throw new Error(result.error || "No data identified.");

            const processed = result.items.map(aiItem => {
                const { allocation, totalAvailable, status } = allocateQuantityToLogs(aiItem.barcode, aiItem.quantity);
                
                return {
                    barcode: aiItem.barcode,
                    productName: aiItem.productName,
                    quantity: aiItem.quantity,
                    allocation,
                    totalAvailable,
                    status
                } as StagedReturn;
            });

            setStagedItems(processed);
            toast({ title: "Scan Successful", description: `Identified ${processed.length} items for return.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "AI Sync Error", description: e.message || "Failed to parse document." });
        } finally {
            setIsProcessing(false);
        }
    };

    const commitReturns = async () => {
        if (!user?.email || stagedItems.length === 0) return;
        setIsExecuting(true);

        const staffName = user.email.split('@')[0].toUpperCase();
        let totalLogsAffected = 0;

        try {
            for (const staged of stagedItems) {
                if (staged.allocation.length === 0) continue;
                
                // SERIALIZED REGISTRY WRITE
                for (const node of staged.allocation) {
                    const res = await bulkReturnInventoryItemsAction(user.email, [node.itemId], staffName, 'specific', node.qty);
                    if (res.success) totalLogsAffected++;
                }
            }
            
            toast({ title: "Registry Updated", description: `Successfully processed ${totalLogsAffected} inventory updates.` });
            setStagedItems([]);
            setPreviewImage(null);
            setFileName(null);
            refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Write Error", description: "Communication with sheet interrupted." });
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-4 rounded-3xl shadow-xl shadow-primary/20"><Zap className="h-8 w-8 text-white fill-current" /></div>
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Gemini 2.0 Terminal</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-40">High-Velocity Visual Return Engine</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                    <Button variant="outline" onClick={startCamera} disabled={isProcessing} className="h-14 px-6 rounded-2xl font-black uppercase text-[10px]"><Camera className="mr-2 h-5 w-5" /> Quick Capture</Button>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="h-14 px-8 rounded-2xl font-black uppercase shadow-xl bg-primary text-white">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Sync Voucher
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-3xl overflow-hidden h-full min-h-[400px]">
                        <CardContent className="p-6 h-full">
                            <div className="aspect-[3/4] h-full relative rounded-2xl bg-muted/10 border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden">
                                {previewImage ? (
                                    <img src={previewImage} className="object-contain w-full h-full" alt="Voucher Preview" />
                                ) : (
                                    <div className="opacity-20 text-center">
                                        <FileType className="h-16 w-16 mx-auto mb-2" />
                                        <p className="text-[10px] font-black uppercase">Awaiting Document</p>
                                    </div>
                                )}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-md flex flex-col items-center justify-center">
                                        <Loader2 className="h-12 w-12 text-white animate-spin mb-4" />
                                        <span className="text-white font-black uppercase text-[10px] tracking-[0.2em] animate-pulse">Analyzing Space...</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8 flex flex-col">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex-grow flex flex-col">
                        <CardHeader className="bg-muted/10 p-8 border-b border-white/5 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Layers className="h-5 w-5 text-primary" />
                                <h4 className="text-xl font-black uppercase tracking-tighter">Fulfillment Pipeline</h4>
                            </div>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{stagedItems.length} MAPPINGS</Badge>
                        </CardHeader>
                        <CardContent className="p-0 flex-grow">
                            <ScrollArea className="h-[450px]">
                                {stagedItems.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {stagedItems.map((item, idx) => (
                                            <div key={idx} className="p-8 group hover:bg-primary/[0.03] transition-all flex items-center justify-between">
                                                <div className="flex items-start gap-6">
                                                    <div className={cn(
                                                        "p-4 rounded-xl border shadow-sm transition-all", 
                                                        item.status === 'matched' ? "bg-green-500/10 text-green-600 border-green-500/20" : 
                                                        item.status === 'partial' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : 
                                                        "bg-destructive/10 text-destructive border-destructive/20"
                                                    )}>
                                                        {item.status === 'matched' ? <CheckCircle2 className="h-6 w-6" /> : 
                                                         item.status === 'partial' ? <AlertTriangle className="h-6 w-6" /> : 
                                                         <X className="h-6 w-6" />}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{item.productName}</p>
                                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase font-black tracking-tight">
                                                            <div className="flex items-center gap-1.5">
                                                                <Barcode className="h-3 w-3" /> {item.barcode}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-primary">
                                                                <Hash className="h-3 w-3" /> {item.quantity} UNITS
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {item.status === 'matched' ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge className="bg-green-500 text-white font-black text-[8px] uppercase px-3 py-1">Ready</Badge>
                                                            <span className="text-[9px] font-bold text-muted-foreground/40">{item.allocation.length} logs targeted</span>
                                                        </div>
                                                    ) : item.status === 'partial' ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge className="bg-yellow-500 text-black font-black text-[8px] uppercase px-3 py-1">Partial</Badge>
                                                            <span className="text-[9px] font-bold text-yellow-600">Available: {item.totalAvailable}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge className="bg-destructive text-white font-black text-[8px] uppercase px-3 py-1">Not Found</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-32 flex flex-col items-center justify-center opacity-30 text-center">
                                        <Search className="h-16 w-16 mb-4" />
                                        <p className="text-sm font-medium">Upload industrial voucher to initialize return pipeline.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                        {stagedItems.length > 0 && (
                            <div className="p-8 border-t border-white/5 bg-muted/10">
                                <Button 
                                    onClick={commitReturns} 
                                    disabled={isExecuting || stagedItems.every(i => i.allocation.length === 0)} 
                                    className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl bg-primary text-white active:scale-95 transition-all"
                                >
                                    {isExecuting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Undo2 className="mr-3 h-5 w-5" />}
                                    Finalize Distributed Returns
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-black">
                    <div className="relative aspect-video sm:aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {isCameraStarting && <div className="absolute inset-0 flex items-center justify-center bg-black z-10"><Loader2 className="h-10 w-10 text-primary animate-spin" /></div>}
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                            <div className="w-full h-full border-2 border-dashed border-primary/40 rounded-3xl" />
                        </div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <DialogFooter className="p-8 bg-zinc-900 border-t border-white/10 flex flex-row items-center justify-center gap-12">
                        <Button variant="ghost" onClick={stopCamera} className="text-white/60 font-black uppercase text-[10px]">Abort</Button>
                        <Button onClick={capturePhoto} className="h-20 w-20 rounded-full bg-white border-[6px] border-primary p-0 flex items-center justify-center active:scale-90 shadow-2xl transition-all">
                            <Camera className="h-8 w-8 text-zinc-900" />
                        </Button>
                        <div className="w-20" />
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
