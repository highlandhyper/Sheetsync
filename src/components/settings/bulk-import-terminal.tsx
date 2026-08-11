'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
    Upload, 
    FileSpreadsheet, 
    FileCode,
    ArrowRight, 
    Loader2, 
    CheckCircle2, 
    AlertTriangle, 
    Play, 
    Settings2,
    Database,
    Zap,
    X,
    Eye,
    PlusCircle,
    RotateCcw
} from 'lucide-react';
import Papa from 'papaparse';
import { clearDatabaseAction, batchImportProductsAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BATCH_SIZE = 400; 
const SKIP_VALUE = "___SKIP_FIELD___";

interface Mapping {
    barcode: string;
    productName: string;
    supplierName: string;
    costPrice: string;
}

function sanitizeXmlString(xml: string): string {
    let cleaned = xml.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]/g, "");
    cleaned = cleaned.replace(/&#(?:0?[0-8]|1[12]|1[4-9]|2[0-9]|3[0-1]);/g, "");
    cleaned = cleaned.replace(/&#x(?:0?[0-8]|1[0-9a-fA-F]|[bB]|[cC]|[eE]|[fF]);/gi, "");
    return cleaned;
}

export function BulkImportTerminal() {
    const { user } = useAuth();
    const { refreshData, products: cachedProducts } = useDataCache();
    const { toast } = useToast();

    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'csv' | 'xml' | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewRows, setPreviewRows] = useState<any[]>([]); 
    const [xmlRecordTag, setXmlRecordTag] = useState<string>('');
    const [isWipeEnabled, setIsWipeEnabled] = useState(true);
    const [mapping, setMapping] = useState<Mapping>({
        barcode: '',
        productName: '',
        supplierName: '',
        costPrice: SKIP_VALUE
    });

    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [totalRows, setTotalRows] = useState(0);
    const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'process'>('upload');
    const [stats, setStats] = useState({ success: 0, failed: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const isXml = selectedFile.name.toLowerCase().endsWith('.xml');
            setFileType(isXml ? 'xml' : 'csv');
            parseHeaders(selectedFile, isXml);
        }
    };

    const parseHeaders = (file: File, isXml: boolean) => {
        setIsParsing(true);
        if (isXml) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let text = e.target?.result as string;
                    text = sanitizeXmlString(text);
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");
                    const parseError = xmlDoc.getElementsByTagName("parsererror");
                    if (parseError.length > 0) throw new Error(parseError[0].textContent || "XML Error");

                    const root = xmlDoc.documentElement;
                    let firstRecord: Element | null = null;
                    const findFirstRecord = (node: Element): Element | null => {
                        if (node.children.length > 0 && Array.from(node.children).every(c => c.children.length === 0)) return node;
                        for (let i = 0; i < node.children.length; i++) {
                            const found = findFirstRecord(node.children[i]);
                            if (found) return found;
                        }
                        return null;
                    };
                    firstRecord = findFirstRecord(root);

                    if (firstRecord) {
                        const tagName = firstRecord.tagName;
                        setXmlRecordTag(tagName);
                        const tagNames = Array.from(firstRecord.children).map(c => c.tagName);
                        setHeaders(tagNames);
                        const allRecords = Array.from(xmlDoc.getElementsByTagName(tagName)).slice(0, 3);
                        const samples = allRecords.map(record => {
                            const obj: any = {};
                            Array.from(record.children).forEach(child => { obj[child.tagName] = child.textContent; });
                            return obj;
                        });
                        setPreviewRows(samples);
                        const newMapping = { barcode: '', productName: '', supplierName: '', costPrice: SKIP_VALUE };
                        tagNames.forEach(h => {
                            const l = h.toLowerCase();
                            if (l.includes('barcode') || l.includes('upc') || l.includes('sku') || l === 'id') newMapping.barcode = h;
                            if (l.includes('name') || l.includes('title') || l.includes('desc')) newMapping.productName = h;
                            if (l.includes('supp') || l.includes('vendor') || l.includes('brand')) newMapping.supplierName = h;
                            if (l.includes('cost') || l.includes('price') || l.includes('rate')) newMapping.costPrice = h;
                        });
                        setMapping(newMapping);
                        setCurrentStep('map');
                    } else {
                        toast({ variant: "destructive", title: "Invalid XML", description: "No records found." });
                        setFile(null);
                    }
                } catch (err: any) {
                    toast({ variant: "destructive", title: "Parse Error", description: err.message });
                } finally { setIsParsing(false); }
            };
            reader.readAsText(file);
        } else {
            Papa.parse(file, {
                header: true,
                preview: 5,
                complete: (results) => {
                    const foundHeaders = results.meta.fields || [];
                    setHeaders(foundHeaders);
                    setPreviewRows(results.data.slice(0, 3));
                    const newMapping = { barcode: '', productName: '', supplierName: '', costPrice: SKIP_VALUE };
                    foundHeaders.forEach(h => {
                        const l = h.toLowerCase();
                        if (l.includes('barcode') || l.includes('upc') || l.includes('sku') || l === 'id') newMapping.barcode = h;
                        if (l.includes('name') || l.includes('title') || l.includes('desc')) newMapping.productName = h;
                        if (l.includes('supp') || l.includes('vendor') || l.includes('brand')) newMapping.supplierName = h;
                        if (l.includes('cost') || l.includes('price') || l.includes('rate')) newMapping.costPrice = h;
                    });
                    setMapping(newMapping);
                    setIsParsing(false);
                    setCurrentStep('map');
                }
            });
        }
    };

    const startImport = async () => {
        if (!file || !user?.email) return;
        setIsImporting(true);
        setCurrentStep('process');
        setProgress(0);
        setStats({ success: 0, failed: 0 });

        if (isWipeEnabled) {
            const wipeRes = await clearDatabaseAction(user.email);
            if (!wipeRes.success) {
                toast({ variant: "destructive", title: "Sync Failed", description: "Could not clear database." });
                setIsImporting(false);
                return;
            }
        }

        if (fileType === 'xml') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let text = e.target?.result as string;
                    text = sanitizeXmlString(text);
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");
                    const records = Array.from(xmlDoc.getElementsByTagName(xmlRecordTag));
                    const data = records.map(record => {
                        const obj: any = {};
                        Array.from(record.children).forEach(child => { obj[child.tagName] = child.textContent; });
                        return obj;
                    });
                    await runBatchImport(data);
                } catch (err: any) {
                    toast({ variant: "destructive", title: "Sync Error", description: "Processing failure." });
                    setIsImporting(false);
                }
            };
            reader.readAsText(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    await runBatchImport(results.data);
                }
            });
        }
    };

    const runBatchImport = async (data: any[]) => {
        setTotalRows(data.length);
        let totalSuccessCount = 0;
        let totalFailedCount = 0;
        
        // GRID EXPANSION PROTOCOL:
        // Wipe mode starts at row 2. Append mode starts after existing products.
        let currentRow = isWipeEnabled ? 2 : (cachedProducts.length + 2);

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const formattedBatch = batch.map(row => {
                const rawBarcode = String(row[mapping.barcode] || '').trim();
                const productName = String(row[mapping.productName] || '').trim();
                const supplierName = String(row[mapping.supplierName] || '').trim();
                const barcode = rawBarcode ? `'${rawBarcode}` : '';
                
                let cost = 0;
                if (mapping.costPrice !== SKIP_VALUE && row[mapping.costPrice] !== undefined) {
                    const parsed = parseFloat(String(row[mapping.costPrice]).replace(/[^0-9.-]+/g, ""));
                    cost = isNaN(parsed) ? 0 : parsed;
                }
                const uniqueId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                return [barcode, '', productName, supplierName, cost, '', '', uniqueId];
            }).filter(row => row[0]); 

            if (formattedBatch.length > 0) {
                // SEQUENTIAL BATCH SYNC
                const res = await batchImportProductsAction(user?.email!, formattedBatch, currentRow);
                if (res.success) {
                    totalSuccessCount += formattedBatch.length;
                    totalFailedCount += (batch.length - formattedBatch.length);
                    currentRow += formattedBatch.length; // ADVANCE TO NEXT PHYSICAL ROW
                } else {
                    totalFailedCount += batch.length;
                }
            } else {
                totalFailedCount += batch.length;
            }

            setProgress(Math.round(((i + batch.length) / data.length) * 100));
            setStats({ success: totalSuccessCount, failed: totalFailedCount });
            
            // DELAY TO PREVENT QUOTA EXHAUSTION
            if (i + BATCH_SIZE < data.length) await new Promise(r => setTimeout(r, 300));
        }

        setIsImporting(false);
        toast({ title: "Import Finished", description: `Updated registry with ${totalSuccessCount} products.` });
        refreshData();
    };

    const isMappingComplete = mapping.barcode && mapping.productName && mapping.supplierName;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-2xl">
                        <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Bulk Import Terminal</h3>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">High-Performance Registry Sync</p>
                    </div>
                </div>
                {currentStep !== 'upload' && !isImporting && (
                    <Button variant="ghost" size="icon" onClick={() => { setFile(null); setCurrentStep('upload'); }} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>

            <Card className="border-primary/10 bg-muted/5 shadow-none rounded-3xl overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                    {currentStep === 'upload' && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                            <div 
                                className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-2 border-dashed border-primary/20 cursor-pointer hover:bg-primary/10 transition-all"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-10 w-10 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-black uppercase tracking-tight text-lg">Load Registry File</h4>
                                <p className="text-xs text-muted-foreground max-w-xs font-medium">Upload CSV or XML to begin industrial synchronization.</p>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xml" onChange={handleFileChange} />
                            <Button onClick={() => fileInputRef.current?.click()} className="h-12 px-8 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                                {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                Select File
                            </Button>
                        </div>
                    )}

                    {currentStep === 'map' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                <div className="flex items-center gap-3">
                                    {fileType === 'xml' ? <FileCode className="h-5 w-5 text-primary" /> : <FileSpreadsheet className="h-5 w-5 text-primary" />}
                                    <h4 className="text-sm font-black uppercase tracking-widest truncate max-w-[200px]">{file?.name}</h4>
                                </div>
                                <Badge variant="outline" className="font-mono text-[10px]">{fileType?.toUpperCase()}</Badge>
                            </div>

                            <div className="rounded-2xl border bg-background overflow-hidden shadow-inner">
                                <div className="bg-muted/50 p-3 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Identification Preview</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-primary/60 uppercase italic">Verify data values</span>
                                </div>
                                <ScrollArea className="h-[150px] w-full">
                                    <Table>
                                        <TableHeader className="bg-muted/20 sticky top-0 z-10">
                                            <TableRow>
                                                {headers.map((h, i) => (
                                                    <TableHead key={`p-head-${h}-${i}`} className="text-[9px] uppercase font-black px-4 whitespace-nowrap">{h}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewRows.map((row, i) => (
                                                <TableRow key={`p-row-${i}`}>
                                                    {headers.map((h, j) => (
                                                        <TableCell key={`p-cell-${i}-${j}`} className="text-[10px] font-medium py-2 px-4 whitespace-nowrap border-r last:border-r-0">
                                                            {String(row[h] || '')}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Barcode Column</Label>
                                    <Select value={mapping.barcode} onValueChange={(v) => setMapping(p => ({...p, barcode: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl font-bold bg-background border-primary/10"><SelectValue placeholder="Select Column..." /></SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h, i) => <SelectItem key={`${h}-${i}-bc`} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Product Name Column</Label>
                                    <Select value={mapping.productName} onValueChange={(v) => setMapping(p => ({...p, productName: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl font-bold bg-background border-primary/10"><SelectValue placeholder="Select Column..." /></SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h, i) => <SelectItem key={`${h}-${i}-name`} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Supplier/Brand Column</Label>
                                    <Select value={mapping.supplierName} onValueChange={(v) => setMapping(p => ({...p, supplierName: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl font-bold bg-background border-primary/10"><SelectValue placeholder="Select Column..." /></SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h, i) => <SelectItem key={`${h}-${i}-supp`} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Cost Price Column</Label>
                                    <Select value={mapping.costPrice} onValueChange={(v) => setMapping(p => ({...p, costPrice: v}))}>
                                        <SelectTrigger className="h-11 rounded-xl font-bold bg-background border-primary/10"><SelectValue placeholder="Select Column..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={SKIP_VALUE}>-- Skip Cost --</SelectItem>
                                            {headers.map((h, i) => <SelectItem key={`${h}-${i}-cost`} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/20 border rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="wipe-toggle" className="text-sm font-black uppercase">Wipe Existing Registry</Label>
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">Erase all current records before starting. Disable to append split files.</p>
                                </div>
                                <Switch id="wipe-toggle" checked={isWipeEnabled} onCheckedChange={setIsWipeEnabled} />
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                <Button variant="ghost" onClick={() => setCurrentStep('upload')} className="font-bold h-12 px-6 rounded-xl">Change File</Button>
                                <Button disabled={!isMappingComplete} onClick={startImport} className="flex-1 h-12 font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20">
                                    <Zap className="mr-2 h-4 w-4 fill-primary-foreground" />
                                    Begin {isWipeEnabled ? 'Wipe & Import' : 'Append Import'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 'process' && (
                        <div className="space-y-8 py-4 animate-in zoom-in-95 duration-500">
                            <div className="text-center space-y-4">
                                <div className="relative inline-flex items-center justify-center">
                                    <div className={cn("absolute inset-0 bg-primary/20 rounded-full animate-ping", !isImporting && "hidden")} />
                                    <div className="relative bg-primary/10 p-5 rounded-full">
                                        {isImporting ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <CheckCircle2 className="h-10 w-10 text-green-500" />}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-2xl font-black tracking-tight uppercase">
                                        {isImporting ? "Syncing Records..." : "Sync Complete"}
                                    </h4>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                                        {isWipeEnabled ? "Full Overwrite Mode" : "Extension Mode Active"}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                                    <span>Sync Status</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-3 rounded-full" />
                                <div className="flex justify-between items-baseline pt-1">
                                    <span className="text-xs font-bold text-muted-foreground">{stats.success.toLocaleString()} Verified Success</span>
                                    <span className="text-xs font-black text-primary">{totalRows.toLocaleString()} Target</span>
                                </div>
                            </div>

                            {!isImporting && (
                                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            <span className="text-sm font-bold text-green-800">Database Synchronized</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 font-black uppercase text-[9px] tracking-widest text-green-700" asChild>
                                            <a href="/products/list">View Catalog</a>
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button variant="outline" onClick={() => setCurrentStep('upload')} className="h-12 font-black uppercase tracking-widest rounded-xl border-primary/10">
                                            <PlusCircle className="mr-2 h-4 w-4" /> Another File
                                        </Button>
                                        <Button variant="ghost" onClick={() => { setFile(null); setCurrentStep('upload'); }} className="h-12 font-black uppercase tracking-widest rounded-xl">
                                            Finish
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {isImporting && (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black uppercase text-yellow-800 tracking-tight">Industrial Protocol</p>
                                        <p className="text-[10px] text-yellow-700/80 font-medium">Auto-expanding grid and verifying 80k+ records. Keep this window active to finalize sync.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
