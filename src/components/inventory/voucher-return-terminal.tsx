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
    Save
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
    matchedItemId?: string;
    availableStock?: number;
    status: 'matched' | 'unmatched' | 'multiple';
}

/**
 * Industrial Image Optimization
 * Reduces high-res camera captures to ~1MB for reliable transmission.
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
                video: { 
                    facingMode: 'environment', 
                    width: { ideal: 1920 }, 
                    height: { ideal: 1080 },
                } 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                const track = stream.getVideoTracks()[0];
                trackRef.current = track;
                const capabilities = (track as any).getCapabilities?.() || {};
                if (capabilities.torch) setHasTorch(true);
                if (capabilities.zoom) {
                    setZoomRange({
                        min: capabilities.zoom.min || 1,
                        max: capabilities.zoom.max || 5,
                        step: capabilities.zoom.step || 0.1
                    });
                    setCurrentZoom(capabilities.zoom.min || 1);
                }
            }
        } catch (err) {
            toast({ variant: "destructive", title: "Camera Error", description: "Could not access camera hardware." });
            setIsCameraOpen(false);
        } finally {
            setIsCameraStarting(false);
        }
    };

    const toggleTorch = async () => {
        if (!trackRef.current || !hasTorch) return;
        try {
            const newState = !isTorchOn;
            await (trackRef.current as any).applyConstraints({ advanced: [{ torch: newState }] });
            setIsTorchOn(newState);
        } catch (e) {}
    };

    const handleZoomChange = async (values: number[]) => {
        const value = values[0];
        setCurrentZoom(value);
        if (!trackRef.current || !zoomRange) return;
        try {
            await (trackRef.current as any).applyConstraints({ advanced: [{ zoom: value }] });
        } catch (e) {}
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

    const processWithAI = async (dataUri: string) => {
        setIsProcessing(true);
        setStagedItems([]);
        
        try {
            const result = await processVoucher({ photoDataUri: dataUri });
            if (!result.success || !result.items) throw new Error(result.error || "No data extracted.");

            const processed = result.items.map(aiItem => {
                const normalizedAiBarcode = aiItem.barcode.replace(/^0+/, '');
                
                const matches = inventoryItems.filter(i => {
                    if (i.quantity <= 0) return false;
                    const normalizedItemBarcode = i.barcode.replace(/^0+/, '');
                    return i.barcode === aiItem.barcode || normalizedItemBarcode === normalizedAiBarcode;
                });
                
                return {
                    barcode: aiItem.barcode,
                    productName: aiItem.productName,
                    quantity: aiItem.quantity,
                    matchedItemId: matches.length === 1 ? matches[0].id : undefined,
                    availableStock: matches.length === 1 ? matches[0].quantity : undefined,
                    status: matches.length === 1 ? 'matched' : matches.length > 1 ? 'multiple' : 'unmatched'
                } as StagedReturn;
            });

            setStagedItems(processed);
            toast({ title: "Extraction Complete", description: `Identified ${processed.length} items.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Analysis Failure", description: e.message || "Registry AI Node failed." });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateQuantity = () => {
        if (editingItemIndex === null) return;
        const newQty = parseInt(editQuantity);
        if (isNaN(newQty) || newQty < 1) {
            toast({ variant: "destructive", title: "Invalid Input", description: "Quantity must be at least 1." });
            return;
        }

        setStagedItems(prev => prev.map((item, idx) => 
            idx === editingItemIndex ? { ...item, quantity: newQty } : item
        ));
        setEditingItemIndex(null);
        toast({ title: "Quantity Adjusted", description: "Staged return payload updated." });
    };

    const commitReturns = async () => {
        if (!user?.email || stagedItems.length === 0) return;
        setIsExecuting(true);

        const validReturns = stagedItems.filter(i => i.matchedItemId);
        if (validReturns.length === 0) {
            toast({ variant: "destructive", title: "Process Aborted", description: "No valid registry matches identified to return." });
            setIsExecuting(false);
            return;
        }

        const staffName = user.email.split('@')[0].toUpperCase();

        try {
            for (const item of validReturns) {
                const res = await bulkReturnInventoryItemsAction(user.email, [item.matchedItemId!], staffName, 'specific', item.quantity);
                if (!res.success) throw new Error("Sync failed for item " + item.barcode);
            }
            toast({ title: "Bulk Returns Committed", description: "Voucher items processed successfully." });
            setStagedItems([]);
            setPreviewImage(null);
            setFileName(null);
            refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Process Error", description: "One or more returns failed to sync with the registry." });
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-4 rounded-[1.5rem] shadow-xl shadow-primary/20">
                        <FileType className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter">Voucher AI Processor</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40">Industrial Document Sync</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    <Button variant="outline" onClick={startCamera} disabled={isProcessing} className="h-14 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] border-primary/20 hover:bg-primary/5">
                        <Camera className="mr-2 h-5 w-5 text-primary" /> Take Photo
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload Voucher / PDF
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-4">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-[2rem] overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Evidence Source</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="aspect-[3/4] relative rounded-2xl bg-muted/10 border-2 border-dashed border-white/5 flex flex-col items-center justify-center overflow-hidden">
                                {previewImage ? (
                                    isPdf ? (
                                        <div className="flex flex-col items-center gap-4 text-center px-4">
                                            <div className="bg-red-500/10 p-6 rounded-3xl"><FileText className="h-16 w-16 text-red-500" strokeWidth={1.5} /></div>
                                            <p className="text-xs font-black uppercase truncate max-w-[200px] text-slate-900 dark:text-white">{fileName}</p>
                                            <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-none font-black text-[9px]">PDF DOCUMENT</Badge>
                                        </div>
                                    ) : (
                                        <img src={previewImage} alt="Voucher" className="object-cover w-full h-full" />
                                    )
                                ) : (
                                    <div className="flex flex-col items-center gap-4 opacity-20"><Upload className="h-16 w-16" strokeWidth={1} /><p className="text-[9px] font-black uppercase tracking-widest">Awaiting Source</p></div>
                                )}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="h-10 w-10 text-white animate-spin" />
                                        <Badge className="bg-white text-primary font-black animate-pulse uppercase tracking-widest text-[10px] py-1 px-4 rounded-full">ANALYZING...</Badge>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden h-full flex flex-col">
                        <CardHeader className="bg-muted/10 p-8 border-b border-white/5 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3"><Zap className="h-5 w-5 text-primary" /><h4 className="text-xl font-black uppercase tracking-tighter leading-none">Extracted Payload</h4></div>
                            <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20">{stagedItems.length} ITEMS IDENTIFIED</Badge>
                        </CardHeader>
                        <CardContent className="p-0 flex-grow">
                            <ScrollArea className="h-[450px]">
                                {stagedItems.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {stagedItems.map((item, idx) => (
                                            <div key={idx} className="p-8 group hover:bg-primary/[0.03] transition-all flex items-center justify-between">
                                                <div className="flex items-start gap-6">
                                                    <div className={cn("p-4 rounded-xl border flex items-center justify-center transition-all group-hover:scale-110", item.status === 'matched' ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
                                                        {item.status === 'matched' ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">{item.productName}</p>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"><Barcode className="h-3 w-3" /> {item.barcode}</div>
                                                            <button 
                                                                onClick={() => { setEditingItemIndex(idx); setEditQuantity(item.quantity.toString()); }}
                                                                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-primary hover:bg-primary/10 px-2 py-0.5 rounded transition-all"
                                                            >
                                                                <Hash className="h-3 w-3" /> {item.quantity} Units <Pencil className="h-2.5 w-2.5 ml-1 opacity-40" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {item.status === 'matched' ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-none font-black text-[8px] uppercase px-3 py-1">Registry Verified</Badge>
                                                            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase">Stock: {item.availableStock}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-none font-black text-[8px] uppercase px-3 py-1">Target Not Found</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30 py-32"><Layers className="h-16 w-16 mb-4" strokeWidth={1} /><h5 className="text-xl font-black uppercase tracking-tighter">Empty Staging Area</h5><p className="text-xs font-medium max-w-[240px] mt-2 leading-relaxed">Awaiting document extraction and normalized matching.</p></div>
                                )}
                            </ScrollArea>
                        </CardContent>
                        {stagedItems.length > 0 && (
                            <div className="p-8 border-t border-white/5 bg-muted/10">
                                <Button onClick={commitReturns} disabled={isExecuting || stagedItems.every(i => !i.matchedItemId)} className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 bg-primary text-white">
                                    {isExecuting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Undo2 className="mr-3 h-5 w-5" />} Finalize Bulk Return
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* QUANTITY CALIBRATION DIALOG */}
            <Dialog open={editingItemIndex !== null} onOpenChange={(open) => !open && setEditingItemIndex(null)}>
                <DialogContent className="sm:max-w-md p-6 rounded-[2rem] border-none shadow-3xl bg-background">
                    <DialogHeader>
                        <div className="bg-primary/10 p-4 rounded-2xl w-fit mb-4">
                            <Hash className="h-6 w-6 text-primary" />
                        </div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Adjust Quantity</DialogTitle>
                        <DialogDescription className="font-medium text-xs">
                            Manually override the extracted quantity for <strong>{editingItemIndex !== null && stagedItems[editingItemIndex]?.productName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Return Quantity</Label>
                                {editingItemIndex !== null && stagedItems[editingItemIndex]?.availableStock !== undefined && (
                                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">Stock Limit: {stagedItems[editingItemIndex].availableStock}</span>
                                )}
                            </div>
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30" />
                                <Input 
                                    type="number" 
                                    value={editQuantity} 
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                    className="pl-12 h-14 rounded-2xl bg-muted/10 font-black text-2xl border-primary/10 focus:border-primary transition-all"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateQuantity()}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="grid grid-cols-2 gap-3">
                        <Button variant="outline" onClick={() => setEditingItemIndex(null)} className="rounded-xl font-bold h-12">Cancel</Button>
                        <Button onClick={handleUpdateQuantity} className="bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-widest text-[10px] h-12 shadow-lg shadow-primary/20">
                            <Save className="mr-2 h-4 w-4" /> Save Override
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-black">
                    <DialogHeader className="p-8 pb-4 bg-zinc-900/80 backdrop-blur-md border-b border-white/10 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4"><div className="p-3 bg-primary/10 rounded-2xl"><Camera className="h-6 w-6 text-primary" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">Evidence Capture</DialogTitle><DialogDescription className="text-zinc-400 font-bold text-[9px] uppercase tracking-[0.3em]">Align invoice with the frame</DialogDescription></div></div>
                            <div className="flex items-center gap-2">
                                {hasTorch && <Button variant="ghost" size="icon" onClick={toggleTorch} className={cn("h-10 w-10 rounded-xl transition-all", isTorchOn ? "bg-yellow-500 text-black" : "text-white hover:bg-white/10")}>{isTorchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}</Button>}
                                <Button variant="ghost" size="icon" onClick={stopCamera} className="text-white hover:bg-white/10"><X className="h-6 w-6" /></Button>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="relative aspect-video sm:aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {isCameraStarting && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black"><Loader2 className="h-10 w-10 text-primary animate-spin" /><span className="text-[10px] font-black uppercase text-primary tracking-widest animate-pulse">Initializing Lens...</span></div>}
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transition-all duration-300" style={{ transform: `scale(${currentZoom})` }} />
                        <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40"><div className="w-full h-full border-2 border-dashed border-primary/40 rounded-3xl relative"><div className="absolute top-1/2 left-0 right-0 h-px bg-primary/20 shadow-[0_0_10px_rgba(41,171,226,0.5)]" /><div className="absolute top-0 bottom-0 left-1/2 w-px bg-primary/20" /><div className="absolute top-4 left-4 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-xl" /><div className="absolute top-4 right-4 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-xl" /><div className="absolute bottom-4 left-4 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-xl" /><div className="absolute bottom-4 right-4 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-xl" /></div></div>
                        {zoomRange && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10"><Minimize2 className="h-3 w-3 text-white/40" /><span className="text-[10px] font-black text-primary min-w-[30px] text-center">{currentZoom.toFixed(1)}x</span><Maximize2 className="h-3 w-3 text-white/40" /></div>}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <DialogFooter className="p-8 bg-zinc-900/80 backdrop-blur-md border-t border-white/10 shrink-0 flex flex-col gap-6">
                        {zoomRange && <div className="px-10 space-y-3"><div className="flex justify-between items-center text-[8px] font-black uppercase text-white/40 tracking-widest"><span>Precision Zoom</span><span>Scale {currentZoom.toFixed(1)}</span></div><Slider value={[currentZoom]} min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} onValueChange={handleZoomChange} className="w-full" /></div>}
                        <div className="flex flex-row items-center justify-center gap-12"><Button variant="ghost" onClick={stopCamera} className="text-white/60 hover:text-white font-black uppercase text-[10px] tracking-widest h-12">Terminate</Button><Button onClick={capturePhoto} className="h-20 w-20 rounded-full bg-white hover:bg-zinc-200 border-[6px] border-primary p-0 flex items-center justify-center group shadow-2xl transition-all active:scale-90"><div className="h-12 w-12 rounded-full border-4 border-zinc-900 group-hover:scale-110 transition-transform flex items-center justify-center"><Scan className="h-5 w-5 text-zinc-900" /></div></Button><div className="w-20" /></div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}