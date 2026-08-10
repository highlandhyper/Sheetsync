'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useDataCache } from '@/context/data-cache-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
    Eye
} from 'lucide-react';
import Papa from 'papaparse';
import { clearDatabaseAction, batchImportProductsAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BATCH_SIZE = 500;
const SKIP_VALUE = "___SKIP_FIELD___";

interface Mapping {
    barcode: string;
    productName: string;
    supplierName: string;
    costPrice: string;
}

/**
 * Strips invalid XML 1.0 control characters that cause DOMParser to fail.
 * This handles errors like "xmlParseCharRef: invalid xmlChar value 30"
 */
function sanitizeXmlString(xml: string): string {
    return xml.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]/g, "");
}

export function BulkImportTerminal() {
    const { user } = useAuth();
    const { refreshData } = useDataCache();
    const { toast } = useToast();

    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'csv' | 'xml' | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewRows, setPreviewRows] = useState<any[]>([]); 
    const [xmlRecordTag, setXmlRecordTag] = useState<string>('');
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
                    // FIX: Sanitize XML to remove invalid control characters before parsing
                    text = sanitizeXmlString(text);
                    
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");
                    
                    const parseError = xmlDoc.getElementsByTagName("parsererror");
                    if (parseError.length > 0) {
                        throw new Error(parseError[0].textContent || "XML Structure Error");
                    }

                    const root = xmlDoc.documentElement;
                    let firstRecord: Element | null = null;
                    
                    const findFirstRecord = (node: Element): Element | null => {
                        if (node.children.length > 0 && Array.from(node.children).every(c => c.children.length === 0)) {
                            return node;
                        }
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
                            Array.from(record.children).forEach(child => {
                                obj[child.tagName] = child.textContent;
                            });
                            return obj;
                        });
                        setPreviewRows(samples);

                        const newMapping = { barcode: '', productName: '', supplierName: '', costPrice: SKIP_VALUE };
                        tagNames.forEach(h => {
                            const lower = h.toLowerCase();
                            if (lower.includes('barcode') || lower.includes('upc') || lower.includes('sku') || lower === 'id') newMapping.barcode = h;
                            if (lower.includes('name') || lower.includes('title') || lower.includes('desc')) newMapping.productName = h;
                            if (lower.includes('supp') || lower.includes('vendor') || lower.includes('brand')) newMapping.supplierName = h;
                            if (lower.includes('cost') || lower.includes('price') || lower.includes('rate')) newMapping.costPrice = h;
                        });
                        setMapping(newMapping);

                        setCurrentStep('map');
                    } else {
                        toast({ variant: "destructive", title: "Invalid XML", description: "Could not identify data records in file." });
                        setFile(null);
                    }
                } catch (err: any) {
                    console.error("XML Parse Error:", err);
                    toast({ variant: "destructive", title: "Parse Error", description: err.message || "Failed to read XML structure." });
                } finally {
                    setIsParsing(false);
                }
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
                        const lower = h.toLowerCase();
                        if (lower.includes('barcode') || lower.includes('upc') || lower.includes('sku') || lower === 'id') newMapping.barcode = h;
                        if (lower.includes('name') || lower.includes('title') || lower.includes('desc')) newMapping.productName = h;
                        if (lower.includes('supp') || lower.includes('vendor') || lower.includes('brand')) newMapping.supplierName = h;
                        if (lower.includes('cost') || lower.includes('price') || lower.includes('rate')) newMapping.costPrice = h;
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

        toast({ title: "Wiping Registry", description: "Clearing existing products for fresh sync..." });
        const wipeRes = await clearDatabaseAction(user.email);
        if (!wipeRes.success) {
            toast({ variant: "destructive", title: "Sync Failed", description: "Could not clear existing database." });
            setIsImporting(false);
            return;
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
                        Array.from(record.children).forEach(child => {
                            obj[child.tagName] = child.textContent;
                        });
                        return obj;
                    });
                    
                    await runBatchImport(data);
                } catch (err: any) {
                    toast({ variant: "destructive", title: "Sync Error", description: "Internal processing failure." });
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
        let processed = 0;

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const formattedBatch = batch.map(row => {
                const barcode = String(row[mapping.barcode] || '').trim();
                const name = String(row[mapping.productName] || '').trim();
                const supplier = String(row[mapping.supplierName] || '').trim();
                
                let cost = 0;
                if (mapping.costPrice !== SKIP_VALUE && row[mapping.costPrice] !== undefined) {
                    const parsed = parseFloat(String(row[mapping.costPrice]).replace(/[^0-9.-]+/g, ""));
                    cost = isNaN(parsed) ? 0 : parsed;
                }
                
                const uniqueId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                
                return [barcode, '', name, supplier, cost, '', '', uniqueId];
            });

            const res = await batchImportProductsAction(user?.email!, formattedBatch);
            
            if (res.success) {
                processed += batch.length;
                setProgress(Math.round((processed / data.length) * 100));
                setStats(prev => ({ ...prev, success: processed }));
            } else {
                setStats(prev => ({ ...prev, failed: prev.failed + batch.length }));
            }
        }

        setIsImporting(false);
        toast({ title: "Import Complete", description: `Processed ${data.length} records.` });
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
                                <p className="text-xs text-muted-foreground max-w-xs font-medium">Upload your local database (CSV or XML) to begin the industrial synchronization process.</p>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".csv,.xml" 
                                onChange={handleFileChange} 
                            />
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-12 px-8 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                                >
                                    {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                    Select File
                                </Button>
                            </div>
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
                                    <span className="text-[9px] font-bold text-primary/60 uppercase italic">Check values to find your fields</span>
                                </div>
                                <ScrollArea className="h-[150px] w-full">
                                    <Table>
                                        <TableHeader className="bg-muted/20 sticky top-0 z-10">
                                            <TableRow>
                                                {headers.map((h, i) => (
                                                    <TableHead key={`preview-head-${h}-${i}`} className="text-[9px] uppercase font-black px-4 whitespace-nowrap">{h}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewRows.map((row, i) => (
                                                <TableRow key={`preview-row-${i}`}>
                                                    {headers.map((h, j) => (
                                                        <TableCell key={`preview-cell-${i}-${j}`} className="text-[10px] font-medium py-2 px-4 whitespace-nowrap border-r last:border-r-0">
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
                                            {headers.map((h, i) => <SelectItem key={`${h}-${i}-barcode`} value={h}>{h}</SelectItem>)}
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
                                            {headers.map((h, i) => <SelectItem key={`${h}-${i}-supplier`} value={h}>{h}</SelectItem>)}
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

                            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                <Button variant="ghost" onClick={() => setCurrentStep('upload')} className="font-bold h-12 px-6 rounded-xl">Change File</Button>
                                <Button 
                                    disabled={!isMappingComplete}
                                    onClick={startImport}
                                    className="flex-1 h-12 font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90"
                                >
                                    <Zap className="mr-2 h-4 w-4 fill-primary-foreground" />
                                    Begin Batch Import
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
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Batch Engine Activity</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                                    <span>Progress</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-3 rounded-full" />
                                <div className="flex justify-between items-baseline pt-1">
                                    <span className="text-xs font-bold text-muted-foreground">{stats.success.toLocaleString()} Rows Transferred</span>
                                    <span className="text-xs font-black text-primary">{totalRows.toLocaleString()} Total Target</span>
                                </div>
                            </div>

                            {!isImporting && (
                                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            <span className="text-sm font-bold text-green-800">Database Overwrite Successful</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 font-black uppercase text-[9px] tracking-widest text-green-700 hover:bg-green-500/10" asChild>
                                            <a href="/products/list">View Catalog</a>
                                        </Button>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setCurrentStep('upload')} 
                                        className="h-12 font-black uppercase tracking-widest rounded-xl border-primary/10"
                                    >
                                        Close Terminal
                                    </Button>
                                </div>
                            )}

                            {isImporting && (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black uppercase text-yellow-800 tracking-tight">Active Protocol</p>
                                        <p className="text-[10px] text-yellow-700/80 font-medium leading-relaxed">DO NOT close this window or navigate away. The batch engine requires a live connection to finalize the multi-row write operations.</p>
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
