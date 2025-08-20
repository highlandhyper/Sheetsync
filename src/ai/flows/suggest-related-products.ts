'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting related products based on items in the cart.
 *
 * - suggestRelatedProducts - A function that takes a list of product names and returns a list of suggested related product names.
 * - SuggestRelatedProductsInput - The input type for the suggestRelatedProducts function.
 * - SuggestRelatedProductsOutput - The return type for the suggestRelatedProducts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRelatedProductsInputSchema = z.object({
  cartItems: z
    .array(z.string())
    .describe('A list of product names currently in the cart.'),
});
export type SuggestRelatedProductsInput = z.infer<typeof SuggestRelatedProductsInputSchema>;

const SuggestRelatedProductsOutputSchema = z.object({
  suggestedProducts: z
    .array(z.string())
    .describe('A list of suggested related product names.'),
});
export type SuggestRelatedProductsOutput = z.infer<typeof SuggestRelatedProductsOutputSchema>;

export async function suggestRelatedProducts(input: SuggestRelatedProductsInput): Promise<SuggestRelatedProductsOutput> {
  return suggestRelatedProductsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRelatedProductsPrompt',
  input: {schema: SuggestRelatedProductsInputSchema},
  output: {schema: SuggestRelatedProductsOutputSchema},
  prompt: `You are a helpful shopping assistant. Given a list of items in a user's cart, suggest other related products that the user might be interested in buying.  Return ONLY the names of the products, and nothing else. Do not explain your reasoning.

Cart Items:
{{#each cartItems}}- {{{this}}}
{{/each}}`,
});

const suggestRelatedProductsFlow = ai.defineFlow(
  {
    name: 'suggestRelatedProductsFlow',
    inputSchema: SuggestRelatedProductsInputSchema,
    outputSchema: SuggestRelatedProductsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
