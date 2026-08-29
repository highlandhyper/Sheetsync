'use server';
/**
 * @fileOverview Return voucher data extraction AI flow.
 *
 * - processVoucher - Handles extraction of return details from images and PDF documents.
 * - ProcessVoucherInput - Base64 document data URI (Image or PDF).
 * - ProcessVoucherOutput - Array of identified return items.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProcessVoucherInputSchema = z.object({
  photoDataUri: z.string().describe("Base64 encoded document (Image or PDF) of the return voucher/invoice. Format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type ProcessVoucherInput = z.infer<typeof ProcessVoucherInputSchema>;

const ProcessVoucherOutputSchema = z.object({
  success: z.boolean().default(true),
  error: z.string().optional(),
  items: z.array(z.object({
    barcode: z.string().describe("The barcode or SKU identifier. Extract exactly as printed."),
    quantity: z.number().describe("The quantity to be returned. Extract as a raw integer."),
    productName: z.string().describe("The identified product name or description from the document."),
    confidence: z.number().describe("Confidence level of extraction 0-1."),
  })).optional().describe("List of items identified for return processing.")
});
export type ProcessVoucherOutput = z.infer<typeof ProcessVoucherOutputSchema>;

/**
 * Industrial AI Processor
 * Analyzes returns vouchers via multimodal Gemini 1.5 Flash.
 * Optimized for high-speed industrial data entry.
 */
export async function processVoucher(input: ProcessVoucherInput): Promise<ProcessVoucherOutput> {
  try {
    const result = await processVoucherFlow(input);
    return result;
  } catch (error: any) {
    console.error("Critical Flow Exception:", error);
    return {
        success: false,
        error: error.message || "An unexpected error occurred during AI analysis."
    };
  }
}

const prompt = ai.definePrompt({
  name: 'processVoucherPrompt',
  input: { schema: ProcessVoucherInputSchema },
  output: { schema: ProcessVoucherOutputSchema },
  prompt: `You are an industrial data entry specialist. Analyze this return voucher or invoice document carefully. 
The document is provided as a multimodal input (Image or PDF).

Extract all items listed for return. Focus exclusively on identifying the SKU/Barcode and the corresponding Quantity.

Industrial Protocol:
- Barcodes/SKUs: Search for columns labeled "Barcode", "SKU", "Item Code", or "EAN".
- Quantities: Extract the numerical quantity designated for return. Look for "Qty", "Return Qty", or "Amount".
- Unregistered Items: If a barcode is missing but a product name is clear, extract the name and leave barcode empty.
- Multi-page Processing: If this is a multi-page PDF, process all visible pages and consolidate the results into a single array.

Data Integrity: Only extract numerical quantities. If "2 cases" is written, and you know a case is 12, multiply it if possible, otherwise just return 2.

Input Document: {{media url=photoDataUri}}`,
});

const processVoucherFlow = ai.defineFlow(
  {
    name: 'processVoucherFlow',
    inputSchema: ProcessVoucherInputSchema,
    outputSchema: ProcessVoucherOutputSchema,
  },
  async input => {
    try {
        console.log("AI Terminal: Initializing multimodal extraction...");
        const { output } = await prompt(input);
        
        if (!output) {
            return { success: false, error: "AI extraction node returned zero payload. Check document visibility." };
        }
        
        console.log(`AI Terminal: Successfully extracted ${output.items?.length || 0} items.`);
        return {
            ...output,
            success: true
        };
    } catch (error: any) {
        console.error("Genkit Flow Error:", error);
        return {
            success: false,
            error: `Registry AI Node Failure: ${error.message}`
        };
    }
  }
);
