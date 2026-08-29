import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Industrial AI Registry Configuration
 * Optimized for high-velocity multimodal processing using Gemini 2.0 Flash.
 * This model provides superior visual reasoning for industrial documents.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  // Establish Gemini 2.0 Flash as the primary industrial analysis node
  model: googleAI.model('gemini-2.0-flash'),
});

export { z };
