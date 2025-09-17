/**
 * @fileoverview This file initializes and configures the Genkit AI instance.
 * It sets up the necessary plugins (like Google AI) and exports a singleton 'ai' object
 * that can be used throughout the application to define and run AI flows.
 */

import { genkit, type Plugin } from 'genkit';
import { googleAI, type GoogleAIPluginParams } from '@genkit-ai/googleai';

// Determine if we are in a server-side environment
const isServer = typeof window === 'undefined';

const googleAIPluginConfig: GoogleAIPluginParams = {
  apiKey: process.env.GEMINI_API_KEY,
};

// Define the plugins to be used by Genkit
const plugins: Plugin[] = [
  googleAI(googleAIPluginConfig),
];

// Initialize Genkit with the defined plugins.
// This 'ai' object is the central point for interacting with Genkit.
export const ai = genkit({
  plugins,
  // Log metadata to the console in development for better debugging.
  // In a production environment, you would likely want to use a different logger.
  logConfig: isServer ? { channel: 'GCLOUD' } : { channel: 'console' },
  // Enable OpenTelemetry for tracing and metrics. This is useful for monitoring
  // the performance and behavior of your AI flows.
  enableTracing: true,
});
