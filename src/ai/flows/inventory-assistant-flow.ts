
'use server';
/**
 * @fileOverview An AI-powered inventory assistant.
 *
 * - generateInventoryInsights - A function that analyzes inventory data.
 * - InventoryInsightsRequest - The input type for the assistant.
 * - InventoryInsightsResponse - The return type for the assistant.
 */

import { ai } from '@/lib/genkit';
import { z } from 'zod';
import { format, parseISO, differenceInDays } from 'date-fns';

const InventoryInsightsRequestSchema = z.object({
  inventoryData: z
    .string()
    .describe(
      'A JSON string representing the current inventory. Each item should have productName, quantity, itemType, expiryDate, and timestamp.'
    ),
});
export type InventoryInsightsRequest = z.infer<
  typeof InventoryInsightsRequestSchema
>;

const InventoryInsightsResponseSchema = z.object({
  anomalyDetections: z.array(z.object({
    productName: z.string().describe("The name of the product with the anomaly."),
    finding: z.string().describe("The specific anomaly or issue detected (e.g., 'Unusual spike in damaged items')."),
  })).describe("A list of detected anomalies in the inventory, like sudden increases in damaged items."),
  expiryWarnings: z.array(z.object({
    productName: z.string().describe("The name of the expiring product."),
    quantity: z.number().describe("The total quantity of the expiring item."),
    daysUntilExpiry: z.number().describe("Number of days until the item expires."),
    recommendation: z.string().describe("A brief, actionable recommendation (e.g., 'Prioritize use' or 'Consider a promotion')."),
  })).describe("A list of items that are expiring soon, prioritized by urgency."),
});
export type InventoryInsightsResponse = z.infer<
  typeof InventoryInsightsResponseSchema
>;

export async function generateInventoryInsights(
  input: InventoryInsightsRequest
): Promise<InventoryInsightsResponse> {
  return inventoryAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'inventoryAssistantPrompt',
  input: { schema: InventoryInsightsRequestSchema },
  output: { schema: InventoryInsightsResponseSchema },
  config: {
    model: 'googleai/gemini-1.5-pro-latest',
  },
  prompt: `You are an expert inventory management analyst. Your task is to analyze the provided inventory data to identify anomalies and provide urgent expiry warnings. Today's date is ${format(new Date(), 'yyyy-MM-dd')}.

Analyze the inventory data provided below.

Focus ONLY on these two areas:
1.  **Anomaly Detection**: Look for unusual patterns, particularly spikes in items marked as 'Damage'. For example, if multiple units of the same product were marked as damaged recently.
2.  **Expiry Warnings**: Identify products that are expiring within the next 14 days. Prioritize items with large quantities or that are expiring the soonest.

Provide your findings in the structured format requested. Do not invent any other categories.

Inventory Data (JSON):
{{{inventoryData}}}`,
});

const inventoryAssistantFlow = ai.defineFlow(
  {
    name: 'inventoryAssistantFlow',
    inputSchema: InventoryInsightsRequestSchema,
    outputSchema: InventoryInsightsResponseSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
