'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AlertTriangle,
  Barcode,
  Camera,
  CheckCircle2,
  FileText,
  FileType,
  Hash,
  Layers,
  Loader2,
  Search,
  Undo2,
  Upload,
  X,
  Zap,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { ScrollArea } from '@/components/ui/scroll-area';

import { processVoucher } from '@/ai/flows/process-voucher-flow';
import { bulkReturnInventoryItemsAction } from '@/app/actions';

import { useToast } from '@/hooks/use-toast';
import { useDataCache } from '@/context/data-cache-context';
import { useAuth } from '@/context/auth-context';

import { cn } from '@/lib/utils';


/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type MatchStatus =
  | 'matched'
  | 'partial'
  | 'unmatched';

interface Allocation {
  itemId: string;
  qty: number;
  location: string;
}

interface StagedReturn {
  barcode: string;
  productName: string;
  quantity: number;
  confidence: number;

  allocation: Allocation[];

  status: MatchStatus;

  totalAvailable: number;
}

type PreviewType =
  | 'image'
  | 'pdf'
  | null;


/* -------------------------------------------------------------------------- */
/*                              BARCODE CLEANING                              */
/* -------------------------------------------------------------------------- */

/**
 * Performs only safe formatting cleanup.
 *
 * IMPORTANT:
 * Leading zeros are deliberately preserved.
 */
function cleanBarcode(value: string): string {
  return value
    .trim()
    .replace(/^['’]+/, '')
    .trim();
}


/* -------------------------------------------------------------------------- */
/*                             IMAGE OPTIMIZATION                             */
/* -------------------------------------------------------------------------- */

async function optimizeImage(
  dataUri: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      /*
       * Keep enough resolution for small printed
       * barcode/SKU digits.
       */
      const MAX_DIMENSION = 2600;

      let width = image.width;
      let height = image.height;

      if (width <= 0 || height <= 0) {
        reject(
          new Error('Invalid image dimensions.')
        );
        return;
      }

      if (width > height) {
        if (width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        }
      } else if (height > MAX_DIMENSION) {
        width *= MAX_DIMENSION / height;
        height = MAX_DIMENSION;
      }

      const canvas =
        document.createElement('canvas');

      canvas.width = Math.round(width);
      canvas.height = Math.round(height);

      const context =
        canvas.getContext('2d');

      if (!context) {
        reject(
          new Error(
            'Unable to initialize image processor.'
          )
        );
        return;
      }

      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      resolve(
        canvas.toDataURL(
          'image/jpeg',
          0.9
        )
      );
    };

    image.onerror = () => {
      reject(
        new Error(
          'Unable to read the selected image.'
        )
      );
    };

    image.src = dataUri;
  });
}


/* -------------------------------------------------------------------------- */
/*                                FILE READER                                 */
/* -------------------------------------------------------------------------- */

function readFileAsDataUri(
  file: File
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result === 'string'
        ) {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            'Unable to read the selected file.'
          )
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            'Unable to read the selected file.'
          )
        );
      };

      reader.readAsDataURL(file);
    }
  );
}


/* -------------------------------------------------------------------------- */
/*                                COMPONENT                                   */
/* -------------------------------------------------------------------------- */

export function VoucherReturnTerminal() {
  const { toast } = useToast();

  const { user } = useAuth();

  const {
    inventoryItems,
    refreshData,
  } = useDataCache();


  /* ---------------------------------------------------------------------- */
  /*                                  STATE                                 */
  /* ---------------------------------------------------------------------- */

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [
    isExecuting,
    setIsExecuting,
  ] = useState(false);

  const [
    stagedItems,
    setStagedItems,
  ] = useState<StagedReturn[]>([]);

  const [
    previewData,
    setPreviewData,
  ] = useState<string | null>(null);

  const [
    previewType,
    setPreviewType,
  ] = useState<PreviewType>(null);

  const [
    fileName,
    setFileName,
  ] = useState<string | null>(null);

  const [
    isCameraOpen,
    setIsCameraOpen,
  ] = useState(false);

  const [
    isCameraStarting,
    setIsCameraStarting,
  ] = useState(false);


  /* ---------------------------------------------------------------------- */
  /*                                   REFS                                 */
  /* ---------------------------------------------------------------------- */

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);


  /* ---------------------------------------------------------------------- */
  /*                            CAMERA CLEANUP                              */
  /* ---------------------------------------------------------------------- */

  const stopCamera =
    useCallback(() => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject =
          null;
      }

      setIsCameraOpen(false);
      setIsCameraStarting(false);
    }, []);


  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);


  /* ---------------------------------------------------------------------- */
  /*                      SHARED STOCK ALLOCATION                           */
  /* ---------------------------------------------------------------------- */

  const createStagedItems = (
    aiItems: Array<{
      barcode: string;
      productName: string;
      quantity: number;
      confidence: number;
    }>
  ): StagedReturn[] => {

    /*
     * IMPORTANT:
     *
     * This map keeps track of stock already allocated
     * to previous voucher rows.
     */
    const remainingByInventoryId =
      new Map<string, number>();

    for (const item of inventoryItems) {
      remainingByInventoryId.set(
        item.id,
        Math.max(
          0,
          Number(item.quantity) || 0
        )
      );
    }


    return aiItems.map((aiItem) => {
      const barcode =
        cleanBarcode(aiItem.barcode);

      const requestedQty =
        Math.max(
          0,
          Number(aiItem.quantity) || 0
        );


      /* ------------------------------------------------------------------ */
      /*                          EXACT MATCH ONLY                          */
      /* ------------------------------------------------------------------ */

      const relevantLogs =
        inventoryItems.filter(
          (inventoryItem) => {
            const available =
              remainingByInventoryId.get(
                inventoryItem.id
              ) ?? 0;

            if (available <= 0) {
              return false;
            }

            const inventoryBarcode =
              cleanBarcode(
                inventoryItem.barcode
              );

            return (
              inventoryBarcode === barcode
            );
          }
        );


      const totalAvailable =
        relevantLogs.reduce(
          (sum, inventoryItem) => {
            return (
              sum +
              (
                remainingByInventoryId.get(
                  inventoryItem.id
                ) ?? 0
              )
            );
          },
          0
        );


      let remaining =
        requestedQty;

      const allocation:
        Allocation[] = [];


      /* ------------------------------------------------------------------ */
      /*                         ALLOCATE STOCK                             */
      /* ------------------------------------------------------------------ */

      for (
        const inventoryItem
        of relevantLogs
      ) {
        if (remaining <= 0) {
          break;
        }

        const available =
          remainingByInventoryId.get(
            inventoryItem.id
          ) ?? 0;

        if (available <= 0) {
          continue;
        }

        const take =
          Math.min(
            available,
            remaining
          );

        allocation.push({
          itemId:
            inventoryItem.id,

          qty:
            take,

          location:
            inventoryItem.location,
        });

        /*
         * Deduct immediately so another
         * voucher row cannot reuse it.
         */
        remainingByInventoryId.set(
          inventoryItem.id,
          available - take
        );

        remaining -= take;
      }


      /* ------------------------------------------------------------------ */
      /*                              STATUS                               */
      /* ------------------------------------------------------------------ */

      let status:
        MatchStatus;

      if (
        requestedQty > 0 &&
        remaining <= 0
      ) {
        status = 'matched';
      } else if (
        totalAvailable > 0
      ) {
        status = 'partial';
      } else {
        status = 'unmatched';
      }


      return {
        barcode,

        productName:
          aiItem.productName.trim(),

        quantity:
          requestedQty,

        confidence:
          Math.max(
            0,
            Math.min(
              1,
              aiItem.confidence ?? 0
            )
          ),

        allocation,

        status,

        totalAvailable,
      };
    });
  };


  /* ---------------------------------------------------------------------- */
  /*                             AI PROCESSING                              */
  /* ---------------------------------------------------------------------- */

  const processWithAI =
    async (
      dataUri: string
    ) => {
      setIsProcessing(true);
      setStagedItems([]);

      try {
        const result =
          await processVoucher({
            photoDataUri:
              dataUri,
          });


        if (!result.success) {
          throw new Error(
            result.error ||
              'Voucher analysis failed.'
          );
        }


        const items =
          result.items ?? [];


        if (items.length === 0) {
          toast({
            variant:
              'destructive',

            title:
              'No Products Found',

            description:
              result.warning ||
              'No reliable voucher rows could be extracted.',
          });

          return;
        }


        const processed =
          createStagedItems(
            items
          );


        setStagedItems(
          processed
        );


        const matched =
          processed.filter(
            (item) =>
              item.status ===
              'matched'
          ).length;

        const reviewNeeded =
          processed.length -
          matched;


        toast({
          title:
            'Analysis Complete',

          description:
            reviewNeeded > 0
              ? `${processed.length} items detected. ${reviewNeeded} require review.`
              : `${processed.length} items detected and fully matched.`
        });


        if (result.warning) {
          toast({
            title:
              'Document Warning',

            description:
              result.warning,
          });
        }

      } catch (
        error: unknown
      ) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to process voucher.';

        toast({
          variant:
            'destructive',

          title:
            'AI Processing Error',

          description:
            message,
        });

      } finally {
        setIsProcessing(false);
      }
    };


  /* ---------------------------------------------------------------------- */
  /*                              FILE UPLOAD                               */
  /* ---------------------------------------------------------------------- */

  const handleFileUpload =
    async (
      event:
        React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target.files?.[0];

      /*
       * Allow selecting the same file
       * again later.
       */
      event.target.value = '';

      if (!file) {
        return;
      }


      const isImage =
        file.type.startsWith(
          'image/'
        );

      const isPdf =
        file.type ===
        'application/pdf';


      if (!isImage && !isPdf) {
        toast({
          variant:
            'destructive',

          title:
            'Unsupported File',

          description:
            'Please select an image or PDF voucher.',
        });

        return;
      }


      try {
        setFileName(
          file.name
        );

        const dataUri =
          await readFileAsDataUri(
            file
          );


        if (isPdf) {
          setPreviewData(
            dataUri
          );

          setPreviewType(
            'pdf'
          );

          await processWithAI(
            dataUri
          );

          return;
        }


        setPreviewData(
          dataUri
        );

        setPreviewType(
          'image'
        );


        const optimizedUri =
          await optimizeImage(
            dataUri
          );


        await processWithAI(
          optimizedUri
        );

      } catch (
        error: unknown
      ) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to process the selected file.';

        toast({
          variant:
            'destructive',

          title:
            'File Error',

          description:
            message,
        });
      }
    };


  /* ---------------------------------------------------------------------- */
  /*                               CAMERA                                   */
  /* ---------------------------------------------------------------------- */

  const startCamera =
    async () => {
      if (
        !navigator.mediaDevices
          ?.getUserMedia
      ) {
        toast({
          variant:
            'destructive',

          title:
            'Camera Unsupported',

          description:
            'This browser does not provide camera access.',
        });

        return;
      }


      setIsCameraStarting(
        true
      );

      setIsCameraOpen(
        true
      );


      try {
        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal:
                    'environment',
                },

                width: {
                  ideal:
                    1920,
                },

                height: {
                  ideal:
                    1080,
                },
              },

              audio: false,
            });


        streamRef.current =
          stream;


        requestAnimationFrame(
          () => {
            if (
              videoRef.current
            ) {
              videoRef.current.srcObject =
                stream;
            }
          }
        );

      } catch {
        stopCamera();

        toast({
          variant:
            'destructive',

          title:
            'Camera Error',

          description:
            'Camera access was denied or unavailable.',
        });

      } finally {
        setIsCameraStarting(
          false
        );
      }
    };


  const capturePhoto =
    async () => {
      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;


      if (
        !video ||
        !canvas
      ) {
        return;
      }


      if (
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        toast({
          variant:
            'destructive',

          title:
            'Camera Not Ready',

          description:
            'Wait for the camera preview before capturing.',
        });

        return;
      }


      const context =
        canvas.getContext(
          '2d'
        );


      if (!context) {
        return;
      }


      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;


      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );


      const dataUri =
        canvas.toDataURL(
          'image/jpeg',
          0.95
        );


      setPreviewData(
        dataUri
      );

      setPreviewType(
        'image'
      );

      setFileName(
        `capture_${Date.now()}.jpg`
      );


      stopCamera();


      try {
        const optimized =
          await optimizeImage(
            dataUri
          );

        await processWithAI(
          optimized
        );

      } catch (
        error: unknown
      ) {
        toast({
          variant:
            'destructive',

          title:
            'Capture Error',

          description:
            error instanceof Error
              ? error.message
              : 'Unable to process captured image.',
        });
      }
    };


  /* ---------------------------------------------------------------------- */
  /*                             REMOVE ROW                                 */
  /* ---------------------------------------------------------------------- */

  const removeStagedItem =
    (index: number) => {
      setStagedItems(
        (current) =>
          current.filter(
            (_, itemIndex) =>
              itemIndex !== index
          )
      );
    };


  /* ---------------------------------------------------------------------- */
  /*                           COMMIT VALIDATION                            */
  /* ---------------------------------------------------------------------- */

  const hasReviewItems =
    stagedItems.some(
      (item) =>
        item.status !==
        'matched'
    );

  const canCommit =
    stagedItems.length > 0 &&
    !hasReviewItems &&
    !isExecuting &&
    !isProcessing;


  /* ---------------------------------------------------------------------- */
  /*                             COMMIT RETURNS                             */
  /* ---------------------------------------------------------------------- */

  const commitReturns =
    async () => {
      if (!user?.email) {
        toast({
          variant:
            'destructive',

          title:
            'Authentication Required',

          description:
            'Unable to identify the current user.',
        });

        return;
      }


      if (
        stagedItems.length === 0
      ) {
        return;
      }


      if (hasReviewItems) {
        toast({
          variant:
            'destructive',

          title:
            'Review Required',

          description:
            'Resolve or remove unmatched and partial rows before committing.',
        });

        return;
      }


      setIsExecuting(true);


      const staffName =
        user.email
          .split('@')[0]
          .toUpperCase();


      const operations =
        stagedItems.flatMap(
          (item) =>
            item.allocation
        );


      let successCount = 0;
      let failureCount = 0;


      try {
        for (
          const node
          of operations
        ) {
          try {
            const result =
              await bulkReturnInventoryItemsAction(
                user.email,
                [node.itemId],
                staffName,
                'specific',
                node.qty
              );


            if (result.success) {
              successCount++;
            } else {
              failureCount++;
            }

          } catch {
            failureCount++;
          }
        }


        setStagedItems([]);
        setPreviewData(null);
        setPreviewType(null);
        setFileName(null);


        await Promise.resolve(
          refreshData()
        );


        if (failureCount > 0) {
          toast({
            variant:
              'destructive',

            title:
              'Partial Commit',

            description:
              `${successCount} operations succeeded and ${failureCount} failed. Inventory has been refreshed.`,
          });

          return;
        }


        toast({
          title:
            'Returns Committed',

          description:
            `${successCount} inventory operations completed successfully.`,
        });

      } finally {
        setIsExecuting(false);
      }
    };


  /* ---------------------------------------------------------------------- */
  /*                              STATUS UI                                 */
  /* ---------------------------------------------------------------------- */

  const getStatusStyle =
    (
      status:
        MatchStatus
    ) => {
      switch (status) {
        case 'matched':
          return {
            icon:
              CheckCircle2,

            wrapper:
              'bg-green-500/10 text-green-600 border-green-500/20',

            label:
              'Matched',
          };

        case 'partial':
          return {
            icon:
              AlertTriangle,

            wrapper:
              'bg-amber-500/10 text-amber-600 border-amber-500/20',

            label:
              'Partial',
          };

        default:
          return {
            icon:
              X,

            wrapper:
              'bg-destructive/10 text-destructive border-destructive/20',

            label:
              'Not Found',
          };
      }
    };


  /* ---------------------------------------------------------------------- */
  /*                                  UI                                    */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">

        <div className="flex items-center gap-4">

          <div className="bg-primary p-4 rounded-3xl">
            <Zap className="h-8 w-8 text-white fill-current" />
          </div>

          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">
              AI Voucher Terminal
            </h3>

            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
              High-Velocity Recognition
            </p>
          </div>

        </div>


        <div className="flex flex-wrap justify-center gap-2">

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
            disabled={
              isProcessing ||
              isExecuting
            }
            className="h-14 px-6 rounded-2xl"
          >
            <Camera className="mr-2 h-5 w-5" />
            Live Scan
          </Button>


          <Button
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={
              isProcessing ||
              isExecuting
            }
            className="h-14 px-8 rounded-2xl font-black uppercase"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Upload className="mr-2 h-5 w-5" />
            )}

            {isProcessing
              ? 'Analyzing'
              : 'Import Voucher'}
          </Button>

        </div>
      </div>


      {/* MAIN GRID */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* PREVIEW */}

        <div className="lg:col-span-4">

          <Card className="bg-card/60 backdrop-blur-3xl rounded-3xl overflow-hidden h-full min-h-[460px]">

            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">

                <div>
                  <p className="font-black">
                    Voucher Preview
                  </p>

                  {fileName && (
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                      {fileName}
                    </p>
                  )}
                </div>


                {previewType && (
                  <Badge variant="outline">
                    {previewType ===
                    'pdf'
                      ? 'PDF'
                      : 'IMAGE'}
                  </Badge>
                )}

              </div>
            </CardHeader>


            <CardContent className="p-6 h-[400px]">

              <div className="relative rounded-2xl bg-muted/10 border-2 border-dashed h-full flex items-center justify-center overflow-hidden">

                {previewType ===
                  'image' &&
                previewData ? (

                  <img
                    src={previewData}
                    className="object-contain w-full h-full"
                    alt="Voucher preview"
                  />

                ) : previewType ===
                    'pdf' &&
                  previewData ? (

                  <div className="text-center">

                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-10 w-10 text-primary" />
                    </div>

                    <p className="font-black">
                      PDF Voucher
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Ready for analysis
                    </p>

                  </div>

                ) : (

                  <div className="opacity-30 text-center">

                    <FileType className="h-16 w-16 mx-auto mb-3" />

                    <p className="text-xs font-black uppercase tracking-wider">
                      Awaiting Voucher
                    </p>

                  </div>

                )}


                {isProcessing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">

                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />

                    <p className="text-sm font-black uppercase tracking-wider">
                      Analyzing Voucher
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Extracting barcode and quantity
                    </p>

                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        </div>


        {/* RESULTS */}

        <div className="lg:col-span-8">

          <Card className="bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">

            <CardHeader className="bg-muted/10 p-8 border-b">

              <div className="flex items-center justify-between gap-4">

                <div className="flex items-center gap-3">

                  <Layers
                    className="h-5 w-5 text-primary"
                    strokeWidth={3}
                  />

                  <h4 className="text-xl font-black uppercase tracking-tighter">
                    Return Mapping
                  </h4>

                </div>


                {stagedItems.length >
                  0 && (

                  <Badge
                    variant={
                      hasReviewItems
                        ? 'destructive'
                        : 'default'
                    }
                  >
                    {hasReviewItems
                      ? 'REVIEW REQUIRED'
                      : 'READY'}
                  </Badge>
                )}

              </div>
            </CardHeader>


            <CardContent className="p-0">

              <ScrollArea className="h-[450px]">

                {stagedItems.length >
                0 ? (

                  <div className="divide-y">

                    {stagedItems.map(
                      (
                        item,
                        index
                      ) => {

                        const status =
                          getStatusStyle(
                            item.status
                          );

                        const StatusIcon =
                          status.icon;


                        return (
                          <div
                            key={`${item.barcode}-${index}`}
                            className="p-6 sm:p-8 hover:bg-primary/[0.03] transition-colors"
                          >

                            <div className="flex items-start justify-between gap-4">

                              <div className="flex items-start gap-5 min-w-0">

                                <div
                                  className={cn(
                                    'p-3 rounded-xl border shrink-0',
                                    status.wrapper
                                  )}
                                >
                                  <StatusIcon className="h-6 w-6" />
                                </div>


                                <div className="min-w-0">

                                  <div className="flex flex-wrap items-center gap-2 mb-2">

                                    <p className="text-lg font-black break-words">
                                      {item.productName}
                                    </p>

                                    <Badge variant="outline">
                                      {status.label}
                                    </Badge>

                                  </div>


                                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">

                                    <div className="flex items-center gap-1.5">

                                      <Barcode className="h-3.5 w-3.5" />

                                      <span className="font-mono font-semibold">
                                        {item.barcode}
                                      </span>

                                    </div>


                                    <div className="flex items-center gap-1.5">

                                      <Hash className="h-3.5 w-3.5" />

                                      <span>
                                        Requested:
                                        {' '}
                                        <strong>
                                          {item.quantity}
                                        </strong>
                                      </span>

                                    </div>


                                    <div>
                                      Available:
                                      {' '}
                                      <strong>
                                        {item.totalAvailable}
                                      </strong>
                                    </div>

                                  </div>


                                  {item.status ===
                                    'partial' && (

                                    <p className="text-xs text-amber-600 font-semibold mt-3">

                                      Only {
                                        item.totalAvailable
                                      } of {
                                        item.quantity
                                      } requested units are currently available.

                                    </p>
                                  )}


                                  {item.status ===
                                    'unmatched' && (

                                    <p className="text-xs text-destructive font-semibold mt-3">

                                      Barcode was not found in active stock.

                                    </p>
                                  )}

                                </div>
                              </div>


                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={
                                  isExecuting
                                }
                                onClick={() =>
                                  removeStagedItem(
                                    index
                                  )
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>

                            </div>
                          </div>
                        );
                      }
                    )}

                  </div>

                ) : (

                  <div className="py-32 text-center opacity-30">

                    <Search className="h-16 w-16 mx-auto mb-4" />

                    <p className="text-sm font-black uppercase tracking-widest">
                      Awaiting Analysis
                    </p>

                  </div>

                )}

              </ScrollArea>
            </CardContent>


            {stagedItems.length >
              0 && (

              <div className="p-6 sm:p-8 border-t bg-muted/10 space-y-3">

                {hasReviewItems && (
                  <div className="flex gap-3 items-start p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">

                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />

                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Remove partial or unmatched rows before committing.
                    </p>

                  </div>
                )}


                <Button
                  onClick={
                    commitReturns
                  }
                  disabled={
                    !canCommit
                  }
                  className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em]"
                >

                  {isExecuting ? (
                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  ) : (
                    <Undo2 className="mr-3 h-6 w-6" />
                  )}

                  {isExecuting
                    ? 'Processing'
                    : 'Commit Returns'}

                </Button>

              </div>
            )}

          </Card>
        </div>

      </div>


      {/* CAMERA */}

      <Dialog
        open={isCameraOpen}
        onOpenChange={(open) => {
          if (!open) {
            stopCamera();
          }
        }}
      >

        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none bg-black">

          <DialogHeader className="sr-only">
             <DialogTitle>Document Capture</DialogTitle>
             <DialogDescription>Use camera to capture return voucher.</DialogDescription>
          </DialogHeader>

          <div className="relative aspect-[3/4] sm:aspect-video bg-zinc-950 flex items-center justify-center">

            {isCameraStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">

                <Loader2 className="h-10 w-10 text-primary animate-spin" />

              </div>
            )}


            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />


            <div className="absolute inset-x-8 top-1/2 border-t border-dashed border-white/40 pointer-events-none" />

          </div>


          <canvas
            ref={canvasRef}
            className="hidden"
          />


          <DialogFooter className="p-8 bg-zinc-900 border-t flex flex-row items-center justify-between">

            <Button
              variant="ghost"
              onClick={stopCamera}
              className="text-white/60 font-black uppercase text-xs"
            >
              Cancel
            </Button>


            <Button
              onClick={
                capturePhoto
              }
              disabled={
                isCameraStarting
              }
              aria-label="Capture voucher"
              className="h-24 w-24 rounded-full bg-white border-[8px] border-primary p-0 flex items-center justify-center active:scale-95"
            >

              <Camera className="h-8 w-8 text-zinc-900" />

            </Button>


            <div className="w-16" />

          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
}
