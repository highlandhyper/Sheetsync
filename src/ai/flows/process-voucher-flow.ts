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
  items: z.array(z.object({
    barcode: z.string().describe("The barcode or SKU identifier."),
    quantity: z.number().describe("The quantity to be returned."),
    productName: z.string().describe("The identified product name."),
    confidence: z.number().describe("Confidence level of extraction 0-1."),
  })).describe("List of items identified for return.")
});
export type ProcessVoucherOutput = z.infer<typeof ProcessVoucherOutputSchema>;

export async function processVoucher(input: ProcessVoucherInput): Promise<ProcessVoucherOutput> {
  return processVoucherFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processVoucherPrompt',
  input: { schema: ProcessVoucherInputSchema },
  output: { schema: ProcessVoucherOutputSchema },
  prompt: `You are an industrial data entry specialist. Analyze this return voucher/invoice document (Image or PDF) carefully.

Extract all items listed for return. Focus on SKU/Barcode and the Quantity. 
- If a barcode is not explicitly listed, try to identify the product name clearly.
- For PDF documents, analyze all pages if present.
- Quantities should be extracted as numbers.

Input Document: {{media url=photoDataUri}}`,
});

const processVoucherFlow = ai.defineFlow(
  {
    name: 'processVoucherFlow',
    inputSchema: ProcessVoucherInputSchema,
    outputSchema: ProcessVoucherOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
