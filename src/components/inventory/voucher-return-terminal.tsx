'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    Scan
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
    status: 'matched' | 'unmatched' | 'multiple';
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
    
    // Camera States
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
        setIsPdf(file.type === 'application/pdf');

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUri = event.target?.result as string;
            setPreviewImage(dataUri);
            processWithAI(dataUri);
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
            console.error("Camera Access Error:", err);
            toast({ variant: "destructive", title: "Camera Error", description: "Could not access visual capture hardware." });
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

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUri = canvas.toDataURL('image/jpeg', 0.9);
                setPreviewImage(dataUri);
                setFileName(`invoice_capture_${Date.now()}.jpg`);
                setIsPdf(false);
                stopCamera();
                processWithAI(dataUri);
            }
        }
    };

    const processWithAI = async (dataUri: string) => {
        setIsProcessing(true);
        setStagedItems([]);
        
        try {
            const result = await processVoucher({ photoDataUri: dataUri });
            
            if (!result || !result.items) {
                throw new Error("No data extracted from document.");
            }

            const processed = result.items.map(aiItem => {
                const matches = inventoryItems.filter(i => i.barcode === aiItem.barcode && i.quantity > 0);
                
                return {
                    barcode: aiItem.barcode,
                    productName: aiItem.productName,
                    quantity: aiItem.quantity,
                    matchedItemId: matches.length === 1 ? matches[0].id : undefined,
                    status: matches.length === 1 ? 'matched' : matches.length > 1 ? 'multiple' : 'unmatched'
                } as StagedReturn;
            });

            setStagedItems(processed);
            toast({ title: "Extraction Complete", description: `Identified ${processed.length} items from document.` });
        } catch (e: any) {
            console.error("Voucher Analysis Error:", e);
            toast({ 
                variant: "destructive", 
                title: "Analysis Failure", 
                description: e.message || "Voucher analysis failed. Check console for details." 
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const commitReturns = async () => {
        if (!user?.email || stagedItems.length === 0) return;
        setIsExecuting(true);

        const validReturns = stagedItems.filter(i => i.matchedItemId);
        const staffName = user.email.split('@')[0].toUpperCase();

        try {
            for (const item of validReturns) {
                await bulkReturnInventoryItemsAction(user.email, [item.matchedItemId!], staffName, 'specific', item.quantity);
            }
            
            toast({ title: "Bulk Returns Commited", description: "Successfully processed verified voucher items." });
            setStagedItems([]);
            setPreviewImage(null);
            setFileName(null);
            refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Process Error", description: "One or more returns failed to sync." });
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
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileUpload} 
                    />
                    <Button 
                        variant="outline"
                        onClick={startCamera}
                        disabled={isProcessing}
                        className="h-14 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] border-primary/20 hover:bg-primary/5"
                    >
                        <Camera className="mr-2 h-5 w-5 text-primary" />
                        Take Photo
                    </Button>
                    <Button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isProcessing}
                        className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90"
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
                        Upload Voucher / PDF
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* PREVIEW PANEL */}
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
                                            <div className="bg-red-500/10 p-6 rounded-3xl">
                                                <FileText className="h-16 w-16 text-red-500" strokeWidth={1.5} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-black uppercase truncate max-w-[200px] text-slate-900 dark:text-white">{fileName}</p>
                                                <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-none font-black text-[9px]">PDF DOCUMENT</Badge>
                                            </div>
                                        </div>
                                    ) : (
                                        <img src={previewImage} alt="Voucher" className="object-cover w-full h-full" />
                                    )
                                ) : (
                                    <div className="flex flex-col items-center gap-4 opacity-20">
                                        <Upload className="h-16 w-16" strokeWidth={1} />
                                        <p className="text-[9px] font-black uppercase tracking-widest">Awaiting Capture</p>
                                    </div>
                                )}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="h-10 w-10 text-white animate-spin" />
                                        <Badge className="bg-white text-primary font-black animate-pulse uppercase tracking-widest text-[10px] py-1 px-4 rounded-full">ANALYZING DOCUMENT...</Badge>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* EXTRACTION PANEL */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-white/10 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden h-full flex flex-col">
                        <CardHeader className="bg-muted/10 p-8 border-b border-white/5 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Zap className="h-5 w-5 text-primary" />
                                <h4 className="text-xl font-black uppercase tracking-tighter leading-none">Extracted Payload</h4>
                            </div>
                            <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                                {stagedItems.length} ITEMS IDENTIFIED
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0 flex-grow">
                            <ScrollArea className="h-[450px]">
                                {stagedItems.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {stagedItems.map((item, idx) => (
                                            <div key={idx} className="p-8 group hover:bg-primary/[0.03] transition-all flex items-center justify-between">
                                                <div className="flex items-start gap-6">
                                                    <div className={cn(
                                                        "p-4 rounded-xl border flex items-center justify-center transition-all group-hover:scale-110",
                                                        item.status === 'matched' ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                                                    )}>
                                                        {item.status === 'matched' ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">{item.productName}</p>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                                                                <Barcode className="h-3 w-3" /> {item.barcode}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-primary">
                                                                <Hash className="h-3 w-3" /> {item.quantity} Units
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {item.status === 'matched' ? (
                                                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-none font-black text-[8px] uppercase px-3 py-1">Registry Verified</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-none font-black text-[8px] uppercase px-3 py-1">Target Not Found</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30 py-32">
                                        <Layers className="h-16 w-16 mb-4" strokeWidth={1} />
                                        <h5 className="text-xl font-black uppercase tracking-tighter">Empty Staging Area</h5>
                                        <p className="text-xs font-medium max-w-[240px] mt-2 leading-relaxed">Upload a document, take a photo, or scan a PDF to begin AI-powered extraction and registry matching.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                        {stagedItems.length > 0 && (
                            <div className="p-8 border-t border-white/5 bg-muted/10">
                                <Button 
                                    onClick={commitReturns} 
                                    disabled={isExecuting || stagedItems.every(i => !i.matchedItemId)}
                                    className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 bg-primary text-white"
                                >
                                    {isExecuting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Undo2 className="mr-3 h-5 w-5" />}
                                    Finalize Bulk return
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* CAMERA CAPTURE DIALOG */}
            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-black">
                    <DialogHeader className="p-8 pb-4 bg-zinc-900/80 backdrop-blur-md border-b border-white/10 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <Camera className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">Visual Evidence Capture</DialogTitle>
                                    <DialogDescription className="text-zinc-400 font-bold text-[9px] uppercase tracking-[0.3em]">Align invoice with the frame</DialogDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={stopCamera} className="text-white hover:bg-white/10">
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    <div className="relative aspect-video sm:aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {isCameraStarting && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                <span className="text-[10px] font-black uppercase text-primary tracking-widest animate-pulse">Initializing Lens...</span>
                            </div>
                        )}
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40">
                             <div className="w-full h-full border-2 border-dashed border-primary/40 rounded-3xl" />
                        </div>
                    </div>

                    <canvas ref={canvasRef} className="hidden" />

                    <DialogFooter className="p-8 bg-zinc-900/80 backdrop-blur-md border-t border-white/10 shrink-0 flex flex-row items-center justify-center gap-6">
                        <Button variant="ghost" onClick={stopCamera} className="text-white/60 hover:text-white font-black uppercase text-[10px] tracking-widest">
                            Abort
                        </Button>
                        <Button 
                            onClick={capturePhoto}
                            className="h-20 w-20 rounded-full bg-white hover:bg-zinc-200 border-[6px] border-primary p-0 flex items-center justify-center group shadow-2xl transition-all active:scale-90"
                        >
                            <div className="h-12 w-12 rounded-full border-4 border-zinc-900 group-hover:scale-110 transition-transform flex items-center justify-center">
                                <Scan className="h-5 w-5 text-zinc-900" />
                            </div>
                        </Button>
                        <div className="w-20" /> {/* Spacer */}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
