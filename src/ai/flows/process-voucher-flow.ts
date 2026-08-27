'use server';
/**
 * @fileOverview Return voucher data extraction AI flow.
 *
 * - processVoucher - Handles extraction of return details from images.
 * - ProcessVoucherInput - Base64 image data URI.
 * - ProcessVoucherOutput - Array of identified return items.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProcessVoucherInputSchema = z.object({
  photoDataUri: z.string().describe("Base64 encoded image of the return voucher/invoice."),
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
  prompt: `You are an industrial data entry specialist. Analyze this return voucher/invoice image carefully.

Extract all items listed for return. Focus on SKU/Barcode and the Quantity. If a barcode is not explicitly listed, try to identify the product name clearly.

Input Image: {{media url=photoDataUri}}`,
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
