'use server';
/**
 * @fileOverview High-Velocity Voucher AI Processor.
 * Utilizes Gemini 2.0 Flash for pure visual extraction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProcessVoucherInputSchema = z.object({
  photoDataUri: z.string().describe("Base64 document data URI."),
});
export type ProcessVoucherInput = z.infer<typeof ProcessVoucherInputSchema>;

const ProcessVoucherOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  items: z.array(z.object({
    barcode: z.string().describe("The barcode or SKU identifier."),
    quantity: z.number().describe("The numerical quantity to return."),
    productName: z.string().describe("Product name as listed on document."),
    confidence: z.number().describe("Confidence score (0-1)."),
  })).optional()
});
export type ProcessVoucherOutput = z.infer<typeof ProcessVoucherOutputSchema>;

const prompt = ai.definePrompt({
  name: 'processVoucherPrompt',
  input: { schema: ProcessVoucherInputSchema },
  output: { schema: ProcessVoucherOutputSchema },
  prompt: `You are an industrial data entry specialist. Analyze this return voucher document using your advanced visual reasoning.

EXTRACTION PROTOCOL:
1. **Spatial Scan**: Identify the table or list structure in the image.
2. **SKU Recognition**: Extract every Barcode/SKU and its associated Return Quantity. 
3. **Data Cleaning**: Remove leading single quotes or whitespace from barcodes. Ensure they are strings.
4. **Calculations**: If a quantity is specified as a pack (e.g., "1 box of 10"), calculate the total units (10).

Input Document: {{media url=photoDataUri}}

GOAL: Provide a JSON array of all SKU/Barcode entries and their specific Return Quantities.
- If the document is unreadable or irrelevant, set success to false.
- Ensure strict adherence to the output schema.`,
});

/**
 * Native Multimodal Processor - Gemini 2.0 Flash Edition
 */
export async function processVoucher(input: ProcessVoucherInput): Promise<ProcessVoucherOutput> {
  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
        console.log(`Registry Node: Initializing Visual Analysis (Attempt ${attempt})...`);
        
        const { output } = await prompt(input);
        
        if (!output) throw new Error("AI Node returned zero payload.");

        // STRIP NON-POJO METADATA FOR SERVER ACTIONS
        return JSON.parse(JSON.stringify({
            ...output,
            success: true
        }));

    } catch (error: any) {
        lastError = error.message;
        console.warn(`Registry Node: Error in attempt ${attempt}: ${lastError}`);
        
        if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }
    }
  }

  return {
    success: false,
    error: `Registry Hub Failure: ${lastError}`,
    items: []
  };
}
