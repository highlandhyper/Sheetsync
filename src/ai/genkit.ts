import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Industrial AI Registry Configuration
 * Explicitly binds to GEMINI_API_KEY for cloud identity verification.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  // Optimized for industrial document and multimodal processing
  model: googleAI.model('gemini-1.5-flash'),
});

export { z };