'use server';
/**
 * @fileOverview Industrial Return Voucher AI Processor.
 * Uses Tesseract.js for primary character extraction and Gemini for spatial reasoning.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Tesseract from 'tesseract.js';

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

/**
 * Local Character Recognition Node
 * Optimized for English alphanumeric industrial documents.
 */
async function performLocalOCR(dataUri: string): Promise<string> {
    try {
        console.log("AI Terminal: Initializing Tesseract Node...");
        const { data: { text } } = await Tesseract.recognize(dataUri, 'eng');
        return text || "";
    } catch (e) {
        console.error("Local OCR Node Failure:", e);
        return "";
    }
}

async function extractWithOcrSpace(dataUri: string): Promise<string> {
    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) return "";

    try {
        const formData = new URLSearchParams();
        formData.append('base64Image', dataUri);
        formData.append('apikey', apiKey);
        formData.append('isTable', 'true');
        formData.append('OCREngine', '2');

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const result = await response.json();
        return result.ParsedResults?.[0]?.ParsedText || "";
    } catch (e) {
        return "";
    }
}

const prompt = ai.definePrompt({
  name: 'processVoucherPrompt',
  input: { schema: ProcessVoucherInputSchema.extend({ ocrText: z.string().optional(), ocrSpaceText: z.string().optional() }) },
  output: { schema: ProcessVoucherOutputSchema },
  prompt: `You are an industrial data entry specialist. Analyze this return voucher document.

MULTIMODAL FUSION PROTOCOL:
1. **Primary Text Layer**: Use the provided OCR text as the authoritative source for numeric characters (SKUs and Quantities).
2. **Visual Spatial Layer**: Use the image to verify which quantity belongs to which barcode by looking at row alignment.

Tesseract OCR Found:
{{{ocrText}}}

Supplemental Cloud OCR Found:
{{{ocrSpaceText}}}

Input Image: {{media url=photoDataUri}}

GOAL: Extract all SKU/Barcode entries and their corresponding Return Quantities.
- If a barcode is missing, provide the product name.
- If a quantity is written as "1 case of 12", return 12.
- Only return valid JSON matching the schema.`,
});

/**
 * Industrial AI Processor with Multi-Layer Extraction & Retry Logic
 */
export async function processVoucher(input: ProcessVoucherInput): Promise<ProcessVoucherOutput> {
  const MAX_RETRIES = 2;
  let lastError = "";

  // Tier 1: Local Character Extraction (Fast)
  const ocrText = await performLocalOCR(input.photoDataUri);
  
  // Tier 2: Cloud Supplemental Extraction (High-Fidelity)
  const ocrSpaceText = await extractWithOcrSpace(input.photoDataUri);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
        console.log(`AI Terminal: Extraction Attempt ${attempt}/${MAX_RETRIES}...`);
        
        // Tier 3: AI Spatial Reasoning
        const { output } = await prompt({ ...input, ocrText, ocrSpaceText });
        
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
