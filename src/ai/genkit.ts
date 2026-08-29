import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Central Genkit AI configuration.
 *
 * Gemini 3.7 Flash is used as the default model for fast,
 * high-volume multimodal document and image processing.
 */
export const ai = genkit({
  plugins: [googleAI()],

  model: googleAI.model('gemini-3.7-flash'),
});

export { z };