'use server';
/**
 * @fileOverview Industrial Return Voucher AI Processor.
 * Relies exclusively on Gemini Multimodal Vision for high-fidelity extraction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProcessVoucherInputSchema = z.object({
  photoDataUri: z.string().describe("Base64 document data URI (Image or PDF)."),
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
  prompt: `You are an industrial data entry specialist. Analyze this return voucher document.

EXTRACTION PROTOCOL:
1. **Visual Scan**: Identify the table structure or list layout in the provided image.
2. **SKU Identification**: Extract the Barcode/SKU and the corresponding Return Quantity for each item.
3. **Spatial Alignment**: Ensure that the quantity you extract belongs to the correct barcode by looking at row alignment.

Input Image: {{media url=photoDataUri}}

GOAL: Extract all SKU/Barcode entries and their corresponding Return Quantities.
- If a quantity is written as a case (e.g. "1 case of 12"), calculate the total units (12).
- Return only valid JSON matching the schema.
- If the image is blurry or unreadable, set success to false and provide an error message.`,
});

/**
 * Industrial AI Processor with Native Multimodal Extraction
 */
export async function processVoucher(input: ProcessVoucherInput): Promise<ProcessVoucherOutput> {
  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
        console.log(`AI Terminal: Visual Analysis Attempt ${attempt}/${MAX_RETRIES}...`);
        
        // Native Gemini Multimodal Call
        const { output } = await prompt(input);
        
        if (!output) throw new Error("AI Node returned zero payload.");

        // ENSURE STRICT SERIALIZATION (POJO)
        return JSON.parse(JSON.stringify({
            ...output,
            success: true
        }));

    } catch (error: any) {
        lastError = error.message;
        console.warn(`AI Terminal: Attempt ${attempt} failed: ${lastError}`);
        
        if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, delay));
        }
    }
  }

  return {
    success: false,
    error: `Registry AI Node Failure: ${lastError}`,
    items: []
  };
}
