import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Industrial AI Registry Configuration
 * Optimized for high-velocity multi-modal processing using Gemini 3.7 Flash.
 * This model provides superior visual reasoning for industrial documents and rapid response times.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  // Establish Gemini 3.7 Flash as the primary industrial analysis node
  model: googleAI.model('gemini-3.7-flash'),
});

export { z };
