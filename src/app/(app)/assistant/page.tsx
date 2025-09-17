
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BrainCircuit, Loader2, Lightbulb, AlertTriangle, PackageSearch } from 'lucide-react';
import { getInventoryInsightsAction } from '@/app/actions';
import type { InventoryInsightsResponse } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

function InsightsSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 mt-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Anomaly Detections
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="h-5 w-5 bg-muted rounded-full animate-pulse mt-1" />
                        <div className="flex-1 space-y-2">
                             <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                             <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <div className="h-5 w-5 bg-muted rounded-full animate-pulse mt-1" />
                        <div className="flex-1 space-y-2">
                             <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                             <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Expiry Warnings
                    </CardTitle>
                </CardHeader>
                 <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="h-5 w-5 bg-muted rounded-full animate-pulse mt-1" />
                        <div className="flex-1 space-y-2">
                             <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                             <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AssistantPage() {
  const [insights, setInsights] = useState<InventoryInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsLoading(true);
    setHasAnalyzed(true);
    setInsights(null);
    const response = await getInventoryInsightsAction();
    setIsLoading(false);

    if (response.success && response.data) {
      setInsights(response.data);
      toast({
        title: "Analysis Complete",
        description: "The AI has finished analyzing your inventory.",
      });
    } else {
      toast({
        title: "Analysis Failed",
        description: response.message || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  const hasAnomalies = insights && insights.anomalyDetections.length > 0;
  const hasWarnings = insights && insights.expiryWarnings.length > 0;

  return (
    <div className="container mx-auto py-2">
      <div className="flex flex-col items-center text-center">
        <BrainCircuit className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold text-primary mb-2">AI Inventory Assistant</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Get smart insights about your inventory. The assistant will check for anomalies and items nearing their expiry date.
        </p>
        <Button onClick={handleAnalyze} disabled={isLoading} className="mt-8" size="lg">
          {isLoading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
          ) : (
            'Analyze My Inventory'
          )}
        </Button>
      </div>

      {isLoading && <InsightsSkeleton />}

      {!isLoading && hasAnalyzed && (
        <>
            {(!hasAnomalies && !hasWarnings) ? (
                 <Card className="mt-8 text-center p-8">
                    <PackageSearch className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold">All Clear!</h3>
                    <p className="text-muted-foreground mt-1">
                        The AI assistant analyzed your inventory and found no urgent anomalies or expiry warnings.
                    </p>
                </Card>
            ) : (
                 <div className="grid gap-6 md:grid-cols-2 mt-8 items-start">
                    {/* Anomaly Detections Card */}
                    <Card className={hasAnomalies ? 'border-destructive/50' : 'border-dashed'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className={`h-5 w-5 ${hasAnomalies ? 'text-destructive' : 'text-muted-foreground'}`} />
                                Anomaly Detections
                            </CardTitle>
                             <CardDescription>
                                Unusual patterns or spikes in your inventory data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {hasAnomalies ? (
                                <div className="space-y-4">
                                {insights.anomalyDetections.map((anomaly, index) => (
                                    <Alert key={index} variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{anomaly.productName}</AlertTitle>
                                        <AlertDescription>{anomaly.finding}</AlertDescription>
                                    </Alert>
                                ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No anomalies detected.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Expiry Warnings Card */}
                    <Card className={hasWarnings ? 'border-yellow-500/50' : 'border-dashed'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lightbulb className={`h-5 w-5 ${hasWarnings ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                                Expiry Warnings
                            </CardTitle>
                             <CardDescription>
                                Items that require attention before they expire.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {hasWarnings ? (
                                <div className="space-y-3">
                                {insights.expiryWarnings.map((warning, index) => (
                                    <div key={index} className="p-3 rounded-md bg-muted/50">
                                        <h4 className="font-semibold">{warning.productName}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-medium text-foreground">{warning.quantity} units</span> expiring in <span className="font-medium text-foreground">{warning.daysUntilExpiry} day(s)</span>.
                                        </p>
                                        <p className="text-sm mt-1">
                                            <span className="font-medium">Suggestion:</span> {warning.recommendation}
                                        </p>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No urgent expiry warnings.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
      )}
    </div>
  );
}
