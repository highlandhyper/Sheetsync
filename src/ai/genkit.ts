import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Industrial AI Registry Initialization
 * 
 * Configures Genkit to use Google AI (Gemini) for document extraction.
 * Requires GOOGLE_GENAI_API_KEY in the environment.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Optimized for industrial document and multimodal processing
  model: googleAI.model('gemini-1.5-flash'),
});

export { z };
