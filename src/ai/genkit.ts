import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { fallback } from '@genkit-ai/middleware';

/**
 * Central Genkit AI configuration.
 *
 * established as the primary industrial analysis node.
 * Integrated with fallback middleware for automatic model hand-off.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
    fallback.plugin()
  ],

  model: googleAI.model('gemini-flash-latest'),
});

export { z };