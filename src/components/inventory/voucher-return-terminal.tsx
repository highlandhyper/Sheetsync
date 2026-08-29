'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    FileText, 
    Upload, 
    Loader2, 
    CheckCircle2, 
    AlertTriangle, 
    Undo2, 
    Barcode, 
    Hash, 
    Layers,
    ArrowRight,
    X,
    FileType,
    Zap,
    Camera,
    RefreshCw,
    Scan,
    ZapOff,
    Maximize2,
    Minimize2,
    AlertCircle,
    Pencil,
    Save,
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
 * Industrial Image Optimization
 */
async function optimizeImageForRegistry(dataUri: string): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX_DIMENSION = 1600;
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
            resolve(canvas.toDataURL('image/jpeg', 0.8));
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
    const [isPdf, setIsPdf] = useState(false);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [zoomRange, setZoomRange] = useState<{ min: number, max: number, step: number } | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);
    
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [editQuantity, setEditQuantity] = useState<string>('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const isPdfFile = file.type === 'application/pdf';
        setIsPdf(isPdfFile);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUri = event.target?.result as string;
            setPreviewImage(dataUri);
            const finalDataUri = isPdfFile ? dataUri : await optimizeImageForRegistry(dataUri);
            processWithAI(finalDataUri);
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
                const track = stream.getVideoTracks()[0];
                trackRef.current = track;
                const capabilities = (track as any).getCapabilities?.() || {};
                if (capabilities.torch) setHasTorch(true);
                if (capabilities.zoom) {
                    setZoomRange({ min: capabilities.zoom.min || 1, max: capabilities.zoom.max || 5, step: capabilities.zoom.step || 0.1 });
                    setCurrentZoom(capabilities.zoom.min || 1);
                }
            }
        } catch (err) {
            toast({ variant: "destructive", title: "Camera Error", description: "Could not access hardware." });
            setIsCameraOpen(false);
        } finally {
            setIsCameraStarting(false);
        }
    };

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            trackRef.current = null;
        }
        setIsCameraOpen(false);
        setIsTorchOn(false);
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
                setIsPdf(false);
                stopCamera();
                const optimizedUri = await optimizeImageForRegistry(dataUri);
                processWithAI(optimizedUri);
            }
        }
    };

    /**
     * Distributed Allocation Engine
     * Matches return quantities against multiple inventory logs to resolve conflicts.
     */
    const allocateQuantityToLogs = (barcode: string, requestedQty: number) => {
        const normalizedTarget = barcode.replace(/^0+/, '');
        const relevantLogs = inventoryItems
            .filter(i => {
                if (i.quantity <= 0) return false;
                const normalizedLogBarcode = i.barcode.replace(/^0+/, '');
                return i.barcode === barcode || normalizedLogBarcode === normalizedTarget;
            })
            .sort((a, b) => (a.quantity - b.quantity)); // Smallest logs first to clear them out

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
            status: remaining <= 0 ? 'matched' : totalAvailable > 0 ? 'partial' : 'unmatched'
        };
    };

    const processWithAI = async (dataUri: string) => {
        setIsProcessing(true);
        setStagedItems([]);
        
        try {
            const result = await processVoucher({ photoDataUri: dataUri });
            if (!result.success || !result.items) throw new Error(result.error || "No data extracted.");

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
            toast({ title: "Analysis Complete", description: `Synchronized ${processed.length} registry items.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "AI Error", description: e.message || "Registry Node failure." });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateQuantity = () => {
        if (editingItemIndex === null) return;
        const newQty = parseInt(editQuantity);
        if (isNaN(newQty) || newQty < 1) return;

        setStagedItems(prev => prev.map((item, idx) => {
            if (idx !== editingItemIndex) return item;
            const { allocation, totalAvailable, status } = allocateQuantityToLogs(item.barcode, newQty);
            return { ...item, quantity: newQty, allocation, totalAvailable, status };
        }));
        setEditingItemIndex(null);
    };

    const commitReturns = async () => {
        if (!user?.email || stagedItems.length === 0) return;
        setIsExecuting(true);

        const staffName = user.email.split('@')[0].toUpperCase();
        let successCount = 0;

        try {
            for (const staged of stagedItems) {
                if (staged.allocation.length === 0) continue;
                
                // DISPATCH ALLOCATION BATCH
                for (const node of staged.allocation) {
                    const res = await bulkReturnInventoryItemsAction(user.email, [node.itemId], staffName, 'specific', node.qty);
                    if (res.success) successCount++;
                }
            }
            
            toast({ title: "Sync Complete", description: `Finalized ${successCount} individual log updates.` });
            setStagedItems([]);
            setPreviewImage(null);
            setFileName(null);
            refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Process Error", description: "Registry write failure." });
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-4 rounded-3xl shadow-xl shadow-primary/20"><FileType className="h-8 w-8 text-white" /></div>
                    <div><h3 className="text-2xl font-black uppercase tracking-tighter">AI Bulk Returns</h3><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Industrial Document Sync</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    <Button variant="outline" onClick={startCamera} disabled={isProcessing} className="h-14 px-6 rounded-2xl font-black uppercase text-[10px]"><Camera className="mr-2 h-5 w-5" /> Take Photo</Button>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="h-14 px-8 rounded-2xl font-black uppercase shadow-xl bg-primary text-white">{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload Voucher</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-3xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="aspect-[3/4] relative rounded-2xl bg-muted/10 border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden">
                                {previewImage ? (isPdf ? <div className="text-center"><FileText className="h-16 w-16 mx-auto text-red-500 mb-2" /><p className="text-xs font-black uppercase">{fileName}</p></div> : <img src={previewImage} className="object-cover w-full h-full" />) : <div className="opacity-20 text-center"><Upload className="h-16 w-16 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Awaiting Source</p></div>}
                                {isProcessing && <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center"><Loader2 className="h-10 w-10 text-white animate-spin" /></div>}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8 flex flex-col">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex-grow">
                        <CardHeader className="bg-muted/10 p-8 border-b border-white/5 flex flex-row items-center justify-between"><div className="flex items-center gap-3"><Zap className="h-5 w-5 text-primary" /><h4 className="text-xl font-black uppercase tracking-tighter">Analyzed Payload</h4></div><Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{stagedItems.length} ITEMS</Badge></CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[450px]">
                                {stagedItems.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {stagedItems.map((item, idx) => (
                                            <div key={idx} className="p-8 group hover:bg-primary/[0.03] transition-all flex items-center justify-between">
                                                <div className="flex items-start gap-6">
                                                    <div className={cn("p-4 rounded-xl border transition-all", item.status === 'matched' ? "bg-green-500/10 text-green-600 border-green-500/20" : item.status === 'partial' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : "bg-destructive/10 text-destructive border-destructive/20")}>{item.status === 'matched' ? <CheckCircle2 className="h-6 w-6" /> : item.status === 'partial' ? <AlertTriangle className="h-6 w-6" /> : <X className="h-6 w-6" />}</div>
                                                    <div className="space-y-1">
                                                        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{item.productName}</p>
                                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase font-black tracking-tight"><div className="flex items-center gap-1"><Barcode className="h-3 w-3" /> {item.barcode}</div><button onClick={() => { setEditingItemIndex(idx); setEditQuantity(item.quantity.toString()); }} className="flex items-center gap-1 text-primary hover:underline"><Hash className="h-3 w-3" /> {item.quantity} units</button></div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {item.status === 'matched' ? (
                                                        <div className="flex flex-col items-end gap-1"><Badge className="bg-green-500 text-white font-black text-[8px] uppercase px-3 py-1">Registry Ready</Badge><span className="text-[9px] font-bold text-muted-foreground/40">{item.allocation.length} nodes assigned</span></div>
                                                    ) : item.status === 'partial' ? (
                                                        <div className="flex flex-col items-end gap-1"><Badge className="bg-yellow-500 text-black font-black text-[8px] uppercase px-3 py-1">Partial Stock</Badge><span className="text-[9px] font-bold text-yellow-600">Available: {item.totalAvailable}</span></div>
                                                    ) : (
                                                        <Badge className="bg-destructive text-white font-black text-[8px] uppercase px-3 py-1">No Stock Logs</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="py-32 flex flex-col items-center justify-center opacity-30 text-center"><Layers className="h-16 w-16 mb-4" /><p className="text-sm font-medium">Identify a voucher to begin bulk return.</p></div>}
                            </ScrollArea>
                        </CardContent>
                        {stagedItems.length > 0 && (
                            <div className="p-8 border-t border-white/5 bg-muted/10">
                                <Button onClick={commitReturns} disabled={isExecuting || stagedItems.every(i => i.allocation.length === 0)} className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl bg-primary text-white">{isExecuting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Undo2 className="mr-3 h-5 w-5" />} Finalize Returns on Sheet</Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <Dialog open={editingItemIndex !== null} onOpenChange={(open) => !open && setEditingItemIndex(null)}>
                <DialogContent className="sm:max-w-md p-6 rounded-[2rem] border-none shadow-3xl bg-background">
                    <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tighter">Adjust Payload</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Quantity to Return</Label>
                        <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} className="h-14 rounded-2xl bg-muted/10 font-black text-2xl border-primary/10" autoFocus />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setEditingItemIndex(null)} className="rounded-xl font-bold h-12">Cancel</Button><Button onClick={handleUpdateQuantity} className="bg-primary text-white rounded-xl font-black uppercase text-[10px] h-12">Save Override</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-black">
                    <DialogHeader className="p-8 pb-4 bg-zinc-900/80 backdrop-blur-md border-b border-white/10 shrink-0 flex flex-row items-center justify-between"><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">Capture Voucher</DialogTitle></div><Button variant="ghost" onClick={stopCamera} className="text-white hover:bg-white/10"><X className="h-6 w-6" /></Button></DialogHeader>
                    <div className="relative aspect-video sm:aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {isCameraStarting && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10"><Loader2 className="h-10 w-10 text-primary animate-spin" /></div>}
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: `scale(${currentZoom})` }} />
                        <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40"><div className="w-full h-full border-2 border-dashed border-primary/40 rounded-3xl relative"><div className="absolute top-4 left-4 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-xl" /><div className="absolute top-4 right-4 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-xl" /><div className="absolute bottom-4 left-4 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-xl" /><div className="absolute bottom-4 right-4 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-xl" /></div></div>
                        {zoomRange && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10"><span className="text-[10px] font-black text-primary">{currentZoom.toFixed(1)}x</span></div>}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <DialogFooter className="p-8 bg-zinc-900/80 backdrop-blur-md border-t border-white/10 flex flex-col gap-6">
                        {zoomRange && <Slider value={[currentZoom]} min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} onValueChange={(v) => handleZoomChange(v)} className="w-full" />}
                        <div className="flex flex-row items-center justify-center gap-12"><Button variant="ghost" onClick={stopCamera} className="text-white/60 font-black uppercase text-[10px]">Abort</Button><Button onClick={capturePhoto} className="h-20 w-20 rounded-full bg-white border-[6px] border-primary p-0 flex items-center justify-center active:scale-90"><Scan className="h-8 w-8 text-zinc-900" /></Button><div className="w-20" /></div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
