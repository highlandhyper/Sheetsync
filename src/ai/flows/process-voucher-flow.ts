'use server';

/**
 * Voucher Document Processor
 *
 * Extracts barcode/SKU, product name, and return quantity
 * from voucher images or PDF documents using Genkit + Gemini.
 */

import { ai, z } from '@/ai/genkit';

/* -------------------------------------------------------------------------- */
/*                                   INPUT                                    */
/* -------------------------------------------------------------------------- */

const ProcessVoucherInputSchema = z.object({
  photoDataUri: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('data:'), {
      message: 'Document must be provided as a valid data URI.',
    })
    .describe(
      'Base64 data URI containing the voucher image or PDF document.'
    ),
});

export type ProcessVoucherInput = z.infer<
  typeof ProcessVoucherInputSchema
>;

/* -------------------------------------------------------------------------- */
/*                              EXTRACTION DATA                               */
/* -------------------------------------------------------------------------- */

const VoucherItemSchema = z.object({
  barcode: z
    .string()
    .min(1)
    .describe(
      'Barcode/SKU exactly as printed. Never modify digits.'
    ),

  quantity: z
    .number()
    .nonnegative()
    .describe(
      'Return quantity exactly as shown.'
    ),

  productName: z
    .string()
    .describe(
      'Product description printed in the document.'
    ),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Estimated visual confidence from 0 to 1.'
    ),
});

const VoucherExtractionSchema = z.object({
  documentReadable: z
    .boolean()
    .describe(
      'True when the voucher is sufficiently readable.'
    ),

  items: z
    .array(VoucherItemSchema)
    .describe(
      'All reliably identified voucher rows.'
    ),

  warning: z
    .string()
    .optional()
    .describe(
      'Reason if some rows are unclear or missing.'
    ),
});

/* -------------------------------------------------------------------------- */
/*                                API OUTPUT                                  */
/* -------------------------------------------------------------------------- */

const ProcessVoucherOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  warning: z.string().optional(),
  items: z.array(VoucherItemSchema),
});

export type ProcessVoucherOutput = z.infer<
  typeof ProcessVoucherOutputSchema
>;

/* -------------------------------------------------------------------------- */
/*                                  PROMPT                                    */
/* -------------------------------------------------------------------------- */

const processVoucherPrompt = ai.definePrompt({
  name: 'processVoucherPrompt',
  input: { schema: ProcessVoucherInputSchema },
  output: { schema: VoucherExtractionSchema },
  config: { 
    temperature: 0.1,
  },
  prompt: `
You are a highly accurate retail voucher data-extraction system.

Your task is to inspect the supplied voucher document and extract its product rows.

DOCUMENT:
{{media url=photoDataUri}}

RULES:
1. BARCODE: Copy EXACTLY. Preserve leading zeros.
2. QUANTITY: Extract the RETURN quantity for that specific row.
3. ASSOCIATION: Ensure barcode and quantity come from the SAME row.
4. ACCURACY: If unsure about a row, omit it. Do not guess digits.

Set documentReadable to false if the image is blurred or not a voucher.
`,
});

/* -------------------------------------------------------------------------- */
/*                              SERVER ACTION                                 */
/* -------------------------------------------------------------------------- */

export async function processVoucher(
  input: ProcessVoucherInput
): Promise<ProcessVoucherOutput> {
  try {
    const { output } = await processVoucherPrompt(input);

    if (!output) {
      return { success: false, error: 'AI returned no structured data.', items: [] };
    }

    if (!output.documentReadable) {
      return { success: false, error: output.warning || 'Voucher not readable.', items: [] };
    }

    // Return plain object for Next.js serialization
    return {
      success: true,
      warning: output.warning,
      items: output.items,
    };
  } catch (error: any) {
    console.error('[Voucher AI] Error:', error);
    return { 
      success: false, 
      error: 'Registry analysis failed. Ensure API key is valid.', 
      items: [] 
    };
  }
}
